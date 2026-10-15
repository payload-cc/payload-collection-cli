#!/usr/bin/env node
import { getPayload } from "payload";
import { createJiti } from "jiti";
import path from "path";
import fs from "fs";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import { execute } from "./executor";
import { COMMANDS, validateInvocation } from "./commands";
import { CLI_OPTIONS, yargsOptions } from "./cli-options";
import { flushOutput, runWithCompletionGuard } from "./completion";
import { PayloadCollectionCLIError, ERROR_TIPS } from "./errors";

// Prefer the project runtime loader (tsx / native ESM) and its module cache.
// Jiti 2.7 falls back to transpilation when native TypeScript loading is unavailable.
const dataOutput = process.stdout.write.bind(process.stdout);

async function printJSON(value: unknown) {
	await new Promise<void>((resolve, reject) => dataOutput(JSON.stringify(value) + "\n", (error) => error ? reject(error) : resolve()));
}

const jiti = createJiti(import.meta.url, { tryNative: true });

const MappingConfigSchema = z.object({
	lookupField: z.string().default("id"),
	onNotFound: z.enum(["error", "ignore", "create"]).default("error"),
	defaults: z.record(z.string(), z.any()).optional(),
});

const CLIConfigSchema = z.object({
	mappings: z.record(z.string(), MappingConfigSchema).default({}),
});

async function handleError(err: any) {
	if (err instanceof PayloadCollectionCLIError) {
		console.error(`error: [${err.slug}] ${err.message}`);
		const tip = ERROR_TIPS[err.slug];
		if (tip) {
			console.error(`\ntip: ${tip}`);
		}
		// Convert slug to a potential anchor link (approximate)
		const anchor = err.slug.toLowerCase().replace(/_/g, "-");
		console.error(`refer to: docs/references/errors.md#${anchor}`);
	} else {
		console.error("error: fatal:", err.message);
		if (err.stack && process.env.DEBUG) {
			console.error(err.stack);
		}
	}
	process.exitCode = 1;
	await flushOutput();
	process.exit(1);
}

async function run() {
	if (process.env.DEBUG) console.error("starting cli...");
	const root = process.cwd();

	const argv = await yargs(hideBin(process.argv))
		.usage("Usage: $0 [options] <collection-slug> <operation> [input]")
		.parserConfiguration({ "parse-positional-numbers": false })
		.options(yargsOptions())
		.pkgConf("payload-collection-cli")
		.strictOptions()
		.help()
		.parseSync();

	if (argv.describe) {
		await printJSON({ commands: COMMANDS, options: CLI_OPTIONS });
		await flushOutput();
		process.exit(0);
	}
	if (argv._.length > 3) throw new PayloadCollectionCLIError("INPUT_PARSE_FAILED", "Expected at most three positional arguments.");
	if (process.env.DEBUG) console.error("parsed arguments:", JSON.stringify(argv, null, 2));

	const {
		configFile,
		configJson,
		configExportName,
		_: [collection, action, input],
	} = argv as any;

	validateInvocation(collection, action, input);
	const reading = COMMANDS[action].output === "json";
	if (reading) {
		// Reserve the original stdout for one JSON value, including config/init logs.
		process.stdout.write = process.stderr.write.bind(process.stderr);
	}

	let rawConfig: any = { mappings: {} };

	// Priority: configJson (CLI/pkg) > configFile (CLI/pkg)
	if (configJson) {
		try {
			rawConfig =
				typeof configJson === "string" ? JSON.parse(configJson) : configJson;
		} catch (err: any) {
			throw new PayloadCollectionCLIError(
				"CONFIG_INVALID",
				`Failed to parse inline JSON config: ${err.message}`,
			);
		}
	} else if (configFile) {
		const customConfigPath = path.resolve(root, configFile);
		if (!fs.existsSync(customConfigPath)) {
			throw new PayloadCollectionCLIError(
				"CONFIG_NOT_FOUND",
				`Config file not found at ${customConfigPath}`,
			);
		}
		const imported = (await jiti.import(customConfigPath)) as any;

		// Strictly use named export only, no default export fallback
		if (imported[configExportName]) {
			rawConfig = imported[configExportName];
		} else {
			throw new PayloadCollectionCLIError(
				"CONFIG_EXPORT_NOT_FOUND",
				`Named export "${configExportName}" not found in ${configFile}`,
			);
		}
	}

	// Validate the configuration using Zod
	const validation = CLIConfigSchema.safeParse(rawConfig);
	if (!validation.success) {
		const messages = validation.error.issues
			.map((issue) => `[${issue.path.join(".")}] ${issue.message}`)
			.join("\n  - ");
		throw new PayloadCollectionCLIError(
			"CONFIG_INVALID",
			`Invalid configuration structure:\n  - ${messages}`,
		);
	}
	const cliConfig = validation.data;

	// Auto-discover payload.config
	const configPath = [
		path.resolve(root, "src/payload.config.ts"),
		path.resolve(root, "payload.config.ts"),
	].find((p) => fs.existsSync(p));

	if (!configPath) {
		throw new PayloadCollectionCLIError(
			"PAYLOAD_CONFIG_NOT_FOUND",
			"payload.config.ts not found.",
		);
	}
	if (process.env.DEBUG) console.error(`loading payload config from: ${configPath}`);

	const { default: payloadConfig } = (await jiti.import(configPath)) as any;
	const payload = await getPayload({ config: payloadConfig });
	if (!payload) {
		throw new PayloadCollectionCLIError(
			"PAYLOAD_INIT_FAILED",
			"Failed to initialize Payload.",
		);
	}
	if (process.env.DEBUG) console.error("connected to payload");

	let result: unknown;
	try {
		result = await execute(
			payload,
			collection as string,
			action as any,
			input as string,
			cliConfig as any,
		);
	} finally {
		await payload.destroy();
	}
	if (reading) await printJSON(result);
	else console.log("Operation successful");
	// Drain both streams before exiting, even if application hooks retain handles.
	process.exitCode = 0;
	await flushOutput();
	process.exit(0);
}

runWithCompletionGuard(run).catch(handleError);

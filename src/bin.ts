#!/usr/bin/env node
import { getPayload } from "payload";
import { createJiti } from "jiti";
import path from "path";
import fs from "fs";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import { execute } from "./executor";
import { PayloadCollectionCLIError, ERROR_TIPS } from "./errors";

const jiti = createJiti(import.meta.url);

const MappingConfigSchema = z.object({
	lookupField: z.string().default("id"),
	onNotFound: z.enum(["error", "ignore", "create"]).default("error"),
	defaults: z.record(z.string(), z.any()).optional(),
});

const CLIConfigSchema = z.object({
	mappings: z.record(z.string(), MappingConfigSchema).default({}),
});

function handleError(err: any) {
	if (err instanceof PayloadCollectionCLIError) {
		console.error(`❌ [${err.slug}] ${err.message}`);
		const tip = ERROR_TIPS[err.slug];
		if (tip) {
			console.error(`\nTip: ${tip}`);
		}
		// Convert slug to a potential anchor link (approximate)
		const anchor = err.slug.toLowerCase().replace(/_/g, "-");
		console.error(`Refer to: docs/references/errors.md#${anchor}`);
	} else {
		console.error("❌ Fatal Error:", err.message);
		if (err.stack && process.env.DEBUG) {
			console.error(err.stack);
		}
	}
	process.exit(1);
}

async function run() {
	console.log("🏁 Starting CLI...");
	const root = process.cwd();

	const argv = await yargs(hideBin(process.argv))
		.usage("Usage: $0 [options] <collection-slug> <operation> <file or string>")
		.options({
			"config-file": {
				alias: "c",
				type: "string",
				describe: "Path to a configuration file (named export required).",
			},
			"config-json": {
				alias: "j",
				type: "string",
				describe: "Inline JSON string for configuration.",
			},
			"config-export-name": {
				alias: "n",
				type: "string",
				describe: "The name of the export to use from the configuration file.",
				default: "cliConfig",
			},
		})
		.pkgConf("payload-collection-cli")
		.demandCommand(3, "Collection slug, operation, and input are required.")
		.help()
		.parseSync();

	console.log("📊 Parsed arguments:", JSON.stringify(argv, null, 2));

	const {
		configFile,
		configJson,
		configExportName,
		_: [collection, action, input],
	} = argv as any;

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
	console.log(`📖 Loading payload config from: ${configPath}`);

	const { default: payloadConfig } = (await jiti.import(configPath)) as any;
	const payload = await getPayload({ config: payloadConfig });
	if (!payload) {
		throw new PayloadCollectionCLIError(
			"PAYLOAD_INIT_FAILED",
			"Failed to initialize Payload.",
		);
	}
	console.log("✅ Connected to Payload");

	await execute(
		payload,
		collection as string,
		action as any,
		input as string,
		cliConfig as any,
	);
	console.log("✨ Operation successful");
	process.exit(0);
}

run().catch(handleError);

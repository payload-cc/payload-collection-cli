import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	ACTIONS,
	COMMANDS,
	validateInvocation,
	type Action,
} from "../commands";
import { CLI_OPTIONS } from "../cli-options";
import { failure, result } from "./result";
import { packageVersion } from "./docs";
import type { Runner } from "./runner";

export const executionOptions = Object.entries(CLI_OPTIONS).filter(
	([, option]) => option.safety !== "discovery",
);
const optionShape = Object.fromEntries(
	executionOptions.map(([name, option]) => {
		const definition = option as {
			type: string;
			describe: string;
			json?: boolean;
		};
		let schema: z.ZodType =
			definition.type === "boolean"
				? z.boolean()
				: definition.type === "number"
					? z.number().finite()
					: z.string();
		if (definition.json)
			schema = z.union([z.string(), z.record(z.string(), z.json())]);
		return [name, schema.describe(definition.describe).optional()];
	}),
);
export const toolInputSchema = z
	.object({
		collection: z.string().trim().min(1),
		input: z
			.string()
			.optional()
			.describe(
				"Raw CLI input: JSON string or supported JSON/JSONL/patch file path. Mutually exclusive with data.",
			),
		data: z
			.json()
			.optional()
			.describe(
				"JSON value serialized once as CLI input; use input instead for file paths or raw JSONL.",
			),
		options: z.object(optionShape).strict().optional(),
	})
	.strict();
export interface WrapperOptions {
	runner: Runner;
	allowWrite?: boolean;
	allowConfigFiles?: boolean;
}

export function actionArguments(
	action: Action,
	args: z.infer<typeof toolInputSchema>,
	allowConfigFiles = false,
): string[] {
	if (args.input !== undefined && args.data !== undefined)
		throw new Error("Supply input or data, not both.");
	const input =
		args.data === undefined ? args.input : JSON.stringify(args.data);
	validateInvocation(args.collection, action, input);
	const flags: string[] = [];
	for (const [name, definition] of executionOptions) {
		const value = args.options?.[name];
		if (value === undefined) continue;
		if (definition.safety === "code" && !allowConfigFiles)
			throw new Error(
				`Option --${name} requires server startup --allow-config-files (executes trusted code).`,
			);
		// Unknown safety classifications must never silently become executable options.
		if (definition.safety !== "code" && definition.safety !== "data")
			throw new Error(`Unsupported option safety: ${name}`);
		flags.push(
			`--${name}`,
			typeof value === "object" ? JSON.stringify(value) : String(value),
		);
	}
	return [
		...flags,
		"--",
		args.collection,
		action,
		...(input === undefined ? [] : [input]),
	];
}

/** One tool per command, generated from exactly the CLI's registry. */
export function createWrapperServer(options: WrapperOptions) {
	const server = new McpServer({
		name: "payload-collection-cli",
		version: packageVersion,
	});
	server.registerTool(
		"cli_describe",
		{
			description:
				"Discover all CLI commands/options and server permissions without opening Payload.",
			inputSchema: z.object({}).strict(),
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async () =>
			result({
				commands: COMMANDS,
				options: CLI_OPTIONS,
				permissions: {
					allowWrite: options.allowWrite === true,
					allowConfigFiles: options.allowConfigFiles === true,
				},
			}),
	);
	for (const action of ACTIONS) {
		const command = COMMANDS[action];
		server.registerTool(
			`cli_${action}`,
			{
				description: `${command.description} Runs the trusted project's privileged Payload Local API. ${command.readOnly ? "" : "Requires server startup --allow-write."}`,
				inputSchema: toolInputSchema,
				annotations: {
					readOnlyHint: command.readOnly === true,
					destructiveHint: command.destructive !== false,
					openWorldHint: true,
				},
			},
			async (args, extra) => {
				try {
					if (command.readOnly !== true && options.allowWrite !== true)
						throw new Error(
							"Write operations are disabled. Restart the server with --allow-write to authorize them.",
						);
					const argv = actionArguments(action, args, options.allowConfigFiles);
					const output = await options.runner.run(argv, extra.signal);
					if (output.error || output.exitCode !== 0 || output.signal)
						return result({ ...output }, true);
					if (command.output !== "json") return result({ ...output });
					try {
						return result({ ...output, result: JSON.parse(output.stdout) });
					} catch {
						return result(
							{ ...output, error: "CLI command returned invalid JSON." },
							true,
						);
					}
				} catch (error) {
					return failure(error);
				}
			},
		);
	}
	return server;
}

import type { Options } from "yargs";

interface CLIOption extends Options {
	type: "string" | "boolean" | "number";
	safety: "data" | "code" | "discovery";
	json?: boolean;
}

/** Both the CLI parser and MCP schemas/argv are generated from this catalog. */
export const CLI_OPTIONS = {
	describe: {
		type: "boolean",
		describe: "Print the command catalog as JSON without opening Payload.",
		safety: "discovery",
	},
	"config-file": {
		alias: "c",
		type: "string",
		describe: "Path to a configuration file (named export required).",
		safety: "code",
	},
	"config-json": {
		alias: "j",
		type: "string",
		describe: "Inline JSON string for configuration.",
		safety: "data",
		json: true,
	},
	"config-export-name": {
		alias: "n",
		type: "string",
		describe: "The name of the export to use from the configuration file.",
		default: "cliConfig",
		safety: "data",
	},
} as const satisfies Record<string, CLIOption>;

export function yargsOptions(): Record<string, Options> {
	return Object.fromEntries(
		Object.entries(CLI_OPTIONS).map(([name, definition]) => {
			const { safety, json, ...option } = definition as CLIOption;
			return [name, option];
		}),
	);
}

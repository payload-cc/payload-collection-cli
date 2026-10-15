#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { CLIRunner } from "./mcp/runner";
import { createWrapperServer } from "./mcp/wrapper";

async function run() {
	const args = yargs(hideBin(process.argv))
		.options({
			"project-root": {
				type: "string",
				demandOption: true,
				describe: "Absolute path to the trusted Payload project.",
			},
			"allow-write": {
				type: "boolean",
				default: false,
				describe: "Allow all editing operations, including delete and sync.",
			},
			"allow-config-files": {
				type: "boolean",
				default: false,
				describe: "Allow tools to import trusted executable CLI config files.",
			},
			"timeout-ms": {
				type: "number",
				default: 300000,
				describe: "Per-operation timeout (1..3600000 ms).",
			},
		})
		.strict()
		.help()
		.parseSync();
	const runner = new CLIRunner({
		projectRoot: args.projectRoot,
		cliPath: fileURLToPath(new URL("./bin.js", import.meta.url)),
		timeoutMs: args.timeoutMs,
	});
	const server = createWrapperServer({
		runner,
		allowWrite: args.allowWrite,
		allowConfigFiles: args.allowConfigFiles,
	});
	server.server.onclose = () => runner.close();
	let closing = false;
	const close = async () => {
		if (closing) return;
		closing = true;
		runner.close();
		await server.close();
	};
	process.stdin.once("end", close);
	process.once("exit", () => runner.close());
	process.once("SIGINT", close);
	process.once("SIGTERM", close);
	await server.connect(new StdioServerTransport());
}
run().catch((error) => {
	console.error("CLI MCP startup failed:", error);
	process.exitCode = 1;
});

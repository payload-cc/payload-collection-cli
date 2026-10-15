import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(path.join(os.tmpdir(), "payload-cli-package-"));
const clients = [];
try {
	execFileSync("pnpm", ["pack", "--pack-destination", temporary], {
		cwd: root,
		stdio: "pipe",
	});
	const tarball = readdirSync(temporary).find((name) => name.endsWith(".tgz"));
	assert(tarball, "pnpm pack must produce an archive");
	execFileSync("tar", ["-xzf", path.join(temporary, tarball), "-C", temporary]);
	const packaged = path.join(temporary, "package");
	// Resolve installed dependencies without accessing source docs/configs.
	symlinkSync(
		path.join(root, "node_modules"),
		path.join(packaged, "node_modules"),
		"dir",
	);
	const pkg = JSON.parse(
		readFileSync(path.join(packaged, "package.json"), "utf8"),
	);
	assert.equal(
		typeof (await import(pathToFileURL(path.join(packaged, pkg.module)).href))
			.execute,
		"function",
	);
	execFileSync(
		process.execPath,
		[
			"-e",
			"if(typeof require(process.argv[1]).execute !== 'function') process.exit(1)",
			packaged,
		],
		{ cwd: temporary },
	);
	const describe = JSON.parse(
		execFileSync(
			process.execPath,
			[path.join(packaged, pkg.bin["payload-collection-cli"]), "--describe"],
			{ cwd: temporary, encoding: "utf8" },
		),
	);
	async function connect(binary, args = []) {
		const client = new Client({ name: "package-smoke", version: "1" });
		clients.push(client);
		await client.connect(
			new StdioClientTransport({
				command: process.execPath,
				args: [path.join(packaged, pkg.bin[binary]), ...args],
				cwd: temporary,
				stderr: "inherit",
			}),
		);
		return client;
	}
	const docs = await connect("payload-collection-docs-mcp");
	const page = await docs.callTool({
		name: "docs_get",
		arguments: { id: "docs/references/mcp.md" },
	});
	assert(
		!page.isError && page.structuredContent.text.includes("--allow-write"),
	);
	const examples = await docs.callTool({
		name: "docs_get",
		arguments: { id: "docs/examples.md" },
	});
	assert(
		!examples.structuredContent.text.includes("[[SCENARIO_EXAMPLES_BUNDLE]]"),
	);
	const wrapper = await connect("payload-collection-mcp", [
		"--project-root",
		temporary,
	]);
	const catalog = await wrapper.callTool({
		name: "cli_describe",
		arguments: {},
	});
	assert.deepEqual(catalog.structuredContent.commands, describe.commands);
	assert.deepEqual(catalog.structuredContent.options, describe.options);
	const tools = (await wrapper.listTools()).tools
		.map((tool) => tool.name)
		.sort();
	assert.deepEqual(
		tools,
		[
			"cli_describe",
			...Object.keys(describe.commands).map((action) => `cli_${action}`),
		].sort(),
	);
	console.log(
		"Packed CJS/ESM library, CLI discovery and both stdio MCP entrypoints passed.",
	);
} finally {
	await Promise.all(clients.map((client) => client.close()));
	rmSync(temporary, { recursive: true, force: true });
}

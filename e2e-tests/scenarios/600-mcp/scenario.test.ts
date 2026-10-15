import { afterEach, beforeEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ACTIONS } from "../../../src/commands";
import {
	e2eDir,
	getCollectionData,
	payloadAppDir,
	resetDatabase,
} from "../../utils";
const clients: Client[] = [];
beforeEach(resetDatabase);
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
});
async function connect(bin: string, args: string[] = []) {
	const client = new Client({ name: "e2e", version: "1" });
	clients.push(client);
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	);
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [path.resolve(e2eDir, `../dist/${bin}.js`), ...args],
		cwd: e2eDir,
		env: {
			...env,
			PAYLOAD_SECRET: "e2e-only-not-a-production-secret-at-least-32-chars",
			DATABASE_URL: `file:${path.join(payloadAppDir, "payload.db")}`,
			PAYLOAD_TELEMETRY_DISABLED: "1",
		},
		stderr: "pipe",
	});
	let logs = "";
	transport.stderr?.on("data", (chunk) => {
		logs += chunk.toString();
	});
	try {
		await client.connect(transport);
	} catch (error) {
		throw new Error(`${error}\n${logs}`);
	}
	return client;
}
async function call(
	client: Client,
	action: string,
	args: Record<string, unknown>,
	expectedError = false,
) {
	const reply = await client.callTool(
		{ name: `cli_${action}`, arguments: { collection: "categories", ...args } },
		undefined,
		{ timeout: 55000 },
	);
	expect(reply.isError === true, JSON.stringify(reply)).toBe(expectedError);
	return reply.structuredContent as Record<string, any>;
}
it("serves embedded docs over built stdio without a Payload config or DB", async () => {
	const client = await connect("docs-mcp");
	const documents = (
		await client.callTool({ name: "docs_list", arguments: {} })
	).structuredContent?.documents as { id: string }[];
	expect(documents.map((doc) => doc.id)).toContain("docs/references/mcp.md");
	for (const id of [
		"README.md",
		"docs/examples.md",
		"docs/ai.md",
		"generated/command-catalog.md",
	]) {
		const reply = await client.callTool({
			name: "docs_get",
			arguments: { id },
		});
		expect(reply.isError).not.toBe(true);
		expect(reply.structuredContent?.text).not.toMatch(
			/\[\[(SCENARIO_EXAMPLES_BUNDLE|AI_CONTEXT_BUNDLE)\]\]/,
		);
	}
	expect(
		(
			await client.callTool({
				name: "docs_search",
				arguments: { query: "--allow-write" },
			})
		).structuredContent?.total,
	).toBeGreaterThan(0);
	const resources = (await client.listResources()).resources;
	expect(resources.length).toBe(documents.length);
	expect(
		(await client.readResource({ uri: resources[0].uri })).contents[0].text,
	).toBeTruthy();
});
it("discovers every action, denies writes/config code by default and preserves CLI failures", async () => {
	const client = await connect("cli-mcp", ["--project-root", payloadAppDir]);
	expect(
		(await client.listTools()).tools.map((tool) => tool.name).sort(),
	).toEqual(
		["cli_describe", ...ACTIONS.map((action) => `cli_${action}`)].sort(),
	);
	await call(client, "create", { data: { name: "denied" } }, true);
	await call(
		client,
		"count",
		{ options: { "config-file": "./not-imported.ts" } },
		true,
	);
	expect((await call(client, "count", {})).result).toEqual({ totalDocs: 0 });
	const failed = await call(client, "get", { data: { id: 999999 } }, true);
	expect(failed.exitCode).toBe(1);
	expect(failed.stderr).toContain("DOCUMENT_NOT_FOUND");
	expect(getCollectionData("categories")).toEqual([]);
});
it("wraps create/update/upsert/patch plus all reads with literal argv and custom named config", async () => {
	const client = await connect("cli-mcp", [
		"--project-root",
		payloadAppDir,
		"--allow-write",
		"--allow-config-files",
	]);
	const config = path.join(payloadAppDir, "mcp config with spaces.ts");
	writeFileSync(
		config,
		'console.log("CONFIG_LOG"); export const named = { mappings: { categories: { lookupField: "name" } } };',
	);
	const options = { "config-file": config, "config-export-name": "named" };
	const filename = path.join(payloadAppDir, "mcp data with spaces.jsonl");
	writeFileSync(filename, JSON.stringify({ name: "Alpha ';$(echo literal)" }));
	await call(client, "create", { input: filename, options });
	await call(client, "update", {
		data: { name: "Alpha ';$(echo literal)" },
		options,
	});
	await call(client, "upsert", { data: { name: "Beta" }, options });
	await call(client, "patch", {
		data: [{ op: "replace", path: "/[name=Beta]/name", value: "Gamma" }],
		options,
	});
	const list = await call(client, "list", { data: { sort: "name" }, options });
	expect(list.result.docs.map((doc: any) => doc.name)).toEqual([
		"Alpha ';$(echo literal)",
		"Gamma",
	]);
	expect(list.stderr).toContain("CONFIG_LOG");
	expect(
		(await call(client, "get", { data: "Gamma", options })).result.name,
	).toBe("Gamma");
	expect(
		(
			await call(client, "find", {
				data: { where: { name: { equals: "Gamma" } } },
				options,
			})
		).result.totalDocs,
	).toBe(1);
	expect((await call(client, "count", { options })).result.totalDocs).toBe(2);
});
it("wraps destructive sync and delete only when authorized", async () => {
	const client = await connect("cli-mcp", [
		"--project-root",
		payloadAppDir,
		"--allow-write",
	]);
	const options = {
		"config-json": { mappings: { categories: { lookupField: "name" } } },
	};
	await call(client, "create", { data: { name: "Remove me" } });
	await call(client, "sync", { data: [{ name: "Kept" }], options });
	expect(getCollectionData("categories").map((doc) => doc.name)).toEqual([
		"Kept",
	]);
	await call(client, "delete", { data: { name: "Kept" }, options });
	expect(getCollectionData("categories")).toEqual([]);
});

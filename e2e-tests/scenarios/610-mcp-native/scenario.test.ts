import { afterEach, beforeEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { NATIVE_COMMANDS } from "../../../src/native-commands";
import { e2eDir, payloadAppDir, resetDatabase } from "../../utils";
const clients: Client[] = [];
beforeEach(resetDatabase);
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
});
async function connect(allowWrite = false) {
	const client = new Client({ name: "native-e2e", version: "1" });
	clients.push(client);
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	);
	await client.connect(
		new StdioClientTransport({
			command: process.execPath,
			args: [
				path.resolve(e2eDir, "../dist/cli-mcp.js"),
				"--project-root",
				payloadAppDir,
				...(allowWrite ? ["--allow-write"] : []),
			],
			cwd: e2eDir,
			env: {
				...env,
				PAYLOAD_SECRET: "e2e-only-not-a-production-secret-at-least-32-chars",
				DATABASE_URL: `file:${path.join(payloadAppDir, "payload.db")}`,
				PAYLOAD_TELEMETRY_DISABLED: "1",
			},
			stderr: "inherit",
		}),
	);
	return client;
}
async function call(
	client: Client,
	action: string,
	data?: unknown,
	expectedError = false,
) {
	const reply = await client.callTool(
		{
			name: `cli_${action}`,
			arguments: {
				collection: "categories",
				...(data === undefined ? {} : { data }),
			},
		},
		undefined,
		{ timeout: 55000 },
	);
	expect(reply.isError === true, JSON.stringify(reply)).toBe(expectedError);
	return reply.structuredContent as Record<string, any>;
}
it("automatically discovers/gates new native writes and returns duplicate IDs as parsed JSON", async () => {
	const readonly = await connect();
	const tools = (await readonly.listTools()).tools;
	for (const [action, command] of Object.entries(NATIVE_COMMANDS)) {
		expect(tools.some((tool) => tool.name === `cli_${action}`)).toBe(true);
		if (!command.readOnly) {
			const denied = await call(readonly, action, { id: 1, data: {} }, true);
			expect(denied.error).toContain("disabled");
		}
	}
	const client = await connect(true);
	const original = (
		await call(client, "createOne", {
			data: { name: "Original", displayName: "Shared" },
		})
	).result;
	const copy = (
		await call(client, "duplicate", { id: original.id, data: { name: "Copy" } })
	).result;
	expect(copy.id).not.toBe(original.id);
	expect(copy.displayName).toBe("Shared");
	expect((await call(client, "findByID", { id: copy.id })).result.name).toBe(
		"Copy",
	);
	expect(
		(await call(client, "findDistinct", { field: "displayName" })).result
			.values,
	).toEqual([{ displayName: "Shared" }]);
});
it("preserves native partial-write and empty-filter errors over the real protocol", async () => {
	const client = await connect(true);
	const file = path.join(payloadAppDir, "mcp-native-bulk.jsonl");
	writeFileSync(
		file,
		["A", "B"].map((name) => JSON.stringify({ name })).join("\n"),
	);
	const seeded = await client.callTool(
		{
			name: "cli_create",
			arguments: { collection: "categories", input: file },
		},
		undefined,
		{ timeout: 55000 },
	);
	expect(seeded.isError).not.toBe(true);
	const partial = await call(
		client,
		"updateMany",
		{ where: { name: { in: ["A", "B"] } }, data: { name: "Collision" } },
		true,
	);
	expect(partial.exitCode).toBe(1);
	expect(partial.stderr).toContain("OPERATION_PARTIAL_FAILURE");
	expect(
		(await call(client, "deleteMany", { where: {} }, true)).stderr,
	).toContain("allowAll");
	expect(
		(await call(client, "deleteMany", { where: {}, allowAll: true })).result
			.docs,
	).toHaveLength(2);
	expect((await call(client, "count")).result.totalDocs).toBe(0);
});

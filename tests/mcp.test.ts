import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ACTIONS, COMMANDS } from "../src/commands";
import { CLI_OPTIONS } from "../src/cli-options";
import { createDocsServer, documentURI } from "../src/mcp/docs";
import {
	actionArguments,
	createWrapperServer,
	toolInputSchema,
} from "../src/mcp/wrapper";

const clients: Client[] = [];
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
});
async function connect(server: ReturnType<typeof createDocsServer>) {
	const [left, right] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "test", version: "1" });
	clients.push(client);
	await server.connect(right);
	await client.connect(left);
	return client;
}
const successful = {
	stdout: '{"totalDocs":3}\n',
	stderr: "application log",
	exitCode: 0,
	signal: null,
};

it("supports real protocol initialization, tools, search and static resources without Payload", async () => {
	const client = await connect(
		createDocsServer([
			{ id: "README.md", text: "# CLI\nUse count for totals." },
		]),
	);
	expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
		"docs_list",
		"docs_get",
		"docs_search",
	]);
	const list = await client.callTool({ name: "docs_list", arguments: {} });
	expect(list.structuredContent?.documents).toHaveLength(2);
	expect(
		(
			await client.callTool({
				name: "docs_get",
				arguments: { id: "README.md" },
			})
		).structuredContent,
	).toEqual({ id: "README.md", text: "# CLI\nUse count for totals." });
	expect(
		(
			await client.callTool({
				name: "docs_search",
				arguments: { query: "COUNT", limit: 1 },
			})
		).structuredContent?.matches,
	).toHaveLength(1);
	expect(
		(
			await client.callTool({
				name: "docs_get",
				arguments: { id: "../../secret" },
			})
		).isError,
	).toBe(true);
	expect((await client.listResources()).resources).toHaveLength(2);
	expect(
		(await client.readResource({ uri: documentURI("README.md") })).contents[0]
			.text,
	).toContain("count");
	expect(
		(
			await client.readResource({
				uri: documentURI("generated/command-catalog.md"),
			})
		).contents[0].text,
	).toContain('"sync"');
});
it("generates exactly the current CLI actions and option schemas, with safety annotations", async () => {
	const run = vi.fn().mockResolvedValue(successful);
	const client = await connect(createWrapperServer({ runner: { run } }));
	const tools = (await client.listTools()).tools;
	expect(tools.map((tool) => tool.name).sort()).toEqual(
		["cli_describe", ...ACTIONS.map((action) => `cli_${action}`)].sort(),
	);
	for (const action of ACTIONS) {
		const tool = tools.find((tool) => tool.name === `cli_${action}`)!;
		expect(tool.annotations?.readOnlyHint).toBe(COMMANDS[action].readOnly);
		expect(tool.annotations?.destructiveHint).toBe(
			COMMANDS[action].destructive,
		);
		const schema = tool.inputSchema.properties?.options as {
			properties: Record<string, unknown>;
		};
		expect(Object.keys(schema.properties).sort()).toEqual(
			Object.entries(CLI_OPTIONS)
				.filter(([, definition]) => definition.safety !== "discovery")
				.map(([name]) => name)
				.sort(),
		);
	}
	const discovery = await client.callTool({
		name: "cli_describe",
		arguments: {},
	});
	expect(discovery.structuredContent?.commands).toEqual(COMMANDS);
	expect(discovery.structuredContent?.options).toEqual(CLI_OPTIONS);
	expect(run).not.toHaveBeenCalled();
});
it.each(
	ACTIONS,
)("routes %s through the same argv runner when authorized", async (action) => {
	const run = vi.fn().mockResolvedValue(successful);
	const client = await connect(
		createWrapperServer({ runner: { run }, allowWrite: true }),
	);
	const reply = await client.callTool({
		name: `cli_${action}`,
		arguments: { collection: "items", data: { name: "';$(echo unsafe)" } },
	});
	expect(reply.isError).not.toBe(true);
	expect(run.mock.calls[0][0]).toEqual([
		"--",
		"items",
		action,
		JSON.stringify({ name: "';$(echo unsafe)" }),
	]);
});
it.each(
	ACTIONS.filter((action) => !COMMANDS[action].readOnly),
)("refuses %s by default without spawning", async (action) => {
	const run = vi.fn();
	const client = await connect(createWrapperServer({ runner: { run } }));
	expect(
		(
			await client.callTool({
				name: `cli_${action}`,
				arguments: { collection: "items", data: {} },
			})
		).isError,
	).toBe(true);
	expect(run).not.toHaveBeenCalled();
});
it("accepts all config flags, JSON objects and literal file arguments only with code-import opt-in", () => {
	const args = toolInputSchema.parse({
		collection: "items",
		input: "./input with spaces.jsonl",
		options: {
			"config-file": "./config with spaces.ts",
			"config-json": { mappings: {} },
			"config-export-name": "custom",
		},
	});
	expect(() => actionArguments("create", args)).toThrow("allow-config-files");
	expect(actionArguments("create", args, true)).toEqual([
		"--config-file",
		"./config with spaces.ts",
		"--config-json",
		'{"mappings":{}}',
		"--config-export-name",
		"custom",
		"--",
		"items",
		"create",
		"./input with spaces.jsonl",
	]);
	expect(
		actionArguments(
			"get",
			toolInputSchema.parse({ collection: "items", data: null }),
		),
	).toEqual(["--", "items", "get", "null"]);
});
it.each([
	{ collection: "items", cwd: "/tmp" },
	{ collection: "items", env: { SECRET: "x" } },
	{ collection: "items", options: { arbitrary: "--shell" } },
	{ collection: "items", input: "{}", data: {} },
	{ collection: "items", options: { "config-file": "./untrusted.ts" } },
	{ collection: "items", options: { "config-json": 3 } },
])("rejects invalid/unsafe arguments without running: %j", async (args) => {
	const run = vi.fn();
	const client = await connect(createWrapperServer({ runner: { run } }));
	expect(
		(await client.callTool({ name: "cli_list", arguments: args })).isError,
	).toBe(true);
	expect(run).not.toHaveBeenCalled();
});
it.each([
	{ ...successful, exitCode: 1 },
	{ ...successful, signal: "SIGTERM" },
	{ ...successful, error: "timed out" },
	{ ...successful, stdout: "not JSON" },
])("returns isError for CLI failures and malformed read output", async (output) => {
	const client = await connect(
		createWrapperServer({ runner: { run: async () => output } }),
	);
	expect(
		(
			await client.callTool({
				name: "cli_count",
				arguments: { collection: "items" },
			})
		).isError,
	).toBe(true);
});
it("returns parsed reads plus separate stdout/stderr and rejects missing required input", async () => {
	const run = vi.fn().mockResolvedValue(successful);
	const client = await connect(createWrapperServer({ runner: { run } }));
	const reply = await client.callTool({
		name: "cli_count",
		arguments: { collection: "items" },
	});
	expect(reply.structuredContent).toEqual({
		...successful,
		result: { totalDocs: 3 },
	});
	run.mockClear();
	expect(
		(
			await client.callTool({
				name: "cli_get",
				arguments: { collection: "items" },
			})
		).isError,
	).toBe(true);
	expect(run).not.toHaveBeenCalled();
});

it("propagates protocol cancellation to the CLI runner's AbortSignal", async () => {
	let started!: () => void;
	let aborted!: () => void;
	const ready = new Promise<void>((resolve) => {
		started = resolve;
	});
	const cancelled = new Promise<void>((resolve) => {
		aborted = resolve;
	});
	const client = await connect(
		createWrapperServer({
			runner: {
				run: async (_args, signal) => {
					started();
					await new Promise<void>((resolve) =>
						signal!.addEventListener(
							"abort",
							() => {
								aborted();
								resolve();
							},
							{ once: true },
						),
					);
					return {
						stdout: "",
						stderr: "",
						exitCode: null,
						signal: "SIGTERM",
						error: "cancelled",
					};
				},
			},
		}),
	);
	const controller = new AbortController();
	const pending = client.callTool(
		{ name: "cli_count", arguments: { collection: "items" } },
		undefined,
		{ signal: controller.signal },
	);
	await ready;
	controller.abort(new Error("client cancelled"));
	await expect(pending).rejects.toThrow("client cancelled");
	await cancelled;
});

it.each(
	ACTIONS.filter(
		(action) =>
			!COMMANDS[action].readOnly && COMMANDS[action].output === "json",
	),
)("parses JSON results for native write %s without treating it as read-only", async (action) => {
	const run = vi
		.fn()
		.mockResolvedValue({ ...successful, stdout: '{"id":123}' });
	const client = await connect(
		createWrapperServer({ runner: { run }, allowWrite: true }),
	);
	const reply = await client.callTool({
		name: `cli_${action}`,
		arguments: { collection: "items", data: { id: 1, data: {} } },
	});
	expect(reply.isError).not.toBe(true);
	expect(reply.structuredContent?.result).toEqual({ id: 123 });
});

import { beforeEach, expect, it, vi } from "vitest";
import { execute } from "../src/executor";
import { NATIVE_COMMANDS, type NativeAction } from "../src/native-commands";
import { NativeSchemas } from "../src/native";
let payload: any;
beforeEach(() => {
	payload = {
		collections: { items: { config: { versions: true } } },
		find: vi.fn().mockResolvedValue({ docs: [] }),
		count: vi.fn().mockResolvedValue({ totalDocs: 0 }),
	};
	for (const command of Object.values(NATIVE_COMMANDS))
		payload[command.payloadMethod] = vi.fn().mockResolvedValue({ id: 123 });
});
const samples = {
	createOne: {
		data: { title: "Hello" },
		filePath: "./image with spaces.jpg",
		draft: true,
	},
	updateOne: {
		id: 1,
		data: { _status: "published" },
		draft: false,
		trash: true,
		overrideLock: false,
	},
	updateMany: {
		where: { title: { equals: "Old" } },
		data: { title: "New" },
		limit: 20,
		sort: "title",
	},
	deleteOne: { id: "uuid", trash: true },
	deleteMany: { where: { title: { equals: "Old" } } },
	duplicate: {
		id: "uuid",
		data: { title: "Copy" },
		selectedLocales: ["en", "ja"],
		draft: true,
	},
	findByID: { id: "uuid", trash: true, flattenLocales: false },
	findDistinct: { field: "title", where: { title: { exists: true } } },
	findVersions: {
		where: { parent: { equals: 1 } },
		sort: "-createdAt",
		draft: true,
		trash: true,
	},
	findVersionByID: { id: 7, locale: "en" },
	countVersions: { where: { parent: { equals: 1 } } },
	restoreVersion: { id: 7, draft: true },
} satisfies Record<NativeAction, Record<string, unknown>>;
it.each(
	Object.keys(NATIVE_COMMANDS) as NativeAction[],
)("dispatches %s to the native API, preserving results and bypassing legacy mappings", async (action) => {
	const command = NATIVE_COMMANDS[action];
	const result = await execute(
		payload,
		"items",
		action,
		JSON.stringify(samples[action]),
		{
			mappings: {
				items: {
					lookupField: "email",
					onNotFound: "create",
					defaults: { DO_NOT_APPLY: true },
				},
			},
		},
	);
	expect(result).toEqual({ id: 123 });
	expect(payload[command.payloadMethod]).toHaveBeenCalledWith({
		collection: "items",
		...NativeSchemas[action].parse(samples[action]),
	});
	expect(command.output).toBe("json");
	if (action !== "createOne") expect(payload.create).not.toHaveBeenCalled();
	if (action === "duplicate") expect(payload.findByID).not.toHaveBeenCalled();
});
it.each([
	"findVersions",
	"countVersions",
] as const)("defaults optional %s input to {}", async (action) => {
	await execute(payload, "items", action);
	expect(payload[NATIVE_COMMANDS[action].payloadMethod]).toHaveBeenCalled();
});
it.each([
	["duplicate", {}],
	["duplicate", { id: 1, collection: "other" }],
	["duplicate", { id: 1, lookup: "a" }],
	["duplicate", { id: 1, data: [] }],
	["duplicate", { id: 1, selectedLocales: [] }],
	["createOne", { data: {}, req: {} }],
	["createOne", { data: {}, file: {} }],
	["updateOne", { data: {} }],
	["updateOne", { id: 1, data: {}, where: {} }],
	["updateMany", { data: {} }],
	["updateMany", { where: {}, data: {} }],
	["updateMany", { where: { and: [] }, data: {} }],
	["updateMany", { where: { or: [{ title: { equals: "x" } }, {}] }, data: {} }],
	["deleteMany", { where: {} }],
	["deleteMany", { where: { title: {} } }],
	["deleteMany", { where: { or: [] } }],
	["deleteOne", { where: { id: { equals: 1 } } }],
	["deleteOne", { id: 1, draft: true }],
	["findDistinct", {}],
	["findDistinct", { field: "title", select: {} }],
	["findVersions", { joins: false }],
	["findVersionByID", { id: 1, lookup: 2 }],
	["countVersions", { trash: true }],
	["countVersions", { draft: true }],
	["restoreVersion", { id: 1, disableTransaction: true }],
	["duplicate", { id: 1, overrideAccess: false }],
	["findByID", { id: 1, user: {} }],
] as const)("rejects unsupported/unsafe %s input %j before any API call", async (action, data) => {
	await expect(
		execute(payload, "items", action, JSON.stringify(data)),
	).rejects.toMatchObject({ slug: "QUERY_INVALID" });
	for (const method of new Set(
		Object.values(NATIVE_COMMANDS).map((c) => c.payloadMethod),
	))
		expect(payload[method]).not.toHaveBeenCalled();
});
it.each([
	"updateMany",
	"deleteMany",
] as const)("requires explicit allowAll for unfiltered %s and removes the CLI-only flag", async (action) => {
	const input = {
		where: {},
		allowAll: true,
		...(action === "updateMany" ? { data: {} } : {}),
	};
	await execute(payload, "items", action, JSON.stringify(input));
	const args = payload[NATIVE_COMMANDS[action].payloadMethod].mock.calls[0][0];
	expect(args.where).toEqual({});
	expect(args).not.toHaveProperty("allowAll");
});
it.each([
	"updateMany",
	"deleteMany",
] as const)("surfaces %s partial failures, including successful docs, without retry", async (action) => {
	const result = {
		docs: [{ id: 1 }],
		errors: [{ id: 2, message: "validation failed" }],
	};
	payload[NATIVE_COMMANDS[action].payloadMethod].mockResolvedValue(result);
	const input = {
		where: { id: { in: [1, 2] } },
		...(action === "updateMany" ? { data: {} } : {}),
	};
	await expect(
		execute(payload, "items", action, JSON.stringify(input)),
	).rejects.toMatchObject({ slug: "OPERATION_PARTIAL_FAILURE", data: result });
	expect(payload[NATIVE_COMMANDS[action].payloadMethod]).toHaveBeenCalledTimes(
		1,
	);
});
it.each([
	"findVersions",
	"findVersionByID",
	"countVersions",
	"restoreVersion",
] as const)("rejects %s on a collection without versions", async (action) => {
	payload.collections.items.config.versions = false;
	await expect(
		execute(payload, "items", action, JSON.stringify({ id: 7 })),
	).rejects.toMatchObject({ slug: "OPERATION_UNAVAILABLE" });
});
it("preserves native errors such as duplicate-disabled and unique-field violations", async () => {
	const error = new Error("cannot be duplicated");
	payload.duplicate.mockRejectedValue(error);
	await expect(execute(payload, "items", "duplicate", '{"id":1}')).rejects.toBe(
		error,
	);
	expect(payload.duplicate).toHaveBeenCalledTimes(1);
});
it("forwards JSON-safe context, localization, selection and populate", async () => {
	const query = {
		id: 1,
		data: {},
		locale: "ja",
		fallbackLocale: false,
		context: { source: "cli" },
		select: { title: true },
		populate: { users: { name: true } },
		showHiddenFields: true,
	};
	await execute(payload, "items", "updateOne", JSON.stringify(query));
	expect(payload.update).toHaveBeenCalledWith({
		collection: "items",
		depth: 0,
		...query,
	});
});
it("allows joins/populate/trash in ordinary reads and rejects flattenLocales for mapped get", async () => {
	const query = {
		trash: true,
		includeLockStatus: true,
		joins: { related: { limit: 5, count: true } },
		populate: { users: { name: true } },
		fallbackLocale: ["en", "ja"],
	};
	await execute(payload, "items", "list", JSON.stringify(query));
	expect(payload.find).toHaveBeenCalledWith({
		collection: "items",
		page: 1,
		limit: 10,
		depth: 0,
		...query,
	});
	await expect(
		execute(payload, "items", "get", '{"lookup":"x","flattenLocales":true}', {
			mappings: { items: { lookupField: "title", onNotFound: "error" } },
		}),
	).rejects.toMatchObject({ slug: "QUERY_INVALID" });
});

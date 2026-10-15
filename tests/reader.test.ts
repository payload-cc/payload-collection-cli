import { beforeEach, describe, expect, it, vi } from "vitest";
import { execute } from "../src/executor";
import { ACTIONS, COMMANDS, isAction } from "../src/commands";

let payload: any;
beforeEach(() => {
	payload = {
		collections: { categories: { config: { fields: [] } } },
		find: vi
			.fn()
			.mockResolvedValue({
				docs: [{ id: 7, name: "News" }],
				totalDocs: 1,
				totalPages: 1,
			}),
		findByID: vi.fn().mockResolvedValue({ id: 7, name: "News" }),
		count: vi.fn().mockResolvedValue({ totalDocs: 1 }),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};
});
const config = {
	mappings: {
		categories: {
			lookupField: "name",
			onNotFound: "create" as const,
			defaults: { name: "NEVER" },
		},
	},
};

describe("read executor", () => {
	it.each([
		"list",
		"find",
	] as const)("%s defaults to a paginated query and preserves metadata", async (action) => {
		const result = await execute(payload, "categories", action);
		expect(result).toEqual({
			docs: [{ id: 7, name: "News" }],
			totalDocs: 1,
			totalPages: 1,
		});
		expect(payload.find).toHaveBeenCalledWith({
			collection: "categories",
			depth: 0,
			page: 1,
			limit: 10,
		});
	});
	it("forwards only validated query options", async () => {
		const query = {
			where: { name: { equals: "News" } },
			page: 2,
			limit: 3,
			sort: ["-name", "id"],
			depth: 1,
			locale: "en",
			fallbackLocale: false,
			draft: true,
			select: { name: true, metadata: { reviewer: true } },
			pagination: false,
		};
		await execute(payload, "categories", "find", JSON.stringify(query));
		expect(payload.find).toHaveBeenCalledWith({
			collection: "categories",
			...query,
		});
	});
	it("count uses count, not find, and accepts an omitted query", async () => {
		expect(await execute(payload, "categories", "count")).toEqual({
			totalDocs: 1,
		});
		expect(payload.count).toHaveBeenCalledWith({ collection: "categories" });
		expect(payload.find).not.toHaveBeenCalled();
	});
	it.each([
		"7",
		'"uuid-7"',
		'{"id":7}',
	])("gets by ID with %s", async (input) => {
		await execute(payload, "categories", "get", input);
		expect(payload.findByID).toHaveBeenCalledWith({
			collection: "categories",
			id: input.includes("uuid") ? "uuid-7" : 7,
			depth: 0,
			disableErrors: true,
		});
	});
	it("uses a configured lookup without defaults or auto-create", async () => {
		expect(
			await execute(payload, "categories", "get", '"News"', config),
		).toEqual({ id: 7, name: "News" });
		expect(payload.find).toHaveBeenCalledWith({
			collection: "categories",
			depth: 0,
			where: { name: { equals: "News" } },
			limit: 2,
		});
		expect(payload.create).not.toHaveBeenCalled();
	});
	it("explicit id overrides the mapping and get options are forwarded", async () => {
		await execute(
			payload,
			"categories",
			"get",
			'{"id":7,"depth":2,"select":{"name":true}}',
			config,
		);
		expect(payload.findByID).toHaveBeenCalledWith({
			collection: "categories",
			id: 7,
			depth: 2,
			select: { name: true },
			disableErrors: true,
		});
	});
	it("explicit lookup uses the configured field", async () => {
		await execute(payload, "categories", "get", '{"lookup":"News"}', config);
		expect(payload.find).toHaveBeenCalled();
	});
	it("normalizes missing id to DOCUMENT_NOT_FOUND", async () => {
		payload.findByID.mockResolvedValue(null);
		await expect(
			execute(payload, "categories", "get", "7"),
		).rejects.toMatchObject({ slug: "DOCUMENT_NOT_FOUND" });
	});
	it.each([
		[[], "DOCUMENT_NOT_FOUND"],
		[[{ id: 1 }, { id: 2 }], "DOCUMENT_NOT_UNIQUE"],
	])("does not guess or create for a non-unique/missing lookup", async (docs, slug) => {
		payload.find.mockResolvedValue({ docs });
		await expect(
			execute(payload, "categories", "get", '"missing"', config),
		).rejects.toMatchObject({ slug });
		expect(payload.create).not.toHaveBeenCalled();
	});
	it("rejects an unknown collection", async () => {
		await expect(execute(payload, "unknown", "list")).rejects.toMatchObject({
			slug: "COLLECTION_NOT_FOUND",
		});
	});
	it.each([
		["list", '{"page":0}'],
		["list", '{"limit":0}'],
		["list", '{"limit":1001}'],
		["list", '{"depth":-1}'],
		["find", '{"overrideAccess":true}'],
		["list", '{"collection":"users"}'],
		["list", '{"page":"2"}'],
		["list", "[]"],
		["list", "null"],
		["list", '{"select":{"name":"yes"}}'],
		["count", '{"draft":true}'],
		["count", '{"page":1}'],
		["count", '{"limit":10}'],
		["get", "{}"],
		["get", '{"id":1,"lookup":"n"}'],
		["get", "null"],
		["get", '""'],
		["get", '{"id":1,"where":{}}'],
	] as const)("rejects invalid %s input %s", async (action, input) => {
		await expect(
			execute(payload, "categories", action, input),
		).rejects.toMatchObject({ slug: "QUERY_INVALID" });
		expect(payload.find).not.toHaveBeenCalled();
		expect(payload.findByID).not.toHaveBeenCalled();
		expect(payload.count).not.toHaveBeenCalled();
	});
	it("distinguishes malformed JSON from invalid query options", async () => {
		await expect(
			execute(payload, "categories", "list", "{"),
		).rejects.toMatchObject({ slug: "INPUT_PARSE_FAILED" });
	});
	it.each([
		"get",
		"create",
		"update",
		"delete",
		"upsert",
		"patch",
		"sync",
	] as const)("requires input for %s", async (action) => {
		await expect(execute(payload, "categories", action)).rejects.toMatchObject({
			slug: "INPUT_REQUIRED",
		});
	});
	it("rejects unknown/inherited actions before accessing Payload", async () => {
		for (const action of ["__proto__", "toString", "unknown"]) {
			expect(isAction(action)).toBe(false);
			await expect(
				execute({} as any, "categories", action as any, "{}"),
			).rejects.toMatchObject({ slug: "INVALID_ACTION" });
		}
	});
	it("no read action calls a mutation, even with onNotFound:create mappings", async () => {
		for (const action of ACTIONS.filter((name) => COMMANDS[name].readOnly)) {
			await execute(
				payload,
				"categories",
				action,
				action === "get" ? "7" : undefined,
				config,
			);
		}
		expect(payload.create).not.toHaveBeenCalled();
		expect(payload.update).not.toHaveBeenCalled();
		expect(payload.delete).not.toHaveBeenCalled();
	});
});

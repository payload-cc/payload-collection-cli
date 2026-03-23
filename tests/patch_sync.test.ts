import { describe, it, expect, vi } from "vitest";
import { execute } from "../src/executor";

describe("JSON Patch Engine", () => {
	it("should perform a complex patch with add, replace, and remove", async () => {
		const payload = {
			collections: { users: { config: { fields: [] } } },
			find: vi.fn()
				.mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Old Name" }] }) // for doc-1
				.mockResolvedValueOnce({ docs: [{ id: "doc-2", name: "To Delete" }] }), // for doc-2
			update: vi.fn().mockResolvedValue({ id: "doc-1", name: "New Name" }),
			delete: vi.fn().mockResolvedValue({ id: "doc-2" }),
			create: vi.fn().mockResolvedValue({ id: "doc-3", name: "New Doc" }),
		};

		const config = { mappings: { users: { lookupField: "id" } } };
		const patch = [
			{ op: "add", path: "/-", value: { name: "New Doc" } },
			{ op: "replace", path: "/[id=doc-1]/name", value: "New Name" },
			{ op: "remove", path: "/[id=doc-2]" }
		];

		await execute(
			payload as any,
			"users",
			"patch",
			JSON.stringify(patch),
			config as any,
		);

		expect(payload.create).toHaveBeenCalledWith({
			collection: "users",
			data: { name: "New Doc" },
		});
		expect(payload.update).toHaveBeenCalledWith({
			collection: "users",
			id: "doc-1",
			data: { name: "New Name" },
		});
		expect(payload.delete).toHaveBeenCalledWith({
			collection: "users",
			id: "doc-2",
		});
	});

	it("should perform sync operation correctly", async () => {
		const payload = {
			collections: { users: { config: { fields: [] } } },
			find: vi.fn()
				.mockResolvedValueOnce({ docs: [
					{ id: "1", name: "Keep Me" },
					{ id: "2", name: "Remove Me" }
				] }) // for targetData
				.mockResolvedValueOnce({ docs: [{ id: "1" }] }) // for finding id=1 during replace
				.mockResolvedValueOnce({ docs: [{ id: "2" }] }), // for finding id=2 during remove
			update: vi.fn().mockResolvedValue({ id: "1" }),
			create: vi.fn().mockResolvedValue({ id: "3" }),
			delete: vi.fn().mockResolvedValue({ id: "2" }),
		};

		const config = { mappings: { users: { lookupField: "id" } } };
		const sourceData = [
			{ id: "1", name: "Update Me" },
			{ id: "3", name: "New Me" }
		];

		await execute(
			payload as any,
			"users",
			"sync",
			JSON.stringify(sourceData),
			config as any,
		);

		// Should update id=1
		expect(payload.update).toHaveBeenCalledWith({
			collection: "users",
			id: "1",
			data: { id: "1", name: "Update Me" },
		});
		// Should create id=3
		expect(payload.create).toHaveBeenCalledWith({
			collection: "users",
			data: { id: "3", name: "New Me" },
		});
		// Should delete id=2
		expect(payload.delete).toHaveBeenCalledWith({
			collection: "users",
			id: "2",
		});
	});
});

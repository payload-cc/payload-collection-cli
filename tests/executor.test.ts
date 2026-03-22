import { describe, it, expect, vi } from "vitest";
import { resolveRelations } from "../src/resolver";
import { execute } from "../src/executor";

describe("Resolver Engine", () => {
	it("should magically resolve relation IDs via lookup string", async () => {
		// Mock Payload instance structure
		const payload = {
			collections: {
				posts: {
					config: {
						fields: [
							{ name: "author", type: "relationship", relationTo: "users" },
						],
					},
				},
			},
			find: vi
				.fn()
				.mockResolvedValue({ docs: [{ id: "mock-resolved-id-123" }] }),
		};

		const config = {
			mappings: {
				users: { lookupField: "email", onNotFound: "error" as const },
			},
		};

		const data = { title: "Test Post", author: "testuser@example.com" };

		const result = await resolveRelations(
			payload as any,
			"posts",
			data,
			config,
		);

		expect(result.author).toBe("mock-resolved-id-123");
		expect(payload.find).toHaveBeenCalledWith({
			collection: "users",
			where: { email: { equals: "testuser@example.com" } },
			limit: 1,
		});
	});

	it("should skip resolution if no mapping is found", async () => {
		const payload = {
			collections: {
				posts: {
					config: {
						fields: [
							{ name: "author", type: "relationship", relationTo: "users" },
						],
					},
				},
			},
		};
		const config = { mappings: {} };
		const data = { title: "Test", author: "some-id" };

		// Should return original data untouched
		const result = await resolveRelations(
			payload as any,
			"posts",
			data,
			config,
		);
		expect(result.author).toBe("some-id");
	});
});

describe("Executor Engine", () => {
	it("should perform single create action with basic data", async () => {
		const payload = {
			collections: { users: { config: { fields: [] } } },
			create: vi.fn().mockResolvedValue({ id: "new-id", name: "Test" }),
		};

		const config = { mappings: {} };

		await execute(
			payload as any,
			"users",
			"create",
			JSON.stringify({ name: "Test" }),
			config,
		);

		expect(payload.create).toHaveBeenCalledWith({
			collection: "users",
			data: { name: "Test" },
		});
	});
});

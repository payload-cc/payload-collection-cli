import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase } from "../../utils";
import path from "path";

describe("Error invalid config", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("fails when an invalid onNotFound value is provided via -j", () => {
		const dataPath = path.resolve(__dirname, "data.jsonl");

		// 'invalid-action' is not a valid enum value for onNotFound
		const output = runCLI(
			`-j '{"mappings":{"users":{"onNotFound":"invalid-action"}}}' users upsert ${dataPath}`,
		);

		expect(output).toContain("error: [CONFIG_INVALID] Invalid configuration structure:");
		expect(output).toContain("mappings.users.onNotFound");
		expect(output).toContain("error");
		expect(output).toContain("ignore");
		expect(output).toContain("create");
	}, 60000);

	it("fails when lookupField is not a string", () => {
		const dataPath = path.resolve(__dirname, "data.jsonl");

		const output = runCLI(
			`-j '{"mappings":{"users":{"lookupField": 123}}}' users upsert ${dataPath}`,
		);

		expect(output).toContain("error: [CONFIG_INVALID] Invalid configuration structure:");
		expect(output).toContain("mappings.users.lookupField");
		expect(output).toContain("expected string, received number");
	}, 60000);
});

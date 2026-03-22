import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";

describe("Error missing ID strictly enforced", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("throws an Error explicitly when no lookupField is configured and no id exists", () => {
		// 💡 Conversely, attempting an `upsert` of data lacking `id` without providing
		// a configuration mapping will strictly trigger the default `missing lookup field` error.
		const dataPath = path.resolve(__dirname, "data.jsonl");

		const output = runCLI(`users upsert ${dataPath}`);

		expect(output).toContain("lookup field 'id' in data");

		const users = getCollectionData("users");
		expect(users).toHaveLength(0); // DB remains untouched
	}, 30000);
});

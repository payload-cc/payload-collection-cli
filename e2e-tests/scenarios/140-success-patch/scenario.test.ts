import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Success Patch", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("applies a JSON Patch successfully to a collection", () => {
		// First, create some initial data
		runCLI(`users create '{"email": "patch-old@example.com", "password": "password123"}'`);
		runCLI(`users create '{"email": "patch-delete@example.com", "password": "password123"}'`);

		const dataFile = path.resolve(__dirname, "data.json");
		const output = runCLI(`users patch ${dataFile}`);

		expect(output).toContain("Operation successful");

		const users = getCollectionData("users");
		// Initial 2, added 1, removed 1 = 2 total
		expect(users).toHaveLength(2);

		const emails = users.map((u: any) => u.email);
		expect(emails).toContain("patch-new@example.com");
		expect(emails).toContain("patch-updated@example.com");
		expect(emails).not.toContain("patch-old@example.com");
		expect(emails).not.toContain("patch-delete@example.com");
	}, 60000);
});

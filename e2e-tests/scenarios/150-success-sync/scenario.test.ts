import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Success Sync", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("synchronizes a collection with a JSONL file successfully", () => {
		// First, create some order data
		runCLI(`users create '{"email": "sync-keep-updated@example.com", "name": "Old Name", "password": "password123"}'`);
		runCLI(`users create '{"email": "sync-delete@example.com", "name": "Delete Me", "password": "password123"}'`);

		const dataFile = path.resolve(__dirname, "data.jsonl");
		const configFile = path.resolve(__dirname, "config.ts");
		
		// Run sync with config to use email as lookup
		const output = runCLI(`-c ${configFile} users sync ${dataFile}`);

		expect(output).toContain("Operation successful");

		const users = getCollectionData("users");
		// Initial 2, 1 updated, 1 added, 1 deleted = 2 total
		expect(users).toHaveLength(2);

		const emails = users.map((u: any) => u.email);
		expect(emails).toContain("sync-keep-updated@example.com");
		expect(emails).toContain("sync-new@example.com");
		expect(emails).not.toContain("sync-delete@example.com");

		const updatedUser = users.find((u: any) => u.email === "sync-keep-updated@example.com");
		expect(updatedUser.name).toBe("Updated Name");
	}, 60000);
});

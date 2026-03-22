import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Update Record", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("updates a specific field of a user successfully using a config file", () => {
		// 1. Create a user first
		const userData = JSON.stringify({
			email: "update-me@example.com",
			name: "Original Name",
			password: "password123",
		});
		runCLI(`users create '${userData}'`);

		// 2. Update the user's name using a config file and data file
		const dataFile = path.resolve(__dirname, "data.jsonl");
		const configFile = path.resolve(__dirname, "config.ts");
		const output = runCLI(`-c ${configFile} users update ${dataFile}`);

		expect(output).toContain("Operation successful");

		const users = getCollectionData("users");
		expect(users).toHaveLength(1);
		expect(users[0].name).toBe("Updated Name");
		expect(users[0].email).toBe("update-me@example.com");
	}, 60000);
});

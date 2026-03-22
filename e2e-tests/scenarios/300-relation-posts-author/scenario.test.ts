import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";

describe("Relation auto-resolution", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("safely binds relational fields through pure email string specifications", () => {
		// 💡 Since resolving relationship fields inherently requires the target document's `id`,
		// the CLI config auto-resolves explicit relationships (e.g. mapping `author` email directly to `Users.id`).

		// 1. Preparation: Upsert the author
		// 1. Preparation: Upsert the author using local fixture
		const userDataPath = path.resolve(__dirname, "users.jsonl");
		const userConfig = JSON.stringify({
			mappings: { users: { lookupField: "email" } },
		});
		runCLI(`-j '${userConfig}' users upsert ${userDataPath}`);

		// 2. Main Execution: Upsert the Post referencing the author by their email string
		const dataPath = path.resolve(__dirname, "data.jsonl");
		const configPath = path.resolve(__dirname, "config.ts");

		const output = runCLI(`-c ${configPath} posts create ${dataPath}`);
		expect(output).toContain("Operation successful");

		const users = getCollectionData("users");
		const posts = getCollectionData("posts");
		const alice = users.find((u: any) => u.email === "alice@example.com");

		expect(posts).toHaveLength(1);
		// Assure Payload successfully bridged the relationship automatically converting string -> ID!
		expect(posts[0].author.id).toBe(alice.id);
	}, 60000);
});

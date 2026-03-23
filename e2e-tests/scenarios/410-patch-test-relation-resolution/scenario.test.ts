import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Patch Test Relation Resolution", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("resolves relations in the 'test' operation of a patch for consistency", () => {
		// 1. Setup collections
		// Create a category
		runCLI(`categories create '{"name": "News", "displayName": "News Category"}'`);
		// Create a user
		runCLI(`users create '{"email": "author@example.com", "name": "Author", "password": "password123"}'`);
		
		// 2. Create a post referencing them
		// We'll use sync or create with slugs if relations are resolved
		// Let's use simple create and then patch to set relations if needed,
		// but we want to test the 'test' op itself.
		
		// Map slugs to IDs is what resolveRelations does.
		// Let's create the post directly with slugs (which should work due to my fixes or existing logic)
		const configPath = path.resolve(__dirname, "config.ts");
		const configContent = `
			export const cliConfig = {
				mappings: {
					users: { lookupField: 'email' },
					categories: { lookupField: 'name' }
				}
			}
		`;
		fs.writeFileSync(configPath, configContent);

		runCLI(`-c ${configPath} posts create '{"title": "Post 1", "author": "author@example.com", "category": "News"}'`);

		// 3. Perform a patch with a 'test' operation using slugs
		const patchPath = path.resolve(__dirname, "patch.json");
		const patchContent = [
			{ op: "test", path: "/[title=Post 1]/author", value: "author@example.com" },
			{ op: "test", path: "/[title=Post 1]/category", value: "News" },
			{ op: "replace", path: "/[title=Post 1]/title", value: "Verified Post" }
		];
		fs.writeFileSync(patchPath, JSON.stringify(patchContent));

		const output = runCLI(`-c ${configPath} posts patch ${patchPath}`);
		expect(output).toContain("Operation successful");

		const posts = getCollectionData("posts");
		expect(posts[0].title).toBe("Verified Post");
	}, 60000);
});

import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Nested Relation Resolution", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("resolves relations inside groups, arrays, and via flattened paths", () => {
		// 1. Setup collections
		runCLI(`users create '{"email": "reviewer@example.com", "name": "Reviewer", "password": "password123"}'`);
		runCLI(`users create '{"email": "author1@example.com", "name": "Author 1", "password": "password123"}'`);
		runCLI(`users create '{"email": "author2@example.com", "name": "Author 2", "password": "password123"}'`);
		
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

		// 2. Test recursive resolution in 'create' (Group and Array)
		const createData = {
			name: "Tech",
			displayName: "Technology",
			metadata: {
				reviewer: "reviewer@example.com"
			},
			authors: [
				{ user: "author1@example.com" },
				{ user: "author2@example.com" }
			]
		};
		const createOutput = runCLI(`-c ${configPath} categories create '${JSON.stringify(createData)}'`);
		if (!createOutput.includes("Operation successful")) {
			throw new Error(`Create failed: ${createOutput}`);
		}

		const categories = getCollectionData("categories");
		const tech = categories.find((c: any) => c.name === "Tech");
		expect(tech.metadata.reviewer).toBeDefined();
		expect(typeof tech.metadata.reviewer).not.toBe("string"); // Should be populated object or ID
		const reviewerId = typeof tech.metadata.reviewer === 'object' ? tech.metadata.reviewer.id : tech.metadata.reviewer;

		expect(tech.authors).toHaveLength(2);
		const author1Id = typeof tech.authors[0].user === 'object' ? tech.authors[0].user.id : tech.authors[0].user;

		// 3. Test flattened path resolution in 'patch' using slashes
		// (Identifier-based paths support both slashes and dots for sub-paths)
		const patchPath = path.resolve(__dirname, "patch.json");
		const patchContent = [
			{ op: "replace", path: "/[name=Tech]/metadata/reviewer", value: "author1@example.com" }
		];
		fs.writeFileSync(patchPath, JSON.stringify(patchContent));

		runCLI(`-c ${configPath} categories patch ${patchPath}`);
		
		const updatedTech = getCollectionData("categories").find((c: any) => c.name === "Tech");
		const updatedReviewerId = typeof updatedTech.metadata.reviewer === 'object' ? updatedTech.metadata.reviewer.id : updatedTech.metadata.reviewer;
		expect(updatedReviewerId).toBe(author1Id);
	}, 60000);
});

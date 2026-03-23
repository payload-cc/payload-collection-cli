import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Auto Create with Defaults", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("applies defaults to documents auto-created via onNotFound: 'create'", () => {
		// 1. Setup config with defaults and onNotFound: 'create' for 'categories'
		const configPath = path.resolve(__dirname, "config.ts");
		const configContent = `
			export const cliConfig = {
				mappings: {
					categories: {
						lookupField: 'name',
						onNotFound: 'create',
						defaults: {
							displayName: 'AUTO_CREATED_DISPLAY_NAME'
						}
					}
				}
			}
		`;
		fs.writeFileSync(configPath, configContent);

		// 2. Create a post with a category that doesn't exist
		// This should trigger auto-creation of the category
		runCLI(`-c ${configPath} posts create '{"title": "New Post", "author": "admin@example.com", "category": "Brand New Category"}'`);

		// 3. Verify that the auto-created category has its default displayName
		const categories = getCollectionData("categories");
		const category = categories.find((c: any) => c.name === "Brand New Category");

		expect(category).toBeDefined();
		expect(category.name).toBe("Brand New Category");
		// This is the CRITICAL check for auto-create hierarchy support
		expect(category.displayName).toBe("AUTO_CREATED_DISPLAY_NAME");
	}, 60000);
});

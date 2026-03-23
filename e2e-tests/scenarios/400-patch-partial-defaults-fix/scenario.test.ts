import { describe, it, expect, beforeEach } from "vitest";
import { runCLI, resetDatabase, getCollectionData } from "../../utils";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Patch Partial Defaults Fix", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("does not apply defaults to partial field updates in patch", () => {
		// 1. Create initial data
		runCLI(`categories create '{"name": "Original Name", "displayName": "Original Display"}'`);
		
		// 2. Define a config with a default for displayName
		const configPath = path.resolve(__dirname, "config.ts");
		const configContent = `
			export const cliConfig = {
				mappings: {
					categories: {
						lookupField: 'name',
						defaults: {
							displayName: 'DEFAULT_DISPLAY_NAME'
						}
					}
				}
			}
		`;
		fs.writeFileSync(configPath, configContent);

		// 3. Patch only the 'name' field
		const patchPath = path.resolve(__dirname, "patch.json");
		const patchContent = [
			{ op: "replace", path: "/[name=Original Name]/name", value: "Updated Name" }
		];
		fs.writeFileSync(patchPath, JSON.stringify(patchContent));

		const output = runCLI(`-c ${configPath} categories patch ${patchPath}`);
		expect(output).toContain("Operation successful");

		// 4. Verify that displayName was NOT changed to the default
		const categories = getCollectionData("categories");
		const category = categories.find((c: any) => c.name === "Updated Name");
		
		expect(category).toBeDefined();
		expect(category.name).toBe("Updated Name");
		// This is the CRITICAL check: it should remain "Original Display"
		expect(category.displayName).toBe("Original Display");
		expect(category.displayName).not.toBe("DEFAULT_DISPLAY_NAME");
	}, 60000);
});

import { describe, it, expect, beforeEach } from "vitest";
import { runCLIFull, resetDatabase } from "../../utils";
import path from "path";

describe("Error stderr reporting", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("reports CONFIG_NOT_FOUND to stderr", () => {
		// Run with a non-existent config file
		const { stdout, stderr, status } = runCLIFull("--config-file missing.ts users create '{}'");

		// Should fail
		expect(status).toBe(1);
		
		// Error should be in stderr, not stdout
		expect(stderr).toContain("❌ [CONFIG_NOT_FOUND]");
		expect(stderr).toContain("Tip:");
		expect(stderr).toContain("Refer to:");
		
		// Stdout should not contain the error message
		expect(stdout).not.toContain("❌ [CONFIG_NOT_FOUND]");
	}, 60000);

	it("reports COLLECTION_NOT_FOUND to stderr", () => {
		// Run with a non-existent collection
		const { stdout, stderr, status } = runCLIFull("non-existent-collection create '{}'");

		// Should fail
		expect(status).toBe(1);
		
		// Error should be in stderr
		expect(stderr).toContain("❌ [COLLECTION_NOT_FOUND]");
		expect(stdout).not.toContain("❌ [COLLECTION_NOT_FOUND]");
	}, 60000);
});

import { describe, it, expect, beforeEach } from "vitest";
import { runCLIFull, resetDatabase } from "../../utils";
import path from "path";

describe("Error stderr reporting", () => {
	beforeEach(() => {
		resetDatabase();
	});

	it("reports COLLECTION_NOT_FOUND to stderr with non-zero exit code", () => {
		const { stderr, stdout, status } = runCLIFull("non-existent-collection create '{}'");

		expect(status).toBe(1);
		// Error should be in stderr
		expect(stderr).toContain("error: [COLLECTION_NOT_FOUND]");
		expect(stdout).not.toContain("error: [COLLECTION_NOT_FOUND]");
	}, 60000);

	it("reports CONFIG_NOT_FOUND to stderr with non-zero exit code", () => {
		const { stderr, stdout, status } = runCLIFull("-c non-existent.config.ts users create '{}'");

		expect(status).toBe(1);
		expect(stderr).toContain("error: [CONFIG_NOT_FOUND]");
		expect(stderr).toContain("tip:");
		expect(stderr).toContain("refer to:");
		
		// Error should not be in stdout
		expect(stdout).not.toContain("error: [CONFIG_NOT_FOUND]");
	}, 60000);
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	runCLI,
	resetDatabase,
	getCollectionData,
	payloadAppDir,
} from "../../utils";
import path from "path";
import fs from "fs";

describe("Success package.json config", () => {
	const pkgPath = path.join(payloadAppDir, "package.json");
	let originalPkg: string;

	beforeEach(() => {
		resetDatabase();
		if (!originalPkg && fs.existsSync(pkgPath)) {
			originalPkg = fs.readFileSync(pkgPath, "utf-8");
		}
	});

	afterEach(() => {
		if (originalPkg) {
			fs.writeFileSync(pkgPath, originalPkg);
		}
	});

	it("reads config from package.json defaults", () => {
		// 1. Prepare data
		const dataPath = path.resolve(__dirname, "data.jsonl");

		// 2. Inject payload-collection-cli config into package.json
		const pkg = JSON.parse(originalPkg);
		pkg["payload-collection-cli"] = {
			configJson: JSON.stringify({
				mappings: {
					users: { lookupField: "email" },
				},
			}),
		};
		fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

		// 3. Run CLI WITHOUT -c or -j flags
		const output = runCLI(`users upsert ${dataPath}`);

		// Cleanup package.json immediately
		fs.writeFileSync(pkgPath, originalPkg);

		expect(output).toContain("Operation successful");

		const users = getCollectionData("users");
		expect(users).toHaveLength(1);
		expect(users[0].email).toBe("pkg-json@example.com");
	}, 60000);
});

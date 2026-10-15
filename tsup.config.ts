import { defineConfig } from "tsup";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { documentation } from "./scripts/documentation.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const version = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;
export default defineConfig({
	entry: ["src/index.ts", "src/bin.ts", "src/docs-mcp.ts", "src/cli-mcp.ts"],
	format: ["cjs", "esm"],
	dts: true,
	clean: true,
	shims: true,
	external: ["payload", "jiti", "@modelcontextprotocol/sdk"],
	define: {
		__DOCS_BUNDLE__: JSON.stringify(documentation(root)),
		__PACKAGE_VERSION__: JSON.stringify(version),
	},
});

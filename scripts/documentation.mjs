import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Build-time only: runtime docs servers never open project files. */
export function documentation(root) {
	const read = (file) => readFileSync(path.join(root, file), "utf8");
	const markdown = (directory) =>
		readdirSync(path.join(root, directory), { withFileTypes: true })
			.sort((a, b) => a.name.localeCompare(b.name))
			.flatMap((entry) =>
				entry.name.startsWith(".") || entry.name === "public"
					? []
					: entry.isDirectory()
						? markdown(`${directory}/${entry.name}`)
						: entry.name.endsWith(".md")
							? [`${directory}/${entry.name}`]
							: [],
			);
	const examples = readdirSync(path.join(root, "e2e-tests/scenarios"), {
		withFileTypes: true,
	})
		.filter((entry) => entry.isDirectory())
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((entry) => {
			const dir = `e2e-tests/scenarios/${entry.name}`;
			return (
				`## ${entry.name}\n\n` +
				readdirSync(path.join(root, dir))
					.sort()
					.filter((name) =>
						/^(README\.md|data\.jsonl|config\.ts|scenario\.test\.ts)$/.test(
							name,
						),
					)
					.map((name) => {
						const text = read(`${dir}/${name}`);
						return name === "README.md"
							? text
							: `### ${name}\n\n\`\`\`${name.endsWith("ts") ? "typescript" : "jsonl"}\n${text}\n\`\`\``;
					})
					.join("\n\n")
			);
		})
		.join("\n\n");
	const docs = ["README.md", ...markdown("docs")].map((id) => ({
		id,
		text: read(id).replace("[[SCENARIO_EXAMPLES_BUNDLE]]", examples),
	}));
	const context = docs
		.filter((doc) => doc.id !== "docs/ai.md")
		.map((doc) => `# ${doc.id}\n\n${doc.text}`)
		.join("\n\n---\n\n");
	return docs.map((doc) => ({
		...doc,
		text: doc.text.replace("[[AI_CONTEXT_BUNDLE]]", context),
	}));
}

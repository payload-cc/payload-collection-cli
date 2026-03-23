import { defineConfig } from "vitepress";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
	title: "Payload Collection CLI",
	description: "Functional CLI for Payload 3.0 collection management",
	base: "/payload-collection-cli/",
	lastUpdated: true,
	sitemap: {
		hostname: "https://payload-cc.github.io/payload-collection-cli/",
	},
	head: [
		[
			"link",
			{
				rel: "icon",
				type: "image/png",
				href: "/payload-collection-cli/logo.png",
			},
		],
		["meta", { property: "og:type", content: "website" }],
		["meta", { property: "og:locale", content: "en_US" }],
		["meta", { property: "og:site_name", content: "Payload Collection CLI" }],
		[
			"meta",
			{
				property: "og:image",
				content: "https://payload-cc.github.io/payload-collection-cli/logo.png",
			},
		],
	],
	markdown: {
		config: (md) => {
			// Internal rule to bundle documentation into ai.md during compilation
			const originalRender = md.render;
			md.render = function (this: any, src, env) {
				if (env.path && env.path.endsWith("ai.md")) {
					// Find placeholder and replace with resolved content from the pages list
					src = src.replace("[[AI_CONTEXT_BUNDLE]]", () => {
						const rootDir = process.cwd();
						const pages = [
							"README.md",
							"docs/examples.md",
							"docs/references/specs_detail.md",
						];

						return pages
							.map((file) => {
								const filePath = path.resolve(rootDir, file);
								return fs.existsSync(filePath)
									? fs.readFileSync(filePath, "utf-8")
									: "";
							})
							.join("\n\n---\n\n")
							.replace(/\(docs\//g, "(/");
					});
				}

				if (env.path && env.path.endsWith("examples.md")) {
					// Automatically scan e2e scenarios and generate examples
					src = src.replace("[[SCENARIO_EXAMPLES_BUNDLE]]", () => {
						const scenariosDir = path.resolve(
							process.cwd(),
							"e2e-tests/scenarios",
						);
						if (!fs.existsSync(scenariosDir)) return "";

						const scenarios = fs
							.readdirSync(scenariosDir)
							.filter((name) =>
								fs.statSync(path.join(scenariosDir, name)).isDirectory(),
							)
							.sort();

						return scenarios
							.map((name) => {
								const scenarioPath = path.join(scenariosDir, name);
								const readmePath = path.join(scenarioPath, "README.md");

								let readmeContent = "";
								let title = name
									.replace(/^\d+-/, "")
									.split("-")
									.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
									.join(" ");

								if (fs.existsSync(readmePath)) {
									const fullReadme = fs.readFileSync(readmePath, "utf-8");
									const titleMatch = fullReadme.match(/^#\s+(.+)$/m);
									if (titleMatch) {
										title = titleMatch[1];
										readmeContent =
											fullReadme.replace(/^#\s+.+$/m, "").trim() + "\n\n";
									} else {
										readmeContent = fullReadme.trim() + "\n\n";
									}
								}

								let output = `## ${title}\n\n`;
								output += readmeContent;

								const dataPath = path.join(scenarioPath, "data.jsonl");
								if (fs.existsSync(dataPath)) {
									output += `### Data (\`data.jsonl\`)\n\`\`\`jsonline\n${fs.readFileSync(dataPath, "utf-8")}\n\`\`\`\n\n`;
								}

								const configPath = path.join(scenarioPath, "config.ts");
								if (fs.existsSync(configPath)) {
									output += `### Configuration (\`config.ts\`)\n\`\`\`typescript\n${fs.readFileSync(configPath, "utf-8")}\n\`\`\`\n\n`;
								}

								const testPath = path.join(scenarioPath, "scenario.test.ts");
								if (fs.existsSync(testPath)) {
									output += `### Test Scenario (\`scenario.test.ts\`)\n\`\`\`typescript\n${fs.readFileSync(testPath, "utf-8")}\n\`\`\`\n\n`;
								}

								return output.trim();
							})
							.filter(Boolean)
							.join('\n\n');
					});
				}
				return originalRender.call(this, src, env);
			};
		},
	},
	themeConfig: {
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Examples", link: "/examples" },
			{ text: "Specs", link: "/references/specs_detail" },
			{ text: "AI Context", link: "/ai" },
		],
		sidebar: [
			{
				text: "Introduction",
				items: [
					{ text: "What is this?", link: "/" },
					{ text: "Examples & Use Cases", link: "/examples" },
					{ text: "AI Coding Context", link: "/ai" },
				],
			},
			{
				text: "Reference",
				items: [{ text: "Detailed Specs", link: "/references/specs_detail" }],
			},
		],
		socialLinks: [
			{
				icon: "github",
				link: "https://github.com/payload-cc/payload-collection-cli",
			},
		],
	},
});

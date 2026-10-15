import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { result } from "./result";
import { COMMANDS } from "../commands";
import { CLI_OPTIONS } from "../cli-options";

export interface Document {
	id: string;
	text: string;
}
declare const __DOCS_BUNDLE__: Document[];
declare const __PACKAGE_VERSION__: string;
export const packageVersion =
	typeof __PACKAGE_VERSION__ === "undefined"
		? "development"
		: __PACKAGE_VERSION__;
const bundledDocuments =
	typeof __DOCS_BUNDLE__ === "undefined" ? [] : __DOCS_BUNDLE__;
export function documentURI(id: string) {
	return `payload-collection-cli://docs/${id.split("/").map(encodeURIComponent).join("/")}`;
}

/** Only embedded, exact-ID documents are exposed. No filesystem or network access. */
export function createDocsServer(
	documents: readonly Document[] = bundledDocuments,
) {
	documents = [
		...documents,
		{
			id: "generated/command-catalog.md",
			text:
				"# Command and option catalog\n\n```json\n" +
				JSON.stringify({ commands: COMMANDS, options: CLI_OPTIONS }, null, 2) +
				"\n```",
		},
	];
	const server = new McpServer({
		name: "payload-collection-cli-docs",
		version: packageVersion,
	});
	const index = new Map(documents.map((doc) => [doc.id, doc]));
	const annotations = {
		readOnlyHint: true,
		destructiveHint: false,
		openWorldHint: false,
	};
	server.registerTool(
		"docs_list",
		{
			description:
				"List bundled documentation for this version of payload-collection-cli (not upstream Payload docs).",
			inputSchema: z.object({}).strict(),
			annotations,
		},
		async () =>
			result({
				documents: documents.map((doc) => ({
					id: doc.id,
					uri: documentURI(doc.id),
				})),
			}),
	);
	server.registerTool(
		"docs_get",
		{
			description: "Get a bundled Markdown document by its exact ID.",
			inputSchema: z.object({ id: z.string() }).strict(),
			annotations,
		},
		async ({ id }) => {
			const doc = index.get(id);
			if (!doc) throw new Error(`Unknown documentation ID: ${id}`);
			return result({ id, text: doc.text });
		},
	);
	server.registerTool(
		"docs_search",
		{
			description:
				"Case-insensitive literal search of bundled CLI documentation.",
			inputSchema: z
				.object({
					query: z.string().trim().min(1).max(200),
					limit: z.number().int().min(1).max(30).default(10),
				})
				.strict(),
			annotations,
		},
		async ({ query, limit }) => {
			const matches = documents.flatMap((doc) => {
				const position = doc.text.toLowerCase().indexOf(query.toLowerCase());
				return position < 0
					? []
					: [
							{
								id: doc.id,
								excerpt: doc.text.slice(
									Math.max(0, position - 150),
									position + query.length + 350,
								),
							},
						];
			});
			return result({
				total: matches.length,
				matches: matches.slice(0, limit),
			});
		},
	);
	for (const doc of documents) {
		server.registerResource(
			doc.id,
			documentURI(doc.id),
			{
				mimeType: "text/markdown",
				description: `Bundled CLI documentation: ${doc.id}`,
			},
			async (uri) => ({
				contents: [
					{ uri: uri.href, mimeType: "text/markdown", text: doc.text },
				],
			}),
		);
	}
	return server;
}

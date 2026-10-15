import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function result(
	value: Record<string, unknown>,
	isError = false,
): CallToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(value) }],
		structuredContent: value,
		...(isError ? { isError: true } : {}),
	};
}

export function failure(error: unknown): CallToolResult {
	return result(
		{ error: error instanceof Error ? error.message : String(error) },
		true,
	);
}

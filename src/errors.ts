export type ErrorSlug =
	| "CONFIG_NOT_FOUND"
	| "CONFIG_INVALID"
	| "CONFIG_EXPORT_NOT_FOUND"
	| "PAYLOAD_CONFIG_NOT_FOUND"
	| "PAYLOAD_INIT_FAILED"
	| "COLLECTION_NOT_FOUND"
	| "RELATION_NOT_FOUND"
	| "DOCUMENT_NOT_FOUND"
	| "INVALID_ACTION"
	| "MISSING_LOOKUP_FIELD"
	| "PATCH_PARSE_FAILED"
	| "PATCH_INVALID_OP"
	| "PATCH_INVALID_PATH"
	| "PATCH_TEST_FAILED"
	| "INPUT_PARSE_FAILED";

export class PayloadCollectionCLIError extends Error {
	public readonly slug: ErrorSlug;
	public readonly data?: any;

	constructor(slug: ErrorSlug, message: string, data?: any) {
		super(message);
		this.slug = slug;
		this.data = data;
		this.name = "PayloadCollectionCLIError";
	}
}

export const ERROR_TIPS: Record<ErrorSlug, string> = {
	CONFIG_NOT_FOUND: "Check the file path and ensure the file exists.",
	CONFIG_INVALID:
		"Check the syntax of your configuration file and ensure it matches the schema.",
	CONFIG_EXPORT_NOT_FOUND:
		"Ensure your configuration file uses a named export (default: cliConfig).",
	PAYLOAD_CONFIG_NOT_FOUND:
		"Ensure you are running from the project root or payload.config.ts is in src/.",
	PAYLOAD_INIT_FAILED: "Check your Payload configuration and environment variables.",
	COLLECTION_NOT_FOUND: "Double-check the collection slug.",
	RELATION_NOT_FOUND:
		"Ensure the referenced document exists or change onNotFound to 'create' or 'ignore'.",
	DOCUMENT_NOT_FOUND:
		"Verify the document exists and the lookupField value is correct.",
	INVALID_ACTION: "Refer to the supported operations in the documentation.",
	MISSING_LOOKUP_FIELD: "Ensure your data contains the specified lookupField.",
	PATCH_PARSE_FAILED: "Check the syntax of your patch input JSON.",
	PATCH_INVALID_OP: "Use standard RFC 6902 operations (add, remove, etc.).",
	PATCH_INVALID_PATH: "Ensure the path follows the CLI's identifier-based syntax.",
	PATCH_TEST_FAILED: "Verify the current document state and the expected value.",
	INPUT_PARSE_FAILED: "Check the syntax of your input (JSON or JSONL).",
};

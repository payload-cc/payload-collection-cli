import { PayloadCollectionCLIError } from "./errors";
import { NATIVE_COMMANDS } from "./native-commands";

interface CommandDefinition {
	description: string;
	inputRequired: boolean;
	readOnly: boolean;
	destructive: boolean;
	output: "text" | "json";
	payloadMethod?: string;
}

/** Single source of truth for CLI discovery and generated integrations. */
export const COMMANDS = {
	create: {
		description: "Create records from JSON or JSONL.",
		inputRequired: true,
		readOnly: false,
		output: "text",
		destructive: false,
	},
	update: {
		description: "Update existing records using the configured lookup field.",
		inputRequired: true,
		readOnly: false,
		output: "text",
		destructive: true,
	},
	delete: {
		description: "Delete records using the configured lookup field.",
		inputRequired: true,
		readOnly: false,
		output: "text",
		destructive: true,
	},
	upsert: {
		description: "Update matching records or create missing records.",
		inputRequired: true,
		readOnly: false,
		output: "text",
		destructive: true,
	},
	patch: {
		description: "Apply identifier-based JSON patch operations.",
		inputRequired: true,
		readOnly: false,
		output: "text",
		destructive: true,
	},
	sync: {
		description:
			"Synchronize a collection, including deleting records absent from the input.",
		inputRequired: true,
		readOnly: false,
		output: "text",
		destructive: true,
	},
	get: {
		payloadMethod: "findByID",
		description: "Read one record by ID or configured lookup value.",
		inputRequired: true,
		readOnly: true,
		output: "json",
		destructive: false,
	},
	list: {
		payloadMethod: "find",
		description: "Read a paginated collection using a JSON query (default {}).",
		inputRequired: false,
		readOnly: true,
		output: "json",
		destructive: false,
	},
	find: {
		payloadMethod: "find",
		description:
			"Alias of list: read a paginated collection using a JSON query.",
		inputRequired: false,
		readOnly: true,
		output: "json",
		destructive: false,
	},
	count: {
		payloadMethod: "count",
		description: "Count matching records without fetching them (default {}).",
		inputRequired: false,
		readOnly: true,
		output: "json",
		destructive: false,
	},
	...NATIVE_COMMANDS,
} as const satisfies Record<string, CommandDefinition>;

export type Action = keyof typeof COMMANDS;
export const ACTIONS = Object.keys(COMMANDS) as Action[];

export function isAction(action: unknown): action is Action {
	return typeof action === "string" && Object.hasOwn(COMMANDS, action);
}

export function validateInvocation(
	collection: unknown,
	action: unknown,
	input: unknown,
): asserts action is Action {
	if (typeof collection !== "string" || !collection.trim()) {
		throw new PayloadCollectionCLIError(
			"COLLECTION_NOT_FOUND",
			"A collection slug is required.",
		);
	}
	if (!isAction(action)) {
		throw new PayloadCollectionCLIError(
			"INVALID_ACTION",
			`Unknown action '${String(action)}'. Supported: ${ACTIONS.join(", ")}`,
		);
	}
	if (input !== undefined && typeof input !== "string") {
		throw new PayloadCollectionCLIError(
			"INPUT_PARSE_FAILED",
			"Input must be a JSON string or supported file path.",
		);
	}
	if (COMMANDS[action].inputRequired && (input === undefined || input === "")) {
		throw new PayloadCollectionCLIError(
			"INPUT_REQUIRED",
			`Action '${action}' requires input.`,
		);
	}
}

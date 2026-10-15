/** Native JSON-envelope commands: no legacy lookup/default/relation rewriting. */
export const NATIVE_COMMANDS = {
	createOne: {
		payloadMethod: "create",
		description:
			"Create one document with native options, including uploads and drafts.",
		inputRequired: true,
		readOnly: false,
		destructive: false,
		output: "json",
	},
	updateOne: {
		payloadMethod: "update",
		description:
			"Update one explicit ID with native options (publish, unpublish, trash, restore, upload).",
		inputRequired: true,
		readOnly: false,
		destructive: true,
		output: "json",
	},
	updateMany: {
		payloadMethod: "update",
		description:
			"Update documents matching an explicit where query; empty filters require allowAll.",
		inputRequired: true,
		readOnly: false,
		destructive: true,
		output: "json",
	},
	deleteOne: {
		payloadMethod: "delete",
		description:
			"Permanently delete one explicit ID; trash:true includes trashed documents.",
		inputRequired: true,
		readOnly: false,
		destructive: true,
		output: "json",
	},
	deleteMany: {
		payloadMethod: "delete",
		description:
			"Permanently delete documents matching an explicit where query; empty filters require allowAll.",
		inputRequired: true,
		readOnly: false,
		destructive: true,
		output: "json",
	},
	duplicate: {
		payloadMethod: "duplicate",
		description:
			"Duplicate one explicit ID using Payload's native duplication hooks, with optional data overrides.",
		inputRequired: true,
		readOnly: false,
		destructive: false,
		output: "json",
	},
	findByID: {
		payloadMethod: "findByID",
		description: "Find one document by explicit ID (never a mapping lookup).",
		inputRequired: true,
		readOnly: true,
		destructive: false,
		output: "json",
	},
	findDistinct: {
		payloadMethod: "findDistinct",
		description: "Find paginated distinct values for a field.",
		inputRequired: true,
		readOnly: true,
		destructive: false,
		output: "json",
	},
	findVersions: {
		payloadMethod: "findVersions",
		feature: "versions",
		description:
			"Find a paginated collection version history (default query {}).",
		inputRequired: false,
		readOnly: true,
		destructive: false,
		output: "json",
	},
	findVersionByID: {
		payloadMethod: "findVersionByID",
		feature: "versions",
		description: "Find one version by its version ID, not its document ID.",
		inputRequired: true,
		readOnly: true,
		destructive: false,
		output: "json",
	},
	countVersions: {
		payloadMethod: "countVersions",
		feature: "versions",
		description: "Count matching versions (default query {}).",
		inputRequired: false,
		readOnly: true,
		destructive: false,
		output: "json",
	},
	restoreVersion: {
		payloadMethod: "restoreVersion",
		feature: "versions",
		description:
			"Restore a version by its version ID, replacing the current document state.",
		inputRequired: true,
		readOnly: false,
		destructive: true,
		output: "json",
	},
} as const;
export type NativeAction = keyof typeof NATIVE_COMMANDS;
export function isNativeAction(action: string): action is NativeAction {
	return Object.hasOwn(NATIVE_COMMANDS, action);
}

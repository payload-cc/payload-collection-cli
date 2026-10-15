import type { Payload } from "payload";
import { z } from "zod";
import { common, identifier, ListQuerySchema, where, validate } from "./reader";
import {
	NATIVE_COMMANDS,
	isNativeAction,
	type NativeAction,
} from "./native-commands";
import { PayloadCollectionCLIError } from "./errors";

const object = z.record(z.string(), z.json());
const singleFallback = z
	.union([z.string().min(1), z.literal(false)])
	.optional();
const base = common
	.omit({ draft: true, trash: true, includeLockStatus: true, joins: true })
	.extend({ fallbackLocale: singleFallback, context: object.optional() });
const write = base.extend({ disableTransaction: z.boolean().optional() });
const create = write.extend({
	data: object,
	draft: z.boolean().optional(),
	filePath: z.string().min(1).optional(),
	overwriteExistingFiles: z.boolean().optional(),
	disableVerificationEmail: z.boolean().optional(),
	publishAllLocales: z.boolean().optional(),
	duplicateFromID: identifier.optional(),
});
const update = write.extend({
	data: object,
	draft: z.boolean().optional(),
	autosave: z.boolean().optional(),
	filePath: z.string().min(1).optional(),
	overwriteExistingFiles: z.boolean().optional(),
	overrideLock: z.boolean().optional(),
	trash: z.boolean().optional(),
	publishAllLocales: z.boolean().optional(),
	publishSpecificLocale: z.string().min(1).optional(),
	unpublishAllLocales: z.boolean().optional(),
});
const remove = write.extend({
	overrideLock: z.boolean().optional(),
	trash: z.boolean().optional(),
});
const count = z
	.object({
		where: where.optional(),
		locale: z.string().min(1).optional(),
		context: object.optional(),
	})
	.strict();
const versionID = identifier.transform(String);

export const NativeSchemas = {
	createOne: create.strict(),
	updateOne: update.extend({ id: identifier }).strict(),
	updateMany: update
		.extend({
			where,
			limit: z.number().int().min(1).max(10000).optional(),
			sort: z
				.union([z.string().min(1), z.array(z.string().min(1)).min(1)])
				.optional(),
			allowAll: z.boolean().optional(),
		})
		.strict(),
	deleteOne: remove.extend({ id: identifier }).strict(),
	deleteMany: remove
		.extend({ where, allowAll: z.boolean().optional() })
		.strict(),
	duplicate: base
		.extend({
			id: identifier,
			data: object.optional(),
			draft: z.boolean().optional(),
			selectedLocales: z.array(z.string().min(1)).min(1).optional(),
			disableTransaction: z.boolean().optional(),
		})
		.strict(),
	findByID: common
		.extend({ id: identifier, flattenLocales: z.boolean().optional() })
		.strict(),
	findDistinct: common
		.omit({
			fallbackLocale: true,
			draft: true,
			select: true,
			includeLockStatus: true,
			joins: true,
		})
		.extend({
			field: z.string().min(1),
			where: where.optional(),
			limit: z.number().int().min(1).max(1000).default(10),
			page: z.number().int().min(1).default(1),
			sort: z
				.union([z.string().min(1), z.array(z.string().min(1)).min(1)])
				.optional(),
		})
		.strict(),
	findVersions: ListQuerySchema.omit({ includeLockStatus: true, joins: true })
		.extend({ fallbackLocale: singleFallback, context: object.optional() })
		.strict(),
	findVersionByID: base
		.extend({
			id: versionID,
			draft: z.boolean().optional(),
			trash: z.boolean().optional(),
		})
		.strict(),
	countVersions: count,
	restoreVersion: base
		.extend({ id: versionID, draft: z.boolean().optional() })
		.strict(),
} satisfies Record<NativeAction, z.ZodType>;

function scopedFilter(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const entries = Object.entries(value);
	return (
		entries.length > 0 &&
		entries.every(([key, predicate]) => {
			if (key === "and" || key === "or")
				return (
					Array.isArray(predicate) &&
					predicate.length > 0 &&
					predicate.every(scopedFilter)
				);
			return (
				predicate !== null &&
				typeof predicate === "object" &&
				!Array.isArray(predicate) &&
				Object.keys(predicate).length > 0
			);
		})
	);
}

/** Safe JSON surface for every native collection document operation. */
export async function executeNative(
	payload: Payload,
	collection: string,
	action: NativeAction,
	input: string | undefined,
) {
	if (!Object.hasOwn(payload.collections, collection))
		throw new PayloadCollectionCLIError(
			"COLLECTION_NOT_FOUND",
			`Collection '${collection}' not found.`,
		);
	if (!isNativeAction(action))
		throw new PayloadCollectionCLIError(
			"INVALID_ACTION",
			`Unknown native action: ${action}`,
		);
	const command = NATIVE_COMMANDS[action];
	if (
		"feature" in command &&
		command.feature === "versions" &&
		!payload.collections[collection].config.versions
	)
		throw new PayloadCollectionCLIError(
			"OPERATION_UNAVAILABLE",
			`Collection '${collection}' does not enable versions.`,
		);
	let data: unknown;
	try {
		data = JSON.parse(input ?? "{}");
	} catch (error) {
		throw new PayloadCollectionCLIError(
			"INPUT_PARSE_FAILED",
			`Failed to parse JSON: ${(error as Error).message}`,
		);
	}
	const options = validate(NativeSchemas[action], data) as Record<
		string,
		unknown
	>;
	if (
		(action === "updateMany" || action === "deleteMany") &&
		options.allowAll !== true &&
		!scopedFilter(options.where)
	)
		throw new PayloadCollectionCLIError(
			"QUERY_INVALID",
			"Bulk writes require a nonempty where predicate. Set allowAll:true explicitly to authorize an unfiltered operation.",
		);
	delete options.allowAll;
	const result = await (
		payload[command.payloadMethod] as (args: unknown) => Promise<any>
	).call(payload, { collection, ...options });
	if (result == null)
		throw new PayloadCollectionCLIError(
			"DOCUMENT_NOT_FOUND",
			`No document/version returned for ${action}.`,
		);
	if (
		(action === "updateMany" || action === "deleteMany") &&
		Array.isArray(result.errors) &&
		result.errors.length > 0
	)
		throw new PayloadCollectionCLIError(
			"OPERATION_PARTIAL_FAILURE",
			`Bulk operation partially failed: ${JSON.stringify(result)}`,
			result,
		);
	return result;
}

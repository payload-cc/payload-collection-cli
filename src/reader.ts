import type { Payload } from "payload";
import { z } from "zod";
import { COMMANDS, isAction, type Action } from "./commands";
import type { CLIConfig } from "./types";
import { PayloadCollectionCLIError } from "./errors";

type Selection = { [field: string]: boolean | Selection };
const selection: z.ZodType<Selection> = z.record(
	z.string(),
	z.union([z.boolean(), z.lazy(() => selection)]),
);
const identifier = z.union([z.string().min(1), z.number().int().safe()]);
const common = z.object({
	depth: z.number().int().min(0).max(10).default(0),
	locale: z.string().min(1).optional(),
	fallbackLocale: z.union([z.string().min(1), z.literal(false)]).optional(),
	draft: z.boolean().optional(),
	select: selection.optional(),
});
const where = z.record(z.string(), z.unknown());
export const ListQuerySchema = common
	.extend({
		where: where.optional(),
		page: z.number().int().min(1).default(1),
		limit: z.number().int().min(1).max(1000).default(10),
		sort: z
			.union([z.string().min(1), z.array(z.string().min(1)).min(1)])
			.optional(),
		pagination: z.boolean().optional(),
	})
	.strict();
export const CountQuerySchema = z
	.object({
		where: where.optional(),
		locale: z.string().min(1).optional(),
	})
	.strict();
export const GetQuerySchema = common
	.extend({
		id: identifier.optional(),
		lookup: identifier.optional(),
	})
	.strict()
	.refine(
		(value) => (value.id !== undefined) !== (value.lookup !== undefined),
		{
			message: "Specify exactly one of 'id' or 'lookup'.",
		},
	);

function validate<T>(schema: z.ZodType<T>, data: unknown): T {
	const result = schema.safeParse(data);
	if (!result.success) {
		throw new PayloadCollectionCLIError(
			"QUERY_INVALID",
			result.error.issues
				.map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data;
}

/** No relation resolution, defaults, or onNotFound auto-creation on reads. */
export async function executeRead(
	payload: Payload,
	collection: string,
	action: Action,
	input: string | undefined,
	config: CLIConfig,
) {
	if (!isAction(action) || !COMMANDS[action].readOnly) {
		throw new PayloadCollectionCLIError(
			"INVALID_ACTION",
			`Not a read action: ${String(action)}`,
		);
	}
	if (!Object.hasOwn(payload.collections, collection)) {
		throw new PayloadCollectionCLIError(
			"COLLECTION_NOT_FOUND",
			`Collection '${collection}' not found.`,
		);
	}
	let data: unknown;
	try {
		data = JSON.parse(input ?? "{}");
	} catch (error) {
		throw new PayloadCollectionCLIError(
			"INPUT_PARSE_FAILED",
			`Failed to parse JSON: ${(error as Error).message}`,
		);
	}
	if (action === "list" || action === "find") {
		return payload.find({
			collection,
			...validate(ListQuerySchema, data),
		} as any);
	}
	if (action === "count") {
		return payload.count({
			collection,
			...validate(CountQuerySchema, data),
		} as any);
	}
	if (action !== "get")
		throw new PayloadCollectionCLIError(
			"INVALID_ACTION",
			`Unsupported read action: ${action}`,
		);
	const query = validate(
		GetQuerySchema,
		typeof data === "string" || typeof data === "number"
			? { lookup: data }
			: data,
	);
	const { id, lookup, ...options } = query;
	const lookupField = config.mappings[collection]?.lookupField ?? "id";
	if (id !== undefined || lookupField === "id") {
		const doc = await payload.findByID({
			collection,
			id: id ?? lookup!,
			...options,
			disableErrors: true,
		} as any);
		if (doc == null)
			throw new PayloadCollectionCLIError(
				"DOCUMENT_NOT_FOUND",
				`Document not found: id=${id ?? lookup}`,
			);
		return doc;
	}
	// Fetch two to detect ambiguous non-unique mappings; never silently pick one.
	const result = await payload.find({
		collection,
		...options,
		where: { [lookupField]: { equals: lookup } },
		limit: 2,
	} as any);
	if (result.docs.length === 0)
		throw new PayloadCollectionCLIError(
			"DOCUMENT_NOT_FOUND",
			`Document not found: ${lookupField}=${lookup}`,
		);
	if (result.docs.length > 1)
		throw new PayloadCollectionCLIError(
			"DOCUMENT_NOT_UNIQUE",
			`Multiple documents match ${lookupField}=${lookup}. Use an explicit id.`,
		);
	return result.docs[0];
}

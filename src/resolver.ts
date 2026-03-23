import { Payload } from "payload";
import { CLIConfig } from "./types";
import { PayloadCollectionCLIError } from "./errors";

export async function resolveRelations(
	payload: Payload,
	collectionSlug: string,
	data: any,
	config: CLIConfig,
	isPartial = false,
) {
	const collection = payload.collections[collectionSlug];
	if (!collection) {
		throw new PayloadCollectionCLIError(
			"COLLECTION_NOT_FOUND",
			`Collection "${collectionSlug}" not found.`,
		);
	}

	const mappingConfig = config.mappings[collectionSlug];
	const resolved = { ...data };

	// Apply defaults only for non-partial updates (e.g. create, upsert-create, sync-add)
	if (!isPartial && mappingConfig?.defaults) {
		for (const [k, v] of Object.entries(mappingConfig.defaults)) {
			if (resolved[k] === undefined || resolved[k] === null) {
				resolved[k] = v;
			}
		}
	}

	async function resolveRecursive(fields: any[], currentData: any, prefix = "") {
		for (const field of fields) {
			const fullPath = prefix ? `${prefix}.${field.name}` : field.name;

			// Handle relationship
			if (field.type === "relationship" && currentData[field.name]) {
				currentData[field.name] = await resolveId(field, currentData[field.name]);
			}
			// Handle group
			else if (field.type === "group" && currentData[field.name]) {
				await resolveRecursive(field.fields, currentData[field.name], fullPath);
			}
			// Handle array
			else if (field.type === "array" && Array.isArray(currentData[field.name])) {
				for (const item of currentData[field.name]) {
					await resolveRecursive(field.fields, item, ""); // Arrays reset path context for items
				}
			}
			// Handle nested group fields even if the group object itself is missing (flattened paths)
			else if (field.type === "group" || field.type === "row" || field.type === "collapsible" || field.type === "tabs") {
				const nestedFields = field.fields || (field.tabs ? field.tabs.flatMap((t: any) => t.fields) : []);
				await resolveRecursive(nestedFields, currentData[field.name] || {}, fullPath);
			}
		}
	}

	async function resolveId(field: any, val: any) {
		const relationTo = Array.isArray(field.relationTo)
			? field.relationTo[0]
			: field.relationTo;
		const mapping = config.mappings[relationTo as string];
		if (!mapping) return val;

		const isArray = Array.isArray(val);
		const values = isArray ? val : [val];
		const resolvedIds: (string | number)[] = [];

		for (const v of values) {
			if (typeof v === "string" && v.length < 24) {
				const found = await payload.find({
					collection: relationTo as any,
					where: { [mapping.lookupField]: { equals: v } },
					limit: 1,
				});

				if (found.docs.length > 0) {
					resolvedIds.push(found.docs[0].id);
				} else if (mapping.onNotFound === "create") {
					const createdData = await resolveRelations(
						payload,
						relationTo as string,
						{ [mapping.lookupField]: v },
						config,
						false, // Auto-create is a full creation, apply defaults
					);
					const created = await payload.create({
						collection: relationTo as any,
						data: createdData,
					});
					resolvedIds.push(created.id);
				} else if (mapping.onNotFound === "error") {
					throw new PayloadCollectionCLIError(
						"RELATION_NOT_FOUND",
						`Relation not found: ${relationTo} (${mapping.lookupField}=${v})`,
					);
				} else {
					resolvedIds.push(v);
				}
			} else {
				resolvedIds.push(v);
			}
		}
		return isArray ? resolvedIds : resolvedIds[0];
	}

	await resolveRecursive(collection.config.fields, resolved);
	return resolved;
}

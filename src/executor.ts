import { Payload } from "payload";
import fs from "fs";
import readline from "readline";
import path from "path";
import { resolveRelations } from "./resolver";
import { Action, CLIConfig } from "./types";
import { PayloadCollectionCLIError } from "./errors";

function safeParseJson(input: string, slug: any = "INPUT_PARSE_FAILED"): any {
	try {
		return JSON.parse(input);
	} catch (err: any) {
		throw new PayloadCollectionCLIError(slug, `Failed to parse JSON: ${err.message}`, { input });
	}
}

export interface PatchOperation {
	op: "add" | "remove" | "replace" | "test";
	path: string;
	value?: any;
}

function buildNestedObject(path: string, value: any): any {
	const parts = path.split(".");
	const obj: any = {};
	let current = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		current[parts[i]] = {};
		current = current[parts[i]];
	}
	current[parts[parts.length - 1]] = value;
	return obj;
}

async function applyPatch(
	payload: Payload,
	collection: string,
	patch: PatchOperation[],
	config: CLIConfig,
) {
	for (const op of patch) {
		const pathParts = op.path.split("/").filter((p) => p !== "");
		
		// Handle append to collection
		if (op.path === "/-") {
			if (op.op === "add") {
				const resolved = await resolveRelations(payload, collection, op.value, config);
				await payload.create({
					collection: collection as any,
					data: resolved,
				});
				continue;
			}
		}

		// Handle identifier-based path: /[id=123]/field or /[id=123]
		const idMatch = pathParts[0]?.match(/^\[([^=]+)=(.+)\]$/);
		if (idMatch) {
			const [_, field, value] = idMatch;
			const subPath = pathParts.slice(1).join(".");

			// Find the document
			const existing = await payload.find({
				collection: collection as any,
				where: { [field]: { equals: value } },
				limit: 1,
				depth: 0, // Disable population for raw value comparison
			});

			if (existing.docs.length === 0) {
				throw new PayloadCollectionCLIError(
					"DOCUMENT_NOT_FOUND",
					`Document not found: ${field}=${value}`,
				);
			}
			const docId = existing.docs[0].id;

			switch (op.op) {
				case "replace":
				case "add": {
					const updateData = subPath ? buildNestedObject(subPath, op.value) : op.value;
					const resolved = await resolveRelations(
						payload, 
						collection, 
						updateData, 
						config,
						!!subPath // isPartial if subPath is present
					);
					await payload.update({
						collection: collection as any,
						id: docId,
						data: resolved,
					});
					break;
				}
				case "remove":
					if (subPath) {
						// Partial remove (set to null/undefined)
						await payload.update({
							collection: collection as any,
							id: docId,
							data: buildNestedObject(subPath, null),
						});
					} else {
						// Full delete
						await payload.delete({
							collection: collection as any,
							id: docId,
						});
					}
					break;
				case "test": {
					// Resolve relations in testing value for consistency
					const testData = subPath ? buildNestedObject(subPath, op.value) : op.value;
					const resolvedTest = await resolveRelations(payload, collection, testData, config, true);
					
					// Re-extract value from nested structure for comparison
					const expectedVal = subPath 
						? subPath.split('.').reduce((obj, key) => obj?.[key], resolvedTest)
						: resolvedTest;

					const currentVal = subPath 
						? subPath.split('.').reduce((obj, key) => obj?.[key], existing.docs[0])
						: existing.docs[0];
						
					if (JSON.stringify(currentVal) !== JSON.stringify(expectedVal)) {
						throw new PayloadCollectionCLIError(
							"PATCH_TEST_FAILED",
							`Test failed: ${op.path} value mismatch`,
						);
					}
					break;
				}
			}
			continue;
		}

		throw new PayloadCollectionCLIError(
			"PATCH_INVALID_PATH",
			`Unsupported patch path or operation: ${op.op} ${op.path}`,
		);
	}
}

async function processSingle(
	payload: Payload,
	collection: string,
	action: Action,
	data: any,
	config: CLIConfig,
) {
	const mapping = config.mappings[collection];
	const lookupField = mapping?.lookupField || "id";
	const patch: PatchOperation[] = [];

	switch (action) {
		case "create":
			patch.push({ op: "add", path: "/-", value: data });
			break;
		case "update":
			if (data[lookupField] === undefined) {
				throw new PayloadCollectionCLIError(
					"MISSING_LOOKUP_FIELD",
					`[update] Missing lookup field '${lookupField}' in data. Cannot perform update.`,
				);
			}
			patch.push({ 
				op: "replace", 
				path: `/[${lookupField}=${data[lookupField]}]`, 
				value: data 
			});
			break;
		case "delete":
			const delVal = typeof data === "object" ? data[lookupField] : data;
			if (delVal === undefined) {
				throw new PayloadCollectionCLIError(
					"MISSING_LOOKUP_FIELD",
					`[delete] Missing lookup field '${lookupField}' in action. Cannot perform delete.`,
				);
			}
			patch.push({ op: "remove", path: `/[${lookupField}=${delVal}]` });
			break;
		case "upsert":
			const upsertVal = data[lookupField];
			if (upsertVal === undefined) {
				throw new PayloadCollectionCLIError(
					"MISSING_LOOKUP_FIELD",
					`[upsert] Missing lookup field '${lookupField}' in data. Cannot perform upsert.`,
				);
			}
			const existing = await payload.find({
				collection: collection as any,
				where: { [lookupField]: { equals: upsertVal } },
				limit: 1,
			});
			if (existing.docs.length > 0) {
				patch.push({ op: "replace", path: `/[${lookupField}=${upsertVal}]`, value: data });
			} else {
				patch.push({ op: "add", path: "/-", value: data });
			}
			break;
		default:
			throw new PayloadCollectionCLIError(
				"INVALID_ACTION",
				`Action ${action} requires special handling or is unsupported in processSingle`,
			);
	}

	return await applyPatch(payload, collection, patch, config);
}

export async function execute(
	payload: Payload,
	collection: string,
	action: Action,
	input: string,
	config: CLIConfig,
) {
	if (action === "patch") {
		const patchContent = input.endsWith(".json")
			? fs.readFileSync(path.resolve(process.cwd(), input), "utf8")
			: input;
		const patch = safeParseJson(patchContent, "PATCH_PARSE_FAILED");
		return await applyPatch(payload, collection, Array.isArray(patch) ? patch : [patch], config);
	}

	if (action === "sync") {
		const sourceData = input.endsWith(".jsonl") 
			? await loadJsonl(input)
			: safeParseJson(input);
		
		const mapping = config.mappings[collection];
		const lookupField = mapping?.lookupField || "id";

		// Fetch all existing docs
		const targetData = await payload.find({
			collection: collection as any,
			limit: 10000, // Reasonable limit for CLI
		});

		const patch: PatchOperation[] = [];
		const sourceMap = new Map(sourceData.map((item: any) => [item[lookupField], item]));
		const targetMap = new Map(targetData.docs.map((doc: any) => [doc[lookupField], doc]));

		// To Add or Update
		for (const sourceItem of sourceData) {
			const id = sourceItem[lookupField];
			if (targetMap.has(id)) {
				patch.push({ op: "replace", path: `/[${lookupField}=${id}]`, value: sourceItem });
			} else {
				patch.push({ op: "add", path: "/-", value: sourceItem });
			}
		}

		// To Remove
		for (const targetDoc of targetData.docs) {
			const id = targetDoc[lookupField];
			if (!sourceMap.has(id)) {
				patch.push({ op: "remove", path: `/[${lookupField}=${id}]` });
			}
		}

		return await applyPatch(payload, collection, patch, config);
	}

	if (input.endsWith(".jsonl")) {
		const filePath = path.resolve(process.cwd(), input);
		const rl = readline.createInterface({
			input: fs.createReadStream(filePath),
		});
		for await (const line of rl) {
			if (line.trim())
				await processSingle(
					payload,
					collection,
					action,
					safeParseJson(line),
					config,
				);
		}
		return { status: "bulk success" };
	}
	
	return await processSingle(
		payload,
		collection,
		action,
		safeParseJson(input),
		config,
	);
}

async function loadJsonl(filePath: string): Promise<any[]> {
	const absolutePath = path.resolve(process.cwd(), filePath);
	const content = fs.readFileSync(absolutePath, "utf8");
	return content.split("\n").filter(l => l.trim()).map(l => safeParseJson(l));
}

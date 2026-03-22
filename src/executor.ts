import { Payload } from "payload";
import fs from "fs";
import readline from "readline";
import path from "path";
import { resolveRelations } from "./resolver";
import { Action, CLIConfig } from "./types";

async function processSingle(
	payload: Payload,
	collection: string,
	action: Action,
	data: any,
	config: CLIConfig,
) {
	const mapping = config.mappings[collection];
	const lookupField = mapping?.lookupField || "id";

	const resolved = await resolveRelations(payload, collection, data, config);

	switch (action) {
		case "create":
			console.log(
				`📝 [executor] Creating record in "${collection}" with resolved data:`,
				JSON.stringify(resolved, null, 2),
			);
			return await payload.create({
				collection: collection as any,
				data: resolved,
			});
		case "upsert":
			if (data[lookupField] === undefined) {
				throw new Error(
					`[upsert] Missing lookup field '${lookupField}' in data. Cannot perform upsert.`,
				);
			}
			const existingUpsert = await payload.find({
				collection: collection as any,
				where: { [lookupField]: { equals: data[lookupField] } },
			});
			if (existingUpsert.docs.length > 0) {
				return await payload.update({
					collection: collection as any,
					id: existingUpsert.docs[0].id,
					data: resolved,
				});
			}
			return await payload.create({
				collection: collection as any,
				data: resolved,
			});
		case "update":
			if (data[lookupField] === undefined) {
				throw new Error(
					`[update] Missing lookup field '${lookupField}' in data. Cannot perform update.`,
				);
			}
			return await payload.update({
				collection: collection as any,
				where: { [lookupField]: { equals: data[lookupField] } },
				data: resolved,
			});
		case "delete":
			const delVal = typeof data === "object" ? data[lookupField] : data;
			if (delVal === undefined) {
				throw new Error(
					`[delete] Missing lookup field '${lookupField}' in action. Cannot perform delete.`,
				);
			}
			return await payload.delete({
				collection: collection as any,
				where: { [lookupField]: { equals: delVal } },
			});
		default:
			throw new Error(`Unsupported action: ${action}`);
	}
}

export async function execute(
	payload: Payload,
	collection: string,
	action: Action,
	input: string,
	config: CLIConfig,
) {
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
					JSON.parse(line),
					config,
				);
		}
		return { status: "bulk success" };
	}
	return await processSingle(
		payload,
		collection,
		action,
		JSON.parse(input),
		config,
	);
}

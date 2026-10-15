import { beforeEach, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
	payloadAppDir,
	resetDatabase,
	runCLIFull,
	getCollectionData,
	runCLI,
} from "../../utils";
beforeEach(resetDatabase);
function call(collection: string, action: string, data?: unknown) {
	const reply = runCLIFull([
		collection,
		action,
		...(data === undefined ? [] : [JSON.stringify(data)]),
	]);
	expect(reply.status, reply.stderr).toBe(0);
	return JSON.parse(reply.stdout);
}
it("duplicates through native Payload behavior with overrides and returns JSON/new ID", () => {
	const original = call("categories", "createOne", {
		data: { name: "Original", displayName: "Inherited" },
	});
	const copy = call("categories", "duplicate", {
		id: original.id,
		data: { name: "Copy" },
	});
	expect(copy.id).not.toBe(original.id);
	expect(copy.displayName).toBe("Inherited");
	expect(call("categories", "findByID", { id: copy.id }).name).toBe("Copy");
	const missing = runCLIFull(["categories", "duplicate", '{"id":999999}']);
	expect(missing.status).toBe(1);
	expect(missing.stdout).toBe("");
	expect(getCollectionData("categories")).toHaveLength(2);
});
it("provides distinct, query-based bulk edits/deletes, and explicit all-documents authorization", () => {
	const file = path.join(payloadAppDir, "native-seed.jsonl");
	writeFileSync(
		file,
		["Alpha", "Beta", "Gamma"]
			.map((name) => JSON.stringify({ name, displayName: "Shared" }))
			.join("\n"),
	);
	runCLI(["categories", "create", file]);
	const distinct = call("categories", "findDistinct", { field: "displayName" });
	expect(distinct.values).toEqual([{ displayName: "Shared" }]);
	expect(distinct.totalDocs).toBe(1);
	expect(
		call("categories", "updateMany", {
			where: { name: { in: ["Alpha", "Beta"] } },
			data: { displayName: "Updated" },
		}).docs,
	).toHaveLength(2);
	expect(
		call("categories", "deleteMany", { where: { name: { equals: "Gamma" } } })
			.docs,
	).toHaveLength(1);
	const denied = runCLIFull(["categories", "deleteMany", '{"where":{}}']);
	expect(denied.status).toBe(1);
	expect(denied.stderr).toContain("allowAll");
	expect(
		call("categories", "deleteMany", { where: {}, allowAll: true }).docs,
	).toHaveLength(2);
	expect(getCollectionData("categories")).toHaveLength(0);
});
it("fails nonzero on partial bulk validation errors rather than reporting success", () => {
	call("categories", "createOne", { data: { name: "A" } });
	call("categories", "createOne", { data: { name: "B" } });
	const result = runCLIFull([
		"categories",
		"updateMany",
		JSON.stringify({
			where: { name: { in: ["A", "B"] } },
			data: { name: "Collision" },
		}),
	]);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("OPERATION_PARTIAL_FAILURE");
	const docs = getCollectionData("categories");
	expect(docs).toHaveLength(2);
	expect(docs.filter((doc) => doc.name === "Collision")).toHaveLength(1);
});
it("reads, counts and restores version IDs without confusing them with document IDs", () => {
	const doc = call("documents", "createOne", {
		data: { title: "First" },
		draft: true,
	});
	call("documents", "updateOne", {
		id: doc.id,
		data: { title: "Second" },
		draft: true,
	});
	const where = { parent: { equals: doc.id } };
	const history = call("documents", "findVersions", {
		where,
		sort: "createdAt",
	});
	expect(history.docs.length).toBeGreaterThanOrEqual(2);
	const first = history.docs.find(
		(version: any) => version.version.title === "First",
	);
	expect(first).toBeTruthy();
	expect(
		call("documents", "findVersionByID", { id: first.id }).version.title,
	).toBe("First");
	expect(call("documents", "countVersions", { where }).totalDocs).toBe(
		history.totalDocs,
	);
	expect(
		call("documents", "restoreVersion", { id: first.id, draft: true }).title,
	).toBe("First");
	expect(call("documents", "findByID", { id: doc.id, draft: true }).title).toBe(
		"First",
	);
});
it("supports drafts, publishing and unpublishing through native update options", () => {
	const doc = call("documents", "createOne", {
		data: { title: "Draft" },
		draft: true,
	});
	expect(doc._status).toBe("draft");
	expect(
		call("documents", "updateOne", {
			id: doc.id,
			data: { _status: "published" },
			draft: false,
		})._status,
	).toBe("published");
	expect(call("documents", "findByID", { id: doc.id })._status).toBe(
		"published",
	);
	expect(
		call("documents", "updateOne", { id: doc.id, data: { _status: "draft" } })
			._status,
	).toBe("draft");
});
it("supports soft-delete, trash reads, restore and explicit permanent deletion", () => {
	const doc = call("documents", "createOne", {
		data: { title: "Trash lifecycle" },
	});
	call("documents", "updateOne", {
		id: doc.id,
		data: { deletedAt: new Date().toISOString() },
	});
	expect(call("documents", "count").totalDocs).toBe(0);
	expect(
		call("documents", "findByID", { id: doc.id, trash: true }).deletedAt,
	).toBeTruthy();
	expect(
		call("documents", "updateOne", {
			id: doc.id,
			trash: true,
			data: { deletedAt: null },
		}).deletedAt,
	).toBeNull();
	call("documents", "deleteOne", { id: doc.id });
	expect(call("documents", "count", { trash: true }).totalDocs).toBe(0);
});
it("passes native filePath uploads and replacements through createOne/updateOne", () => {
	const file = path.join(payloadAppDir, "native upload with spaces.txt");
	writeFileSync(file, "first upload");
	const doc = call("media", "createOne", {
		data: { alt: "First" },
		filePath: file,
	});
	expect(doc.filename).toBeTruthy();
	expect(doc.alt).toBe("First");
	writeFileSync(file, "replacement upload");
	const updated = call("media", "updateOne", {
		id: doc.id,
		data: { alt: "Second" },
		filePath: file,
		overwriteExistingFiles: true,
	});
	expect(updated.alt).toBe("Second");
	call("media", "deleteOne", { id: doc.id });
});

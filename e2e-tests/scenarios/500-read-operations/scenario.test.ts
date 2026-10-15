import { beforeEach, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ACTIONS } from "../../../src/commands";
import {
	cliBin,
	e2eDir,
	getCollectionData,
	payloadAppDir,
	resetDatabase,
	runCLI,
	runCLIFull,
} from "../../utils";

beforeEach(() => {
	resetDatabase();
	const file = path.join(payloadAppDir, "read-seed.jsonl");
	writeFileSync(
		file,
		["Alpha", "Beta", "Gamma"]
			.map((name) => JSON.stringify({ name }))
			.join("\n"),
	);
	runCLI(["categories", "create", file]);
});
function read(action: string, input?: string, options: string[] = []) {
	const result = runCLIFull([
		...options,
		"categories",
		action,
		...(input === undefined ? [] : [input]),
	]);
	expect(result.status, result.stderr).toBe(0);
	return JSON.parse(result.stdout);
}
it("lists and finds paginated/filtered results with JSON-only stdout", () => {
	const list = read("list", '{"sort":"name","limit":1,"page":2}');
	expect(list.totalDocs).toBe(3);
	expect(list.page).toBe(2);
	expect(list.docs[0].name).toBe("Beta");
	const find = read(
		"find",
		'{"where":{"name":{"equals":"Alpha"}},"select":{"name":true}}',
	);
	expect(find.docs).toHaveLength(1);
	expect(find.docs[0].name).toBe("Alpha");
	expect(read("count", '{"where":{"name":{"equals":"Alpha"}}}')).toEqual({
		totalDocs: 1,
	});
});
it("gets by explicit ID and mapped lookup without changing data", () => {
	const before = getCollectionData("categories");
	expect(
		read("get", JSON.stringify({ id: before[0].id, select: { name: true } }))
			.name,
	).toBe(before[0].name);
	const mapping = JSON.stringify({
		mappings: { categories: { lookupField: "name", onNotFound: "create" } },
	});
	expect(read("get", '"Beta"', ["-j", mapping]).name).toBe("Beta");
	expect(getCollectionData("categories")).toEqual(before);
});
it("defaults list/find/count input to {} and keeps DEBUG logs off stdout", () => {
	const previous = process.env.DEBUG;
	process.env.DEBUG = "1";
	try {
		expect(read("list").docs).toHaveLength(3);
		expect(read("find").docs).toHaveLength(3);
		expect(read("count")).toEqual({ totalDocs: 3 });
		const config = path.join(payloadAppDir, "read-log.config.ts");
		writeFileSync(
			config,
			'console.log("CONFIG_LOG"); export const cliConfig = { mappings: {} };',
		);
		const result = runCLIFull(["-c", config, "categories", "count"]);
		expect(result.status, result.stderr).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({ totalDocs: 3 });
		expect(result.stderr).toContain("CONFIG_LOG");
	} finally {
		if (previous === undefined) delete process.env.DEBUG;
		else process.env.DEBUG = previous;
	}
});
it("fails cleanly on missing documents and invalid queries without mutation", () => {
	const mapping = JSON.stringify({
		mappings: { categories: { lookupField: "name", onNotFound: "create" } },
	});
	for (const [args, slug] of [
		[["-j", mapping, "categories", "get", '"Missing"'], "DOCUMENT_NOT_FOUND"],
		[["categories", "list", '{"overrideAccess":true}'], "QUERY_INVALID"],
		[["categories", "count", "{"], "INPUT_PARSE_FAILED"],
		[["categories", "delete"], "INPUT_REQUIRED"],
		[["absent", "list"], "COLLECTION_NOT_FOUND"],
	] as const) {
		const result = runCLIFull(args);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(`[${slug}]`);
		expect(result.stdout).toBe("");
	}
	expect(getCollectionData("categories")).toHaveLength(3);
});
it("describes every action without a Payload project or database", () => {
	const result = spawnSync(process.execPath, [cliBin, "--describe"], {
		cwd: e2eDir,
		encoding: "utf8",
		timeout: 15000,
	});
	expect(result.status, result.stderr).toBe(0);
	expect(Object.keys(JSON.parse(result.stdout).commands)).toEqual(ACTIONS);
});

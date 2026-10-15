import { expect, it } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { COMMANDS } from "../src/commands";

it("accounts for every public Collection document Local API method in the installed Payload version", () => {
	const require = createRequire(import.meta.url);
	const filename = path.join(
		path.dirname(require.resolve("payload")),
		"index.d.ts",
	);
	const source = ts.createSourceFile(
		filename,
		readFileSync(filename, "utf8"),
		ts.ScriptTarget.Latest,
		true,
	);
	const collectionOptionTypes = new Set<string>();
	for (const statement of source.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			!ts.isStringLiteral(statement.moduleSpecifier) ||
			!statement.moduleSpecifier.text.startsWith(
				"./collections/operations/local/",
			)
		)
			continue;
		const bindings = statement.importClause?.namedBindings;
		if (bindings && ts.isNamedImports(bindings))
			for (const element of bindings.elements)
				collectionOptionTypes.add(element.name.text);
	}
	expect(collectionOptionTypes.size).toBeGreaterThan(10);
	const base = source.statements.find(
		(statement) =>
			ts.isClassDeclaration(statement) &&
			statement.name?.text === "BasePayload",
	) as ts.ClassDeclaration;
	expect(base).toBeDefined();
	const methods = new Set<string>();
	for (const member of base.members) {
		let matches = false;
		function walk(node: ts.Node) {
			if (ts.isIdentifier(node) && collectionOptionTypes.has(node.text))
				matches = true;
			ts.forEachChild(node, walk);
		}
		walk(member);
		if (matches && member.name) methods.add(member.name.getText(source));
	}
	const covered = new Set(
		Object.values(COMMANDS).flatMap((command) =>
			"payloadMethod" in command ? [command.payloadMethod] : [],
		),
	);
	// A new upstream method fails here until its CLI surface and permissions are classified.
	expect([...covered].sort()).toEqual([...methods].sort());
});

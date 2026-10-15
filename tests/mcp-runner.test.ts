import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CLIRunner } from "../src/mcp/runner";
const roots: string[] = [],
	runners: CLIRunner[] = [];
afterEach(() => {
	for (const runner of runners.splice(0)) runner.close();
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});
function fixture(
	code: string,
	options: { timeoutMs?: number; maxOutputBytes?: number } = {},
) {
	const root = mkdtempSync(path.join(os.tmpdir(), "payload-mcp-"));
	roots.push(root);
	const cliPath = path.join(root, "fake-cli.cjs");
	writeFileSync(cliPath, code);
	const runner = new CLIRunner({ projectRoot: root, cliPath, ...options });
	runners.push(runner);
	return runner;
}
it("preserves literal argv, fixed cwd, stdout/stderr and nonzero exit status", async () => {
	const runner = fixture(
		'console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() })); console.error("stderr log"); process.exitCode = 7;',
	);
	const args = [
		"--",
		"collection with spaces",
		'$(touch /tmp/never) ; "quotes"',
	];
	const output = await runner.run(args);
	expect(output.exitCode).toBe(7);
	expect(output.stderr).toContain("stderr log");
	expect(JSON.parse(output.stdout)).toEqual({ args, cwd: runner.projectRoot });
});
it("bounds runtime and reports timeouts", async () => {
	const runner = fixture("setInterval(() => {}, 1000)", { timeoutMs: 100 });
	expect((await runner.run([])).error).toContain("timed out");
});
it("bounds combined captured output", async () => {
	const runner = fixture(
		'process.stdout.write("x".repeat(50000));setInterval(() => {}, 1000)',
		{ maxOutputBytes: 1000 },
	);
	const output = await runner.run([]);
	expect(output.error).toContain("output limit");
	expect(Buffer.byteLength(output.stdout + output.stderr)).toBeLessThanOrEqual(
		1000,
	);
});
it("cancels active requests and refuses pre-cancelled requests", async () => {
	const runner = fixture("setInterval(() => {}, 1000)");
	const abort = new AbortController();
	const pending = runner.run([], abort.signal);
	abort.abort();
	expect((await pending).error).toContain("cancelled");
	expect((await runner.run([], abort.signal)).error).toContain("cancelled");
});
it("kills active children on server close and refuses subsequent operations", async () => {
	const runner = fixture("setInterval(() => {}, 1000)");
	const pending = runner.run([]);
	runner.close();
	expect((await pending).signal).toBeTruthy();
	expect((await runner.run([])).error).toContain("closed");
});
it("reports CLI spawn/entry failures", async () => {
	const runner = fixture('throw new Error("broken config")');
	const output = await runner.run([]);
	expect(output.exitCode).not.toBe(0);
	expect(output.stderr).toContain("broken config");
});

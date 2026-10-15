import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const e2eDir = path.dirname(fileURLToPath(import.meta.url));
export const payloadAppDir = path.join(e2eDir, "_payload");
export const cliBin = path.resolve(e2eDir, "../dist/bin.js");

function runNode(args: readonly string[]) {
	const result = spawnSync(process.execPath, ["--import", "tsx", ...args], {
		cwd: payloadAppDir,
		encoding: "utf8",
		shell: false,
		timeout: 55000,
		maxBuffer: 16 * 1024 * 1024,
		env: {
			...process.env,
			NODE_OPTIONS: "--max-old-space-size=4096",
			PAYLOAD_SECRET: "e2e-only-not-a-production-secret-at-least-32-chars",
			DATABASE_URL: `file:${path.join(payloadAppDir, "payload.db")}`,
			PAYLOAD_TELEMETRY_DISABLED: "1",
		},
	});
	if (result.error) throw result.error;
	if (result.signal || result.status === null) {
		throw new Error(`Subprocess terminated: ${result.signal}\n${result.stderr}`);
	}
	return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

/** Never concatenate arguments into a shell command. */
export function runCLIFull(args: readonly string[]) {
	return runNode([cliBin, ...args]);
}

/** Success is the default; negative scenarios must explicitly expect failure. */
export function runCLI(args: readonly string[], expectedStatus = 0): string {
	const result = runCLIFull(args);
	if (result.status !== expectedStatus) {
		throw new Error(`Expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}\n${result.stderr}`);
	}
	return result.stdout + result.stderr;
}

/** Only the disposable fixture DB is reset. Scenarios must run serially. */
export function resetDatabase() {
	for (const suffix of ["", "-wal", "-shm", "-journal"]) {
		fs.rmSync(path.join(payloadAppDir, `payload.db${suffix}`), { force: true });
	}
}

export function getCollectionData(collection: string) {
	const result = runNode([path.join(e2eDir, "read-db.ts"), collection]);
	if (result.status !== 0) {
		throw new Error(`Database inspection failed\n${result.stdout}\n${result.stderr}`);
	}
	const lines = result.stdout.split("\n").filter((line) => line.startsWith("__E2E_DATA__"));
	if (lines.length !== 1) throw new Error(`Missing or ambiguous database result: ${result.stdout}`);
	const docs: unknown = JSON.parse(lines[0].slice("__E2E_DATA__".length));
	if (!Array.isArray(docs)) throw new Error("Database inspection did not return an array");
	return docs;
}

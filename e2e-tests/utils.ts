import { execSync, spawnSync } from "child_process";
import path from "path";
import fs from "fs";

export const e2eDir = path.resolve(__dirname);
export const payloadAppDir = path.join(e2eDir, "_payload");
export const cliBin = path.resolve(e2eDir, "../dist/bin.js");
const tsxLoader = path.resolve(e2eDir, "../node_modules/tsx/dist/loader.mjs");
const nodeCommand = `"${process.execPath}" --import "${tsxLoader}"`;
const execPrefix = process.platform === "win32" ? "" : "exec ";

/**
 * Runs the CLI command inside the dummy _payload application environment.
 */
export function runCLI(args: string): string {
	const { stdout, stderr } = runCLIFull(args);
	return stdout + stderr;
}

export function runCLIFull(args: string): { stdout: string; stderr: string; status: number } {
	const envCmd = process.platform === "win32"
		? ""
		: 'export $(grep -v "^#" .env | xargs) && ';
	const result = spawnSync(`${envCmd}${execPrefix}${nodeCommand} "${cliBin}" ${args}`, {
		cwd: payloadAppDir,
		encoding: "utf8",
		shell: true,
		env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
		maxBuffer: 16 * 1024 * 1024,
		timeout: 55000,
	});
	if (result.error) throw result.error;
	const status = result.status ?? 1;
	const stderr = result.stderr + (result.signal ? `\nCLI terminated by ${result.signal}` : "");
	if (status !== 0) console.error(`[E2E CLI exit ${status}] ${stderr}`);
	return { stdout: result.stdout, stderr, status };
}

export function resetDatabase() {
	for (const suffix of ["", "-wal", "-shm", "-journal"]) {
		fs.rmSync(path.join(payloadAppDir, `payload.db${suffix}`), { force: true });
	}
}

export function getCollectionData(collection: string) {
	const scriptContent = String.raw`
import { getPayload } from 'payload';
import configPromise from './src/payload.config';
async function run() {
  const payload = await getPayload({ config: await configPromise });
  const docs = await payload.find({ collection: '${collection}' });
  await payload.destroy();
  process.stdout.write(JSON.stringify(docs.docs) + '\n', () => process.exit(0));
}
await run();
  `;
	const scriptPath = path.join(payloadAppDir, "check-db.ts");
	fs.writeFileSync(scriptPath, scriptContent);
	const out = execSync(
		`export $(grep -v '^#' .env | xargs) && ${execPrefix}${nodeCommand} check-db.ts`,
		{
			cwd: payloadAppDir,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 55000,
		},
	);
	fs.unlinkSync(scriptPath);
	try {
		const lines = out.split("\n");
		for (let i = lines.length - 1; i >= 0; i--) {
			if (lines[i].trim().startsWith("[")) return JSON.parse(lines[i].trim());
		}
	} catch (err) {}
	return [];
}

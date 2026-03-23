import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export const e2eDir = path.resolve(__dirname);
export const payloadAppDir = path.join(e2eDir, "_payload");
export const cliBin = path.resolve(e2eDir, "../dist/bin.js");

/**
 * Runs the CLI command inside the dummy _payload application environment.
 */
export function runCLI(args: string): string {
	const { stdout, stderr } = runCLIFull(args);
	return stdout + stderr;
}

export function runCLIFull(args: string): { stdout: string; stderr: string; status: number } {
	try {
		const envCmd =
			process.platform === "win32"
				? ""
				: 'export $(grep -v "^#" .env | xargs) && ';
		const command = `NODE_OPTIONS="--max-old-space-size=4096" ${envCmd}npx tsx ${cliBin} ${args}`;

		const stdout = execSync(command, {
			cwd: payloadAppDir,
			encoding: "utf-8",
			stdio: "pipe",
		});
		return { stdout, stderr: "", status: 0 };
	} catch (err: any) {
		const stdout = err.stdout?.toString() || "";
		const stderr = err.stderr?.toString() || "";
		return { stdout, stderr, status: err.status || 1 };
	}
}

export function resetDatabase() {
	const dbPath = path.join(payloadAppDir, "payload.db");
	if (fs.existsSync(dbPath)) {
		fs.unlinkSync(dbPath);
	}
}

export function getCollectionData(collection: string) {
	const scriptContent = `
import { getPayload } from 'payload';
import configPromise from './src/payload.config';
async function run() {
  const payload = await getPayload({ config: await configPromise });
  const docs = await payload.find({ collection: '${collection}' });
  console.log(JSON.stringify(docs.docs));
  process.exit(0);
}
run();
  `;
	const scriptPath = path.join(payloadAppDir, "check-db.ts");
	fs.writeFileSync(scriptPath, scriptContent);
	const out = execSync(
		`export $(grep -v '^#' .env | xargs) && npx tsx check-db.ts`,
		{
			cwd: payloadAppDir,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
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

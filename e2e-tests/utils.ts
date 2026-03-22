import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export const e2eDir = path.resolve(__dirname);
export const payloadAppDir = path.join(e2eDir, '_payload');
export const cliBin = path.resolve(e2eDir, '../dist/bin.js');

/**
 * Runs the CLI command inside the dummy _payload application environment.
 */
export function runCLI(args: string) {
  try {
    return execSync(`export $(grep -v '^#' .env | xargs) && node ${cliBin} ${args}`, {
      cwd: payloadAppDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (err: any) {
    if (err.stdout || err.stderr) {
      return (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
}
    return err.message;
  }
}

export function resetDatabase() {
  const dbPath = path.join(payloadAppDir, 'payload.db');
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
  const scriptPath = path.join(payloadAppDir, 'check-db.ts');
  fs.writeFileSync(scriptPath, scriptContent);
  const out = execSync(`export $(grep -v '^#' .env | xargs) && npx tsx check-db.ts`, {
    cwd: payloadAppDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  fs.unlinkSync(scriptPath);
  try {
    const lines = out.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('[')) return JSON.parse(lines[i].trim());
    }
  } catch (err) {}
  return [];
}

export class TempFile {
  constructor(public filename: string, public content: string) {}
}

/**
 * Materializes an array of TempFile instances to disk, runs a callback, 
 * and strictly guarantees their cleanup afterward.
 */
export function withTempFiles<T>(files: TempFile[], callback: () => T): T {
  const writtenPaths: string[] = [];
  try {
    for (const file of files) {
      const filepath = path.join(payloadAppDir, file.filename);
      fs.writeFileSync(filepath, file.content.trim() + '\n');
      writtenPaths.push(filepath);
    }
    return callback();
  } finally {
    for (const filepath of writtenPaths) {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
  }
}

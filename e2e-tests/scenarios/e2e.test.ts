import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Payload Collection CLI E2E Scenarios', () => {
  const e2eDir = path.resolve(__dirname, '..');
  const payloadAppDir = path.join(e2eDir, '_payload');
  const cliBin = path.resolve(e2eDir, '../dist/bin.js');

  const runCLI = (args: string) => {
    try {
      if (!fs.existsSync(payloadAppDir)) {
         throw new Error(`Directory _payload does not exist. Did you run 'mise run init'?`);
      }
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
  };

  it('正常系: should successfully upsert with explicit config option mapping email', () => {
    const output = runCLI('-c ../payload-collection-cli.config.ts users upsert ../data.jsonl');
    expect(output).toContain('Operation successful');
  });

  it('異常系: should throw Error when missing lookupField explicitly enforcing specification', () => {
    const output = runCLI('users upsert ../data.jsonl');
    expect(output).toContain("Missing lookup field 'id' in data");
  });
});

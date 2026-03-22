import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Success mapping upsert', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('upserts users using email as lookup variable provided by strict configuration', () => {
    // 💡 In an `upsert` operation, we must provide a configuration to use `email` 
    // for existence checks instead of the default `id`.
    // We achieve this by explicitly passing a file-based configuration to the CLI.
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    const configPath = path.resolve(__dirname, 'config.ts');
    
    const output = runCLI(`-c ${configPath} users upsert ${dataPath}`);
    
    expect(output).toContain('Operation successful');

    const users = getCollectionData('users');
    expect(users).toHaveLength(2);
    const emails = users.map((u: any) => u.email);
    expect(emails).toContain('alice@example.com');
  }, 30000);
});

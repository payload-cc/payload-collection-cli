import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Success mapping upsert', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('upserts users using email as lookup variable provided by strict configuration', () => {
    // 💡 By default, upsert strictly requires an 'id' field for existence checks.
    // Since our JSONL data lacks 'id', we must pass an explicit file config 
    // instructing the CLI to use 'email' as the lookup field.
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

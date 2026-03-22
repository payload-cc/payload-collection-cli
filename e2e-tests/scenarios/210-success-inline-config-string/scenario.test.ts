import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Success mapping upsert via inline string config', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('upserts users using an inline JSON string for lookupField', () => {
    // 💡 In an `upsert` operation, we must provide a configuration to use `email` 
    // for existence checks instead of the default `id`.
    // We achieve this by directly supplying an inline JSON string to the CLI.
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    
    // Pass config directly as an inline JSON string
    const output = runCLI(`-j '{"mappings":{"users":{"lookupField":"email"}}}' users upsert ${dataPath}`);
    
    expect(output).toContain('Operation successful');

    const users = getCollectionData('users');
    expect(users).toHaveLength(2);
    const emails = users.map((u: any) => u.email);
    expect(emails).toContain('inline1@example.com');
  }, 30000);
});

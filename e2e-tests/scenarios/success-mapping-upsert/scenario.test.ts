import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getUsers } from '../../utils';
import path from 'path';

describe('Success: Mapping Upsert', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('should successfully upsert with explicit config option mapping email', () => {
    const configPath = path.resolve(__dirname, 'config.ts');
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    
    const output = runCLI(`-c ${configPath} users upsert ${dataPath}`);
    expect(output).toContain('Operation successful');

    const users = getUsers();
    expect(users).toHaveLength(2);
    const emails = users.map((u: any) => u.email);
    expect(emails).toContain('alice@example.com');
    expect(emails).toContain('bob@example.com');
  }, 30000);
});

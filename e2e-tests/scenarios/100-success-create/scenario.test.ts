import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Success Create', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('creates a new user successfully from a JSONL file', () => {
    const dataFile = path.resolve(__dirname, 'data.jsonl');
    
    // runCLI returns the string output of the command
    const output = runCLI(`users create ${dataFile}`);

    expect(output).toContain('Operation successful');

    const users = getCollectionData('users');
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('charlie@example.com');
  }, 60000);
});

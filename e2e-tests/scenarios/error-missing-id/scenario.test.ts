import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getUsers } from '../../utils';
import path from 'path';

describe('Error: Missing ID Scenario', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('should throw Error when missing lookupField explicitly enforcing specification', () => {
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    
    const output = runCLI(`users upsert ${dataPath}`);
    expect(output).toContain("Missing lookup field 'id' in data");

    // Ensure database remained totally empty
    const users = getUsers();
    expect(users).toHaveLength(0);
  }, 30000);
});

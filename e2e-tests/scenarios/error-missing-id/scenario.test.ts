import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Error: Missing ID Scenario', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('should throw Error when missing lookupField explicitly enforcing specification', () => {
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    
    // Testing the default behavior without config where "id" is strictly required
    const output = runCLI(`users upsert ${dataPath}`);
    expect(output).toContain("Missing lookup field 'id' in data");

    // Ensure database remained totally empty
    const users = getCollectionData('users');
    expect(users).toHaveLength(0);
  }, 30000);
});

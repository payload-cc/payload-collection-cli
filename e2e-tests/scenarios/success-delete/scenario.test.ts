import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Success delete', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('deletes a user successfully', () => {
    // 1. Create a user first
    const userData = JSON.stringify({ email: 'delete-me@example.com', name: 'Delete Me', password: 'password123' });
    runCLI(`users create '${userData}'`);
    
    expect(getCollectionData('users')).toHaveLength(1);

    // 2. Delete the user
    const deleteData = JSON.stringify({ email: 'delete-me@example.com' });
    const output = runCLI(`-j '{"mappings":{"users":{"lookupField":"email"}}}' users delete '${deleteData}'`);
    
    expect(output).toContain('Operation successful');
    expect(getCollectionData('users')).toHaveLength(0);
  }, 60000);
});

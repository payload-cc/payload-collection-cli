import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Success update', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('updates a specific field of a user successfully', () => {
    // 1. Create a user first
    const userData = JSON.stringify({ email: 'update-me@example.com', name: 'Original Name', password: 'password123' });
    runCLI(`users create '${userData}'`);
    
    // 2. Update the user's name
    const updateData = JSON.stringify({ email: 'update-me@example.com', name: 'Updated Name' });
    const output = runCLI(`-j '{"mappings":{"users":{"lookupField":"email"}}}' users update '${updateData}'`);
    
    expect(output).toContain('Operation successful');
    
    const users = getCollectionData('users');
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Updated Name');
    expect(users[0].email).toBe('update-me@example.com');
  }, 60000);
});

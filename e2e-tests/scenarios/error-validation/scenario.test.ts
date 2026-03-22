import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Error validation', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('fails when a required field is missing in create', () => {
    // 1. Attempt to create a post missing the required 'title'
    const postData = JSON.stringify({ author: 'dev@example.com', category: 'general' });
    const output = runCLI(`posts create '${postData}'`);
    
    // 2. Verify the output contains the validation error
    expect(output).toContain('Error:');
    expect(output.toLowerCase()).toContain('error');
    expect(output.toLowerCase()).toContain('title');
    expect(output.toLowerCase()).toContain('author');
    expect(output.toLowerCase()).toContain('category');
    
    expect(getCollectionData('posts')).toHaveLength(0);
  }, 60000);

  it('fails when a unique constraint is violated in create', () => {
    // 1. Create a category
    const output1 = runCLI(`categories create '{"name": "unique-cat", "displayName": "Unique"}'`);
    expect(output1).toContain('Operation successful');
    
    // 2. Attempt to create another category with the same name
    const output = runCLI(`categories create '{"name": "unique-cat", "displayName": "Duplicate"}'`);
    
    // 3. Verify the output contains the unique constraint error
    expect(output.toLowerCase()).toContain('error');
    expect(output.toLowerCase()).toContain('name');
    
    expect(getCollectionData('categories')).toHaveLength(1);
  }, 60000);
});

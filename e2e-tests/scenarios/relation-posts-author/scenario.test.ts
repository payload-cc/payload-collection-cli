import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Relation auto-resolution', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('safely binds relational fields through pure email string specifications', () => {
    // 💡 Tests automatic relational field resolution (mapping 'author' email directly to User ID).

    // 1. Preparation: Upsert the author
    const userDataPath = path.resolve(__dirname, '..', 'success-mapping-upsert', 'data.jsonl');
    const userConfigPath = path.resolve(__dirname, '..', 'success-mapping-upsert', 'config.ts');
    runCLI(`-c ${userConfigPath} users upsert ${userDataPath}`);

    // 2. Main Execution: Upsert the Post referencing the author by their email string
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    const configPath = path.resolve(__dirname, 'config.ts');
    
    const output = runCLI(`-c ${configPath} posts upsert ${dataPath}`);
    expect(output).toContain('Operation successful');

    const users = getCollectionData('users');
    const posts = getCollectionData('posts');
    const alice = users.find((u: any) => u.email === 'alice@example.com');

    expect(posts).toHaveLength(1);
    // Assure Payload successfully bridged the relationship automatically converting string -> ID!
    expect(posts[0].author.id).toBe(alice.id);
  }, 30000);
});

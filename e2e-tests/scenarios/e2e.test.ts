import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, getCollectionData, runCLI, TempFile, withTempFiles } from '../utils';

describe('Payload Collection CLI E2E Scenarios (Consolidated)', () => {
  beforeEach(() => resetDatabase());

  it('[Success] Mapping Upsert via Inline Config String', () => {
    // 💡 By default, upsert strictly requires an 'id' field for existence checks.
    // Since our JSONL data lacks 'id', we must pass an explicit inline config 
    // instructing the CLI to use 'email' as the lookup field.
    const dataFile = new TempFile('data.jsonl', `
{"email":"alice@example.com","password":"password123"}
{"email":"bob@example.com","password":"password123"}
    `);

    withTempFiles([dataFile], () => {
      const output = runCLI(`-c '{"mappings":{"users":{"lookupField":"email"}}}' users upsert data.jsonl`);
      expect(output).toContain('Operation successful');
    });

    const users = getCollectionData('users');
    expect(users).toHaveLength(2);
    
    const emails = users.map((u: any) => u.email);
    expect(emails).toContain('alice@example.com');
    expect(emails).toContain('bob@example.com');
  }, 30000);

  it('[Failure] Missing ID Scenario explicitly enforcing specification', () => {
    // 💡 Conversely, attempting to upsert data lacking 'id' without providing 
    // a configuration mapping will strictly trigger the specification error.
    const dataFile = new TempFile('data.jsonl', `
{"email":"charlie@example.com","password":"password123"}
{"email":"dave@example.com","password":"password123"}
    `);

    withTempFiles([dataFile], () => {
      const output = runCLI(`users upsert data.jsonl`);
      // Verify application deliberately crashes and catches the missing lookup field
      expect(output).toContain("Missing lookup field 'id' in data");
    });

    const users = getCollectionData('users');
    expect(users).toHaveLength(0); // Assure database remains completely untouched
  }, 30000);

  it('[Success] Multi-collection Relation via File Config', () => {
    // 💡 Tests both traditional file-based configuration loading, and
    // automatic relational field resolution (mapping 'author' email directly to User ID).

    // 1. Preparation: Upsert the author via inline config
    const userFile = new TempFile('user.jsonl', `
{"email":"eve@example.com","password":"password123"}
    `);

    withTempFiles([userFile], () => {
      runCLI(`-c '{"mappings":{"users":{"lookupField":"email"}}}' users upsert user.jsonl`);
    });

    // 2. Main Execution: Upsert the Post referencing the author by their email string
    const postFile = new TempFile('post.jsonl', `
{"title":"My E2E Post","author":"eve@example.com"}
    `);

    const configFile = new TempFile('payload-collection-cli.config.ts', `
export const cliConfig = {
  mappings: {
    users: { lookupField: 'email' },
    posts: { lookupField: 'title' }
  }
};
    `);

    withTempFiles([postFile, configFile], () => {
      const output = runCLI(`-c payload-collection-cli.config.ts posts upsert post.jsonl`);
      expect(output).toContain('Operation successful');
    });

    const users = getCollectionData('users');
    const posts = getCollectionData('posts');
    const eve = users.find((u: any) => u.email === 'eve@example.com');

    expect(posts).toHaveLength(1);
    // Assure Payload successfully bridged the relationship automatically converting string -> ID!
    expect(posts[0].author.id).toBe(eve.id);
  }, 30000);
});

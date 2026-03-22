import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../utils';
import path from 'path';
import fs from 'fs';

describe('Payload Collection CLI E2E Scenarios (Consolidated)', () => {
  beforeEach(() => resetDatabase());

  it('[Success] Mapping Upsert via Inline Config String', () => {
    // Heredoc style config & data creation ensures file is completely self-contained
    const data = `{"email":"alice@example.com","password":"password123"}
{"email":"bob@example.com","password":"password123"}`;
    const dataPath = path.join(__dirname, 'temp-success.jsonl');
    fs.writeFileSync(dataPath, data);

    const inlineConfig = JSON.stringify({ mappings: { users: { lookupField: 'email' } } });
    
    // Testing string config `-c '...'`
    const output = runCLI(`-c '${inlineConfig}' users upsert ${dataPath}`);
    expect(output).toContain('Operation successful');

    const users = getCollectionData('users');
    expect(users).toHaveLength(2);
    const emails = users.map((u: any) => u.email);
    expect(emails).toContain('alice@example.com');
    expect(emails).toContain('bob@example.com');
    
    fs.unlinkSync(dataPath);
  }, 30000);

  it('[Failure] Missing ID Scenario explicitly enforcing specification', () => {
    const data = `{"email":"charlie@example.com","password":"password123"}
{"email":"dave@example.com","password":"password123"}`;
    const dataPath = path.join(__dirname, 'temp-error.jsonl');
    fs.writeFileSync(dataPath, data);
    
    // Testing the default behavior without config where "id" is strictly required
    const output = runCLI(`users upsert ${dataPath}`);
    expect(output).toContain("Missing lookup field 'id' in data");

    const users = getCollectionData('users');
    expect(users).toHaveLength(0);

    fs.unlinkSync(dataPath);
  }, 30000);

  it('[Success] Multi-collection Relation via File Config', () => {
    // 1. Create User internally first via inline data
    const userData = `{"email":"eve@example.com","password":"password123"}`;
    const userDataPath = path.join(__dirname, 'temp-user.jsonl');
    fs.writeFileSync(userDataPath, userData);
    const userInlineConfig = JSON.stringify({ mappings: { users: { lookupField: 'email' } } });
    runCLI(`-c '${userInlineConfig}' users upsert ${userDataPath}`);

    // 2. Setup Post data and File Config for relation
    const postData = `{"title":"My E2E Post","author":"eve@example.com"}`;
    const postDataPath = path.join(__dirname, 'temp-post.jsonl');
    fs.writeFileSync(postDataPath, postData);

    // Using traditional typescript payload config structure for tests verifying file reads
    const configFileContent = `
export const cliConfig = {
  mappings: {
    users: { lookupField: 'email' },
    posts: { lookupField: 'title' }
  }
};
    `;
    const configFilePath = path.join(__dirname, 'temp-config.ts');
    fs.writeFileSync(configFilePath, configFileContent);

    // Call CLI using FILE config to prove file-loading still reliably works
    const out = runCLI(`-c ${configFilePath} posts upsert ${postDataPath}`);
    expect(out).toContain('Operation successful');

    const users = getCollectionData('users');
    const posts = getCollectionData('posts');
    const eve = users.find((u: any) => u.email === 'eve@example.com');

    expect(posts).toHaveLength(1);
    expect(posts[0].author.id).toBe(eve.id);

    // Cleanup
    fs.unlinkSync(userDataPath);
    fs.unlinkSync(postDataPath);
    fs.unlinkSync(configFilePath);
  }, 30000);
});

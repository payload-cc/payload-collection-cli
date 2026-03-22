import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Relation auto-create and defaults', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('injects default relationship values and auto-creates them if they do not exist', () => {
    // 💡 Tests two advanced config features:
    // 1. `defaults`: Post lacks a `category`, so CLI injects "default"
    // 2. `onNotFound: 'create'`: The "default" category doesn't exist in DB, so CLI creates it on-the-fly!

    // 1. Preparation: Upsert the author
    const userDataPath = path.resolve(__dirname, '..', 'success-mapping-upsert', 'data.jsonl');
    const userConfigPath = path.resolve(__dirname, '..', 'success-mapping-upsert', 'config.ts');
    runCLI(`-c ${userConfigPath} users upsert ${userDataPath}`);

    // 2. Main Execution: Upsert the Post (lacking category!)
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    const configPath = path.resolve(__dirname, 'config.ts');
    
    const output = runCLI(`-c ${configPath} posts create ${dataPath}`);
    expect(output).toContain('Operation successful');

    const categories = getCollectionData('categories');
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('default');

    const posts = getCollectionData('posts');
    expect(posts).toHaveLength(1);
    
    // Assure Payload successfully bridged the missing relationship by auto-creating it
    expect(posts[0].category.id).toBe(categories[0].id);
  }, 60000);
});

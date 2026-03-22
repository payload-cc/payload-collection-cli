import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData } from '../../utils';
import path from 'path';

describe('Config with cross-file import', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('resolves defaults from an imported constant in a separate project file', () => {
    // 💡 This test verifies that the CLI config file can use standard TypeScript imports
    // to reference constants defined elsewhere in the Payload app.
    // The config imports DEFAULT_CATEGORY_NAME ('uncategorized') from src/constants.ts,
    // uses it as the default value for the post's category field.
    // Combined with onNotFound:'create', the category is auto-created from that imported value.

    // 1. Preparation: Upsert the author
    const userDataPath = path.resolve(__dirname, '..', 'success-mapping-upsert', 'data.jsonl');
    const userConfigPath = path.resolve(__dirname, '..', 'success-mapping-upsert', 'config.ts');
    runCLI(`-c ${userConfigPath} users upsert ${userDataPath}`);

    // 2. Main Execution: Upsert a Post without specifying category
    //    The config's defaults.category is imported from src/constants.ts => 'uncategorized'
    const dataPath = path.resolve(__dirname, 'data.jsonl');
    const configPath = path.resolve(__dirname, 'config.ts');

    const output = runCLI(`-c ${configPath} posts upsert ${dataPath}`);
    expect(output).toContain('Operation successful');

    // 3. Verify the auto-created category name matches the imported constant
    const categories = getCollectionData('categories');
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('uncategorized'); // From imported DEFAULT_CATEGORY_NAME

    const posts = getCollectionData('posts');
    expect(posts).toHaveLength(1);
    expect(posts[0].category.id).toBe(categories[0].id);
  }, 60000);
});

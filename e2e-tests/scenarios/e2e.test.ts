import { describe, it, expect, beforeEach } from 'vitest';
import { runCLI, resetDatabase, getCollectionData, withTempFile } from '../utils';

describe('Payload Collection CLI E2E Scenarios (Consolidated)', () => {
  beforeEach(() => resetDatabase());

  it('[Success] Mapping Upsert via Inline Config String', () => {
    // 💡 upsertはデフォルトで「id」による存在確認を厳格に要求します。
    // 今回の入力データには id が含まれていないため、代わりに「email」で存在確認を行うよう
    // CLI に明示的に設定 (config) を渡してあげる必要があります。
    const config = {
      mappings: {
        users: { lookupField: 'email' },
      },
    };

    // 視覚的に直感的なオブジェクト配列から JSONL (改行区切りJSON) 文字列を生成
    const dataset = [
      { email: 'alice@example.com', password: 'password123' },
      { email: 'bob@example.com', password: 'password123' },
    ];
    const jsonlContent = dataset.map((obj) => JSON.stringify(obj)).join('\n');

    withTempFile('temp-success.jsonl', jsonlContent, (dataPath) => {
      const inlineConfigPattern = JSON.stringify(config);
      const output = runCLI(`-c '${inlineConfigPattern}' users upsert ${dataPath}`);
      
      expect(output).toContain('Operation successful');

      const users = getCollectionData('users');
      expect(users).toHaveLength(2);
      
      const emails = users.map((u: any) => u.email);
      expect(emails).toContain('alice@example.com');
      expect(emails).toContain('bob@example.com');
    });
  }, 30000);

  it('[Failure] Missing ID Scenario explicitly enforcing specification', () => {
    // 💡 逆に、設定ファイル(config)を一切渡さず、id を持たないデータを upsert しようとすると、
    // 仕様通り厳格にエラー (Missing lookup field 'id') が返ることを確認します。
    const dataset = [
      { email: 'charlie@example.com', password: 'password123' },
      { email: 'dave@example.com', password: 'password123' },
    ];
    const jsonlContent = dataset.map((obj) => JSON.stringify(obj)).join('\n');

    withTempFile('temp-error.jsonl', jsonlContent, (dataPath) => {
      const output = runCLI(`users upsert ${dataPath}`);
      // アプリケーションが意図的にクラッシュすることを確認
      expect(output).toContain("Missing lookup field 'id' in data");

      const users = getCollectionData('users');
      expect(users).toHaveLength(0); // DBには一切書き込まれないことを保証
    });
  }, 30000);

  it('[Success] Multi-collection Relation via File Config', () => {
    // 1. 事前準備: ユーザー(author)をインライン設定を利用して upsert 作成
    const userDataset = [{ email: 'eve@example.com', password: 'password123' }];
    const userJsonl = userDataset.map((obj) => JSON.stringify(obj)).join('\n');
    const userConfig = JSON.stringify({ mappings: { users: { lookupField: 'email' } } });
    
    withTempFile('temp-user.jsonl', userJsonl, (userDataPath) => {
      runCLI(`-c '${userConfig}' users upsert ${userDataPath}`);
    });

    // 2. 本編: 記事(Posts)に、先ほど作ったユーザーのメールアドレスをリレーションとして渡す
    // 💡 author フィールドには ID ではなく文字列(email)を渡します。CLIのconfigを通じて
    // Posts と Users 両方のルックアップフィールドを解決します。
    const postDataset = [
      { title: 'My E2E Post', author: 'eve@example.com' }
    ];
    const postJsonl = postDataset.map((obj) => JSON.stringify(obj)).join('\n');

    // 💡 オプション `-c` が、インラインJSONだけでなく「従来どおりの .ts 設定ファイル」
    // からのパス読み込みでも安定して行えることを保証・確認するためのテストです。
    const configFileContent = `
export const cliConfig = {
  mappings: {
    users: { lookupField: 'email' },
    posts: { lookupField: 'title' }
  }
};
    `;

    withTempFile('temp-config.ts', configFileContent, (configFilePath) => {
      withTempFile('temp-post.jsonl', postJsonl, (postDataPath) => {
        const out = runCLI(`-c ${configFilePath} posts upsert ${postDataPath}`);
        expect(out).toContain('Operation successful');

        const users = getCollectionData('users');
        const posts = getCollectionData('posts');
        const eve = users.find((u: any) => u.email === 'eve@example.com');

        expect(posts).toHaveLength(1);
        // Payload側で実際にリレーション関係が紐付き、純粋なユーザーオブジェクトに解決されているか確認！
        expect(posts[0].author.id).toBe(eve.id);
      });
    });
  }, 30000);
});

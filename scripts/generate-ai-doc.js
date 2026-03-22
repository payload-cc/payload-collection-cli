import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const docsDir = path.join(root, 'docs');
const referencesDir = path.join(docsDir, 'references');
const aiFile = path.join(docsDir, 'ai.md');

function generate() {
  let readme = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');
  const specs = fs.readFileSync(path.join(referencesDir, 'specs_detail.md'), 'utf-8');

  // Transform links like (docs/references/...) to (/references/...) for VitePress ai.md
  readme = readme.replace(/\(docs\//g, '(/');

  const content = `---
editLink: false
outline: deep
---

# AI Coding Context

This file is a consolidated summary for AI agents to understand the project architecture, configurations, and usage.

${readme}

---

${specs}
`;

  fs.writeFileSync(aiFile, content);
  console.log('✅ Generated docs/ai.md');
}

generate();

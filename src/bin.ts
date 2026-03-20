#!/usr/bin/env node
import { getPayload } from 'payload';
import { createJiti } from 'jiti';
import path from 'path';
import { execute } from './executor';

const jiti = createJiti(import.meta.url);

async function run() {
  const [collection, action, input] = process.argv.slice(2);
  const root = process.cwd();

  if (!collection || !action || !input) {
    console.log('Usage: payload-collection-cli <collection> <action> <json|file.jsonl>');
    process.exit(1);
  }

  // Auto-discover payload.config
  const configPath = [
    path.resolve(root, 'src/payload.config.ts'),
    path.resolve(root, 'payload.config.ts'),
  ].find(p => require('fs').existsSync(p));

  if (!configPath) throw new Error('payload.config.ts not found.');

  const { default: payloadConfig } = await jiti.import(configPath) as any;
  
  // Load CLI mapping config
  let cliConfig = { mappings: {} };
  const cliCfgPath = path.resolve(root, 'payload-collection.config.ts');
  if (require('fs').existsSync(cliCfgPath)) {
    const imported = await jiti.import(cliCfgPath) as any;
    cliConfig = imported.cliConfig || imported.default || cliConfig;
  }

  const payload = await getPayload({ config: payloadConfig });
  
  try {
    const result = await execute(payload, collection, action as any, input, cliConfig as any);
    console.log('✨ Operation successful');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();

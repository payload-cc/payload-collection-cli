#!/usr/bin/env node
import { getPayload } from 'payload';
import { createJiti } from 'jiti';
import path from 'path';
import { execute } from './executor';

const jiti = createJiti(import.meta.url);

async function run() {
  const args = process.argv.slice(2);
  let configOptIdx = args.indexOf('-c');
  if (configOptIdx === -1) configOptIdx = args.indexOf('--config');

  let cliConfig = { mappings: {} };
  if (configOptIdx !== -1) {
    if (args.length <= configOptIdx + 1) {
      console.error('❌ Error: Missing path after --config option.');
      process.exit(1);
    }
    const customConfigPath = path.resolve(process.cwd(), args[configOptIdx + 1]);
    if (!require('fs').existsSync(customConfigPath)) {
      console.error(`❌ Error: Config file not found at ${customConfigPath}`);
      process.exit(1);
    }
    const imported = await jiti.import(customConfigPath) as any;
    cliConfig = imported.cliConfig || imported.default || cliConfig;

    args.splice(configOptIdx, 2);
  }

  const [collection, action, input] = args;
  const root = process.cwd();

  if (!collection || !action || !input) {
    console.log('Usage: payload-collection-cli [-c path] <collection> <action> <json|file.jsonl>');
    process.exit(1);
  }

  // Auto-discover payload.config
  const configPath = [
    path.resolve(root, 'src/payload.config.ts'),
    path.resolve(root, 'payload.config.ts'),
  ].find(p => require('fs').existsSync(p));

  if (!configPath) throw new Error('payload.config.ts not found.');

  const { default: payloadConfig } = await jiti.import(configPath) as any;

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

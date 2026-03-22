#!/usr/bin/env node
import { getPayload } from 'payload';
import { createJiti } from 'jiti';
import path from 'path';
import fs from 'fs';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { execute } from './executor';

const jiti = createJiti(import.meta.url);

async function run() {
  const root = process.cwd();

  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options] <collection-slug> <operation> <file or string>')
    .options({
      'config-file': {
        alias: 'c',
        type: 'string',
        describe: 'Path to a configuration file (named export required).',
      },
      'config-json': {
        alias: 'j',
        type: 'string',
        describe: 'Inline JSON string for configuration.',
      },
      'config-export-name': {
        alias: 'n',
        type: 'string',
        describe: 'The name of the export to use from the configuration file.',
        default: 'cliConfig',
      },
    })
    .pkgConf('payload-collection-cli')
    .demandCommand(3, 'Collection slug, operation, and input are required.')
    .help()
    .parse();

  // Positional arguments are in argv._
  const { configFile, configJson, configExportName, _: [collection, action, input] } = argv as any;

  let cliConfig = { mappings: {} };

  // Priority: configJson (CLI/pkg) > configFile (CLI/pkg)
  if (configJson) {
    try {
      cliConfig = JSON.parse(configJson);
    } catch (err) {
      console.error('❌ Error: Failed to parse inline JSON config:', err);
      process.exit(1);
    }
  } else if (configFile) {
    const customConfigPath = path.resolve(root, configFile);
    if (!fs.existsSync(customConfigPath)) {
      console.error(`❌ Error: Config file not found at ${customConfigPath}`);
      process.exit(1);
    }
    const imported = await jiti.import(customConfigPath) as any;
    
    // Strictly use named export only, no default export fallback
    if (imported[configExportName]) {
      cliConfig = imported[configExportName];
    } else {
      console.error(`❌ Error: Named export "${configExportName}" not found in ${configFile}`);
      process.exit(1);
    }
  }

  // Auto-discover payload.config
  const configPath = [
    path.resolve(root, 'src/payload.config.ts'),
    path.resolve(root, 'payload.config.ts'),
  ].find(p => fs.existsSync(p));

  if (!configPath) throw new Error('payload.config.ts not found.');

  const { default: payloadConfig } = await jiti.import(configPath) as any;

  const payload = await getPayload({ config: payloadConfig });
  
  try {
    const result = await execute(payload, collection as string, action as any, input as string, cliConfig as any);
    console.log('✨ Operation successful');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();

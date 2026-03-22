#!/usr/bin/env node
import { getPayload } from 'payload';
import { createJiti } from 'jiti';
import path from 'path';
import fs from 'fs';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { z } from 'zod';
import { execute } from './executor';

const jiti = createJiti(import.meta.url);

const MappingConfigSchema = z.object({
  lookupField: z.string().default('id'),
  onNotFound: z.enum(['error', 'ignore', 'create']).default('error'),
  defaults: z.record(z.string(), z.any()).optional(),
});

const CLIConfigSchema = z.object({
  mappings: z.record(z.string(), MappingConfigSchema).default({}),
});

async function run() {
  console.log('🏁 Starting CLI...');
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
    .parseSync();

  console.log('📊 Parsed arguments:', JSON.stringify(argv, null, 2));

  const { configFile, configJson, configExportName, _: [collection, action, input] } = argv as any;

  let rawConfig: any = { mappings: {} };

  // Priority: configJson (CLI/pkg) > configFile (CLI/pkg)
  if (configJson) {
    try {
      rawConfig = typeof configJson === 'string' ? JSON.parse(configJson) : configJson;
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
      rawConfig = imported[configExportName];
    } else {
      console.error(`❌ Error: Named export "${configExportName}" not found in ${configFile}`);
      process.exit(1);
    }
  }

  // Validate the configuration using Zod
  const validation = CLIConfigSchema.safeParse(rawConfig);
  if (!validation.success) {
    console.error('❌ Error: Invalid configuration structure:');
    validation.error.issues.forEach(issue => {
      console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
    });
    process.exit(1);
  }
  const cliConfig = validation.data;

  // Auto-discover payload.config
  const configPath = [
    path.resolve(root, 'src/payload.config.ts'),
    path.resolve(root, 'payload.config.ts'),
  ].find(p => fs.existsSync(p));

  if (!configPath) {
    console.error('❌ Error: payload.config.ts not found.');
    process.exit(1);
  }
  console.log(`📖 Loading payload config from: ${configPath}`);

  const { default: payloadConfig } = await jiti.import(configPath) as any;
  const payload = await getPayload({ config: payloadConfig });
  console.log('✅ Connected to Payload');
  
  try {
    const result = await execute(payload, collection as string, action as any, input as string, cliConfig as any);
    console.log('✨ Operation successful');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Fatal Error:', err.message);
  process.exit(1);
});

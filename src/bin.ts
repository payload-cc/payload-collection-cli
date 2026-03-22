#!/usr/bin/env node
import { getPayload } from 'payload';
import { createJiti } from 'jiti';
import path from 'path';
import fs from 'fs';
import { execute } from './executor';

const jiti = createJiti(import.meta.url);

/**
 * Read defaults from the "payload-collection-cli" field in package.json.
 * Returns an object with optional keys: configFile, configExportName.
 * Note: collection, action, and input are positional and MUST be provided via CLI.
 */
function readPackageJsonDefaults(root: string): Record<string, string> {
  const pkgPath = path.resolve(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg['payload-collection-cli'] || {};
  } catch {
    return {};
  }
}

async function run() {
  const root = process.cwd();
  const pkgDefaults = readPackageJsonDefaults(root);

  const args = process.argv.slice(2);

  // --- Extract -n / --config-export-name from CLI args ---
  let exportOptIdx = args.indexOf('-n');
  if (exportOptIdx === -1) exportOptIdx = args.indexOf('--config-export-name');
  
  let exportName = pkgDefaults.configExportName || 'cliConfig';
  if (exportOptIdx !== -1) {
    if (args.length <= exportOptIdx + 1) {
      console.error('❌ Error: Missing option after --config-export-name parameter.');
      process.exit(1);
    }
    exportName = args[exportOptIdx + 1];
    args.splice(exportOptIdx, 2);
  }

  // --- Extract -c / --config-file from CLI args ---
  let configOptIdx = args.indexOf('-c');
  if (configOptIdx === -1) configOptIdx = args.indexOf('--config-file');

  let configVal: string | undefined;
  if (configOptIdx !== -1) {
    if (args.length <= configOptIdx + 1) {
      console.error('❌ Error: Missing option after --config-file parameter.');
      process.exit(1);
    }
    configVal = args[configOptIdx + 1];
    args.splice(configOptIdx, 2);
  } else if (pkgDefaults.configFile) {
    // Fallback to package.json default
    configVal = pkgDefaults.configFile;
  }

  // --- Load CLI config ---
  let cliConfig = { mappings: {} };

  if (configVal) {
    if (configVal.trim().startsWith('{')) {
      try {
        cliConfig = JSON.parse(configVal);
      } catch (err) {
        console.error('❌ Error: Failed to parse inline JSON config:', err);
        process.exit(1);
      }
    } else {
      const customConfigPath = path.resolve(root, configVal);
      if (!fs.existsSync(customConfigPath)) {
        console.error(`❌ Error: Config file not found at ${customConfigPath}`);
        process.exit(1);
      }
      const imported = await jiti.import(customConfigPath) as any;
      // Strictly use named export only, no default export fallback
      if (imported[exportName]) {
        cliConfig = imported[exportName];
      } else {
        console.error(`❌ Error: Named export "${exportName}" not found in ${configVal}`);
        process.exit(1);
      }
    }
  }

  // --- Resolve positional args ---
  const [collection, action, input] = args;

  if (!collection || !action || !input) {
    console.log('Usage: payload-collection-cli [-c configFile] [-n exportName] <collection> <action> <json|file.jsonl>');
    process.exit(1);
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
    const result = await execute(payload, collection, action as any, input, cliConfig as any);
    console.log('✨ Operation successful');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();

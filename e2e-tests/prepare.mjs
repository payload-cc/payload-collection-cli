import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, '_payload');
await mkdir(path.join(fixture, 'src', 'collections'), { recursive: true });
for (const collection of ['Users', 'Media', 'Posts', 'Categories']) {
  await copyFile(path.join(here, 'payload-template', `${collection}.ts`),
    path.join(fixture, 'src', 'collections', `${collection}.ts`));
}
for (const name of ['constants.ts', 'payload.config.ts']) {
  await copyFile(path.join(here, 'payload-template', name), path.join(fixture, 'src', name));
}
await writeFile(path.join(fixture, 'package.json'), JSON.stringify({
  name: 'payload-collection-cli-e2e-fixture', private: true, type: 'module',
}, null, 2) + '\n');
console.log('Prepared local fixture; dependencies come from the repository frozen lockfile.');

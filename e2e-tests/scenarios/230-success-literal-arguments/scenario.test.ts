import { beforeEach, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { getCollectionData, payloadAppDir, resetDatabase, runCLI } from '../../utils';

beforeEach(resetDatabase);
it('passes quotes, spaces and shell metacharacters as literal JSON', () => {
  const name = `O'Brien $(echo not-a-command) ; & spaces`;
  runCLI(['categories', 'create', JSON.stringify({ name })]);
  expect(getCollectionData('categories')[0].name).toBe(name);
});
it('reads JSONL from a path containing spaces and quotes', () => {
  const file = path.join(payloadAppDir, `input with spaces and 'quotes'.jsonl`);
  writeFileSync(file, JSON.stringify({ name: 'literal-file-path' }) + '\n');
  runCLI(['categories', 'create', file]);
  expect(getCollectionData('categories')[0].name).toBe('literal-file-path');
});

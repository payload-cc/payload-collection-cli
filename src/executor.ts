import { Payload } from 'payload';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { resolveRelations } from './resolver';
import { Action, CLIConfig } from './types';

async function processSingle(payload: Payload, collection: string, action: Action, data: any, config: CLIConfig) {
  const mapping = config.mappings[collection];
  const lookupField = mapping?.lookupField || 'id';

  const resolved = await resolveRelations(payload, collection, data, config);

  switch (action) {
    case 'create':
      return await payload.create({ collection: collection as any, data: resolved });
    case 'upsert':
      if (data[lookupField] !== undefined) {
        const existing = await payload.find({
          collection: collection as any,
          where: { [lookupField]: { equals: data[lookupField] } },
        });
        if (existing.docs.length > 0) {
          return await payload.update({ collection: collection as any, id: existing.docs[0].id, data: resolved });
        }
      }
      return await payload.create({ collection: collection as any, data: resolved });
    case 'update':
      return await payload.update({
        collection: collection as any,
        where: { [lookupField]: { equals: data[lookupField] } },
        data: resolved,
      });
    case 'delete':
      return await payload.delete({
        collection: collection as any,
        where: { [lookupField]: { equals: typeof data === 'object' ? data[lookupField] : data } },
      });
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

export async function execute(payload: Payload, collection: string, action: Action, input: string, config: CLIConfig) {
  if (input.endsWith('.jsonl')) {
    const filePath = path.resolve(process.cwd(), input);
    const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
    for await (const line of rl) {
      if (line.trim()) await processSingle(payload, collection, action, JSON.parse(line), config);
    }
    return { status: 'bulk success' };
  }
  return await processSingle(payload, collection, action, JSON.parse(input), config);
}

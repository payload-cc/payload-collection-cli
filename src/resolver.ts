import { Payload } from 'payload';
import { CLIConfig } from './types';

export async function resolveRelations(payload: Payload, collectionSlug: string, data: any, config: CLIConfig) {
  const collection = payload.collections[collectionSlug];
  if (!collection) throw new Error(`Collection "${collectionSlug}" not found.`);

  const resolved = { ...data };

  for (const field of collection.config.fields) {
    if (field.type === 'relationship' && data[field.name]) {
      const relationTo = Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo;
      const mapping = config.mappings[relationTo as string];
      if (!mapping) continue;

      const rawValue = data[field.name];
      const isArray = Array.isArray(rawValue);
      const values = isArray ? rawValue : [rawValue];
      const resolvedIds: (string | number)[] = [];

      for (const val of values) {
        if (typeof val === 'string' && val.length < 24) { // Simple heuristic for slug vs ID
          const found = await payload.find({
            collection: relationTo as any,
            where: { [mapping.lookupField]: { equals: val } },
            limit: 1,
          });

          if (found.docs.length > 0) {
            resolvedIds.push(found.docs[0].id);
          } else if (mapping.onNotFound === 'error') {
            throw new Error(`Relation not found: ${relationTo} (${mapping.lookupField}=${val})`);
          } else {
            resolvedIds.push(val);
          }
        } else {
          resolvedIds.push(val);
        }
      }
      resolved[field.name] = isArray ? resolvedIds : resolvedIds[0];
    }
  }
  return resolved;
}

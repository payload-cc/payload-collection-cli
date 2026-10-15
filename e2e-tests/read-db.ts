import { getPayload } from 'payload';
import config from './_payload/src/payload.config';

try {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: process.argv[2], pagination: false, limit: 0,
  });
  console.log(`__E2E_DATA__${JSON.stringify(result.docs)}`);
  await payload.destroy();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

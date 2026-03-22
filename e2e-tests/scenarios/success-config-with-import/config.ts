// 💡 This config imports DEFAULT_CATEGORY_NAME from a separate constants file
// in the Payload app. This proves that jiti correctly resolves imports
// relative to the config file's own location—NOT the CLI's location.
import { DEFAULT_CATEGORY_NAME } from '../../_payload/src/constants';

export const cliConfig = {
  mappings: {
    users: { lookupField: 'email' },
    categories: {
      lookupField: 'name',
      onNotFound: 'create' // Auto-create category if it doesn't exist
    },
    posts: {
      defaults: {
        category: DEFAULT_CATEGORY_NAME // Injected from shared constants!
      }
    }
  }
};

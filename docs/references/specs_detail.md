# Payload Collection CLI - Specifications & FAQs

## What is the correct behavior for `upsert`, `update`, and `delete` when the lookup field is missing?

When performing an `upsert`, `update`, or `delete` action, the CLI strictly requires a unique identifier (the `lookupField`) to locate the target record in the database. 

By default, the `lookupField` is `id`. If your JSON or JSONLines data does not contain this field (or the custom field defined in your config), the CLI will deliberately **throw an Error** rather than falling back to creating a new record or modifying unintended records.

### Why is this the specification?
If `upsert` were to silently act as `create` when the identifier is missing, it could easily lead to developers accidentally flooding their database with duplicate records (e.g., if a typo causes the `id` field to be undefined in the provided JSON). Enforcing an explicit Error ensures data integrity, prevents unintended creation of records, and forces the user to explicitly define identifying fields for update operations.

### In this context, is it correct to specify the ID in `data.jsonl`?
Yes. If you intend to `upsert`, `update`, or `delete` a specific record, you **must** include its unique identifier in your input data. 
If you only intend to create new records and want Payload to auto-generate the IDs, you should use the `create` action instead of `upsert`.

---

## Configuration

### `package.json` Defaults

You can set defaults for all CLI arguments in your `package.json` under the `payload-collection-cli` key. CLI arguments always override these defaults.

```json
{
  "payload-collection-cli": {
    "config": "./payload-collection-cli.config.ts",
    "configExportName": "myCustomConfig",
    "collection": "users",
    "action": "upsert",
    "input": "data.jsonl"
  }
}
```

| Key | Description | Default |
|-----|-------------|---------|
| `config` | Path to the config file (same as `-c` flag) | _(none)_ |
| `configExportName` | Named export to use from the config file | `cliConfig` |
| `collection` | Default collection slug | _(none)_ |
| `action` | Default action (`create`, `upsert`, etc.) | _(none)_ |
| `input` | Default input file or JSON string | _(none)_ |

With these defaults set, you can run shorthands like:
```bash
# Uses all defaults from package.json
npx @payload-cc/payload-collection-cli

# Override just the action
npx @payload-cc/payload-collection-cli users create data.jsonl
```

### Relation Mappings

By default, Payload relations require you to provide target document IDs (e.g., ObjectIDs or numeric IDs). The CLI can magically resolve these relations by searching for human-readable fields instead.

**Example Scenario**:
Assume your `posts` collection has a relationship field named `author` that references the `users` collection. Instead of manually finding and hard-coding the user's database ID, you want to simply provide their email address.

Create a config file and pass it via `-c`:

```typescript
// payload-collection-cli.config.ts
export const cliConfig = {
  mappings: {
    users: {
      lookupField: 'email',
      onNotFound: 'error',
    },
    categories: {
      lookupField: 'name',
      onNotFound: 'create', // Auto-create if not found
    },
    posts: {
      defaults: {
        category: 'default', // Inject default value when field is missing
      },
    },
  }
}
```

| Mapping Option | Description |
|----------------|-------------|
| `lookupField` | Field to search by instead of `id` |
| `onNotFound` | `'error'` to throw, `'ignore'` to skip, `'create'` to auto-create |
| `defaults` | Object of field defaults injected when values are missing from data |

Now, when you supply an `author: "user@example.com"` property to a `posts` collection insertion, the CLI will intercept this relationship, look up the `users` collection by the `email` field, and automatically replace the email string with the actual database ID before inserting!

### Config File Cross-Imports

Since the config file is loaded via `jiti` (a TypeScript-aware runtime loader), you can import constants from other project files:

```typescript
import { DEFAULT_CATEGORY_NAME } from './src/constants';

export const cliConfig = {
  mappings: {
    posts: {
      defaults: { category: DEFAULT_CATEGORY_NAME }
    }
  }
}
```

Imports are resolved relative to the config file's own location.

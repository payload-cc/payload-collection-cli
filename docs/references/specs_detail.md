# Payload Collection CLI - Specifications & FAQs

## Command Options and Configuration File

### CLI Command Options
The CLI supports the following arguments:

```bash
npx @payload-cc/payload-collection-cli [-c config-file] <collection-slug> <operation> <file or string>
```

- `-c`, `--config`: Path to a TypeScript/JavaScript configuration file or an inline JSON string.

### Configuration File (`cliConfig`)
By default, the CLI looks for a named export `cliConfig` or a `default` export in the configuration file.

#### Relation Mappings
The core of the configuration is the `mappings` object, which allows you to define how relationship fields are resolved.

```typescript
export const cliConfig = {
  mappings: {
    users: {
      lookupField: 'email', // Search by 'email' instead of 'id'
      onNotFound: 'error',  // 'error' | 'ignore' | 'create'
    },
    categories: {
      lookupField: 'name',
      onNotFound: 'create', // Auto-create the category if it doesn't exist
    },
    posts: {
      defaults: {
        category: 'default', // Inject this value if the field is missing from data
      },
    },
  }
}
```

| Mapping Option | Description |
|----------------|-------------|
| `lookupField` | The field used to find the target document. Defaults to `id`. |
| `onNotFound` | Action when a document is not found: `'error'` (default), `'ignore'`, or `'create'`. |
| `defaults` | An object containing default values to be injected into the record before processing. |

---

## Overriding defaults in package.json

You can define default values for any CLI argument in your `package.json`. This is useful for avoiding repetitive flags in a specific project.

Add a `payload-collection-cli` field to your `package.json`:

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
| `config` | Path to the config file (equivalent to `-c`) | _(none)_ |
| `configExportName` | The name of the export to look for in the config file | `cliConfig` |
| `collection` | Default collection slug | _(none)_ |
| `action` | Default action (`create`, `upsert`, `update`, `delete`) | _(none)_ |
| `input` | Default data input (file path or JSON string) | _(none)_ |

---

## FAQ

### What is the correct behavior for `upsert`, `update`, and `delete` when the lookup field is missing?
The CLI strictly requires a unique identifier (the `lookupField`) to locate the target record. If the field is missing from your data, the CLI will **throw an Error**.

**Why?**
To prevent accidental data corruption or duplicate records. If an `upsert` silently created a new record when the identifier was missing (e.g., due to a typo), it could result in thousands of duplicate entries. Enforcing an error ensures that you are explicitly identifying the records you intend to modify.

### Can I include imports in my configuration file?
Yes! Since the configuration is loaded using `jiti`, you can use standard TypeScript/ESM imports to reference constants or logic from your Payload project.

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
**Note:** Imports are resolved relative to the location of the configuration file itself.

### Should I specify the ID in my data files?
If you are using `upsert`, `update`, or `delete` and have not configured a custom `lookupField`, then **yes**, you must provide the `id`. If you are using `create`, Payload will automatically generate the ID for you.

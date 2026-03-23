---
title: Technical Specifications & FAQ | Payload Collection CLI
description: Detailed documentation of CLI syntax, configuration options, relation mappings, and frequently asked questions for Payload Collection CLI.
---

# Payload Collection CLI - Specifications & FAQs

## CLI Syntax
```bash
npx @payload-cc/payload-collection-cli [options] <collection-slug> <operation> <file or string>
```

### Command Options

The following options can be set either via CLI flags or as defaults in your `package.json`. Note that positional arguments (`collection-slug`, `operation`, `file or string`) are **mandatory** and cannot be defaulted via `package.json`.

| CLI Option (Short/Long) | `package.json` Key | Default | Description |
|-------------------------|-------------------|---------|-------------|
| `-c`, `--config-file` | `configFile` | _(none)_ | Path to a configuration file (named export required). |
| `-j`, `--config-json` | `configJson` | _(none)_ | Inline JSON string for configuration. Takes precedence over `configFile`. |
| `-n`, `--config-export-name` | `configExportName` | `cliConfig` | The name of the export to use from the configuration file. |

### Overriding defaults in package.json

To use defaults, add a `payload-collection-cli` field to your `package.json`:

```json
{
  "payload-collection-cli": {
    "configFile": "./payload-collection-cli.config.ts",
    "configExportName": "myCustomConfig",
    "configJson": "{\"mappings\": { \"users\": { \"lookupField\": \"email\" }}}"
  }
}
```

---

## Configuration (`cliConfig`)

The CLI strictly looks for a **named export** in the configuration file (defaulting to `cliConfig`). **Default exports are not supported.**

### Relation Mappings
The core of the configuration is the `mappings` object in your config file.

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

| Mapping Option | Default | Description |
|----------------|---------|-------------|
| `lookupField` | `id` | The field used to find the target document. |
| `onNotFound` | `'error'` | Action when a document is not found (`'error'`, `'ignore'`, `'create'`). |
| `defaults` | _(none)_ | Default values injected into the record before processing. |

---

## FAQ

### What is the correct behavior for `upsert`, `update`, and `delete` when the lookup field is missing?
The CLI strictly requires a unique identifier (the `lookupField`) to locate the target record. If the field is missing from your data, the CLI will **throw an Error**. This prevents accidental data corruption or duplicate records.

### Can I include imports in my configuration file?
Yes! Since the configuration is loaded using `jiti`, you can use standard TypeScript/ESM imports.

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
**Note:** Imports are resolved relative to the configuration file's location.

### Should I specify the ID in my data files?
If you use `upsert`, `update`, or `delete` without a custom `lookupField`, you **must** provide the `id`. For `create`, Payload will auto-generate the ID.

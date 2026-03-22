# AI Context: @payload-cc/payload-collection-cli

This document is optimized for LLM/Coding Agents to quickly understand the package specifications, configuration patterns, and internal logic.

## CLI Usage Summary
```bash
npx @payload-cc/payload-collection-cli [options] <collection-slug> <operation> <file or string>
```

- **Operations**: `create`, `update`, `delete`, `upsert`.
- **Input**: Path to `.json` / `.jsonl` or inline JSON string.

## Global Configuration Options
Can be set via CLI flags or `payload-collection-cli` field in `package.json`.

| CLI Option | `package.json` Key | Default | Description |
|------------|-------------------|---------|-------------|
| `-j`, `--config-json` | `configJson` | *None* | Inline JSON string. Priority over file. |
| `-c`, `--config-file` | `configFile` | *None* | Path to a configuration file. |
| `-n`, `--config-export-name` | `configExportName` | `cliConfig` | Named export in config file. |

**Note**: Positional arguments (slug, operation, input) **must** be provided via CLI.

## Configuration File Schema (`cliConfig`)
The config file MUST export a **named object** (default: `cliConfig`). `default export` is NOT supported.

```typescript
export const cliConfig = {
  mappings: {
    [collectionSlug: string]: {
      lookupField: string; // Default: 'id'. Used to find existing docs.
      onNotFound: 'error' | 'ignore' | 'create'; // Default: 'error'.
      defaults: Record<string, any>; // Values injected before processing.
    }
  }
}
```

## Relation Resolution Logic
The CLI automatically resolves relationship fields:
1.  **Direct ID**: If the input value is a valid Payload ID, it's used directly.
2.  **Lookup Search**: If a mapping is defined for the target collection, the CLI searches for the document using `lookupField`.
3.  **Recursive Create**: If `onNotFound: 'create'` is set, it automatically creates the missing related document.
4.  **Circularities**: Handled by processing dependencies first (if possible).

## Validation
- The CLI respects Payload's internal validation (`required: true`, `unique: true`).
- If a validation fails, the entire operation for that record fails and an error is reported.

## Implementation Details
- **Parser**: `yargs` (with `pkgConf` for `package.json` defaults).
- **Loader**: `jiti` (for loading `.ts` configuration and `payload.config.ts`).
- **Core**: Uses `payload.create()`, `payload.update()`, `payload.delete()`.

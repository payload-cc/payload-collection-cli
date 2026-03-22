# payload-collection-cli

Functional CLI for Payload 3.0 collection management.

Allows for magical, easy-to-use bulk imports, updates, deletions and operations on Payload CMS collections using simple JSONLines or JSON files, with automatic relation resolution.

## Installation

```bash
pnpm add @payload-cc/payload-collection-cli
# or npm install @payload-cc/payload-collection-cli
```

## Quick Start

You can immediately start using the commands without any configuration for basic insertions/updates!

**Command Syntax**:
```bash
npx @payload-cc/payload-collection-cli [-c config-file] [-n export-name] <collection-slug> <operation> <file or string>
```

**Examples**:
```bash
# Bulk create/upsert from jsonlines
npx @payload-cc/payload-collection-cli posts upsert data.jsonl

# Simple JSON update
npx @payload-cc/payload-collection-cli users update '{"email": "user@example.com", "name": "New Name"}'

# With explicit mapping configuration
npx @payload-cc/payload-collection-cli -c ./my-map.config.ts users upsert data.jsonl
```

## Available Actions
- `create`: Create new records.
- `update`: Update existing records based on `lookupField`.
- `delete`: Delete records.
- `upsert`: Update if existing, create if not.

## Specifications & FAQ

For detailed configuration options (including `package.json` defaults, relation mappings, `onNotFound` behaviors, and cross-file imports), please refer to the [Specifications & FAQ](docs/references/specs_detail.md).

## Development & CI/CD

- Tests are powered by `vitest` to remain fast and lightweight. 
- GitHub Actions automatically run checks on PRs, and publish the `dist/` bundle (excluding test codes and local configs) when a new Release is created on GitHub!
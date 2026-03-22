# payload-collection-cli

**The missing CLI for Payload 3.0. Manage collections without writing boilerplate scripts.**

---

## Why?

Payload 3.0 is powerful, but performing simple data operations often requires writing one-off scripts. **payload-collection-cli** turns your terminal into a direct interface for your collections, supporting intelligent relation lookups by name/slug instead of cryptic IDs.

## Features

- ⚡️ **Zero Scripting:** Run CRUD operations directly from your terminal.
- 🔍 **Relation Lookup:** Resolve relationships using `name`, `email`, or `slug`.
- 📄 **Batch Processing:** Support for both JSON strings and JSONLines (`.jsonl`) files.
- ⚙️ **Configurable:** Define your lookup logic in a simple external config.
- 🛡 **Native Performance:** Uses Local API to ensure all Hooks and Validations run.

## 📖 Documentation

- **🚀 [Official Guide](https://payload-cc.github.io/payload-collection-cli/)**
- **🤖 [AI Context Page](https://payload-cc.github.io/payload-collection-cli/ai.html)** (One-file summary for coding agents)

## Installation

```bash
pnpm add @payload-cc/payload-collection-cli
# or npm install @payload-cc/payload-collection-cli
```

## Quick Start

You can immediately start using the commands without any configuration for basic insertions/updates!

**Command Syntax**:
```bash
npx @payload-cc/payload-collection-cli [options] <collection-slug> <operation> <file or string>
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
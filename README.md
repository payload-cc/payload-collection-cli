# payload-collection-cli

[![CI](https://github.com/payload-cc/payload-collection-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/payload-cc/payload-collection-cli/actions/workflows/ci.yml)
[![NPM Version](https://img.shields.io/npm/v/@payload-cc/payload-collection-cli)](https://www.npmjs.com/package/@payload-cc/payload-collection-cli)
[![License](https://img.shields.io/github/license/payload-cc/payload-collection-cli)](https://github.com/payload-cc/payload-collection-cli/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-VitePress-blue)](https://payload-cc.github.io/payload-collection-cli/)

**The missing CLI for Payload 3. Manage collections without writing boilerplate scripts.**

<p align="center">
  <img src="https://raw.githubusercontent.com/payload-cc/payload-collection-cli/main/docs/public/logo.png" alt="Payload Collection CLI Logo" width="200"/>
</p>

<p align="center">
  🚀 <strong><a href="https://payload-cc.github.io/payload-collection-cli/">Official Guide</a></strong>
  &nbsp;&nbsp;•&nbsp;&nbsp;
  🤖 <strong><a href="https://payload-cc.github.io/payload-collection-cli/ai.html">AI Context Page</a></strong>
</p>

---

## Why?

Payload 3 is powerful, but performing simple data operations often requires writing one-off scripts. **payload-collection-cli** turns your terminal into a direct interface for your collections, supporting intelligent relation lookups by name/slug instead of cryptic IDs.

## Features

- ⚡️ **Zero Scripting:** Run CRUD operations directly from your terminal.
- 🔍 **Relation Lookup:** Resolve relationships using `name`, `email`, or `slug`.
- 📄 **Batch Processing:** Support for both JSON strings and JSONLines (`.jsonl`) files.
- ⚙️ **Configurable:** Define your lookup logic in a simple external config.
- 🛡 **Native Performance:** Uses Local API to ensure all Hooks and Validations run.

## Installation

```bash
pnpm add @payload-cc/payload-collection-cli
# or npm install @payload-cc/payload-collection-cli
```

## Compatibility

The supported Payload range is **3.90.2 or newer within v3**. Development and
integration tests target 3.90.2, the latest stable release checked on 2026-10-15.
Payload 4 prereleases are not supported. Use the same version for `payload` and
your `@payloadcms/*` packages in the application consuming this CLI.

Node.js must satisfy `^20.19.0 || ^22.12.0 || >=23` (the requirement of the CLI's
argument parser); the development toolchain is pinned in `mise.toml`.

**Upgrading an existing application from an older Payload release:** review the
[Payload 3.90.0 migration notes](https://github.com/payloadcms/payload/releases/tag/v3.90.0).
Regenerate application types and, for relational databases, create and review the
required migrations before applying them in your environment. This CLI does not
run migrations or modify your application's dependencies automatically.

## Quick Start

You can immediately start using the commands without any configuration for basic insertions/updates!

**Command Syntax**:
```bash
npx @payload-cc/payload-collection-cli [options] <collection-slug> <operation> [input]
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
- `get`: Read one document by ID or configured lookup value.
- `list` / `find`: Query a paginated collection (input defaults to `{}`).
- `count`: Count matching documents (input defaults to `{}`).
- `create`: Create new records.
- `update`: Update existing records based on `lookupField`.
- `delete`: Delete records.
- `upsert`: Update if existing, create if not.

## Reading data

```sh
payload-collection-cli posts list
payload-collection-cli posts find '{"where":{"title":{"contains":"Payload"}},"sort":"-createdAt","limit":20}'
payload-collection-cli posts get '{"id":"document-id","depth":1}'
payload-collection-cli users -j '{"mappings":{"users":{"lookupField":"email"}}}' get '"user@example.com"'
payload-collection-cli posts count '{"where":{"title":{"contains":"Payload"}}}'
payload-collection-cli --describe
```

Read commands emit **one JSON value on stdout**; configuration, Payload, and DEBUG
logs go to stderr. `get` returns a document, `list`/`find` preserve Payload's
pagination metadata, and `count` returns `{ "totalDocs": n }`. Reads do not apply
mapping defaults or auto-create missing relations. Missing or ambiguous lookups
fail instead of silently choosing or creating a document.

See [read query options](docs/references/reads.md) for supported fields, defaults,
ID versus mapped lookup syntax, and permissions. All operations use the trusted
server-side Local API, not the permissions of a logged-in admin UI user.

## Native document operations

`duplicate` and the rest of Payload's Collection document API are also available:

```sh
payload-collection-cli categories duplicate '{"id":7,"data":{"name":"Copy"}}'
payload-collection-cli categories findDistinct '{"field":"displayName"}'
payload-collection-cli articles findVersions '{"where":{"parent":{"equals":7}}}'
payload-collection-cli articles restoreVersion '{"id":"version-id","draft":true}'
payload-collection-cli categories updateMany '{"where":{"name":{"equals":"Old"}},"data":{"displayName":"New"}}'
```

Native `createOne` / `updateOne` / `deleteOne` use explicit IDs and JSON option
envelopes, supporting uploads, drafts/publication and trash lifecycle without
changing the existing mapping/JSONL commands. Native writes return actual JSON
results. Bulk errors fail nonzero; empty bulk filters require `allowAll: true`.
See the [complete method coverage and options](docs/references/native-operations.md).
Authentication, Globals and Jobs are separate from Collection document operations.

## Specifications & FAQ

For detailed configuration options (including `package.json` defaults, relation mappings, `onNotFound` behaviors, and cross-file imports), please refer to the [Specifications & FAQ](docs/references/specs_detail.md).

## Development & CI/CD

- Tests are powered by `vitest` to remain fast and lightweight. 
- GitHub Actions automatically run checks on PRs, and publish the `dist/` bundle (excluding test codes and local configs) when a new Release is created on GitHub!
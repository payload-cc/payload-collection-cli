# payload-collection-cli

Functional CLI for Payload 3.0 collection management.

Allows for magical, easy-to-use bulk imports, updates, deletions and operations on Payload CMS collections using simple JSONLines or JSON files, with automatic relation resolution.

## Installation

```bash
pnpm add payload-collection-cli
# or npm install payload-collection-cli
```

## Quick Start

Create a `payload-collection.config.ts` in your Payload project root with your relation mappings:

```typescript
export const cliConfig = {
  mappings: {
    users: {
      lookupField: 'email',
      onNotFound: 'error',
    },
    posts: {
      lookupField: 'slug'
    }
  }
}
```

Then run commands easily!

```bash
# Bulk create/upsert from jsonlines
npx payload-collection-cli posts upsert data.jsonl

# Simple JSON update
npx payload-collection-cli users update '{"email": "user@example.com", "name": "New Name"}'
```

## Available Actions
- `create`: Create new records.
- `update`: Update existing records based on `lookupField`.
- `delete`: Delete records.
- `upsert`: Update if existing, create if not.
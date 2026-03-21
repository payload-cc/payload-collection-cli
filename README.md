# payload-collection-cli

Functional CLI for Payload 3.0 collection management.

Allows for magical, easy-to-use bulk imports, updates, deletions and operations on Payload CMS collections using simple JSONLines or JSON files, with automatic relation resolution.

## Installation

```bash
pnpm add @payload-cc/payload-collection-cli
# or npm install @payload-cc/payload-collection-cli
```

## Quick Start

You can immediately start using the commands without any configuration!

```bash
# Bulk create/upsert from jsonlines
npx @payload-cc/payload-collection-cli posts upsert data.jsonl

# Simple JSON update
npx @payload-cc/payload-collection-cli users update '{"email": "user@example.com", "name": "New Name"}'
```

## Available Actions
- `create`: Create new records.
- `update`: Update existing records based on `lookupField`.
- `delete`: Delete records.
- `upsert`: Update if existing, create if not.

## Configuration (Optional)

### Relation Mappings (`payload-collection-cli.config.ts`)
If you want the CLI to magically resolve relation IDs (e.g. searching a User by email to relate to a Post), create a `payload-collection-cli.config.ts` in your Payload project root:

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

Now, when you supply an `author: "user@example.com"` property to a `posts` collection insertion, the CLI will look up the user by email in the exact database rather than forcing you to hard-code Payload ObjectId strings!

## Development & CI/CD

- Tests are powered by `vitest` to remain fast and lightweight. 
- GitHub Actions automatically run checks on PRs, and publish the `dist/` bundle (excluding test codes and local configs) when a new Release is created on GitHub!
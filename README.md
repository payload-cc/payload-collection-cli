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
npx @payload-cc/payload-collection-cli [-c config-file] <collection-slug> <operation> <file or string>
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
For detailed behavior specifications (such as how identifier lookups work strictly during upserts, updates, and deletes), please refer to the [Specifications & FAQ](docs/references/specs_detail.md).

## Configuration (Optional)

### Relation Mappings (`payload-collection-cli.config.ts`)
By default, Payload relations require you to provide target document IDs (e.g., ObjectIDs or numeric IDs). The CLI can magically resolve these relations by searching for human-readable fields instead.

**Example Scenario**:
Assume your `posts` collection has a relationship field named `author` that references the `users` collection. Instead of manually finding and hard-coding the user's database ID, you want to simply provide their email address.

Create a `payload-collection-cli.config.ts` in your Payload project root (or pass it via `-c`) to define the `lookupField` for the `users` collection:

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

Now, when you supply an `author: "user@example.com"` property to a `posts` collection insertion, the CLI will intercept this relationship, look up the `users` collection by the `email` field, and automatically replace the email string with the actual database ID before inserting!

## Development & CI/CD

- Tests are powered by `vitest` to remain fast and lightweight. 
- GitHub Actions automatically run checks on PRs, and publish the `dist/` bundle (excluding test codes and local configs) when a new Release is created on GitHub!
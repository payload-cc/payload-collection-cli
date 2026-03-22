# Examples & Use Cases

This page showcases common use cases for the **Payload Collection CLI**, using live snippets from our E2E test suite. These examples demonstrate how to handle various data types, relationships, and error scenarios.

---

## 🚀 Basic Upsert with Custom Lookup Field

In this example, we upsert user records using `email` as the unique lookup field instead of the default `id`.

### Data (`data.jsonl`)
<<< @/../e2e-tests/scenarios/success-mapping-upsert/data.jsonl

### Configuration (`config.ts`)
<<< @/../e2e-tests/scenarios/success-mapping-upsert/config.ts

### Command
```bash
npx @payload-cc/payload-collection-cli -c ./config.ts users upsert data.jsonl
```

---

## 🔍 Advanced Relationship Resolution

Resolve relational fields (like `author` or `category`) using pure string identifiers (email, slug, etc.) rather than technical IDs.

### Data (`data.jsonl`)
<<< @/../e2e-tests/scenarios/relation-posts-author/data.jsonl

### Configuration (`config.ts`)
<<< @/../e2e-tests/scenarios/relation-posts-author/config.ts

### Command
```bash
npx @payload-cc/payload-collection-cli -c ./config.ts posts create data.jsonl
```

---

## ✨ Automated Relation Creation

Automatically create missing related records (e.g., a new Category) while importing main records (e.g., Posts).

### Configuration (`config.ts`)
<<< @/../e2e-tests/scenarios/relation-auto-create-default/config.ts

---

## 🛡 Validations & Error Handling

The CLI strictly enforces Payload's schema validations and unique constraints.

### Unique Constraint Violation
When attempting to create a record with a duplicate unique field, the CLI provides a clear error message.

**Scenario**: Creating two categories with the same name.
```bash
# First creation succeeds
npx @payload-cc/payload-collection-cli categories create '{"name": "unique-cat", "displayName": "Unique"}'

# Second creation fails with validation error
npx @payload-cc/payload-collection-cli categories create '{"name": "unique-cat", "displayName": "Duplicate"}'
```

**Output**:
```text
Error: Field "name" must be unique.
```

---

> [!TIP]
> All these examples are tested automatically on every commit to ensure they remain functional with the latest version of Payload CMS.

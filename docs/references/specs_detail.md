# Payload Collection CLI - Specifications & FAQs

## What is the correct behavior for `upsert`, `update`, and `delete` when the lookup field is missing?

When performing an `upsert`, `update`, or `delete` action, the CLI strictly requires a unique identifier (the `lookupField`) to locate the target record in the database. 

By default, the `lookupField` is `id`. If your JSON or JSONLines data does not contain this field (or the custom field defined in your `payload-collection-cli.config.ts`), the CLI will deliberately **throw an Error** rather than falling back to creating a new record or modifying unintended records.

### Why is this the specification?
If `upsert` were to silently act as `create` when the identifier is missing, it could easily lead to developers accidentally flooding their database with duplicate records (e.g., if a typo causes the `id` field to be undefined in the provided JSON). Enforcing an explicit Error ensures data integrity, prevents unintended creation of records, and forces the user to explicitly define identifying fields for update operations.

### In this context, is it correct to specify the ID in `data.jsonl`?
Yes. If you intend to `upsert`, `update`, or `delete` a specific record, you **must** include its unique identifier in your input data. 
If you only intend to create new records and want Payload to auto-generate the IDs, you should use the `create` action instead of `upsert`.

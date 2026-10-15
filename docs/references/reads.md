# Reading collections

## Commands and input

`payload-collection-cli <collection> <get|list|find|count> [input]`

Input is **JSON**, not a query file or JSONL. Omit it only for list/find/count,
which default to `{}`. All editing commands and get still require input.

- `list` and `find` are aliases and return the complete paginated response,
  including `docs`, `totalDocs`, `page`, and `totalPages` where applicable.
- `count` uses Payload's count API, not a scan of documents, and returns `totalDocs`.
- `get` returns one document. A JSON string or integer is a lookup value using
  `mappings[collection].lookupField` (default `id`). `{ "lookup": value }` is the
  explicit form. `{ "id": value }` always uses ID, regardless of the mapping.
  Supply **exactly one** selector with the optional read options below.

```sh
payload-collection-cli categories get '7'
payload-collection-cli categories get '{"id":7,"select":{"name":true}}'
payload-collection-cli -j '{"mappings":{"categories":{"lookupField":"name"}}}' categories get '{"lookup":"News"}'
payload-collection-cli categories list '{"page":2,"limit":10,"sort":"name"}'
payload-collection-cli categories count '{"where":{"name":{"equals":"News"}}}'
```

A mapped lookup must be unique: zero matches produces `DOCUMENT_NOT_FOUND`, two
or more produce `DOCUMENT_NOT_UNIQUE`. `onNotFound: "create"` and mapping defaults
have **no effect on reads**. This also applies to a missing get-by-ID.

## Validated options

| Option | get | list / find | count |
| --- | --- | --- | --- |
| `depth` | Integer 0–10; default 0 | Integer 0–10; default 0 | — |
| `select` | Nested object of boolean field selections | Same | — |
| `locale` | Nonempty string | Same | Same |
| `fallbackLocale` | String or false | Same | — |
| `draft` | Boolean | Boolean | — |
| `where` | —; use ID or mapped lookup | Payload query object | Payload query object |
| `page` | — | Integer >= 1; default 1 | — |
| `limit` | — | Integer 1–1000; default 10 | — |
| `sort` | — | Nonempty string or array of strings | — |
| `pagination` | — | Boolean; false skips pagination calculations, not the limit | — |

Unknown options, mismatched JSON types, null/array queries, and invalid bounds
produce `QUERY_INVALID`. Malformed JSON produces `INPUT_PARSE_FAILED`; missing
required input produces `INPUT_REQUIRED`. Payload validates the operators and
field names inside `where`. This is deliberately not an unrestricted passthrough
for Local API options such as `user`, `overrideAccess`, `req`, or `collection`.
Payload 3.90.2's count API does not accept `draft`; the CLI rejects it rather than
silently ignoring it. Use a `where` filter for applicable stored document fields.

## Output and trust

Every successful read writes exactly one JSON value to stdout, without an
"Operation successful" suffix. Logs from config loading, initialization, the
operation and cleanup (including DEBUG output) are redirected to stderr. A read
error exits nonzero, writes diagnostics to stderr and does not write a result.
Use a nonzero exit code to detect failure; an empty result set is valid JSON.

The CLI itself never calls create/update/delete or relation resolution for reads.
However, a Payload config and its hooks are arbitrary trusted server-side code;
initialization and user hooks can have their own side effects. This is **not** a
read-only database sandbox. The CLI inherits Payload v3 Local API's privileged
access-control defaults, just like its existing editing operations. Only run it
with a trusted application and appropriate environment/database credentials.

## Discovery and programmatic API

`payload-collection-cli --describe` prints the shared action catalog as JSON
without loading a Payload config or opening a database. Integration authors can
import `COMMANDS` and `ACTIONS` from the package; those are the same definitions
used by CLI validation.

```ts
import { execute } from '@payload-cc/payload-collection-cli'
const page = await execute(payload, 'posts', 'list')
const count = await execute(payload, 'posts', 'count', '{"where":{}}')
const doc = await execute(payload, 'posts', 'get', '{"id":"document-id"}')
```

Programmatic calls return values and do not redirect the host application's
logging; stdout reservation belongs to the CLI process only.

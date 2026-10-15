# Native Collection document operations

The CLI covers every public **Collection document** Local API method in Payload
3.90.2, in addition to its existing lookup/mapping/JSONL workflows. `duplicate`
uses `payload.duplicate()` itself, not a read-and-create approximation, so native
hooks, localization, upload handling and `disableDuplicate` are honored.

## Coverage and scope

| Payload Local API | CLI action(s) |
| --- | --- |
| `create` | `createOne` (native options); `create` (legacy JSON/JSONL + mappings) |
| `find` | `list`, `find` |
| `findByID` | `findByID`; `get` also supports configured lookup values |
| `count` | `count` |
| `findDistinct` | `findDistinct` |
| `update` by ID / where | `updateOne`, `updateMany`; legacy `update` / `upsert` / `patch` / `sync` remain available |
| `delete` by ID / where | `deleteOne`, `deleteMany`; legacy `delete` remains available |
| `duplicate` | `duplicate` |
| `findVersions` | `findVersions` |
| `findVersionByID` | `findVersionByID` |
| `countVersions` | `countVersions` |
| `restoreVersion` | `restoreVersion` |

CI examines the installed Payload declaration AST, extracts public methods using
Collection-operation option types, and compares them with the command registry's
`payloadMethod` coverage. A new upstream Collection document method fails CI until
its CLI interface and permissions have been classified. MCP derives its tools from
the same registry; there is no second action allowlist.

**Not included:** authentication/session/password/email-verification APIs, Globals,
Jobs, email, database internals and application lifecycle APIs. Those have different
targets/credential/side-effect contracts and are not Collection document management.
This is method coverage, **not** unrestricted access to every Local API parameter.
`req`, `user`, `overrideAccess`, callback functions and in-memory `File` objects are
not accepted as JSON. Use `filePath` for uploads. Unknown fields are rejected.

## Input and output contract

Native commands use a **JSON object envelope**, not bare document data or mapping
lookups. `collection` is always the positional argument and cannot be overridden
inside input. IDs are explicit; mapping `lookupField`, defaults and relation
auto-creation do not rewrite native calls. Relationship data must contain valid
Payload IDs. Existing legacy commands keep their existing input/output semantics.

```sh
payload-collection-cli categories duplicate '{"id":7,"data":{"name":"Copy"}}'
payload-collection-cli categories findByID '{"id":8}'
payload-collection-cli categories findDistinct '{"field":"displayName","limit":20}'
payload-collection-cli categories createOne '{"data":{"name":"New"}}'
payload-collection-cli categories updateOne '{"id":8,"data":{"displayName":"Updated"}}'
payload-collection-cli categories updateMany '{"where":{"displayName":{"equals":"Old"}},"data":{"displayName":"New"}}'
payload-collection-cli categories deleteMany '{"where":{"name":{"equals":"Obsolete"}}}'
```

Each native command returns the **actual Payload result as JSON stdout**, including
new IDs, pagination/distinct metadata or bulk `docs` / `errors`. Logs go to stderr,
even for editing commands. Failures exit nonzero. Bulk responses with any `errors`
produce `OPERATION_PARTIAL_FAILURE` instead of false success; stderr includes the
partial result. Successful writes may already have committed: inspect before retrying.
No implicit retries or whole-batch transaction guarantees are added.

All native commands require input except `findVersions` / `countVersions`, which
default to `{}`. Together with `list` / `find` / `count`, these are the only
input-optional actions. Native input is inline JSON, not a JSON/JSONL query file.
Legacy JSONL actions and patch JSON-file input remain available.

## Validated native options

Each action's schema is strict. The following groups summarize accepted fields;
an option listed for one action is not silently accepted/ignored by other actions.

- Native **return options**: `depth` (0–10, default 0), `locale`, `fallbackLocale`
  (string or false), nested boolean `select`, `populate` (collection → selection),
  `showHiddenFields`, JSON-object `context`.
- `createOne`: return options, required `data`, optional `draft`, `filePath`,
  `overwriteExistingFiles`, `disableVerificationEmail`, `publishAllLocales`,
  `duplicateFromID`, `disableTransaction`.
- `updateOne`: return options, required `id` and `data`, optional `draft`, `autosave`,
  `filePath`, `overwriteExistingFiles`, `overrideLock`, `trash`, `publishAllLocales`,
  `publishSpecificLocale`, `unpublishAllLocales`, `disableTransaction`.
- `updateMany`: same update options but **`where` instead of `id`**; optional `limit`
  (1–10000), `sort` and CLI-only `allowAll`.
- `deleteOne`: return options, required `id`, optional `overrideLock`, `trash`,
  `disableTransaction`. **Deletion is permanent**, not soft-delete.
- `deleteMany`: same delete options but **`where` instead of `id`** and optional
  CLI-only `allowAll`.
- `duplicate`: return options, required source `id`, optional `data` overrides,
  `draft`, `selectedLocales` (nonempty locale list), `disableTransaction`. Unique
  fields may need overrides or project hooks. Payload decides whether duplication
  is allowed and how localized/upload fields are copied.
- `findByID`: required `id` plus the [get read options](./reads.md), including
  `trash`, `joins`, `includeLockStatus`, `flattenLocales`, and fallback-locale lists.
  It never uses a configured mapping lookup.
- `findDistinct`: required `field`; optional `where`, `depth`, `locale`, `populate`,
  `showHiddenFields`, `trash`, `page` (>=1, default 1), `limit` (1–1000, default 10),
  `sort`. It does **not** accept `select`, `draft`, `fallbackLocale` or `pagination`.
- `findVersions`: [list query options](./reads.md), except `joins` / `includeLockStatus`
  are unavailable and fallbackLocale is string/false; also accepts JSON `context`.
- `findVersionByID`: required **version** `id`, return options, `draft`, `trash`.
- `countVersions`: optional `where`, `locale`, JSON `context`; no `draft` / `trash`.
- `restoreVersion`: required **version** `id`, return options, optional `draft`.

Version methods require `versions` enabled on the collection; otherwise the CLI
returns `OPERATION_UNAVAILABLE`. Version IDs can be strings or integers and are
normalized to strings for the Local API. `where` on version history uses version
fields such as `parent` and `version.title`, not ordinary-document selectors.

For bulk writes, `where` is mandatory. Empty/missing predicates (including empty
`and`/`or` groups) are refused unless **`allowAll: true`** is explicitly provided:

```sh
# Dangerous: permanently delete the whole collection, with explicit authorization
payload-collection-cli categories deleteMany '{"where":{},"allowAll":true}'
```

This is an accidental-empty-filter guard, not a proof that a nonempty predicate
is selective: a broad `exists` / `not_equals` condition can still match everything.
Preview the same `where` using `list` / `count` before any destructive operation.

## Drafts, publishing, trash and uploads

These are native API options/data, not extra synthetic server methods:

```sh
# Draft creation and publication (collection must enable drafts)
payload-collection-cli articles createOne '{"data":{"title":"Draft"},"draft":true}'
payload-collection-cli articles updateOne '{"id":7,"data":{"_status":"published"},"draft":false}'
payload-collection-cli articles updateOne '{"id":7,"data":{"_status":"draft"}}'

# Read version history, inspect a version, then restore that version ID
payload-collection-cli articles findVersions '{"where":{"parent":{"equals":7}},"sort":"-createdAt"}'
payload-collection-cli articles findVersionByID '{"id":"version-id"}'
payload-collection-cli articles countVersions '{"where":{"parent":{"equals":7}}}'
payload-collection-cli articles restoreVersion '{"id":"version-id","draft":true}'

# Soft-delete / read trash / restore (collection must enable trash)
payload-collection-cli articles updateOne '{"id":7,"data":{"deletedAt":"2026-01-01T00:00:00.000Z"}}'
payload-collection-cli articles list '{"trash":true,"where":{"deletedAt":{"exists":true}}}'
payload-collection-cli articles updateOne '{"id":7,"trash":true,"data":{"deletedAt":null}}'

# PERMANENTLY delete; trash:true permits targeting already-trashed documents
payload-collection-cli articles deleteOne '{"id":7,"trash":true}'

# Upload / replace files in an upload-enabled collection
payload-collection-cli media createOne '{"data":{"alt":"Photo"},"filePath":"/absolute/path/image.jpg"}'
payload-collection-cli media updateOne '{"id":7,"data":{"alt":"Replacement"},"filePath":"/absolute/path/image.jpg","overwriteExistingFiles":true}'
```

`trash: true` means **include trashed documents**, not "move to trash" or "delete
only trash". Soft-delete and restore are `updateOne` / `updateMany` data changes;
`deleteOne` / `deleteMany` always perform permanent deletion. See
[Payload trash docs](https://payloadcms.com/docs/trash/overview) and the pinned
[3.90.2 Collection operations](https://github.com/payloadcms/payload/tree/v3.90.2/packages/payload/src/collections/operations/local).

All calls use the trusted, privileged Payload Local API. Read flags are not a DB
sandbox: configuration/hooks can have side effects. File paths are not confined
to the project directory. `context` can change project-hook behavior and
`disableTransaction` opts out of Payload's normal transaction handling; use only
trusted inputs. Do not pass production credentials to an untrusted agent.

# MCP servers

This package provides two independent **stdio** MCP servers. The docs server reads
bundled documentation for **this CLI**, not Payload's upstream documentation.
The wrapper exposes every CLI action, including all editing and read operations.
No HTTP listener or remote service is started.

## Installation and startup

Install the updated CLI in your trusted Payload project (with its Payload peer
dependency), build it when working from source, then use the installed binaries:

```sh
# Does not need a Payload project, config, environment secrets, or database
payload-collection-docs-mcp

# Default: read actions allowed; editing and explicit config-file imports denied
payload-collection-mcp --project-root /absolute/path/to/payload-project

# Owner-authorized editing, including delete and sync
payload-collection-mcp --project-root /absolute/path/to/payload-project --allow-write

# Also permit tool-selected executable mapping config files
payload-collection-mcp --project-root /absolute/path/to/payload-project --allow-write --allow-config-files
```

These binaries are part of the updated source/package. A source checkout does not
change an older version already installed from npm; no release is made by building.
For a local checkout, point the client at `node /absolute/path/to/checkout/dist/docs-mcp.js`
or `node /absolute/path/to/checkout/dist/cli-mcp.js` after `pnpm install && pnpm build`.

Example client configuration (adapt the outer configuration format to your client):

```json
{
  "mcpServers": {
    "payload-cli-docs": {
      "command": "node",
      "args": ["/absolute/path/to/checkout/dist/docs-mcp.js"]
    },
    "payload-cli": {
      "command": "node",
      "args": ["/absolute/path/to/checkout/dist/cli-mcp.js", "--project-root", "/absolute/path/to/payload-project"],
      "env": {
        "PAYLOAD_SECRET": "supply-your-project-secret-securely",
        "DATABASE_URL": "supply-your-project-database-url-securely"
      }
    }
  }
}
```

Do not commit real credentials. The child CLI inherits the **server's** environment;
tools cannot select environment variables, executable, shell command, or cwd.
The project root is resolved once at startup and must be an existing absolute directory.

## Docs tools and resources

- `docs_list {}` lists exact document IDs and resource URIs.
- `docs_get {"id":"docs/references/reads.md"}` returns Markdown.
- `docs_search {"query":"lookupField","limit":10}` performs case-insensitive
  literal search and returns bounded excerpts (limit 1–30).
- The same documents are static `text/markdown` MCP resources under
  `payload-collection-cli://docs/…`.
- `generated/command-catalog.md` is produced from the live command and option
  registries, so newly registered features are discoverable too.

README and repository Markdown are embedded **at build time**, with scenario and
AI-context placeholders expanded. Runtime docs requests cannot read arbitrary files,
follow paths, fetch URLs, import project code, or initialize Payload/DB. Rebuild to
refresh the embedded documents. The MCP server version matches `package.json`.

## CLI tools

`cli_describe {}` returns the command/option catalog and active permissions, without
initializing Payload. One `cli_<action>` tool is generated for **every** CLI action,
including `duplicate`, distinct/version operations, native ID/bulk CRUD and the
existing mapping/JSONL/read workflows. Use `cli_describe` for the authoritative
catalog; see [native operation coverage](./native-operations.md).
Editing tools remain discoverable when disabled; calling one returns `isError: true`.

All action tools share this input format:

```json
{
  "collection": "posts",
  "data": {"where":{"title":{"contains":"Payload"}},"limit":10},
  "options": {
    "config-json": {"mappings":{"users":{"lookupField":"email"}}}
  }
}
```

Use **either** `data` (a JSON value serialized once) **or** `input` (a raw CLI string).
Use `input` for JSONL file paths, raw JSON strings, or patch `.json`
file paths, for example `{"collection":"posts","input":"./input with spaces.jsonl"}`.
Paths are passed literally and resolved by the CLI relative to the fixed project root;
existing CLI support for absolute paths remains available. File access is **not**
confined to this directory. See [CLI specs](./specs_detail.md) for each action's input
format; notably `sync` takes a JSON array or a JSONL file, not a single object.
`get` and all editing actions require input; `list`/`find`/`count` and
`findVersions`/`countVersions` default to `{}`. Native operations require the
JSON options envelope inside `data`, for example:

```json
{"collection":"categories","data":{"id":7,"data":{"name":"Copy"}}}
```

That is the input for `cli_duplicate`: outer `data` is the CLI JSON envelope;
inner `data` contains document overrides. `cli_updateMany` / `cli_deleteMany`
require a `where`; empty predicates additionally need `allowAll: true`.

The tool `options` object is generated from the **same option registry as yargs**,
using canonical flag names (CLI aliases still work on the standalone CLI):

- `config-json`: inline configuration string or JSON object.
- `config-file`: path to executable config; requires `--allow-config-files`.
- `config-export-name`: named export, default `cliConfig`.

Unknown fields/options are rejected. `--describe` is represented by `cli_describe`;
startup/help/discovery flags are not accepted as per-action execution flags. New
registered actions/options automatically appear in tool discovery; CI checks parity
and invokes every action through the same runner. New commands must explicitly
classify input requirements and read/destructive behavior; missing permissions
fail closed. New options must explicitly classify code/data/discovery safety.

## Results, failures and process lifecycle

Successful reads **and native JSON editing actions** (including `duplicate`) return
`structuredContent.result` (parsed JSON), plus separate
`stdout`, `stderr`, `exitCode` and `signal`. Legacy mapping/JSONL edits return these process
fields and the CLI's normal success output. Text content contains the same JSON for
clients that do not expose structured content. Validation/permission failures,
nonzero exits, signals, malformed expected JSON, timeouts and output overflow return
`isError: true`; child diagnostics remain separate from protocol stdout.

Each request spawns this package's CLI using argv, **never a shell**. The default
operation timeout is 300000 ms; startup `--timeout-ms` accepts 1–3600000 ms. Combined
captured stdout/stderr is capped at 8 MiB (failure, not silent success). Cancellation,
timeout and output overflow terminate the child; shutdown/disconnection kills active
children. POSIX subprocess groups are terminated together (Windows: direct child).
Operations are never automatically retried. A failed/cancelled edit may have partially
completed: inspect state before retrying. Batch operations are not transactions.

## Security and permissions

The wrapper is for a **trusted local project and trusted MCP client**. Payload's
privileged Local API is used, not an authenticated admin user's access rules. Treat
both database contents and diagnostics as potentially sensitive. Read-only annotations
and `--allow-write` prevent dispatch of CLI editing actions, but are **not a sandbox**:
Payload config, package defaults, plugins and hooks still execute and can mutate data,
access files or use the network even during reads/initialization. Likewise,
`--allow-config-files` allows code imports and should only be enabled for trusted
inputs. Existing package-level CLI defaults may already import code; review them.
Do not grant an untrusted agent this server or production credentials.

All editing operations require `--allow-write`. Destructive annotations cover updates, deletes, upserts, patches, sync and version
restore, in both native and legacy forms. Creation and duplication are also
write-gated, although they are not annotated as destructive.
`sync` can delete documents absent from its input. MCP annotations are descriptive
hints, not client confirmation dialogs; arrange approvals in your client and use
non-production data until you have inspected the intended changes.

Protocol implementation uses the [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
and [stdio transport](https://modelcontextprotocol.io/docs/develop/build-server).

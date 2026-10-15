# End-to-end tests

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test:e2e
```

The command prepares a minimal fixture, builds the **actual distributable CLI**,
and runs all scenarios against real Payload **3.90.2** and SQLite. Both Payload
and its SQLite adapter are pinned in the repository lockfile. No Next.js app,
`create-payload-app`, separate install, `.env`, `npx`, or database service is needed.
After dependency installation the suite does not need network access.

`pnpm e2e:prepare` only copies the committed collection/config templates and writes
a minimal fixture package manifest. All generated files live in ignored `_payload/`.
It does not remove databases. Each scenario explicitly resets its disposable SQLite
DB, including WAL/SHM files. Scenarios run **serially**, as they share the fixture.
Never point the harness at an application or production database.

Subprocesses use argv arrays and an explicit test-only environment. Both successful
and failed calls preserve stdout, stderr and exit status. Normal scenarios require
exit 0; failure scenarios explicitly expect exit 1. Signals and a 55-second process
timeout fail the test. `getCollectionData` reads all pages and fails loudly on DB,
process or JSON errors; it never substitutes `[]` for a failed read. Package defaults
are restored by `afterEach`; runtime-generated configs remain inside `_payload/`.

The suite covers CRUD, mapping/upsert, package/inline/imported configuration,
relations/defaults, patch/sync and error reporting. Use a focused Vitest invocation
(after `pnpm e2e:prepare && pnpm build`) to diagnose a single scenario:

```sh
pnpm exec vitest run e2e-tests/scenarios/930-error-stderr --no-file-parallelism
```

`mise run init` and `mise run test` in this directory are convenience aliases.

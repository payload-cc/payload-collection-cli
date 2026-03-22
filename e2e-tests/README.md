# E2E Tests for Payload Collection CLI

This directory contains resources to initialize a local, blank Payload CMS project and perform actual end-to-end (E2E) integration tests using the locally built CLI.

## Requirements
- `mise` must be installed.

## Usage

1. **Initialize the dummy Payload CMS application**
   Run the following command. It will scaffold a blank Payload 3.0 SQLite application inside the `_payload/` directory and link the local CLI codebase.
   ```bash
   mise run init
   ```

2. **Run the CLI integration test**
   Run the following command to test the CLI's upsert functionality against the dummy database using `data.jsonl`.
   ```bash
   mise run test
   ```

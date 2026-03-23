---
title: Error Reference | Payload Collection CLI
description: Standardized error codes and troubleshooting guide for Payload Collection CLI.
---

# Error Reference

This document lists the standardized error slugs used by Payload Collection CLI. Each error includes a description and suggested resolution.

## Configuration Errors (1xxx)

### `CONFIG_NOT_FOUND`
**Description**: The configuration file specified via `--config-file` or found in `package.json` does not exist.
**Resolution**: Check the file path and ensure the file exists.

### `CONFIG_INVALID`
**Description**: The configuration file failed to parse as JSON or failed validation against the expected schema.
**Resolution**: Check the syntax of your configuration file and ensure it matches the [Configuration Specification](specs_detail.md#cli-config).

### `CONFIG_EXPORT_NOT_FOUND`
**Description**: The configuration file was loaded, but the specified named export (default: `cliConfig`) was not found.
**Resolution**: Ensure your configuration file uses a named export. Default exports are not supported.

---

## Payload Integration Errors (2xxx)

### `PAYLOAD_CONFIG_NOT_FOUND`
**Description**: The CLI could not find `payload.config.ts` in the expected locations (`src/payload.config.ts` or `payload.config.ts`).
**Resolution**: Ensure you are running the CLI from the root of your Payload project or that the config file is in one of the standard locations.

### `PAYLOAD_INIT_FAILED`
**Description**: Payload failed to initialize.
**Resolution**: Check your Payload configuration and environment variables (e.g., `DATABASE_URI`).

---

## Resolver Errors (3xxx)

### `COLLECTION_NOT_FOUND`
**Description**: The specified collection slug does not exist in your Payload configuration.
**Resolution**: Double-check the collection slug.

### `RELATION_NOT_FOUND`
**Description**: An attempt to resolve a relation failed because the target document was not found, and `onNotFound` is set to `error`.
**Resolution**: Ensure the referenced document exists or change `onNotFound` to `create` or `ignore`.

---

## Executor Errors (4xxx)

### `DOCUMENT_NOT_FOUND`
**Description**: The target document for an `update`, `delete`, or `patch` operation could not be found.
**Resolution**: Verify that the document exists and that the `lookupField` value is correct.

### `INVALID_ACTION`
**Description**: The requested operation is not supported or was called incorrectly.
**Resolution**: Refer to the [supported operations](specs_detail.md#operations).

### `MISSING_LOOKUP_FIELD`
**Description**: An operation that requires a `lookupField` (like `update`, `delete`, or `upsert`) was called, but the field was missing from the input data.
**Resolution**: Ensure your data contains the field specified as `lookupField` for the collection.

### `INPUT_PARSE_FAILED`
**Description**: Failed to parse the input JSON or JSONL.
**Resolution**: Check the syntax of your input data.

---

## JSON Patch Errors (5xxx)

### `PATCH_PARSE_FAILED`
**Description**: The input for a `patch` operation is not valid JSON.
**Resolution**: Check the syntax of your patch input.

### `PATCH_INVALID_OP`
**Description**: A JSON Patch operation contains an invalid `op` value.
**Resolution**: Use one of the standard RFC 6902 operations: `add`, `remove`, `replace`, `move`, `copy`, `test`.

### `PATCH_INVALID_PATH`
**Description**: A JSON Patch operation contains an invalid or unsupported `path`.
**Resolution**: Ensure the path follows the [CLI's path syntax](specs_detail.md#identifier-based-paths).

### `PATCH_TEST_FAILED`
**Description**: A `test` operation in a JSON Patch failed (the value at the target path did not match).
**Resolution**: Verify the current state of the document and the expected value in your patch.

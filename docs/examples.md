---
title: Examples & Use Cases | Payload Collection CLI
description: Explore real-world examples and use cases for Payload Collection CLI, including batch processing, relation lookups, and automated data management.
---

# Examples & Use Cases

This page showcases live examples of the **Payload Collection CLI** in action, automatically generated from our E2E test suite. Each section below represents a verified scenario, including the sample data and any custom mapping configuration used.

[[SCENARIO_EXAMPLES_BUNDLE]]

> [!TIP]
> All these examples are extracted directly from the `e2e-tests/scenarios` directory and are automatically verified on every CI run to ensure they remain perfectly functional with the latest Payload CMS version.


## Query and inspect before editing

```sh
payload-collection-cli categories list '{"sort":"name","limit":10}'
payload-collection-cli categories get '{"id":7,"depth":0}'
payload-collection-cli categories count '{"where":{"name":{"equals":"News"}}}'
```

See [read options](./references/reads.md). Read stdout is JSON; logs and errors go to stderr.

# Phase 9 package script note

The intended Phase 9 package script is:

```json
{
  "test:diagnostic-preview": "node tests/preview-adapters/diagnostic-canvas-preview-adapter.test.mjs && node tests/preview-adapters/bm-cii-diagnostic-canvas-preview.test.mjs"
}
```

The source branch contains both test files, but the package script was not added because the connector blocked the full `package.json` replacement while preserving the existing large script set.

Run the commands directly until the package script is added in a follow-up patch:

```bash
node tests/preview-adapters/diagnostic-canvas-preview-adapter.test.mjs
node tests/preview-adapters/bm-cii-diagnostic-canvas-preview.test.mjs
```

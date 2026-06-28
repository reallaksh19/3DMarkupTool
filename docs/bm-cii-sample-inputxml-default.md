# BM_CII sample load and support basis default

This patch fixes the observed runtime log:

`ERROR loading BM_CII stagedJson sample: HTTP 404 while loading BM_CII_INPUT_managed_stage.json`

The app already has a bundled BM_CII sample data module, but the managed-stage JSON UI also registered an earlier capture listener that attempted to fetch `./samples/BM_CII_INPUT_managed_stage.json` and stopped the newer bundled sample controller from running.

The fix changes the managed-stage JSON UI sample path to import `managed-stage-bm-cii-json-sample-data.js`, avoiding a missing deployed JSON file. It keeps fallback fetch candidates for local development.

New managed-stage file/sample loads also reset support basis to `stagedJson` / InputXML Basis before conversion. This prevents a stale `isonote` selection from producing zero support candidates before any ISONOTE text is loaded.

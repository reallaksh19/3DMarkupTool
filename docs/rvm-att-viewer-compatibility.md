# RVM/ATT Viewer Compatibility Audit

C12 adds a generated compatibility report for the BM_CII RVM/ATT catalogue export artifact.

## Purpose

The audit verifies that the generated `.rvm` and `.att` files keep a Review/Navis-style structural and property contract:

- RVM chunk grammar remains `HEAD -> MODL -> CNTB/PRIM/CNTE -> END:`.
- RVM `CNTB`/`CNTE` container counts remain balanced.
- RVM `PRIM` count matches the production export model primitive count.
- ATT header remains the expected `CADC_Attributes_File` format.
- ATT `NEW`/`END` property blocks remain balanced.
- ATT block count matches the production export model node count.
- Catalogue valve/flange nodes expose the required catalogue metadata properties.

## Generated artifact

The CI artifact is named:

```text
rvm-att-viewer-compat
```

It contains:

```text
BM_CII_catalogue_sample.rvm
BM_CII_catalogue_sample.att
BM_CII_catalogue_sample.audit.json
BM_CII_catalogue_sample.summary.md
BM_CII_rvm_att_viewer_compat.audit.json
BM_CII_rvm_att_viewer_compat.summary.md
```

## Compatibility level

The report uses this explicit level:

```text
STRUCTURAL_AND_PROPERTY_VISIBILITY_AUDIT
```

This means CI verifies structure and metadata visibility, but it does not claim:

- an external Navisworks import was executed;
- an external AVEVA Review import was executed;
- byte-for-byte equivalence with `RHBG.RVM`;
- ASME/rating-size database-backed dimensions.

## Catalogue metadata expected in ATT

Every catalogue-rendered valve/flange component must expose these properties in its ATT block:

```text
CATALOGUE_VISUAL
CATALOGUE_CLASS
CATALOGUE_TYPE
CATALOGUE_RECIPE_ID
CATALOGUE_SCHEMA
PROPORTIONAL_FALLBACK
ASME_DIMENSIONAL_DB_BACKED
RVM_CATALOGUE_PARITY
CATALOGUE_EXPORT_PRODUCTION_WIRING
```

The proportional fallback flags remain deliberate:

```text
PROPORTIONAL_FALLBACK := 'TRUE'
ASME_DIMENSIONAL_DB_BACKED := 'FALSE'
```

## CI command

```bash
npm run artifact:rvm-att-viewer-compat
node tests/rvm-att-viewer-compat.test.mjs
```

The test is part of `npm test`.

## Out of scope

C12 does not change runtime geometry, RVM binary writer primitive kinds, GLB visual output, UI layout, or InputXML parsing. It is a compatibility verification and reporting phase only.

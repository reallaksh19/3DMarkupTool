# Support / Restraint Parity Audit

C16 updates the support/restraint parity audit from the C13 foundation gate to a **production catalogue wiring** gate.

## Scope

The current support/restraint symbols remain **proportional fallback symbols** generated from InputXML restraints and optional ISONOTE expected-support records. They are not a vendor support catalogue and they are not dimensionally backed by project support-standard tables.

The current production path is:

```text
InputXML restraints / ISONOTE expected records
→ buildRvmExportModel()
→ applySupportRestraintCatalogueExportParity()
→ support-restraint-primitive-adapter.js
→ RVM writer-safe primitives
→ ATT support metadata
```

## Current contract

The audit intentionally locks these facts:

```text
supportCatalogueParity = PRODUCTION_WIRED
productionCatalogueWiring = TRUE
proportionalFallback = TRUE
vendorDimensionalDbBacked = FALSE
asmeDimensionalDbBacked = FALSE
externalViewerExecutedInCi = FALSE
```

Supported RVM writer primitive kinds remain:

```text
cylinder
box
pyramid
sphere
```

No support/restraint path may pass a custom renderer-only primitive kind directly to the RVM writer.

## Required support catalogue metadata

Every real BM_CII support/restraint node in the production RVM/ATT export must expose:

```text
SUPPORT_CATALOGUE_VISUAL
SUPPORT_CATALOGUE_FAMILY
SUPPORT_CATALOGUE_RECIPE_ID
SUPPORT_CATALOGUE_SCHEMA
SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK
SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED
SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING
```

These fields must also be present in the generated ATT text so they are visible as imported properties in compatible Review/Navis workflows.

## CI artifact

The C16 artifact generator writes:

```text
artifacts/support-restraint-parity/
  BM_CII_support_restraint_parity.audit.json
  BM_CII_support_restraint_parity.summary.md
```

The artifact is generated from:

```text
samples/BM_CII_Enriched_v8_lite.XML
samples/BM_CII_ISONOTE_sideload.csv
samples/BM_CII_LINE_NO_sideload.csv
```

with `supportMode: compare`.

## What the audit verifies

The audit verifies:

- the real BM_CII sample emits support/restraint nodes;
- every support/restraint node is rewritten by `applySupportRestraintCatalogueExportParity()`;
- support/restraint primitives are present;
- primitive kinds are writer-safe;
- primitive dimensions and centers are finite;
- ATT support metadata remains visible;
- every exported support node carries stable metadata such as `FAMILY`, `NODE`, `SOURCE_CLASS`, `SOURCE_MODE`, `GAP_MM`, and `TARGET_VIEWER`;
- every exported support node carries the required `SUPPORT_CATALOGUE_*` metadata;
- generated summary reports catalogue families, schemas, recipe ids, and metadata coverage;
- proportional-fallback and non-dimensional claims remain explicit.

## What the audit does not claim

This C16 production-wiring audit does **not** claim:

- vendor standard support geometry;
- clamp, shoe, trunnion, spring-can, guide-frame, or line-stop dimensional accuracy;
- external Navisworks / AVEVA Review import execution in CI;
- byte-for-byte equivalence with any reference RVM;
- ASME/rating-size dimensional database backing.

## Next phase

C17 should add a GLB-side support/restraint scene/visual audit, similar to the valve/flange C10/C11 gates, so support/restraint catalogue symbols are also visually inspectable in the actual preview scene.

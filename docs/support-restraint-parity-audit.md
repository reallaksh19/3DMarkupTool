# Support / Restraint Parity Audit

C13 establishes a support/restraint parity foundation for the `3DMarkupTool` core export path.

## Scope

The current support/restraint symbols are **proportional fallback symbols** generated from InputXML restraints and optional ISONOTE expected-support records. They are not a vendor support catalogue and they are not dimensionally backed by project support-standard tables.

The current path is:

```text
InputXML restraints / ISONOTE expected records
→ collectSupportRecords()
→ supportPrimitives()
→ RVM writer-safe primitives
→ ATT support metadata
```

## Current contract

The audit intentionally locks these facts:

```text
supportCatalogueParity = FOUNDATION_ONLY
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

## CI artifact

The C13 artifact generator writes:

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
- support/restraint primitives are present;
- primitive kinds are writer-safe;
- primitive dimensions and centers are finite;
- ATT support metadata remains visible;
- every exported support node carries stable metadata such as `FAMILY`, `NODE`, `SOURCE_CLASS`, `SOURCE_MODE`, `GAP_MM`, and `TARGET_VIEWER`;
- the generated summary keeps the proportional-fallback and non-dimensional claims explicit.

## What the audit does not claim

This C13 foundation does **not** claim:

- vendor standard support geometry;
- clamp, shoe, trunnion, spring-can, guide-frame, or line-stop dimensional accuracy;
- external Navisworks / AVEVA Review import execution in CI;
- byte-for-byte equivalence with any reference RVM;
- ASME/rating-size dimensional database backing.

## Next phase

C14 should introduce a real support/restraint visual catalogue module, similar to the valve/flange path:

```text
support-restraint-visual-catalog.js
→ support-restraint-primitive-adapter.js
→ GLB/RVM audit gates
```

That later phase can improve visual quality while preserving this C13 export/metadata contract.

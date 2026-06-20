# RVM Catalogue Export Requirements Gate

This document records the C3/C3B safety gate for valve/flange catalogue export parity.

## Purpose

The shared valve/flange adapter can emit renderer-neutral hints such as:

```text
frustum
valve-body
radial-cylinder
torus
direction-arrow
bolt-pattern
```

The existing RVM writer must not receive those adapter hints directly. It supports only:

```text
cylinder
box
pyramid
sphere
```

Therefore C3 requires a translator seam:

```text
valve-flange-primitive-adapter.js
→ rvm-catalogue-primitive-translator.js
→ rvm-catalogue-export-wiring.js
→ rvm-writer.js
```

## Gates added

```text
tests/rvm-catalogue-primitive-requirements.test.mjs
tests/rvm-catalogue-export-wiring.test.mjs
```

The gates verify:

```text
1. Flanged valves translate into segmented RVM-safe primitives.
2. Weld-neck flange pairs translate into segmented RVM-safe primitives.
3. Frustum hints are stepped into cylinders.
4. Bolt-pattern hints are expanded into writer-safe sphere primitives.
5. RVM writer receives only cylinder / box / pyramid / sphere.
6. ATT metadata exposes catalogue status and fallback/non-ASME flags.
7. The translator and production wiring have no Three.js, DOM, polling, or scene traversal dependency.
8. Production RVM conversion applies catalogue parity before Navis-safe normalization and RVM/ATT writing.
9. Non-catalogue components keep the existing fallback primitive path.
```

## Production conversion path

```text
buildRvmExportModel(model)
→ applyRvmCatalogueExportParity(exportModel, model)
→ normalizeNavisExportModelNames(exportModel)
→ assertNavisExportModel(exportModel)
→ writeRvm(exportModel)
→ writeAtt(exportModel)
```

## Metadata required in ATT

Catalogue-rendered valve/flange nodes must expose:

```text
CATALOGUE_VISUAL := 'TRUE'
CATALOGUE_CLASS := 'VALVE' / 'FLANGE'
CATALOGUE_TYPE := 'VALVE_FLANGED' / 'FLANGE_WELD_NECK'
CATALOGUE_RECIPE_ID := '<recipe id>'
CATALOGUE_SCHEMA := '<schema version>'
PROPORTIONAL_FALLBACK := 'TRUE'
ASME_DIMENSIONAL_DB_BACKED := 'FALSE'
RVM_CATALOGUE_PARITY := 'TRUE'
CATALOGUE_EXPORT_PRODUCTION_WIRING := 'TRUE'
```

## Current status

C3 added the translator seam and requirements gate. C3B wires that seam into the production RVM conversion path while preserving the neutral base export model and fallback behavior.

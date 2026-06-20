# RVM Catalogue Export Requirements Gate

This document records the C3 safety gate for valve/flange catalogue export parity.

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
→ export-model.js
→ rvm-writer.js
```

## Gate added

```text
tests/rvm-catalogue-primitive-requirements.test.mjs
```

The gate verifies:

```text
1. Flanged valves translate into segmented RVM-safe primitives.
2. Weld-neck flange pairs translate into segmented RVM-safe primitives.
3. Frustum hints are stepped into cylinders.
4. Bolt-pattern hints are expanded into writer-safe sphere primitives.
5. RVM writer receives only cylinder / box / pyramid / sphere.
6. ATT metadata exposes catalogue status and fallback/non-ASME flags.
7. The translator has no Three.js, DOM, polling, or scene traversal dependency.
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
```

## Current status

This PR adds the translator seam and CI requirements gate. The production `export-model.js` switch is intentionally left for the next PR so the unsafe part is isolated and gated first.

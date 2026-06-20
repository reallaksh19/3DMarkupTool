# Support / Restraint Export Wiring

## Status

C15 wires the support/restraint proportional visual catalogue into the production RVM/ATT conversion path.

```text
InputXML / ISONOTE support records
→ export-model.js support node collection
→ rvm-support-restraint-export-wiring.js
→ support-restraint-primitive-adapter.js
→ RVM writer-safe primitives
→ ATT-visible catalogue metadata
```

The wiring is intentionally applied after `buildRvmExportModel()` and before Navis-safe name normalization. This keeps record collection in one existing place while moving support/restraint symbol geometry to the shared catalogue adapter introduced in C14.

## What is now production-wired

For every exported support/restraint node with a valid model node position, the production conversion path stamps catalogue metadata and replaces legacy inline primitives with adapter-generated primitives.

Required node attributes:

```text
SUPPORT_CATALOGUE_VISUAL
SUPPORT_CATALOGUE_FAMILY
SUPPORT_CATALOGUE_RECIPE_ID
SUPPORT_CATALOGUE_SCHEMA
SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK
SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED
SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING
```

Primitive records also carry adapter metadata:

```text
supportCatalogue
supportVisualKey
supportVisualRecipeId
supportVisualSchema
supportVisualFamily
proportionalFallback
vendorDimensionalDbBacked
adapterOrdinal
```

## Writer safety

The RVM writer is still limited to existing supported primitive kinds:

```text
cylinder
box
pyramid
sphere
```

C15 does not introduce new RVM binary primitive kinds.

## Dimensional scope

This remains a proportional fallback visual/export catalogue. It is not a vendor support catalogue, not a support-standard dimensional database, and not ASME backed.

```text
SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK = TRUE
SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED = FALSE
```

## Non-goals

C15 does not change:

- UI layout or review tools
- valve/flange catalogue geometry
- RVM writer binary primitive types
- support vendor dimensions
- support load/design calculations

## CI gate

`tests/support-restraint-export-wiring.test.mjs` verifies the production wiring seam directly:

- support nodes are rewritten through the shared adapter;
- unknown support families resolve to `UNKNOWN_RESTRAINT` instead of being silently converted;
- node and primitive metadata are stamped;
- only writer-safe primitive kinds are emitted.

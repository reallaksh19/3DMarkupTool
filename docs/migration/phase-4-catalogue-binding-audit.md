# Phase 4 catalogue binding audit

## Purpose

Phase 4 adds an exact-only shadow catalogue binding audit.

The Phase 4 path is:

```text
PlantModelGraph.v1
+ PlantGraphTopologyAudit.v1 ok
+ CatalogueRegistry.v1
+ ComponentCatalogueItem.v1
-> CatalogueBindingAudit.v1
```

This phase reports what can bind exactly and what remains unresolved. It does not solve geometry, execute primitive recipes, compile export models, or make RVM/ATT/GLB decisions.

## Classification

Each graph item is classified into one of the Phase 4 audit outcomes:

- `catalogueResolved` when an item has an exact normalized catalogue identity match;
- `proceduralResolved` when a generated straight pipe has deterministic `straightPipe.v1` intent;
- `fallbackBlocked` when a fallback policy blocks automatic binding;
- `unresolved` when no exact catalogue item exists;
- `supportIntent` for preserved support intent that is not catalogue-bound in this phase.

`supportIntent` is counted separately so support mapping cannot be confused with component catalogue binding.

## Exact-only rule

Catalogue binding uses exact normalized identity only.

No nearest match is allowed. A nearby nominal size, wall, schedule, family, rating, or component type must not be substituted silently.

If no exact item exists, the binding row remains unresolved with:

```json
{
  "status": "unresolved",
  "reason": "no exact catalogue item"
}
```

## Explicit non-goals

Phase 4 does not start:

- geometry solver;
- bend arc solver;
- primitive compiler;
- RVM export model compiler;
- GLB visual model;
- canvas adapter;
- runtime switch.

The binding audit does not read or write RVM, ATT, GLB, canvas, app-loader, or browser state.

## BM_CII expected audit posture

The full BM_CII-style topology benchmark currently produces:

```text
itemCount = 52
proceduralResolvedCount = 19
supportIntentCount = 12
unresolvedCount = 21
nearestMatchCount = 0
exportDecisionCount = 0
```

The unresolved component set is expected at this phase because the base catalogue is intentionally small:

```text
flange unresolved count = 8
valve unresolved count = 6
bend unresolved count = 7
```

This is success for Phase 4: the platform knows exactly what can bind, what remains unresolved, and why, without guessing.

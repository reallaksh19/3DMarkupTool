# Phase 3 catalogue registry and base catalogue format

## Dependency

This phase depends on Phase 2A governance: PlantGraph topology and migration boundaries.

This PR is registry/load-only. It does not implement binding, geometry solving, primitive compiling, or export/RVM/GLB decisions.

## Purpose

Phase 3 establishes the dormant catalogue registry and base-piping catalogue file layout required by the platform migration. It does not bind graph items, solve geometry, create RVM primitives, compile primitive models, make GLB mesh decisions, or change the current app runtime path.

The shadow-mode catalogue path is:

```text
CatalogueRegistry.v1
  -> catalogue index
  -> ComponentCatalogueItem.v1 records
  -> contract validation
  -> catalogue load audit
```

This prepares the later binding phase without moving catalogue logic into writer or canvas code.

## Explicit non-goals

This phase does not:

- bind `PlantModelGraph.v1` items to catalogue records;
- choose nearest-match catalogue records;
- solve ports, endpoints, pipe trims, or elbow tangents;
- compile primitives;
- create RVM primitive codes or material IDs;
- create GLB mesh recipes or preview geometry;
- make export/RVM/GLB production decisions.

## File layout

```text
catalogues/base-piping/catalogue-registry.json
catalogues/base-piping/base-piping.index.json
catalogues/base-piping/items/pipe-straight-4in-std.json
catalogues/base-piping/items/elbow-90lr-4in-std.json
catalogues/base-piping/items/support-rest-generic.json
```

The registry remains a `CatalogueRegistry.v1` document. Its `source` points to a catalogue index. The index is a small deterministic manifest that points to individual `ComponentCatalogueItem.v1` files.

## Base catalogue scope

The Phase 3 base-piping catalogue deliberately contains only a minimum deterministic seed set:

- 4 inch STD straight pipe seed;
- 4 inch STD 90 degree long-radius elbow seed;
- generic REST support marker seed.

The item records preserve the Phase 1 catalogue-item boundary: dimensions, ports, RVM recipe hint, GLB recipe hint, and ATT template. These are catalogue records only, not runtime primitives, not solved geometry, and not export decisions.

## Loader contract

`src/catalogue/catalogue-registry-loader.js` exposes:

- `loadCatalogueRegistryFromText(sourceText, options = {})`
- `loadCatalogueItemsFromMap(registry, fileMap, options = {})`
- `auditCatalogueRegistryLoad(registry, validation, options = {})`
- `catalogueItemKey(item)`

The loader accepts source text and an explicit file map. It does not access browser globals, runtime app state, canvas state, writer state, preview state, or catalogue binder state.

## Golden benchmark

The deterministic Phase 3 benchmark is:

```text
catalogues/base-piping/catalogue-registry.json
  -> loadCatalogueRegistryFromText()
  -> loadCatalogueItemsFromMap()
  -> samples/catalogue/base-piping.catalogue-summary.expected.json
```

The test validates the registry through `CatalogueRegistry.v1`, validates every loaded item through `ComponentCatalogueItem.v1`, and compares the generated load summary to the golden summary fixture.

## Runtime behavior guarantee

No runtime file is changed. The current managed-stage converter, RVM output, ATT output, canvas behavior, ISONOTE popup behavior, support mapping behavior, app loader, loader chain, and Pages build/cache-key chain remain unchanged.

## Next phase handoff

Phase 4 should consume `PlantModelGraph.v1` items and this catalogue registry to produce an exact-only catalogue binding audit. Phase 4 should remain shadow-mode and should not solve geometry, compile primitives, or call writers.

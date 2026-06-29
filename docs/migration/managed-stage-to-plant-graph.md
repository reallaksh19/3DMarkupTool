# Managed-stage JSON to PlantModelGraph shadow importer

## Purpose

Phase 2 adds a shadow-mode importer that converts BM_CII-style managed-stage JSON into `PlantModelGraph.v1`. The importer is an adapter contract for the platform migration path:

```text
managed-stage JSON
  -> convertManagedStageJsonToPlantGraph()
  -> PlantModelGraph.v1
  -> validatePlantModelGraphContract()
  -> ManagedStageToPlantGraphAudit.v1
```

This path is intentionally test/script-only. It is not wired into the current app runtime.

## Preserved data

The importer preserves the source identity of discovered records where possible:

- pipe route source IDs and names;
- node IDs and endpoint coordinates from route-like records;
- branch-level line number and material values where available;
- pipe bore and schedule values where available;
- catalogue hints for tagged components such as family, type, NPS, and schedule;
- support source identity, support family, axis, node, source, and position;
- optional ISONOTE text when explicitly supplied through importer options.

Generated pipe items are emitted as `kind: "generated"` with `generator: "straightPipe.v1"`. Tagged components with catalogue hints are emitted as `kind: "component"` and keep a `catalogueRef`. Supports are emitted as graph items instead of geometry primitives.

## Intentionally not solved in this phase

This importer does not solve catalogue binding, dimensional catalogue lookup, component primitive resolution, support symbol mapping, or RVM/ATT emission. It does not create preview meshes or RVM primitives. Unknown component families may be represented as generated placeholder graph items until the catalogue binder owns the resolution step.

## Runtime behavior guarantee

No current runtime path is changed. The importer does not call the managed-stage converter, canvas preview path, RVM writer, ATT writer, ISONOTE popup code, support mapper, app loader, safe UI loader, or Pages build/cache-key chain. Existing managed-stage conversion, RVM output, ATT output, canvas behavior, popup behavior, and support mapping remain unchanged.

## Golden benchmark

The deterministic Agent 02/03 benchmark is:

```text
samples/importers/managed-stage-minimal.input.json
  -> convertManagedStageJsonToPlantGraph()
  -> samples/importers/managed-stage-minimal.expected.plant-graph.json
```

The importer test validates both the expected graph and generated graph under `PlantModelGraph.v1`, compares the generated graph to the golden expected graph, and verifies the audit counts.

## Next phase handoff

Agent 04 Catalogue Binder should consume `PlantModelGraph.v1` items and resolve catalogue-backed component definitions into a richer primitive/model representation. The binder should treat this importer output as the source-preserving graph boundary, not as final render/export geometry.

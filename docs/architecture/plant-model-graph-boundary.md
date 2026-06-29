# PlantModelGraph boundary

## Purpose

`PlantModelGraph.v1` is the engineering-intent boundary for the migration. It is allowed to preserve source intent and references, but it must not contain solved geometry, primitive export decisions, or runtime rendering state.

This boundary exists so future catalogue, geometry, preview, and export agents cannot silently move downstream assumptions into the authoring graph.

## Allowed in PlantModelGraph

The following data is allowed:

- nodes;
- routes;
- item identity;
- support identity;
- `catalogueRef` for exact catalogue intent;
- `generatorRef` or generator name for procedural authoring intent;
- `sourceRef` for traceability to source records;
- intended placement reference, such as node or route IDs;
- line, spec, and material metadata;
- authoring coordinate basis.

## Forbidden in PlantModelGraph

The following data is forbidden:

- solved world ports;
- primitive centers;
- primitive basis matrices;
- trimmed pipe lengths;
- elbow tangent solutions;
- RVM primitive codes;
- RVM material IDs;
- Navis export transforms;
- GLB mesh recipes;
- fallback export decisions.

## Boundary rule

`PlantModelGraph.v1` may say what an item is intended to be and where it is intended to connect. It must not say how that item is solved, meshed, previewed, compiled, or exported.

Downstream phases must keep their outputs in separate contracts:

```text
PlantModelGraph.v1
  -> catalogue binding audit
  -> geometry solving / ResolvedPrimitiveModel.v1
  -> RvmExportModel compiler
  -> writers/adapters
```

Any future field proposal that adds solved geometry or export-specific semantics to `PlantModelGraph.v1` must be rejected unless the boundary document is intentionally revised with tests.

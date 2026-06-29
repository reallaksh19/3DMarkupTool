# Coordinate and basis policy

## Hard rule

Authoring coordinate basis remains unchanged through `PlantModelGraph.v1` and geometry solving.

The Navis/RVM transform happens only at the `RvmExportModelCompiler` boundary.

No module before `RvmExportModelCompiler` may apply the Navis export transform.

## Rationale

The migration separates engineering intent, solved geometry, and export encoding. Applying export transforms too early would make the graph ambiguous, break traceability, and make canvas/runtime state look like engineering source data.

## Boundary responsibilities

### PlantModelGraph.v1

- Stores the authoring coordinate basis.
- Stores nodes, route references, item placement references, and source traceability in authoring coordinates.
- Does not contain Navis/RVM transforms.

### Catalogue binding

- Reads catalogue keys and graph placement references.
- Does not rotate or remap the model into Navis/RVM basis.

### Geometry solving

- Solves geometry in the authoring coordinate basis.
- May produce world-space ports and solved placements in the authoring basis.
- Does not apply the Navis/RVM export transform.

### RvmExportModelCompiler

- Is the first boundary allowed to map solved authoring-basis geometry into Navis/RVM export basis.
- Owns export transform policy and export-specific material/review-node mapping.

## Prohibited behavior

No pre-compiler module may:

- swap axes for Navis/RVM export;
- apply Review/Navis export basis matrices;
- encode RVM primitive basis matrices;
- mutate graph nodes into export coordinates;
- infer export-space pipe lengths or elbow tangents.

If a future test needs Navis/RVM coordinates, the test belongs at or after the `RvmExportModelCompiler` boundary.

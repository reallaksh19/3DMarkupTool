# Core platform contracts

## Contract boundary

The upgraded platform is built on three separate contract families:

```text
PlantModelGraph.v1          authoring/input source of truth
ComponentCatalogueItem.v1   reusable tagged item catalogue contract
ResolvedPrimitiveModel.v1   compiler output before RVM/GLB/ATT writers
```

Do not collapse these into one object.

## PlantModelGraph.v1

Represents engineering intent.

It contains:

- project metadata;
- units and axis basis;
- catalogue references;
- nodes;
- routes;
- items;
- supports;
- source references.

It does not contain RVM primitive payloads.

## CatalogueRegistry.v1

Represents available catalogues and their version locks.

It contains:

- catalogue id;
- version;
- source path or URL;
- integrity hash when available;
- supported families.

The binder reads this registry but the RVM writer does not.

## ComponentCatalogueItem.v1

Represents one reusable tagged catalogue entry.

It contains:

- family/type keys;
- normalized dimensions;
- ports;
- RVM primitive recipe;
- GLB visual recipe;
- ATT template;
- validation metadata.

The item does not contain world placement. Placement belongs to `PlantModelGraph.v1` and solver output.

## ResolvedPrimitiveModel.v1

Represents fully solved geometry before file writing.

It contains:

- resolved item source;
- binding mode: catalogue / procedural / fallback;
- world-space ports;
- primitive plans;
- material assignments;
- bbox;
- audit rows.

The RVM writer consumes compiled RVM export model from this contract.

## Required traceability

Every primitive must trace back to:

```text
PlantModelGraph item ID
catalogue item ID or procedural generator ID
resolved primitive ID
RVM review name / ATT row identity
```

## Current app compatibility

Phase 1 contracts are dormant. They are not imported by current runtime modules.

The first integration point is Phase 2 shadow import:

```text
managed-stage JSON -> PlantModelGraph.v1 -> validation/audit only
```

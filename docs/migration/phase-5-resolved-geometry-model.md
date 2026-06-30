# Phase 5 resolved geometry model

## Purpose

Phase 5 adds a shadow geometry contract and deterministic solver skeleton between catalogue binding and future primitive compilation.

The Phase 5 pipeline is:

```text
PlantModelGraph.v1
+ PlantGraphTopologyAudit.v1 ok
+ CatalogueBindingAudit.v1
-> ResolvedGeometryModel.v1
-> GeometryResolutionAudit.v1
```

This phase proves route frames, straight-pipe frames, support placement intent, catalogue component frames, and blocked unresolved geometry without compiling primitives or changing runtime behavior.

## Authoring coordinate basis rule

Authoring coordinate basis remains unchanged through `PlantModelGraph.v1` and `ResolvedGeometryModel.v1`.

No Navis/RVM export transform is applied in Phase 5. The export transform remains owned by the later `RvmExportModelCompiler` boundary.

## What is resolved

Phase 5 deterministically resolves:

- route frames for every graph route;
- generated straight pipe item frames from `straightPipe.v1` intent;
- support placements as intent-only placements;
- catalogue-resolved component frames when Phase 4 already produced an exact catalogue binding.

Catalogue component frames are frames only. They are not primitives, not meshes, and not export records.

## What remains blocked

Unresolved catalogue components remain blocked in `unresolvedGeometry`.

Flanges, valves, and bends without exact catalogue binding are not guessed and do not receive fallback geometry. This is intentional: unresolved components are blockers for primitive/export phases, not hard errors for this shadow geometry phase.

## Support placement is intent-only

Support items are preserved as support placement intent using graph node or placement position evidence.

Phase 5 does not perform support symbol generation, support primitive generation, support RVM export, or support ATT export.

## Bend chord midpoint rule

Bend evidence from the importer may contain a chord midpoint warning such as `inputxml-chord-midpoint-not-arc-center`.

Phase 5 does not use that chord midpoint as solved bend geometry. Bends without exact catalogue and geometry policy remain blocked unresolved geometry.

## Runtime behavior guarantee

Phase 5 does not change:

- current canvas behavior;
- current RVM output;
- current ATT output;
- current GLB output;
- support mapping runtime behavior;
- Pages cache keys;
- production converter behavior.

No primitive compiling, RVM export, ATT export, GLB export, canvas rendering, or runtime replacement is introduced in this phase.

## Handoff to Phase 6

Phase 6 may introduce a primitive compiler that consumes `ResolvedGeometryModel.v1`.

Phase 6 must continue to respect blocked unresolved geometry. It must not silently convert unresolved flanges, valves, or bends into fake cylinders, boxes, or fallback meshes.

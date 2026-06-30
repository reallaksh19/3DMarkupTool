# Phase 7 export model compilers

## Purpose

Phase 7 adds shadow export model compilers that consume `ResolvedPrimitiveModel.v1` and `PrimitiveCompilationAudit.v1` and produce writer-neutral export model plans.

The Phase 7 pipeline is:

```text
ResolvedPrimitiveModel.v1
+ PrimitiveCompilationAudit.v1 ok
-> RvmExportModel.v1
-> AttExportModel.v1
-> GlbVisualModel.v1
-> ExportModelCompilationAudit.v1
```

This is export-model compilation only. It is not RVM binary writing, ATT file writing, GLB binary writing, canvas rendering, runtime replacement, RVM chunk/body writing, CNTB generation, primitive solving, catalogue binding, or geometry solving.

## Boundary rules

The export model compilers consume primitive model data as input. They do not recompute primitive compilation, geometry, catalogue binding, or support mapping. They do not repair blocked or deferred primitive records, and they do not create fallback export records for blocked/deferred components.

No writer module is imported. No writer call is made. No binary, text, GLB, download, blob, or runtime object payload is generated.

## RVM/Navis transform boundary

`ResolvedPrimitiveModel.v1` remains in authoring basis.

The RVM export model compiler is the first allowed boundary for a future authoring-to-Navis/Review transform. In Phase 7 the exact production transform is not reused from writer/runtime code. The compiler therefore uses a named identity placeholder policy:

```text
phase7-authoring-to-navis-review.identity-placeholder.v1
```

The RVM export model records:

```text
transformApplied: false
```

and carries a warning:

```text
RVM transform policy not implemented in Phase 7
```

Scalar dimensions such as length and radius are preserved unchanged.

## RVM export model plan

Phase 7 compiles only straight-pipe cylinder primitive descriptors that were already resolved by Phase 6:

```text
primitiveKind: CYLINDER
primitiveCode: 8
```

No TORUS/code4 bend, flange cylinder, valve cylinder, support primitive, box, sphere, pyramid, CNTB body, binary PRIM body, or writer payload is produced.

## ATT metadata-only plan

`AttExportModel.v1` is metadata-only in Phase 7. It creates record plans for primitive-model items with source identity and resolution state, and carries blocked/deferred records separately.

It does not serialize ATT text and does not call the ATT writer.

## GLB visual-model plan

`GlbVisualModel.v1` is a writer-neutral visual plan only. It creates visual item plans for resolved cylinder primitives.

It does not create Three.js objects, GLTF JSON, GLB bytes, buffers, meshes, or downloadable files.

## Blocked unresolved components

Unresolved flanges, valves, and bends remain blocked through all three export model plans.

The export model compilers do not create RVM, ATT, or GLB export geometry for unresolved items. They do not create TORUS/code4 bend plans, placeholder cylinders, fallback boxes, fallback spheres, or fallback pyramids.

## Deferred supports

Support primitive generation remains deferred. Phase 7 does not create support export primitives.

Default Phase 7 expectation:

```text
supportPrimitiveCount === 0
deferredSupportExportCount === 12 for BM_CII
```

## Runtime behavior guarantee

Phase 7 does not change:

- current canvas behavior;
- current RVM output;
- current ATT output;
- current GLB output;
- support mapping runtime behavior;
- Pages cache keys;
- production converter behavior.

## Handoff to Phase 8

Phase 8 may add writer adapters that consume these export model plans. Those adapters must preserve blocked/deferred semantics and must not silently turn unresolved or deferred items into writer payloads.

# Phase 6 primitive compiler skeleton

## Purpose

Phase 6 introduces a shadow primitive compiler that consumes already-resolved geometry and produces a writer-neutral primitive model.

The Phase 6 pipeline is:

```text
ResolvedGeometryModel.v1
+ GeometryResolutionAudit.v1 ok
-> ResolvedPrimitiveModel.v1
-> PrimitiveCompilationAudit.v1
```

This phase is a compiler skeleton only. It prepares the later export-model compiler boundary without changing runtime output.

## Boundary rules

Phase 6 does not perform RVM binary writing, ATT writing, GLB writing, canvas rendering, runtime replacement, RVM export-model compilation, Navis/RVM transform, final elbow/torus solving, or support export.

The primitive compiler consumes `ResolvedGeometryModel.v1` and `GeometryResolutionAudit.v1`. It does not recompute catalogue binding, does not recompute geometry, does not repair unresolved geometry, and does not create fallback primitives for unresolved components.

## Authoring coordinate basis

Authoring coordinate basis remains unchanged through `ResolvedPrimitiveModel.v1`.

Navis/RVM transform is still owned by the later export model compiler boundary.

## Straight pipe cylinder planning

Phase 6 may compile a straight pipe frame into a writer-neutral primitive descriptor when the source geometry has deterministic numeric radius or diameter evidence.

The allowed Phase 6 primitive is:

```text
primitiveKind: CYLINDER
primitiveCode: 8
basis: authoring
resolver: straightPipeCylinderPrimitive.v1
```

This is not binary payload generation and not an RVM writer body. It is a neutral primitive plan that a later export model compiler may consume.

The compiler must not fabricate radius. Missing pipe radius or numeric diameter evidence defers the primitive and fails the primitive compilation audit.

## Deferred catalogue components

Catalogue component frames are deferred in Phase 6. Elbows, bends, flanges, valves, and other catalogue components need explicit primitive recipes before they can compile.

Phase 6 does not create torus/code4 elbows, flange cylinders, valve cylinders, boxes, spheres, pyramids, or visual fallback substitutes.

## Deferred supports

Support placements remain deferred. Support marker generation and support export stay outside Phase 6 unless a later support primitive policy is explicitly implemented and tested.

Default Phase 6 expectation:

```text
supportPrimitiveCount === 0
```

## Blocked unresolved geometry

Every unresolved geometry entry becomes a blocked primitive entry. Unresolved flanges, valves, and bends remain blocked and are not guessed.

Bend chord midpoint evidence is not torus center evidence and must not be used to create a bend primitive in Phase 6.

## Runtime behavior guarantee

Phase 6 does not change:

- current canvas behavior;
- current RVM output;
- current ATT output;
- current GLB output;
- support mapping runtime behavior;
- Pages cache keys;
- production converter behavior.

No writer, export, canvas, runtime, browser, or Three.js module is imported by the primitive compiler.

## Handoff to Phase 7

Phase 7 may introduce export model compilers that consume `ResolvedPrimitiveModel.v1`.

Those compilers must preserve blocked/deferred semantics and must not silently convert unresolved or deferred items into fake primitives or export records.

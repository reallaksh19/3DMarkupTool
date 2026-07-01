# Phase 11C catalogue-backed flange primitive compiler

## Purpose

Phase 11C adds catalogue-backed flange primitive compilation to the shadow pipeline only.

The goal is:

```text
PlantModelGraph flange item
+ exact catalogue-backed flange identity
+ deterministic inline placement/frame evidence
-> FlangeFrame.v1
-> FLANGE_CYLINDER logical primitive descriptor
```

This follows Phase 11B, where the pipe+bend subset became test-byte-proven with 19 straight-pipe CYLINDER/code-8 primitives and 7 bend TORUS/code-4 primitives.

## Exact flange rule

A flange may resolve only when both conditions are true:

1. exact catalogue-backed flange identity exists;
2. deterministic inline placement/frame evidence exists.

The exact identity includes family/type, diameter/wall, flange dimensions, facing, rating, connection type, and units. The binder does not use fuzzy matching.

## Placement/frame evidence rule

`FlangeFrame.v1` is produced only from explicit source topology/evidence such as FROM/TO node positions, APOS/LPOS, or an explicit flange center plus route axis. The frame stays in authoring basis.

Generic component midpoint, canvas-only orientation, visual fallback orientation, and nominal-size dimensional fallback are forbidden.

## FlangeFrame.v1

A resolved flange frame records:

- center, axis, startPoint, endPoint;
- length, bore radius, outer radius, face thickness, optional hub radius/length;
- flange type, facing, rating, connection type;
- catalogue item identity;
- evidence for placement, axis, axial extent, and dimensions.

The contract requires finite coordinates, normalized axis, positive dimensions, `outerRadiusMm > boreRadiusMm`, catalogue identity, and `fallbackUsed: false`.

## Logical primitive descriptor

Phase 11C emits `FLANGE_CYLINDER` logical descriptors only:

```text
primitiveKind: FLANGE_CYLINDER
primitiveCode: 8
writerReady: false
testByteEligible: false
byteBridge: not-implemented-phase-11c
```

The descriptor contains a `bodyPrimitive` CYLINDER/code-8 metadata object, but it is not a pipe cylinder and must not be passed to the byte writer.

## Shadow-only boundary

Phase 11C does not implement flange byte writing and does not change production RVM/ATT/GLB/canvas/runtime behavior. Production writer modules remain untouched.

RVM export keeps production-shaped `primitives` limited to the 19 straight pipes. Bends remain in the Phase 11B test-byte-eligible TORUS list. Flanges are classified as deferred exports with reason:

```text
FLANGE_CYLINDER/code8 RVM byte writer bridge not implemented in Phase 11C
```

## BM_CII expected state

After Phase 11C:

- 19 straight-pipe CYLINDER/code-8 primitives remain pipe-byte-proven;
- 7 bend TORUS/code-4 primitives remain test-byte-proven;
- 8 flanges resolve to logical FLANGE_CYLINDER primitives;
- 6 valves remain blocked;
- 12 supports remain deferred;
- RVM pipe+bend subset remains ready;
- flange byte writing remains deferred;
- full RVM remains not ready;
- ATT and GLB remain blocked.

## Diagnostics and controlled preview

Diagnostics should show:

```text
Flanges resolved as catalogue-backed flange primitives: 8
Flange writer/artifact: DEFERRED
RVM pipe+bend subset: READY
RVM full model: NOT READY
Reason: valves/supports/flange artifact bridge remain unresolved/deferred
```

They must not show flange geometry, raw RVM bytes, object URLs, downloads, Three.js objects, canvas objects, or full-model readiness.

## Handoff

Phase 11C prepares:

- optional Phase 11C-B RVM flange test-only byte proof;
- Phase 11D catalogue-backed valve primitive compiler;
- future production flange writer only after test-byte proof matures;
- future controlled geometry/canvas overlay only after artifact status is proven and gated.

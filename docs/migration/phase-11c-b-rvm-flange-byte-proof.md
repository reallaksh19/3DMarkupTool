# Phase 11C-B — RVM flange test-only byte proof

## Purpose

Phase 11C-B adds an isolated test-only RVM byte proof for catalogue-backed flange body primitives.

It follows Phase 11C, where BM_CII flanges were resolved only as logical `FLANGE_CYLINDER` descriptors in the shadow pipeline. Phase 11C-B proves that those already-resolved flange body descriptors can be serialized as RVM code-8 cylinder PRIM records in a test-only bridge without changing the production writer path.

## Scope

This phase proves the flange body subset only:

- 19 straight-pipe `CYLINDER` / code-8 pipe primitives remain byte-proven.
- 7 bend `TORUS` / code-4 primitives remain byte-proven.
- 8 catalogue-backed `FLANGE_CYLINDER` logical primitives become test-byte-proven as flange body cylinders.
- 6 valves remain blocked.
- 12 supports remain deferred.
- ATT and GLB remain blocked.
- Full RVM model readiness remains false.

## Why `FLANGE_CYLINDER` is not a pipe cylinder

At the RVM byte level, a flange body is encoded as a code-8 cylinder PRIM. That does not make it a straight pipe cylinder.

The bridge keeps the distinction explicit:

- pipe cylinders come from `rvmExportModel.primitives`;
- bend torus primitives come from `rvmExportModel.testByteEligiblePrimitives`;
- flange bodies come from `rvmExportModel.flangeTestByteEligiblePrimitives`.

The byte-proof audit therefore reports:

- `decodedCylinderCount = decodedPipeCylinderCount + decodedFlangeCylinderCount`;
- `decodedPipeCylinderCount === 19`;
- `decodedFlangeCylinderCount === 8`.

`CYLINDER/code-8` alone must never be interpreted as pipe.

## Allowed flange byte bridge inputs

The flange bridge accepts only transformed, catalogue-backed flange body primitives:

- `primitiveKind === "FLANGE_CYLINDER"`;
- `primitiveCode === 8`;
- `family === "flange"`;
- `resolver === "flangeCylinderPrimitive.v1"`;
- `geometryStatus === "primitiveResolved"`;
- `basis === "navis-review"`;
- `transformPolicy === "final-review-transform.v1"`;
- `transformApplied === true`;
- finite center and normalized axis;
- positive `lengthMm`, `outerRadiusMm`, and `boreRadiusMm`;
- `outerRadiusMm > boreRadiusMm`;
- catalogue identity and catalogue reference present;
- no fallback evidence.

## Rejected inputs

The bridge rejects:

- straight pipe `CYLINDER` primitives;
- `TORUS`, `BOX`, `SPHERE`, and `PYRAMID` primitives;
- supports;
- valves;
- unresolved flanges;
- fallback flanges;
- flanges without catalogue identity;
- flanges without final review transform metadata;
- non-finite geometry;
- non-normalized axis.

## Transform boundary

The flange byte bridge consumes only `navis-review` basis primitives. The authoring-to-review transform remains at the RVM export model boundary through `final-review-transform.v1`.

No runtime transform or canvas transform is introduced.

## Byte proof

The new isolated flange byte writer produces deterministic test bytes and checksum metadata. Raw `.rvm` files are not committed. The proof object stores metadata only: byte length, SHA-256 checksum, decoded counts, and source trace status.

## Production safety

Phase 11C-B does not modify `src/rvm-writer.js` or `src/att-writer.js`.

It does not change:

- production RVM output;
- ATT output;
- GLB output;
- runtime/canvas/UI behavior;
- browser downloads;
- object URLs;
- cache keys.

Production writer readiness remains false for flanges. The flange bridge is an isolated test-only artifact adapter.

## Full model readiness

Full RVM model readiness remains false because valves are still blocked and supports are still deferred. ATT and GLB remain blocked.

## Handoff

This prepares:

- Phase 11D catalogue-backed valve primitive compiler;
- Phase 11D-B valve test-only byte proof;
- support primitive/compiler decision;
- full RVM readiness audit;
- production RVM writer integration only after test-byte proofs mature.

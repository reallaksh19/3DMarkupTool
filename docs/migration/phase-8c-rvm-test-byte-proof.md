# Phase 8C RVM test-only straight-pipe artifact byte proof

## Purpose

Phase 8C proves that the already transform-ready straight-pipe `CYLINDER` / code-8 subset can produce real RVM bytes in an isolated test-only path.

This phase consumes:

```text
RvmExportModel.v1
+ ExportModelCompilationAudit.v1 ok
+ WriterAdapterPlan.v1
+ WriterAdapterAudit.v1 ok
+ TestArtifactAdapterPlan.v1
+ TestArtifactAdapterAudit.v1 ok
-> RvmTestArtifactByteProof.v1
-> RvmTestArtifactByteProofAudit.v1
```

## Why this follows Phase 8B

Phase 8B proved the final Navis/RVM review transform at the RVM export-model boundary. Phase 8C intentionally comes after that so the byte bridge accepts only already-transformed, finite, normalized, scalar-preserving RVM export primitives.

## Test-only writer bridge boundary

The only Phase 8C bridge that may call `writeRvm()` is:

```text
src/artifact-adapters/rvm-test-byte-artifact-adapter.js
```

The bridge is isolated from runtime modules. It does not create browser downloads, object URLs, DOM nodes, canvas objects, Three.js objects, or UI state.

## Allowed subset

Only RVM export primitives satisfying all of the following may enter the byte bridge:

- `primitiveKind === "CYLINDER"`
- `primitiveCode === 8`
- `transformPolicy === "final-review-transform.v1"`
- `transformApplied === true`
- `basis === "navis-review"`
- finite transformed center
- finite normalized axis
- finite positive `lengthMm`
- finite positive `radiusMm`

The bridge preserves `sourcePrimitiveId`, `sourceItemId`, transformed center/axis, and scalar length/radius.

## Rejected content

The byte bridge does not write:

- TORUS/code4 bends
- bend centers or bend fallback geometry
- flange placeholder cylinders
- valve placeholder cylinders
- support primitives
- fallback boxes/spheres/pyramids
- blocked components
- deferred supports

Blocked flanges, valves, and bends remain blocked. Supports remain deferred.

## Byte proof metadata

The proof stores metadata only:

- byte length
- SHA-256 checksum
- optional small header hex preview
- primitive write counts
- source trace
- blocked/deferred item status

Committed fixtures do not contain raw `.rvm` bytes.

## Readiness semantics

The byte proof can report:

```text
rvmStraightPipeSubsetArtifactReady: true
```

The full model remains not ready while blocked/deferred content exists:

```text
rvmFullModelArtifactReady: false
```

ATT and GLB remain blocked and are not implemented by this phase.

## Handoff

Phase 8C prepares:

- Phase 9A feature-flagged diagnostic panel wiring;
- Phase 10 controlled preview of proven artifact/diagnostic state;
- future primitive compiler phases for bends, flanges, valves, and supports.

Those later phases must not silently convert blocked/deferred content into geometry.

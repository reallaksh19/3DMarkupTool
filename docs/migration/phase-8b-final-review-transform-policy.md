# Phase 8B final review transform policy

## Purpose

Phase 8B replaces the Phase 7 placeholder RVM review transform with a deterministic, writer-independent final review transform policy.

The policy is applied only at the RVM export model boundary:

```text
authoring basis
-> RvmExportModel.v1 final review transform
-> dry-run writer readiness for straight-pipe CYLINDER/code8 subset
```

This phase is not writer integration, artifact byte generation, runtime wiring, canvas preview, ATT implementation, GLB implementation, or blocked/deferred geometry solving.

## Why this comes before Phase 9A

A runtime diagnostic panel or feature-flagged overlay should not be the first layer to discover transform readiness. Phase 8B proves the transform boundary in contracts, export audit, writer dry-run planning, artifact-readiness status, and diagnostic preview status before any runtime UI wiring.

## Final transform policy

The policy name is:

```text
final-review-transform.v1
```

The source basis is the authoring/model basis. The target basis is the Navis/RVM review basis.

The final review transform uses the existing production Navis/RVM post-transform convention:

```text
[xPrime, yPrime, zPrime] = [-z, -x, y]
```

This corresponds to the existing `canvasEngineeringToNavis` right-handed mapping. Phase 8B implements that mapping as a pure writer-independent helper:

- points are transformed by the matrix above in model millimetres;
- direction vectors are transformed by the same matrix and normalized;
- non-finite values fail closed;
- zero vectors fail closed;
- scalar dimensions are preserved.

The existing RVM writer axis-basis policy remains responsible for writer matrix construction and millimetre-to-metre scaling. The Phase 8B export model does not call that writer path and does not generate binary chunks.

## RVM-only boundary

`RvmExportModel.v1` now reports:

```text
transformPolicy: final-review-transform.v1
transformApplied: true
```

Each exported straight-pipe `CYLINDER` / code-8 primitive has:

- finite transformed center;
- finite normalized transformed axis;
- preserved `lengthMm`;
- preserved `radiusMm`;
- preserved `diameterMm` when present;
- preserved `wallMm` when present;
- `basis: navis-review`;
- `transformPolicy: final-review-transform.v1`.

## Authoring models remain unchanged

The following models remain authoring-basis models:

- `PlantModelGraph.v1`
- `ResolvedGeometryModel.v1`
- `ResolvedPrimitiveModel.v1`

Phase 8B does not mutate or back-propagate review coordinates into them.

## ATT and GLB

ATT remains metadata-only in this phase.

GLB visual plans remain authoring-basis diagnostic/visual model data and are not converted to Navis/RVM review coordinates by Phase 8B.

## Blocked and deferred items

Blocked flanges, valves, and bends remain blocked. Phase 8B does not create torus bends, flange placeholder cylinders, valve placeholder cylinders, fallback boxes, fallback spheres, fallback pyramids, or any chord-midpoint bend geometry.

Supports remain deferred. Phase 8B does not create support primitives.

## Writer and artifact status

Phase 8B does not call writers and does not generate artifacts.

The RVM dry-run writer adapter may now report straight-pipe subset readiness because the final transform is proven, but that readiness is limited to logical dry-run planning:

```text
straightPipeSubsetDryRunReady
```

RVM artifact bytes remain blocked because the Phase 8C byte bridge is not implemented yet. The deterministic artifact blocker is:

```text
RVM artifact byte generation not implemented in Phase 8B; straight-pipe subset transform readiness proven
```

ATT and GLB artifact readiness remain blocked for their existing bridge reasons.

## Handoff

Phase 8B prepares these next steps:

- Phase 8C RVM test-only straight-pipe artifact byte proof;
- Phase 9A feature-flagged diagnostic panel wiring.

Neither handoff should fabricate blocked/deferred geometry or silently alter production runtime paths.

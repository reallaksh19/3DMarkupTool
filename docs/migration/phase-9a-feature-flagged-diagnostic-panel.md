# Phase 9A feature-flagged diagnostic panel

## Purpose

Phase 9A adds a default-off, read-only diagnostic panel for already-proven shadow diagnostic state.

It consumes:

```text
DiagnosticCanvasPreviewModel.v1
+ DiagnosticCanvasPreviewAudit.v1 ok
+ RvmTestArtifactByteProof.v1
+ RvmTestArtifactByteProofAudit.v1 ok
-> read-only runtime diagnostic panel
```

The panel does not discover export, writer, artifact, transform, geometry, or byte readiness. It displays state already proven by previous shadow pipeline phases.

## Why this follows Phase 8C

Phase 8B proved the final Navis/RVM transform. Phase 8C proved actual test-only RVM bytes for the straight-pipe `CYLINDER` / code-8 subset. Phase 9A is therefore allowed to display that proven subset readiness, while still reporting that the full model is not ready.

## Feature flag behavior

The panel is default off.

It is enabled only by one of these gates:

```text
?shadowDiagnostics=1
3dmt.shadowDiagnostics.enabled=true
```

The feature flag helper reads URL query and localStorage only. It fails closed when browser globals are unavailable and does not write localStorage.

When disabled:

- no visible UI is mounted;
- no diagnostic module is dynamically imported by the app-loader hook;
- no shadow pipeline is run;
- no current layout changes.

## Runtime wiring

The only runtime hook is a guarded idle import from `src/app-loader.js` after the existing app boot. It performs a small local feature-flag check before importing the diagnostics bootstrap.

The runtime bootstrap reads only this optional namespaced state:

```js
globalThis.__3DMT_SHADOW_DIAGNOSTICS__ = {
  diagnosticPreviewModel,
  diagnosticPreviewAudit,
  rvmByteProof,
  rvmByteProofAudit
}
```

If no state is present and the flag is enabled, the panel renders:

```text
No diagnostic model available yet.
```

It does not trigger conversion, export, downloads, writers, byte generation, or the BM_CII test pipeline.

## What the panel displays

The panel renders:

- RVM straight-pipe subset byte proof: READY
- RVM full model: NOT READY
- Reason: blocked/deferred content remains
- ATT: BLOCKED
- GLB: BLOCKED
- Flanges blocked
- Valves blocked
- Bends blocked
- Supports deferred
- source trace rows, capped for DOM size

For BM_CII, the panel view model asserts:

```text
straight pipe subset ready count: 19
full model ready: false
blocked flange count: 8
blocked valve count: 6
blocked bend count: 7
deferred support count: 12
source trace rows: 52
```

## Non-goals

Phase 9A does not add:

- geometry preview;
- canvas overlays;
- Three.js/WebGL objects;
- CSS2D labels;
- RVM/ATT/GLB writer integration;
- runtime byte generation;
- downloads;
- object URLs;
- file blobs;
- bend torus previews;
- valve/flange placeholder cylinders;
- support geometry;
- fallback boxes/spheres/pyramids.

## Readiness semantics

The panel may show the straight-pipe RVM subset as ready because Phase 8C produced and audited actual test-only bytes for that subset.

It must not show the full RVM model as ready while blocked/deferred content remains.

ATT and GLB remain blocked.

Blocked flanges, valves, and bends remain blocked.

Supports remain deferred.

## Handoff

Phase 9A prepares:

- Phase 10 controlled preview of proven diagnostic/artifact state;
- future primitive compiler phases for bends, flanges, valves, and supports;
- future ATT/GLB artifact bridges.

Those phases must not make the runtime canvas the source of export truth.

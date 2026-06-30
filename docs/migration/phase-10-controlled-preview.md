# Phase 10 controlled preview of proven diagnostic/artifact state

## Purpose

Phase 10 adds a controlled preview of already-proven diagnostic and artifact state.

It consumes:

```text
DiagnosticPanelViewModel.v1
+ DiagnosticCanvasPreviewModel.v1
+ DiagnosticCanvasPreviewAudit.v1 ok
+ RvmTestArtifactByteProof.v1
+ RvmTestArtifactByteProofAudit.v1 ok
-> ControlledPreviewModel.v1
-> ControlledPreviewAudit.v1
-> optional feature-flagged read-only preview section
```

The controlled preview does not compute or discover artifact truth. It visualizes only state already proven by Phase 8C and exposed by Phase 9A.

## Why this follows Phase 9A and Phase 8C

Phase 8C proved actual test-only RVM bytes for the straight-pipe `CYLINDER` / code-8 subset. Phase 9A exposed that state in a default-off read-only diagnostic panel. Phase 10 adds a second-gated controlled preview so the UI can show a schematic diagnostic/artifact-state preview without making the runtime canvas the source of truth.

## Feature flags

Phase 10 requires both gates:

```text
?shadowDiagnostics=1&shadowPreview=1
```

or:

```text
localStorage["3dmt.shadowDiagnostics.enabled"] === "true"
localStorage["3dmt.shadowPreview.enabled"] === "true"
```

If only the diagnostics flag is enabled, the Phase 9A diagnostic panel mounts as before and no controlled preview DOM is created.

If both flags are disabled, no diagnostics or controlled preview UI is mounted.

## What is displayed

The controlled preview displays only diagnostic/artifact-state information:

- RVM straight-pipe subset readiness;
- RVM full model not-ready status;
- ATT blocked status;
- GLB blocked status;
- blocked flanges, valves, and bends;
- deferred supports;
- source trace order;
- compact schematic status cells labelled as not geometry.

For BM_CII, the controlled preview audit expects:

```text
straight-pipe subset preview count: 19
blocked component preview count: 21
blocked flanges: 8
blocked valves: 6
blocked bends: 7
deferred supports: 12
source trace preview count: 52
```

## What is not displayed

Phase 10 does not display or generate:

- engineering geometry;
- canvas overlays;
- Three.js objects;
- WebGL resources;
- CSS2D labels;
- RVM bytes;
- ATT text;
- GLB/GLTF bytes;
- object URLs;
- downloads;
- export buttons;
- generate buttons;
- bend torus previews;
- valve/flange placeholder cylinders;
- support geometry;
- fallback boxes, spheres, or pyramids.

## Runtime guarantees

The runtime bootstrap does not call writers, does not import the byte proof adapter, and does not generate bytes. It reads only the optional diagnostics bridge:

```js
globalThis.__3DMT_SHADOW_DIAGNOSTICS__
```

If controlled preview is enabled but diagnostic/artifact state is unavailable, it renders a deterministic unavailable state:

```text
Controlled preview unavailable: diagnostic/artifact state not available.
```

## Readiness semantics

The preview may show:

```text
RVM straight-pipe subset: READY
```

It must also show:

```text
RVM full model: NOT READY
ATT: BLOCKED
GLB: BLOCKED
```

while blocked/deferred content remains.

## Handoff

Phase 10 prepares:

- future Phase 10A controlled straight-pipe canvas overlay only if explicitly approved;
- future component primitive compiler phases for elbows, flanges, valves, and supports;
- future ATT/GLB artifact bridges.

Later phases must not silently promote schematic diagnostic state into production geometry or export readiness.

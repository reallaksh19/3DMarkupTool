# Phase 11B RVM TORUS/code-4 test-only byte proof

## Purpose

Phase 11B proves that the shadow pipeline can produce isolated test-only RVM bytes for the currently resolved pipe + bend subset:

```text
19 CYLINDER/code-8
7 TORUS/code-4
```

It follows Phase 11A, which resolved catalogue-backed bend/elbow items into authoring-basis TORUS/code-4 primitive descriptors but kept those bends deferred at the RVM writer/artifact boundary.

## Exact byte-proof boundary

The Phase 11B bridge accepts only final transformed `RvmExportModel.v1` content:

- CYLINDER/code-8 plans already transformed by `final-review-transform.v1`;
- TORUS/code-4 plans in `testByteEligiblePrimitives`;
- `basis: navis-review`;
- `transformApplied: true`;
- finite center/vector data;
- normalized normal/tangents;
- positive radii and sweep angle;
- catalogue-backed bend evidence already proven upstream.

It rejects production/runtime/browser/canvas invocation and any unsupported primitive kind.

## Why test-only

The new code-4 writer is isolated in `src/artifact-adapters/rvm-code4-torus-test-byte-writer.js`. It is not registered in the production writer path, is not imported by runtime modules, and does not create browser downloads, object URLs, blobs, canvas objects, Three.js objects, ATT text, or GLB bytes.

## Code-4 payload validation

The bridge writes Review-style PRIM chunks with code 4 and a deterministic three-word payload:

```text
bend radius
pipe/tube radius
sweep angle in radians
```

The proof decodes generated PRIM bodies through the existing primitive payload decoder and asserts:

```text
decoded PRIM count = 26
decoded code-8 count = 19
decoded code-4 count = 7
fallback code 1/2/9 count = 0
```

## Production writer remains unchanged

The production RVM writer is not modified by Phase 11B. TORUS/code-4 production readiness remains false. The new proof only demonstrates that the shadow pipe+bend subset can be serialized by an isolated test bridge.

## Full model readiness

The full RVM model remains not ready because:

- 8 flanges remain blocked;
- 6 valves remain blocked;
- 12 supports remain deferred.

ATT and GLB remain blocked.

## Diagnostics and controlled preview

After Phase 11B, diagnostics and controlled preview should report:

```text
RVM pipe+bend subset: READY
Bend TORUS test byte proof: READY
RVM full model: NOT READY
Reason: flanges/valves/supports remain unresolved/deferred
```

They must not display torus geometry, bend coordinate visualization, mesh/canvas/Three.js objects, raw byte payloads, downloads, or object URLs.

## Handoff

Phase 11B prepares:

- Phase 11C catalogue-backed flange primitive compiler;
- Phase 11D catalogue-backed valve primitive compiler;
- future production RVM code-4 writer only after the test-byte proof matures;
- future controlled geometry/canvas overlay only after artifact status is proven and gated.

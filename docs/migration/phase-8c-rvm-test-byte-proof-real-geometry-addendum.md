# Phase 8C real-geometry byte-proof oracle

This addendum records the deterministic real-geometry fixture added after the initial Phase 8C byte-proof PR.

The fixture is intentionally separate from BM_CII because BM_CII count coverage is not enough to prove exact coordinate transformation correctness.

## Fixture files

```text
samples/artifact-adapters/rvm-byte-proof.real-geometry.input.plant-graph.json
samples/artifact-adapters/rvm-byte-proof.real-geometry.expected-transform.json
```

The PlantModelGraph fixture contains exactly:

- 5 generated straight pipes;
- 1 blocked valve;
- 1 blocked flange;
- 1 blocked bend/elbow;
- 2 deferred supports;
- 10 total graph items.

The transform oracle validates the production Navis/RVM mapping before bytes are written:

```text
[xPrime, yPrime, zPrime] = [-z, -x, y]
```

For every straight-pipe item, the test asserts transformed center, transformed normalized axis, length, radius, primitive kind, and primitive code before the RVM writer bridge is called.

The bridge still writes only final-transform-ready `CYLINDER` / code-8 primitives. Blocked flanges, valves, and bends remain blocked. Supports remain deferred. ATT and GLB remain blocked.

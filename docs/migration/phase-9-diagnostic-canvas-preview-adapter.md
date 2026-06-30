# Phase 9 diagnostic canvas preview adapter

## Purpose

Phase 9 adds a pure diagnostic preview model after the Phase 8A test-only artifact readiness audit.

It converts already-proven pipeline status into JSON records that a future diagnostic panel or feature-flagged overlay can consume.

This is not artifact preview, geometry preview, runtime UI wiring, production viewer replacement, or current output replacement.

## Pipeline

```text
TestArtifactAdapterPlan.v1
+ TestArtifactAdapterAudit.v1 ok
+ WriterAdapterPlan.v1
+ WriterAdapterAudit.v1 ok
-> DiagnosticCanvasPreviewModel.v1
-> DiagnosticCanvasPreviewAudit.v1
```

The adapter consumes Phase 8A readiness as source of truth. It does not recompute plant graph import, topology, catalogue binding, geometry, primitive compilation, export model compilation, writer adapter planning, or artifact readiness.

## Diagnostic-only model

`DiagnosticCanvasPreviewModel.v1` contains:

- artifact status banner;
- summary cards;
- diagnostic preview items;
- blocked badges;
- deferred badges;
- source trace;
- source references.

It does not contain renderable geometry, meshes, runtime objects, object URLs, download URLs, binary payloads, ATT text, GLB bytes, GLTF JSON, DOM nodes, or scene mutations.

## Relationship to Phase 8A

Phase 8A proves artifact readiness state. Phase 9 only displays that state as diagnostics.

Current BM_CII Phase 8A default keeps RVM, ATT, and GLB artifacts blocked:

- RVM is blocked until final review transform policy is implemented.
- ATT is blocked until a safe production writer model bridge exists.
- GLB is blocked until a test artifact writer exists.

Phase 9 preserves those statuses and makes them visible through an artifact status banner.

## Artifact status banner

The banner reports readiness, generation, blocked status, and deterministic message for:

- RVM;
- ATT;
- GLB.

Messages are taken from `TestArtifactAdapterPlan.v1` where available.

## Straight-pipe writer-plan representation

Straight pipes with writer plans are represented only as diagnostics:

```text
Straight pipe planned, artifact blocked
```

They are not marked as artifact-ready geometry. No preview shape is created.

## Blocked flanges, valves, and bends

Blocked flanges, valves, and bends are represented as blocked diagnostic items and blocked badges.

No bend torus, valve placeholder cylinder, flange placeholder cylinder, fallback box, fallback sphere, fallback pyramid, or chord-midpoint preview is created.

## Deferred supports

Supports remain deferred diagnostic items and deferred badges.

No support geometry is generated.

## Side-effect policy

Phase 9 has no:

- runtime app wiring;
- current viewer behavior change;
- current converter behavior change;
- writer call;
- browser download;
- object URL;
- DOM node;
- runtime scene mutation;
- WebGL resource;
- Three.js object;
- binary/text/GLB payload;
- Pages cache-key change.

## Handoff options

After Phase 9, the project can proceed to one of these paths:

- Phase 9A runtime diagnostic panel wiring behind an explicit feature flag;
- Phase 8B final review transform policy;
- Phase 8C isolated writer bridge for a real artifact subset;
- later geometry preview only after the artifact subset is proven.

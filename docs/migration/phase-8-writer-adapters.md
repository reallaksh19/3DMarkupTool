# Phase 8 writer adapters

## Purpose

Phase 8 adds shadow writer adapter plans that consume Phase 7 export models and `ExportModelCompilationAudit.v1`.

The Phase 8 pipeline is:

```text
RvmExportModel.v1
+ AttExportModel.v1
+ GlbVisualModel.v1
+ ExportModelCompilationAudit.v1 ok
-> WriterAdapterPlan.v1
-> WriterAdapterAudit.v1
```

This phase introduces writer adapter boundaries only. It is dry-run by default and does not replace production writer paths.

## Dry-run boundary

The default mode is:

```text
dryRun
```

Dry-run plans are logical readiness summaries. They do not create user-visible artifacts and do not perform browser or file-system side effects.

Phase 8 does not automatically generate `.rvm`, `.att`, or `.glb` files. It does not create object URLs, downloads, blobs, byte buffers, GLTF JSON, Three.js objects, or writer payloads.

## Production runtime guarantee

Phase 8 does not change:

- current canvas behavior;
- current RVM output;
- current ATT output;
- current GLB output;
- support mapping runtime behavior;
- Pages cache keys;
- production converter behavior;
- existing writer modules.

The following runtime files remain outside Phase 8 scope:

- `src/app.js`
- `src/managed-stage-rvm-converter.js`
- `src/rvm-writer.js`
- `src/att-writer.js`
- `src/managed-stage-json-ui-controller.js`
- `src/safe-ui-loader.js`
- `src/app-loader.js`
- `scripts/build-pages.mjs`

## RVM writer adapter

The RVM adapter consumes `RvmExportModel.v1` and creates logical PRIM chunk plans only for straight-pipe cylinder primitives:

```text
primitiveKind: CYLINDER
primitiveCode: 8
```

The planned chunk is not a binary chunk and has no body bytes:

```text
chunkKind: PRIM
writerStatus: planned
```

No PRIM body, CNTB bytes, RVM binary chunk, file blob, object URL, or writer payload is produced.

Because Phase 7 still uses a placeholder review transform policy with `transformApplied: false`, Phase 8 keeps RVM writer artifact readiness blocked and records this warning:

```text
RVM writer artifact readiness blocked until final review transform policy is implemented.
```

Logical dry-run chunks may still be counted for readiness review, but they are not final artifact readiness.

## ATT writer adapter

The ATT adapter consumes `AttExportModel.v1` and creates metadata record summaries only.

It does not serialize ATT text and does not call the ATT writer.

Blocked and deferred records remain separate and are not marked as exported geometry.

## GLB writer adapter

The GLB adapter consumes `GlbVisualModel.v1` and creates visual summaries only.

It does not create GLTF JSON, GLB bytes, Three.js geometry, runtime meshes, file blobs, object URLs, or downloads.

It records a warning that GLB artifact output is not implemented in Phase 8.

## Blocked unresolved components

Blocked flanges, valves, and bends remain blocked. They do not become writer chunks, ATT geometry exports, visual fallback objects, torus primitives, placeholder cylinders, boxes, spheres, or pyramids.

Bend chord midpoint evidence remains insufficient for torus center generation and is not used for writer planning.

## Deferred supports

Support writer output remains deferred. Phase 8 does not create support writer chunks, support ATT export geometry, or support GLB geometry.

For BM_CII, the expected support writer count is:

```text
deferredSupportWriterCount === 12
```

## Handoff

After Phase 8, the project can choose between:

- Phase 9 canvas preview adapter for the shadow writer plans; or
- Phase 8A test-only artifact adapter that calls production writers in an isolated opt-in test path.

Neither path should silently convert blocked or deferred items into production output.

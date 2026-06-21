# Managed-stage JSON coordinate audit

## Scope

Target: `BM_CII_INPUT_managed_stage.json` with schema `inputxml-managed-stage/v1`, profile `AVEVA_JSON_FOR_3D_RVM_VIEWER`, millimetre coordinates.

The audit compares the previous `3DMarkupTool` implementation with the proven staged JSON display path in `3D_Viewer > 3D RVM Viewer > Load`.

## Source-level finding

`3DMarkupTool` was using one mixed pipeline for both preview and export:

```text
raw staged JSON
  -> managed-stage geometry contracts
  -> bend exclusion / branch fitting inference / primitive planning
  -> RVM export model
  -> createRvmPreviewScene(exportModel)
```

That made preview geometry depend on RVM primitive planning. The export planner is allowed to reconstruct generic bend cylinders and inferred branch fitting cylinders for RVM writer compatibility, but those planner outputs are not the raw staged APOS/LPOS/POS records.

The previous preview also used the generic RVM preview scene, which frames by subtracting the generated scene center. That is useful for generated RVM primitives, but it is not a coordinate-faithful staged JSON display path.

The working 3D_Viewer behavior uses a separate display pipeline:

```text
raw staged JSON hierarchy
  -> extract APOS / LPOS / POS / BPOS / SUPPORTCOORD
  -> create visible objects directly at those coordinates
```

It also preserves source route-bearing entries when the upstream source is already routed, instead of discarding or regenerating them through auto-routing.

## Patch

`3DMarkupTool` now has separate pipelines:

### A. Preview pipeline

```text
raw staged JSON -> ManagedStageRawPreview.v1 scene
```

Rules:

- APOS/LPOS line records are rendered directly from source coordinates.
- POS/BPOS/SUPPORTCOORD records are rendered as preview-only point/support markers.
- BEND source APOS/LPOS lines remain visible and unchanged.
- Bend visual cues are additive only and marked `previewAdditiveCue`, `previewOnly`, and `exportedRvmGeometry: false`.
- Branch topology cues are inferred from shared nodes only as additive preview cues; adjacent source records are not trimmed or moved.
- The legacy visible fallback overlay is skipped for this preview scene to avoid double-rendering the same raw records.

### B. RVM export pipeline

```text
raw staged JSON -> managed-stage contracts -> RVM primitives -> RVM/ATT/Audit
```

Rules:

- RVM export remains pipe/fittings-only.
- ATTA/support preview markers are not exported.
- Generic bend and branch fitting inference remain in the RVM export path only.

## Audit/test output

`tests/managed-stage-preview-coordinate-preservation.test.mjs` generates a `ManagedStageCoordinateAudit.v1` report with one row per staged record. Each row includes:

- record name
- TYPE / DTXR
- APOS / LPOS / POS / BPOS / HPOS / TPOS / SUPPORTCOORD
- coordinates before preview planning
- coordinates after preview planning
- rendered coordinates
- RVM export flag
- preview-only flag
- coordinate delta from source
- reason for any non-zero delta

The assertion fails if any non-bend APOS/LPOS source record has coordinate delta greater than `0.001 mm`.

Expected BM_CII audit summary:

```json
{
  "sourceLineCount": 40,
  "supportPreviewOnlyCount": 12,
  "mutatedNonBendRowCount": 0,
  "maxNonBendDeltaMm": 0,
  "rvmExportPrimitiveCount": 91
}
```

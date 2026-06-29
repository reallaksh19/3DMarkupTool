# 3DMarkupTool platform migration orchestrator plan

## Mission

Upgrade the current 3DMarkupTool into a catalogue-driven RVM/ATT/sidecar-GLB authoring platform without breaking the existing managed-stage workflow.

The migration must preserve the present app as a working baseline while new architecture runs first in shadow mode.

## Non-negotiable rules

- Do not make the canvas the source of truth.
- Do not make RVM writer internals depend on UI state.
- Do not allow catalogue binding logic inside the RVM writer.
- Do not allow canvas-only fallback geometry to enter export semantics.
- Do not mix support-axis semantics with full-model export transforms.
- Keep old flow working until each new phase has proof.

## Target architecture

```text
PlantModelGraph.v1
  -> CatalogueBinder
  -> ResolvedPrimitiveModel.v1
  -> RvmExportModel compiler
  -> writeRvm() / writeAtt() / sidecar GLB writer
```

Canvas becomes an adapter:

```text
ResolvedPrimitiveModel.v1 -> CanvasPreviewAdapter
```

The existing managed-stage workflow becomes an import adapter:

```text
BM_CII managed-stage JSON -> PlantModelGraph.v1
```

## Phase 0 baseline

Phase 0 establishes freeze rules, baseline artifacts, and acceptance gates.

Required baseline evidence:

- BM_CII managed-stage JSON input can still load.
- Existing converter can still generate canvas preview.
- Existing converter can still generate RVM/ATT/audit.
- Existing support mapping / ISONOTE sample remains available.
- Existing Navis-compatible output remains the reference for comparison.

Phase 0 does not change runtime behavior.

## Phase 1 core contracts

Phase 1 adds contracts only:

- `PlantModelGraph.v1`
- `CatalogueRegistry.v1`
- `ComponentCatalogueItem.v1`
- `ResolvedPrimitiveModel.v1`

Phase 1 acceptance:

- contracts can validate sample JSON;
- no runtime module imports these contracts yet;
- no canvas, RVM writer, ATT writer, support mapper, or converter behavior is changed;
- BM_CII sample graph is present as a contract seed.

## Agent ownership

| Agent | Owns | Must not edit in early phases |
|---|---|---|
| Agent 00 Orchestrator | docs/architecture, docs/migration, phase gates | runtime pipeline except phase wiring docs |
| Agent 01 Contracts | src/contracts, samples/contracts, tests/contracts | canvas, RVM writer, ATT writer |
| Agent 03 Import Adapter | src/importers | writer internals, canvas editor |
| Agent 04 Catalogue Binder | src/catalogue, catalogues | writer internals, canvas editor |
| Agent 05 Geometry Solver | src/geometry-solver | UI shell, RVM writer |
| Agent 06 Primitive Compiler | src/primitive-compiler | catalogue storage, UI shell |
| Agent 07 Export | src/exporters | authoring canvas internals |
| Agent 08 Canvas | src/authoring-canvas, adapters | writer internals |
| Agent 09 QA/Audit | src/audit, tests/audit | business logic unless via tests |

## PR sequencing

1. Phase 0/1 docs and contracts.
2. Managed-stage JSON -> PlantModelGraph adapter in shadow mode.
3. Catalogue registry and base catalogue format.
4. Catalogue binding audit in shadow mode.
5. ResolvedPrimitiveModel compiler skeleton.
6. Current RVM writer adapter from resolved model.
7. Canvas preview adapter from resolved model.
8. Authoring tools.

## Switch-over rule

The old managed-stage conversion path remains authoritative until the new graph/binder/primitive/export chain passes all gates:

```text
source count parity
catalogue/generator/fallback audit complete
primitive compatibility proof
RVM opens in Navis
ATT links match selection hierarchy
canvas selection maps to graph item ID
```

# Migration Status

## Phase 01 — New-Core Readiness Audit

Status: implemented on branch `agent01-new-core-readiness-audit`; pending CI/reviewer approval.

Audit artifact:

```text
NewCoreReadinessAudit.v1
```

Covered pipeline:

```text
ManagedStage JSON
→ PlantModelGraph.v1
→ CatalogueBindingAudit.v1
→ ResolvedGeometryModel.v1
→ ResolvedPrimitiveModel.v1
→ RvmExportModel.v1 / AttExportModel.v1 / GlbVisualModel.v1
→ NewCoreReadinessAudit.v1
```

Current readiness policy:

| Area | Status |
|---|---|
| Straight procedural pipe | `production-ready` when RVM/ATT/GLB export-boundary rows exist |
| TORUS/code4 bend | `test-byte-only` unless production writer policy explicitly enables it |
| Flange primitive | `deferred` until writer bridge exists |
| Supports | `support-intent-only`; primitive generation outside Phase 01 |
| Unknown catalogue/procedural state | `unresolved` |
| Missing geometry/primitive/export evidence | `blocked` with reason |

Required validation gate:

```bash
npm run test:new-core-readiness
```

Required surrounding gates:

```bash
npm run test:platform-contracts
npm run test:managed-stage-importer
npm run test:catalogue-binding
npm run test:resolved-geometry
npm run test:primitive-compiler
npm run test:export-models
```

Boundary statement:

Phase 01 is shadow-only. It does not modify production runtime wiring, UI files, RVM writer, ATT writer, converter path, or preview runtime.

Next handoff:

Agent 02 may consume `NewCoreReadinessAudit.v1` only after this phase passes CI and reviewer approval.

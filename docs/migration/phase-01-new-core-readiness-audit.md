# Phase 01 — New-Core Readiness Audit

## Purpose

Phase 01 adds `NewCoreReadinessAudit.v1` as the fail-closed proof artifact for the new-core shadow pipeline. The audit does not replace the production RVM writer, does not call the writer, does not change the UI, and does not alter the current runtime converter path.

The audit exists to prove that each source graph item has deterministic, contract-safe, traceable evidence from engineering intent through export-boundary planning.

## Pipeline covered

```text
ManagedStage JSON
→ PlantModelGraph.v1
→ CatalogueBindingAudit.v1
→ ResolvedGeometryModel.v1
→ ResolvedPrimitiveModel.v1
→ RvmExportModel.v1 / AttExportModel.v1 / GlbVisualModel.v1
→ NewCoreReadinessAudit.v1
```

`PlantModelGraph.v1` remains the source-of-truth model for engineering intent. Catalogue items remain separate from placement. Resolved geometry contains solved geometry only. Resolved primitives contain primitive intent only. RVM/ATT/GLB models remain export-boundary plans only.

## Files changed

```text
src/contracts/platform-contract-schemas.js
src/contracts/index.js
src/contracts/new-core-readiness-audit-contract.js
src/export-models/new-core-readiness-audit.js
tests/audit/new-core-readiness-audit.test.mjs
package.json
docs/migration/phase-01-new-core-readiness-audit.md
docs/migration/status.md
```

## Forbidden boundaries

Phase 01 must not import or call:

```text
src/rvm-writer.js
src/att-writer.js
src/rvm-converter.js
src/rvm-preview.js
src/app.js
src/main.js
UI runtime/controller files
DOM/window/document APIs
Three.js runtime objects
```

The audit fails closed if writer/binary payload fields are detected before the writer-adapter phase, including `binary`, `bytes`, `chunk`, `cntb`, `primBody`, `attText`, `glbBytes`, or `writerPayload`.

The audit also fails closed if final Review/Navis transform markers appear before the export-model boundary.

## Audit schema

The new artifact contract is:

```text
NewCoreReadinessAudit.v1
```

Required final readiness statuses are:

```text
production-ready
test-byte-only
deferred
blocked
unresolved
support-intent-only
```

Each graph item must have exactly one `traceRows[]` entry preserving:

```text
itemId
sourceRef
itemKind
bindingStatus
geometryStatus
primitiveStatus
rvmExportStatus
attStatus
glbStatus
readinessStatus
reason
```

Duplicate trace rows are hard errors unless the row explicitly carries decomposition metadata. Missing trace rows are hard errors.

## Readiness behavior

- Straight procedural pipe can reach `production-ready` when RVM, ATT, and GLB export-boundary plans exist.
- TORUS/code4 bend remains `test-byte-only` unless a later production writer policy explicitly allows it.
- Flange primitive intent remains `deferred` until a writer bridge is implemented.
- Support items remain `support-intent-only`; support primitive generation is outside this phase.
- Unresolved catalogue/procedural/fallback decisions end as `unresolved`.
- Blocked geometry, primitives, or exports end as `blocked` with a required reason.

## Tests

New gate:

```bash
npm run test:new-core-readiness
```

Required surrounding gates remain:

```bash
npm run test:platform-contracts
npm run test:managed-stage-importer
npm run test:catalogue-binding
npm run test:resolved-geometry
npm run test:primitive-compiler
npm run test:export-models
```

The new test verifies:

1. `NewCoreReadinessAudit.v1` is generated.
2. Every graph item has a trace row.
3. Straight pipe reaches production-ready/export-planned status.
4. TORUS/code4 bend remains test-byte-only.
5. Flange remains deferred.
6. Supports remain support-intent-only.
7. Writer/binary fields are rejected.
8. Missing traceability fails closed.

## Known deferred areas

- Production RVM TORUS writer policy is not enabled by this phase.
- FLANGE_CYLINDER/code8 writer bridge is not implemented by this phase.
- Support primitive generation is not part of Phase 01.
- Controlled preview, diagnostic preview, writer adapters, artifact adapters, and runtime wiring are handoff targets for later phases.

## Next handoff to Agent 02

Agent 02 may use `NewCoreReadinessAudit.v1` as the Phase 01 input gate for writer/runtime proof work. The intended handoff is:

```text
NewCoreReadinessAudit.v1
→ RvmExportModel.v1 / AttExportModel.v1 / GlbVisualModel.v1
→ writer adapters
→ artifact adapters
→ diagnostic preview / controlled preview
→ WriterRuntimeReadinessAudit.v1
```

Agent 02 must not bypass deferred/test-byte-only/blocked statuses. Any runtime writer enablement must preserve source item identity, source primitive identity, explicit reasons, and fail-closed validation.

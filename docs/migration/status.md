# Migration Status

## Current state

This migration is a layered staged-contract handoff. It is not a vertical feature split.

```text
ManagedStage JSON
→ PlantModelGraph.v1
→ CatalogueBindingAudit.v1
→ ResolvedGeometryModel.v1
→ ResolvedPrimitiveModel.v1
→ RvmExportModel.v1 / AttExportModel.v1 / GlbVisualModel.v1
→ NewCoreReadinessAudit.v1
→ WriterRuntimeReadinessAudit.v1
→ CI validation gate
```

## Completed work on `main`

| Stage | Artifact / output | Repository status |
|---|---|---|
| Core readiness | `NewCoreReadinessAudit.v1` | Merged in PR #482 |
| Writer/runtime proof | `WriterRuntimeReadinessAudit.v1` | Merged in PR #483 |
| Validation infrastructure | `test:writer-runtime-readiness` and GitHub Actions workflow | Merged in PR #484 |

## Runtime boundary

The active production runtime path is unchanged.

No merged readiness phase authorizes changes to:

```text
src/rvm-converter.js
src/rvm-preview.js
src/rvm-writer.js
src/att-writer.js
src/app.js
src/main.js
index.html
UI runtime/controller files
```

## Readiness policy

| Area | Status |
|---|---|
| Straight procedural pipe | `production-ready` in Phase 01 only when full graph → binding → geometry → primitive → RVM/ATT/GLB export evidence exists |
| Valid `CYLINDER`/code8 export row | `dry-run-ready` by default in Phase 02; `writer-ready` only with explicit production policy approval |
| TORUS/code4 bend | `test-byte-only` unless production writer policy explicitly enables it |
| Flange primitive | `deferred` until writer bridge proof and production policy approval exist |
| Support intent | `support-intent-only` / `deferred`; production support primitive generation is outside these phases |
| Unknown catalogue/procedural state | `unresolved` |
| Missing evidence or unsupported primitive | `blocked` with reason |

## Validation gate

GitHub Actions workflow:

```text
.github/workflows/new-core-runtime-readiness.yml
```

Workflow name:

```text
New Core Runtime Readiness
```

Required commands:

```bash
npm run test:platform-contracts
npm run test:managed-stage-importer
npm run test:catalogue-binding
npm run test:resolved-geometry
npm run test:primitive-compiler
npm run test:export-models
npm run test:new-core-readiness
npm run test:writer-adapters
npm run test:artifact-adapters
npm run test:diagnostic-preview
npm run test:controlled-preview
npm run test:rvm-byte-proof
npm run test:rvm-torus-byte-proof
npm run test:writer-runtime-readiness
```

## Next gate

Before any runtime switch proposal is written, the workflow above must produce a green run on `main`.

If no workflow run appears automatically, manually trigger `New Core Runtime Readiness` from the GitHub Actions tab.

## Next allowed work

The next work is a single decision review:

```text
Runtime switch decision review
```

It must decide whether the new export models are ready to become the legal input boundary for `writeRvm()` or whether another proof phase is required.

It must not modify production runtime, writer, converter, preview, or UI files.

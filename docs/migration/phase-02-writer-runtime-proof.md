# Phase 02 — Writer Runtime Readiness Proof

## Purpose

Phase 02 proves that `RvmExportModel.v1`, `AttExportModel.v1`, and `GlbVisualModel.v1` can be traced into writer/runtime readiness decisions without switching production runtime behavior.

This phase is proof-only.

## Dependency

Phase 02 depends on a passing Phase 01 `NewCoreReadinessAudit.v1`.

```text
NewCoreReadinessAudit.v1
→ RvmExportModel.v1 / AttExportModel.v1 / GlbVisualModel.v1
→ WriterRuntimeReadinessAudit.v1
```

## Boundaries

Allowed:

```text
src/diagnostics/
tests/audit/
docs/migration/
```

Forbidden without explicit Agent 00 approval:

```text
src/rvm-converter.js
src/rvm-preview.js
src/rvm-writer.js
src/att-writer.js
UI/runtime files
```

Forbidden in Phase 02 implementation:

```text
catalogue lookup in writer adapter
geometry solving in writer adapter
second final-review/Navis transform
production writer call
silent unsupported primitive fallback
```

## Readiness policy

| Area | Status |
|---|---|
| Valid `CYLINDER`/code8 | `dry-run-ready` by default; `writer-ready` only with explicit approval |
| `TORUS`/code4 | `test-byte-only` |
| `FLANGE_CYLINDER`/code8 | `deferred` |
| Support intent | `deferred` / support-intent-only |
| Unsupported primitive | `blocked` |
| Production runtime | `runtime-unchanged` |

## Test gate

```bash
node tests/audit/writer-runtime-readiness-audit.test.mjs
```

## Required surrounding gates

```bash
npm run test:new-core-readiness
npm run test:writer-adapters
npm run test:artifact-adapters
npm run test:diagnostic-preview
npm run test:controlled-preview
npm run test:rvm-byte-proof
npm run test:rvm-torus-byte-proof
```

## Handoff

A later runtime integration phase may consume this proof. Phase 02 does not change the active production converter path.

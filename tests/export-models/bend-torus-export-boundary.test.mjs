import assert from 'node:assert/strict';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.exportAudit.ok, true);
assert.equal(assertExportModelCompilationAudit(state.exportAudit, { ok: true, transformPolicy: 'final-review-transform.v1', navisTransformApplied: true, rvmPrimitivePlanCount: 19, rvmCylinderPlanCount: 19, rvmTorusPlanCount: 0, rvmTorusWriterReadyCount: 0, deferredBendTorusExportCount: 7, blockedFlangeExportCount: 8, blockedValveExportCount: 6, blockedBendExportCount: 0, deferredSupportExportCount: 12, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0 }).ok, true);
assert.equal(state.exportModels.rvmExportModel.primitives.filter((entry) => entry.primitiveKind === 'CYLINDER').length, 19);
assert.equal(state.exportModels.rvmExportModel.primitives.filter((entry) => entry.primitiveKind === 'TORUS').length, 0, 'TORUS is not writer-ready export primitive in Phase 11A');
assert.equal(state.exportModels.rvmExportModel.deferredExports.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, 7);
assert.equal(state.writerAdapterAudit.rvmPlannedCylinderCount, 19);
assert.equal(state.writerAdapterAudit.rvmPlannedTorusCount, 0);
assert.equal(state.writerAdapterAudit.deferredBendTorusWriterCount, 7);

console.log('bend torus export boundary tests passed');

import assert from 'node:assert/strict';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.exportAudit.ok, true);
assert.equal(assertExportModelCompilationAudit(state.exportAudit, { ok: true, rvmCylinderPlanCount: 19, rvmTorusPlanCount: 0, rvmTorusWriterReadyCount: 0, testByteEligibleTorusCount: 7, testByteEligibleBendTorusCount: 7, productionReadyTorusCount: 0, deferredBendTorusExportCount: 7, flangeDeferredExportCount: 8, flangeWriterReadyCount: 0, flangeTestByteEligibleCount: 0, blockedFlangeExportCount: 0, blockedValveExportCount: 6, blockedBendExportCount: 0, deferredSupportExportCount: 12, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0 }).ok, true);
assert.equal(state.exportModels.rvmExportModel.primitives.length, 19);
assert.equal(state.exportModels.rvmExportModel.testByteEligiblePrimitives.length, 7);
assert.equal(state.exportModels.rvmExportModel.deferredExports.filter((entry) => entry.family === 'flange').length, 8);
for (const torus of state.exportModels.rvmExportModel.testByteEligiblePrimitives) {
  assert.equal(torus.primitiveKind, 'TORUS');
  assert.equal(torus.primitiveCode, 4);
  assert.equal(torus.basis, 'navis-review');
  assert.equal(torus.transformPolicy, 'final-review-transform.v1');
  assert.equal(torus.writerReady, false);
  assert.equal(torus.testByteEligible, true);
}

console.log('RVM TORUS test-byte eligibility export test passed');

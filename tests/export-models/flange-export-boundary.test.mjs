import assert from 'node:assert/strict';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.exportAudit.ok, true);
assert.equal(assertExportModelCompilationAudit(state.exportAudit, { ok: true, rvmCylinderPlanCount: 19, testByteEligibleTorusCount: 7, testByteEligibleBendTorusCount: 7, flangeDeferredExportCount: 8, flangeWriterReadyCount: 0, flangeTestByteEligibleCount: 8, productionReadyFlangeCount: 0, blockedFlangeExportCount: 0, blockedValveExportCount: 6, blockedBendExportCount: 0, deferredSupportExportCount: 12, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0 }).ok, true);
assert.equal(state.exportModels.rvmExportModel.primitives.length, 19);
assert.equal(state.exportModels.rvmExportModel.primitives.every((entry) => entry.primitiveKind === 'CYLINDER'), true);
assert.equal(state.exportModels.rvmExportModel.testByteEligiblePrimitives.length, 7);
assert.equal(state.exportModels.rvmExportModel.flangeTestByteEligiblePrimitives.length, 8);
assert.equal(state.exportModels.rvmExportModel.primitives.some((entry) => entry.primitiveKind === 'FLANGE_CYLINDER'), false);
assert.equal(state.exportModels.rvmExportModel.testByteEligiblePrimitives.some((entry) => entry.primitiveKind === 'FLANGE_CYLINDER'), false);
assert.equal(state.exportModels.rvmExportModel.flangeTestByteEligiblePrimitives.every((entry) => entry.primitiveKind === 'FLANGE_CYLINDER' && entry.writerReady === false && entry.testByteEligible === true && entry.byteBridge === 'test-only-phase-11c-b'), true);
assert.equal(state.exportModels.rvmExportModel.flangeTestByteEligiblePrimitives.some((entry) => entry.family === 'valve' || entry.family === 'support'), false);

console.log('flange export boundary test passed');

import assert from 'node:assert/strict';
import { assertWriterAdapterAudit } from '../../src/audit/writer-adapter-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.writerAdapterAudit.ok, true);
assert.equal(assertWriterAdapterAudit(state.writerAdapterAudit, { ok: true, rvmWriterReady: true, rvmPipeBendSubsetTestByteReady: true, flangeSubsetTestByteReady: true, rvmPlannedCylinderCount: 19, rvmPlannedTorusCount: 0, testByteEligibleTorusCount: 7, testByteEligibleBendTorusCount: 7, flangeTestByteEligibleCount: 8, flangeWriterReadyCount: 0, productionReadyFlangeCount: 0, deferredFlangeWriterCount: 8, blockedFlangeWriterCount: 0, blockedValveWriterCount: 6, blockedBendWriterCount: 0, deferredSupportWriterCount: 12, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0 }).ok, true);
assert.equal(state.writerAdapterPlan.rvmAdapter.flangeSubsetTestByteReady, true);
assert.equal(state.writerAdapterPlan.rvmAdapter.flangeTestByteEligibleCount, 8);
assert.equal(state.writerAdapterPlan.rvmAdapter.flangeWriterReadyCount, 0);
assert.equal(state.writerAdapterPlan.rvmAdapter.productionReadyFlangeCount, 0);
assert.equal(state.writerAdapterPlan.rvmAdapter.testByteEligibleItems.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER').length, 8);
assert.equal(state.writerAdapterPlan.rvmAdapter.plannedChunks.some((entry) => entry.primitiveKind === 'FLANGE_CYLINDER'), false);

console.log('RVM flange test-byte writer readiness test passed');

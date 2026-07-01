import assert from 'node:assert/strict';
import { assertWriterAdapterAudit } from '../../src/audit/writer-adapter-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.writerAdapterAudit.ok, true);
assert.equal(assertWriterAdapterAudit(state.writerAdapterAudit, { ok: true, rvmWriterReady: true, rvmPipeBendSubsetTestByteReady: true, flangeSubsetTestByteReady: true, rvmPlannedCylinderCount: 19, rvmPlannedTorusCount: 0, testByteEligibleTorusCount: 7, testByteEligibleBendTorusCount: 7, productionReadyTorusCount: 0, deferredFlangeWriterCount: 8, flangeWriterReadyCount: 0, flangeTestByteEligibleCount: 8, productionReadyFlangeCount: 0, blockedFlangeWriterCount: 0, blockedValveWriterCount: 6, blockedBendWriterCount: 0, deferredSupportWriterCount: 12, deferredBendTorusWriterCount: 0, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0 }).ok, true);
assert.equal(state.writerAdapterPlan.rvmAdapter.testByteEligibleItems.filter((entry) => entry.primitiveKind === 'TORUS').length, 7);
assert.equal(state.writerAdapterPlan.rvmAdapter.testByteEligibleItems.filter((entry) => entry.primitiveKind === 'FLANGE_CYLINDER').length, 8);
assert.equal(state.writerAdapterPlan.rvmAdapter.plannedChunks.filter((entry) => entry.primitiveKind === 'TORUS').length, 0);
assert.equal(state.writerAdapterPlan.rvmAdapter.productionReadyTorusCount, 0);

console.log('RVM TORUS test-byte writer readiness test passed');

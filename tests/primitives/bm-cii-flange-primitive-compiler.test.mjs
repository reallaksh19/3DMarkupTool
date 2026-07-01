import assert from 'node:assert/strict';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.bindingAudit.flangeCatalogueResolvedCount, 8);
assert.equal(state.geometryAudit.resolvedFlangeFrameCount, 8);
assert.equal(state.primitiveAudit.primitiveCount, 34);
assert.equal(state.primitiveAudit.cylinderPrimitiveCount, 19);
assert.equal(state.primitiveAudit.torusPrimitiveCount, 7);
assert.equal(state.primitiveAudit.flangePrimitiveCount, 8);
assert.equal(state.primitiveAudit.flangeCylinderPrimitiveCount, 8);
assert.equal(state.primitiveAudit.blockedFlangePrimitiveCount, 0);
assert.equal(state.primitiveAudit.blockedValvePrimitiveCount, 6);
assert.equal(state.primitiveAudit.blockedBendPrimitiveCount, 0);
assert.equal(state.primitiveAudit.deferredSupportPrimitiveCount, 12);
assert.equal(state.primitiveAudit.fallbackFlangePrimitiveCount, 0);
assert.equal(state.primitiveAudit.writerCallCount, 0);
assert.equal(state.primitiveAudit.exportDecisionCount, 0);
assert.equal(state.primitiveAudit.navisTransformApplied, false);

console.log('BM CII flange primitive compiler integration test passed');

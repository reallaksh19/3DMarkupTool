import assert from 'node:assert/strict';
import { assertPrimitiveCompilationAudit } from '../../src/audit/primitive-compilation-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.primitiveAudit.ok, true);
assert.equal(assertPrimitiveCompilationAudit(state.primitiveAudit, { ok: true, primitiveCount: 34, cylinderPrimitiveCount: 19, torusPrimitiveCount: 7, bendTorusPrimitiveCount: 7, flangePrimitiveCount: 8, flangeCylinderPrimitiveCount: 8, boxPrimitiveCount: 0, spherePrimitiveCount: 0, pyramidPrimitiveCount: 0, supportPrimitiveCount: 0, blockedFlangePrimitiveCount: 0, blockedValvePrimitiveCount: 6, blockedBendPrimitiveCount: 0, deferredSupportPrimitiveCount: 12, blockedUnresolvedGeometryCount: 6, fallbackFlangePrimitiveCount: 0, writerCallCount: 0, exportDecisionCount: 0 }).ok, true);
const flanges = state.primitiveModel.primitives.filter((entry) => entry.primitiveKind === 'FLANGE_CYLINDER');
assert.equal(flanges.length, 8);
for (const primitive of flanges) {
  assert.equal(primitive.primitiveCode, 8);
  assert.equal(primitive.bodyPrimitive.primitiveKind, 'CYLINDER');
  assert.equal(primitive.bodyPrimitive.primitiveCode, 8);
  assert.equal(primitive.writerReady, false);
  assert.equal(primitive.testByteEligible, false);
  assert.equal(primitive.byteBridge, 'not-implemented-phase-11c');
  assert.ok(primitive.outerRadiusMm > primitive.boreRadiusMm);
  assert.equal(Math.abs(Math.hypot(...primitive.axis) - 1) < 1e-6, true);
}
assert.equal(state.primitiveModel.primitives.filter((entry) => entry.primitiveKind === 'CYLINDER').length, 19);
assert.equal(state.primitiveModel.primitives.filter((entry) => entry.primitiveKind === 'TORUS').length, 7);

console.log('flange primitive compiler tests passed');

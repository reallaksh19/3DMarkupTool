import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertResolvedGeometryModelContract,
  validateResolvedGeometryModelContract
} from '../../src/contracts/index.js';

const model = JSON.parse(await readFile('samples/geometry/minimal-resolved-geometry.expected.resolved-geometry.json', 'utf8'));
const validation = validateResolvedGeometryModelContract(model, { expectedAuthoringBasis: 'canvas-current' });
assert.equal(validation.ok, true, `good resolved geometry fixture must validate: ${validation.errors.join('; ')}`);
assert.equal(assertResolvedGeometryModelContract(model, { expectedAuthoringBasis: 'canvas-current' }).ok, true);
assert.equal(model.axisBasis.authoring, 'canvas-current', 'authoring basis must remain unchanged');

for (const forbidden of ['primitiveCode', 'rvmCode', 'materialId', 'navisTransform', 'glbMesh', 'meshGeometry', 'exportTransform', 'rvmMatrix', 'attRecord']) {
  const bad = structuredClone(model);
  bad.itemFrames[0][forbidden] = forbidden === 'primitiveCode' || forbidden === 'rvmCode' ? 8 : 'forbidden';
  const result = validateResolvedGeometryModelContract(bad, { expectedAuthoringBasis: 'canvas-current' });
  assert.equal(result.ok, false, `contract must reject ${forbidden}`);
  assert.ok(result.errors.some((entry) => entry.includes(forbidden)), `error list must mention ${forbidden}`);
}

const wrongBasis = structuredClone(model);
wrongBasis.axisBasis.authoring = 'navis-review';
const wrongBasisResult = validateResolvedGeometryModelContract(wrongBasis, { expectedAuthoringBasis: 'canvas-current' });
assert.equal(wrongBasisResult.ok, false, 'contract must reject authoring basis mutation');

assert.equal(typeof globalThis.window, 'undefined', 'contract test must not require browser window');
assert.equal(typeof globalThis.document, 'undefined', 'contract test must not require browser document');

console.log('resolved geometry model contract tests passed');

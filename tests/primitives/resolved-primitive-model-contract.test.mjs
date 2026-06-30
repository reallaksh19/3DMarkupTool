import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertResolvedPrimitiveModelContract,
  validateResolvedPrimitiveModelContract
} from '../../src/contracts/index.js';

const model = JSON.parse(await readFile('samples/primitives/minimal-primitive-compiler.expected.resolved-primitive-model.json', 'utf8'));
const validation = validateResolvedPrimitiveModelContract(model, { expectedAuthoringBasis: 'canvas-current' });
assert.equal(validation.ok, true, `good primitive model fixture must validate: ${validation.errors.join('; ')}`);
assert.equal(assertResolvedPrimitiveModelContract(model, { expectedAuthoringBasis: 'canvas-current' }).ok, true);
assert.equal(model.axisBasis.authoring, 'canvas-current', 'authoring basis must remain unchanged');

const legacySeed = JSON.parse(await readFile('samples/contracts/BM_CII.resolved-primitive-model.seed.json', 'utf8'));
assert.equal(validateResolvedPrimitiveModelContract(legacySeed).ok, true, 'legacy seed primitive contract must remain valid');

for (const forbidden of ['binary', 'bytes', 'chunk', 'cntb', 'primBody', 'rvmMatrix', 'navisTransform', 'exportTransform', 'attRecord', 'glbMesh', 'meshGeometry', 'threeGeometry', 'materialId']) {
  const bad = structuredClone(model);
  bad.primitives[0][forbidden] = forbidden;
  const result = validateResolvedPrimitiveModelContract(bad, { expectedAuthoringBasis: 'canvas-current' });
  assert.equal(result.ok, false, `contract must reject ${forbidden}`);
  assert.ok(result.errors.some((entry) => entry.includes(forbidden)), `error list must mention ${forbidden}`);
}

const wrongBasis = structuredClone(model);
wrongBasis.axisBasis.authoring = 'navis-review';
const wrongBasisResult = validateResolvedPrimitiveModelContract(wrongBasis, { expectedAuthoringBasis: 'canvas-current' });
assert.equal(wrongBasisResult.ok, false, 'contract must reject authoring basis mutation');

console.log('resolved primitive model contract tests passed');

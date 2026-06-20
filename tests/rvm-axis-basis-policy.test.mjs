import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { writeRvm } from '../src/rvm-writer.js';
import {
  assertRvmAxisBasis,
  buildRvmAxisBasis,
  buildRvmPrimitiveTransform,
  describeRvmAxisBasisPolicy,
  RVM_PRIMITIVE_TRANSFORM_SCALE
} from '../src/rvm-axis-basis-policy.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const writerSource = readFileSync(new URL('../src/rvm-writer.js', import.meta.url), 'utf8');
const policySource = readFileSync(new URL('../src/rvm-axis-basis-policy.js', import.meta.url), 'utf8');

const policy = describeRvmAxisBasisPolicy();
assert.equal(policy.schema, 'RvmAxisBasisPolicy.v1');
assert.equal(policy.transformScale, 0.001);
assert.equal(policy.failClosed, true);
assert.equal(policy.zeroLengthDirectionsAllowed, false);
assert.equal(RVM_PRIMITIVE_TRANSFORM_SCALE, 0.001);

const xAxisBasis = buildRvmAxisBasis([1, 0, 0]);
assertRvmAxisBasis(xAxisBasis);
assert.deepEqual(
  Object.fromEntries(Object.entries(xAxisBasis).map(([key, value]) => [key, value.map((entry) => round(entry, 6))])),
  {
    x: [0, 0, -1],
    y: [0, 1, 0],
    z: [1, 0, 0]
  },
  'X-axis cylinder basis must remain deterministic and right-handed'
);

const xAxisTransform = buildRvmPrimitiveTransform({ center: [500, 0, 0], direction: [1, 0, 0] });
assert.deepEqual(
  xAxisTransform.map((value) => round(value, 6)),
  [0, 0, -0.001, 0, 0.001, 0, 0.001, 0, 0, 0.5, 0, 0],
  'transform matrix must preserve RHBG-style 0.001 basis scale and metre translation'
);

const zAxisTransform = buildRvmPrimitiveTransform({ center: [0, 0, 1000], direction: [0, 0, 1] });
assert.deepEqual(
  zAxisTransform.map((value) => round(value, 6)),
  [0.001, 0, 0, 0, 0.001, 0, 0, 0, 0.001, 0, 0, 1],
  'Z-axis primitive transform must write basis and translation through the central policy'
);

assert.throws(
  () => buildRvmAxisBasis([0, 0, 0]),
  /expected non-zero vector/,
  'zero-length primitive directions must fail closed instead of silently becoming Z-up'
);
assert.throws(
  () => buildRvmPrimitiveTransform({ center: [0, Number.NaN, 0], direction: [0, 0, 1] }),
  /center: contains non-finite value/,
  'non-finite primitive centers must fail closed'
);
assert.throws(
  () => assertRvmAxisBasis({ x: [1, 0, 0], y: [1, 0, 0], z: [0, 0, 1] }),
  /dot product/,
  'non-orthogonal bases must fail closed'
);
assert.throws(
  () => assertRvmAxisBasis({ x: [1, 0, 0], y: [0, -1, 0], z: [0, 0, 1] }),
  /right-handed orthonormal basis/,
  'left-handed bases must fail closed'
);

const invalidModel = {
  root: {
    name: 'ROOT',
    primitives: [
      {
        name: 'BAD_AXIS',
        kind: 'cylinder',
        center: [0, 0, 0],
        direction: [0, 0, 0],
        radius: 10,
        length: 100
      }
    ],
    children: []
  }
};
assert.throws(
  () => writeRvm(invalidModel),
  /expected non-zero vector/,
  'production RVM writer must route primitive transforms through the fail-closed basis policy'
);

assert.match(writerSource, /buildRvmPrimitiveTransform\(primitive\)/, 'RVM writer must delegate PRIM matrix construction to the axis/basis policy');
assert.doesNotMatch(writerSource, /function basisFromDirection/, 'RVM writer must not keep ad-hoc basis construction');
assert.match(policySource, /RVM_PRIMITIVE_TRANSFORM_SCALE = 0\.001/, 'axis/basis policy must own the RHBG-style transform scale');
assert.match(policySource, /right-handed/, 'axis/basis policy must document right-handed basis construction');
assert.match(pkg.scripts.test, /rvm-axis-basis-policy\.test\.mjs/, 'npm test must include the RVM axis/basis policy test');

console.log('RVM axis/basis policy technical test passed');

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

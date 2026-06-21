import assert from 'node:assert/strict';

import { createManagedStageGeometryContract } from '../src/managed-stage-geometry-contract.js';
import { planManagedStagePrimitives } from '../src/managed-stage-rvm-primitive-planner.js';
import { solveCode4ElbowGeometry } from '../src/rvm-code4-elbow-geometry-solver.js';
import { assertRvmAxisBasis, buildRvmPrimitiveTransform } from '../src/rvm-axis-basis-policy.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const syntheticBend = bendRecord({
  name: 'TEST_90_BEND',
  start: [10, 0, 0],
  end: [0, 10, 0],
  radius: 10,
  angleDeg: 90,
  diameter: '2mm'
});
const syntheticContract = createManagedStageGeometryContract(syntheticBend, 0);
const solved = solveCode4ElbowGeometry(syntheticContract, { planeNormal: [0, 0, 1] });
assert.equal(solved.schema, 'RvmCode4ElbowGeometrySolver.v1');
assert.equal(solved.solverState, 'endpoint-fit-v1');
assert.equal(solved.endpointLocked, true);
assertVectorNear(solved.centerMm, [0, 0, 0], 'synthetic center');
assertVectorNear(solved.basis.x, [1, 0, 0], 'synthetic basis.x');
assertVectorNear(solved.basis.y, [0, 1, 0], 'synthetic basis.y');
assertVectorNear(solved.basis.z, [0, 0, 1], 'synthetic basis.z');
assertRvmAxisBasis(solved.basis);
assertNear(solved.radiusInflatedMm, 0, 'synthetic radius inflation');
assertNear(solved.endpointFitErrorMm, 0, 'synthetic endpoint fit error');
assertVectorNear(solved.localBbox, [0, 0, -1, 11, 11, 1], 'synthetic local bbox');

const fixture = createBmCiiManagedStageFixture();
const bendRecords = fixture.hierarchy[0].children.filter((record) => record.attributes?.DTXR === 'BEND');
assert.equal(bendRecords.length, 7);
const bendPrimitives = bendRecords.map((record, index) => {
  const [primitive] = planManagedStagePrimitives(record, { elementIndex: index });
  return primitive;
});
assert.equal(bendPrimitives.length, 7);
for (const primitive of bendPrimitives) {
  assert.equal(primitive.kind, 'elbow');
  assert.equal(primitive.endpointLocked, true);
  assert.equal(primitive.solverState, 'endpoint-fit-v1');
  assert.equal(primitive.orientationAssumption, 'managed-stage code4 endpoint-fit solver v1');
  assertRvmAxisBasis(primitive.basis);
  assert.ok(primitive.bendRadius > 0);
  assert.ok(primitive.tubeRadius > 0);
  assert.ok(primitive.sweepAngleRad > 0);
  assert.ok(primitive.endpointFitErrorMm <= 0.000001);
  const transform = buildRvmPrimitiveTransform(primitive);
  assert.equal(transform.length, 12);
}

const longChordBend = bendPrimitives.find((primitive) => primitive.sourceElementId === 'PE_029_BEND_70_TO_250');
assert.ok(longChordBend, 'expected PE_029 bend primitive');
assert.ok(longChordBend.radiusInflatedMm > 0, 'long staged bend chord should inflate effective code-4 radius to span endpoints');
assert.ok(longChordBend.bendRadius >= longChordBend.minRadiusForChordMm);

assert.throws(
  () => solveCode4ElbowGeometry(syntheticContract, { planeNormal: [1, -1, 0] }),
  /cannot be parallel to bend chord/
);

console.log('Managed-stage code4 elbow endpoint-fit solver test passed');

function bendRecord({ name, start, end, radius, angleDeg, diameter }) {
  return {
    name: `BEND ${name}`,
    type: 'BEND',
    attributes: {
      TYPE: 'BEND', RAW_TYPE: 'BEND', DTXR: 'BEND', NAME: name, REF: name,
      FROM_NODE: 'A', TO_NODE: 'B', APOS: xyz(start), LPOS: xyz(end), DIAMETER: diameter, BORE: diameter,
      BEND_RADIUS: String(radius), BEND_ANGLE: String(angleDeg), SOURCE_ELEMENT_ID: name
    }
  };
}

function xyz([x, y, z]) { return { x, y, z }; }
function assertVectorNear(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  for (let index = 0; index < expected.length; index += 1) assertNear(actual[index], expected[index], `${label}[${index}]`);
}
function assertNear(actual, expected, label) {
  const delta = Math.abs(Number(actual) - Number(expected));
  assert.ok(delta <= 0.000001, `${label}: expected ${expected}, got ${actual}`);
}

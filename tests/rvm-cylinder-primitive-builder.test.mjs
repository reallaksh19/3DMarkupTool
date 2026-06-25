import assert from 'node:assert/strict';

import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { buildManagedStageGeometryContractSet } from '../src/managed-stage-geometry-contract.js';
import {
  assertEndpointLockedCylinderPrimitive,
  buildContractCylinderPrimitive,
  buildEndpointLockedCylinderPrimitive
} from '../src/rvm-cylinder-primitive-builder.js';
import { planManagedStagePrimitives } from '../src/managed-stage-rvm-primitive-planner.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const profile = parseManagedStageProfile(JSON.stringify(createBmCiiManagedStageFixture()));
const contractSet = buildManagedStageGeometryContractSet(profile);

const pipeContract = contractSet.contracts.find((contract) => contract.dtxr === 'PIPE');
const pipePrimitive = buildContractCylinderPrimitive(pipeContract, { localName: 'body', radiusMm: pipeContract.radiusMm, material: 4 });
assert.equal(pipePrimitive.kind, 'cylinder');
assert.equal(pipePrimitive.endpointLocked, true);
assert.equal(pipePrimitive.length, pipeContract.lengthMm);
assert.deepEqual(pipePrimitive.startMm, pipeContract.startMm);
assert.deepEqual(pipePrimitive.endMm, pipeContract.endMm);
assertEndpointLockedCylinderPrimitive(pipePrimitive, { contract: pipeContract });

const flangePairContract = contractSet.contracts.find((contract) => contract.dtxr === 'FLANGE_PAIR');
const flangeLength = Math.min(flangePairContract.lengthMm * 0.45, 90);
const flangePrimitive = buildContractCylinderPrimitive(flangePairContract, {
  localName: 'flangeA',
  radiusMm: flangePairContract.radiusMm * 1.55,
  material: 6,
  startOffsetMm: 0,
  endOffsetMm: flangePairContract.lengthMm - flangeLength
});
assert.equal(flangePrimitive.endpointLocked, true);
assert.equal(Math.abs(flangePrimitive.length - flangeLength) < 1e-6, true);
assert.deepEqual(flangePrimitive.startMm, flangePairContract.startMm);
assertEndpointLockedCylinderPrimitive(flangePrimitive, { contract: flangePairContract, fullSpan: false });

const planned = profile.geometryRecords.flatMap((record, index) => planManagedStagePrimitives(record, { elementIndex: index }));
const cylinders = planned.filter((primitive) => primitive.kind === 'cylinder');
const elbows = planned.filter((primitive) => primitive.kind === 'elbow');
const cylindersByMaterial = cylinders.reduce((acc, primitive) => {
  acc[primitive.material] = (acc[primitive.material] || 0) + 1;
  return acc;
}, {});
assert.equal(cylinders.length, 65, 'current BM_CII managed-stage fixture must emit the full pipe/flange/valve cylinder recipe set');
assert.equal(elbows.length, 7);
assert.ok(cylindersByMaterial[4] >= 19, 'pipe cylinders must remain present');
assert.ok(cylindersByMaterial[6] >= 8, 'flange/flange-pair cylinders must remain present');
assert.ok(cylindersByMaterial[7] >= 6, 'valve/flanged-valve cylinders must remain present');
assert.equal(cylinders.every((primitive) => primitive.endpointLocked === true), true);
assert.equal(cylinders.every((primitive) => primitive.localBbox?.length === 6), true);
assert.equal(elbows.every((primitive) => primitive.endpointLocked === false), true);

const explicitEndpointCylinders = cylinders.filter((primitive) => Array.isArray(primitive.startMm) && Array.isArray(primitive.endMm));
assert.ok(explicitEndpointCylinders.length >= 1);
assert.equal(explicitEndpointCylinders.every((primitive) => primitive.endpointLocked === true), true);

assert.throws(
  () => buildContractCylinderPrimitive(pipeContract, { startOffsetMm: pipeContract.lengthMm, endOffsetMm: 0, radiusMm: pipeContract.radiusMm }),
  /offsets consume contract span/
);
assert.throws(
  () => buildEndpointLockedCylinderPrimitive({ startMm: [0, 0, 0], endMm: [0, 0, 0], radiusMm: 10 }),
  /non-zero span/
);

console.log('Endpoint-locked RVM cylinder primitive builder test passed');

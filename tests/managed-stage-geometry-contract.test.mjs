import assert from 'node:assert/strict';

import {
  assertManagedStageGeometryContractAudit,
  buildManagedStageGeometryContractSet,
  createManagedStageGeometryContract
} from '../src/managed-stage-geometry-contract.js';
import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const fixture = createBmCiiManagedStageFixture();
const profile = parseManagedStageProfile(JSON.stringify(fixture));
const contractSet = buildManagedStageGeometryContractSet(profile);
const { contracts, audit } = contractSet;

assert.equal(contractSet.schema, 'ManagedStageGeometryContractSet.v1');
assert.equal(contractSet.units, 'mm');
assert.equal(contractSet.contractCount, 40);
assert.equal(contractSet.supportRecordsSkippedFromGeometry, 12);
assert.equal(contracts.length, 40);

assert.deepEqual(audit.dtxrHistogram, {
  FLANGE_PAIR: 2,
  PIPE: 18,
  FLANGE: 6,
  FLANGED_VALVE: 3,
  BEND: 7,
  VALVE: 3,
  UNSPECIFIED: 1
});
assert.deepEqual(audit.centerlineKindHistogram, { line: 33, arc: 7 });
assert.deepEqual(audit.classHistogram, {
  FLANGE_PAIR: 2,
  PIPE: 18,
  FLANGE: 6,
  FLANGED_VALVE: 3,
  BEND: 7,
  VALVE: 3,
  UNKNOWN_PIPELIKE: 1
});
assert.equal(audit.zeroLength.length, 0);
assert.equal(audit.invalidAxis.length, 0);
assert.equal(audit.unsupportedDtxr.length, 0);
assert.equal(audit.missingNodes.length, 0);
assert.equal(audit.allEndpointLocked, true);
assert.equal(audit.allEmitGeometry, true);
assert.deepEqual(
  assertManagedStageGeometryContractAudit(audit, { contractCount: 40, supportRecordsSkippedFromGeometry: 12 }),
  { ok: true, contractCount: 40, dtxrHistogram: audit.dtxrHistogram }
);

const first = contracts[0];
assert.equal(first.name, 'PE_001_FLANGE_PAIR_10_TO_20');
assert.equal(first.dtxr, 'FLANGE_PAIR');
assert.equal(first.componentClass, 'FLANGE_PAIR');
assert.equal(first.centerlineKind, 'line');
assert.deepEqual(first.startMm, [0, 0, 0]);
assert.deepEqual(first.endMm, [0, 0, -108]);
assert.deepEqual(first.centerMm, [0, 0, -54]);
assert.deepEqual(first.axis, [0, 0, -1]);
assert.equal(first.lengthMm, 108);
assert.equal(first.diameterMm, 114.3);
assert.equal(first.radiusMm, 57.15);
assert.equal(first.endpointLocked, true);

const bend = contracts.find((contract) => contract.name === 'PE_014_BEND_120_TO_130');
assert.ok(bend);
assert.equal(bend.centerlineKind, 'arc');
assert.equal(bend.componentClass, 'BEND');
assert.equal(bend.arc.bendRadiusMm, 152.4);
assert.equal(bend.arc.tubeRadiusMm, 57.15);
assert.equal(bend.arc.bendAngleDeg, 45);
assert.equal(Number(bend.arc.sweepAngleRad.toFixed(6)), Number((Math.PI / 4).toFixed(6)));
assert.equal(bend.arc.solverState, 'endpoint-contract-only');

const support = profile.supportRecords[0];
assert.throws(() => createManagedStageGeometryContract(support), /not a geometry contract/);
assert.throws(
  () => createManagedStageGeometryContract({ ...profile.geometryRecords[0], attributes: { ...profile.geometryRecords[0].attributes, DTXR: 'BOX' } }),
  /Unsupported managed-stage geometry DTXR/
);
assert.throws(
  () => assertManagedStageGeometryContractAudit({ ...audit, allEndpointLocked: false }),
  /endpoint locked/
);

console.log('Managed-stage geometry contract layer passed');

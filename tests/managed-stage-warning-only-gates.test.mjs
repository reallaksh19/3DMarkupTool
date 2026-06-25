import assert from 'node:assert/strict';

import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { buildManagedStageGeometryContractSet } from '../src/managed-stage-geometry-contract.js';
import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const fixture = createBmCiiManagedStageFixture();
const bend = fixture.hierarchy[0].children.find((child) => child.attributes?.DTXR === 'BEND');
assert.ok(bend, 'fixture has a bend record');
bend.attributes.BEND_ANGLE = '0.000000';

function parsedFixture() {
  return parseManagedStageProfile(JSON.stringify(fixture));
}

assert.throws(
  () => buildManagedStageGeometryContractSet(parsedFixture()),
  /Missing\/invalid bend angle/,
  'strict contract construction still fails invalid bend metadata'
);

const contractSet = buildManagedStageGeometryContractSet(parsedFixture(), {
  nonBlockingGeometryGates: true,
  warningOnlyManagedStageGates: true
});
assert.equal(contractSet.audit.nonBlockingWarningCount, 1);
assert.equal(contractSet.audit.degradedBends.length, 1);
assert.match(contractSet.audit.nonBlockingWarnings[0].message, /Missing\/invalid bend angle/);

const result = convertManagedStageJsonToRvmAtt(JSON.stringify(fixture), {
  strictAuditExpectations: { geometryComponents: 999 }
});
assert.ok(result.rvm.byteLength > 0, 'RVM still emits with warning-only gates');
assert.ok(result.att.length > 0, 'ATT still emits with warning-only gates');
assert.equal(result.audit.geometryContractAudit.nonBlockingWarningCount, 1);
assert.equal(result.audit.geometryContractAudit.degradedBends.length, 1);
assert.equal(result.audit.managedStageStrictGate.warningOnly, true);
assert.equal(result.audit.managedStageStrictGate.failClosed, false);
assert.ok(result.audit.managedStageStrictGate.nonBlockingAuditWarningCount >= 1);

console.log('Managed-stage warning-only gates passed');

import assert from 'node:assert/strict';

import { buildManagedStageGeometryContractSet } from '../src/managed-stage-geometry-contract.js';
import {
  applyManagedStageElbowTangentHints,
  auditManagedStageElbowTangentHints
} from '../src/managed-stage-elbow-tangent-hints.js';
import { buildManagedStageRvmExportModel } from '../src/managed-stage-rvm-export-model.js';
import { planManagedStagePrimitives } from '../src/managed-stage-rvm-primitive-planner.js';
import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const profile = parseManagedStageProfile(JSON.stringify(createBmCiiManagedStageFixture()));
const contractSet = buildManagedStageGeometryContractSet(profile);
const hintedContracts = applyManagedStageElbowTangentHints(contractSet.contracts);
const audit = auditManagedStageElbowTangentHints(hintedContracts);

assert.equal(audit.schema, 'ManagedStageElbowTangentHintAudit.v1');
assert.equal(audit.bendCount, 7);
assert.equal(audit.allBendsHavePlaneHint, true);
assert.equal(audit.allBendsHaveAtLeastOneAdjacentTangent, true);
assert.equal(audit.stateHistogram['adjacent-start-end'], 7);

const bends = hintedContracts.filter((contract) => contract.dtxr === 'BEND');
for (const bend of bends) {
  assert.equal(bend.arc.tangentHintState, 'adjacent-start-end');
  assert.equal(unitLength(bend.arc.planeNormal), true, `${bend.name} planeNormal must be unit length`);
  assert.equal(unitLength(bend.arc.startTangent), true, `${bend.name} startTangent must be unit length`);
  assert.equal(unitLength(bend.arc.endTangent), true, `${bend.name} endTangent must be unit length`);
  assert.notEqual(bend.arc.tangentHintSources.start, '', `${bend.name} missing start tangent source`);
  assert.notEqual(bend.arc.tangentHintSources.end, '', `${bend.name} missing end tangent source`);

  const [primitive] = planManagedStagePrimitives(bend);
  assert.equal(primitive.kind, 'elbow');
  assert.equal(primitive.endpointLocked, true);
  assert.equal(primitive.tangentHintState, 'adjacent-start-end');
  assert.equal(primitive.orientationAssumption, 'managed-stage code4 endpoint-fit solver v1 with adjacent tangent hints');
  assert.equal(unitLength(primitive.startTangent), true, `${bend.name} primitive startTangent must be unit length`);
  assert.equal(unitLength(primitive.endTangent), true, `${bend.name} primitive endTangent must be unit length`);
}

const exportModel = buildManagedStageRvmExportModel(profile);
assert.equal(exportModel.audit.elbowTangentHintAudit.bendCount, 7);
assert.equal(exportModel.audit.elbowTangentHintAudit.allBendsHavePlaneHint, true);
assert.equal(exportModel.audit.elbowTangentHintAudit.stateHistogram['adjacent-start-end'], 7);

const subgroup = exportModel.root.children[0].children[0];
const bendNodes = subgroup.children.filter((node) => node.attributes.DTXR === 'BEND');
assert.equal(bendNodes.length, 7);
for (const node of bendNodes) {
  const [primitive] = node.primitives;
  assert.equal(primitive.tangentHintState, 'adjacent-start-end');
  assert.ok(primitive.tangentHintSources.start, `${node.name} missing exported start tangent source`);
  assert.ok(primitive.tangentHintSources.end, `${node.name} missing exported end tangent source`);
}

console.log('Managed-stage elbow tangent hint test passed');

function unitLength(vector) {
  if (!Array.isArray(vector) || vector.length !== 3) return false;
  const len = Math.hypot(...vector.map(Number));
  return Math.abs(len - 1) <= 0.000001;
}

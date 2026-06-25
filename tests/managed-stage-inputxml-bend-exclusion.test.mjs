import assert from 'node:assert/strict';

import { buildManagedStageGeometryContractSet } from '../src/managed-stage-geometry-contract.js';
import { applyManagedStageElbowTangentHints } from '../src/managed-stage-elbow-tangent-hints.js';
import {
  applyManagedStageInputXmlBendExclusion,
  assertManagedStageInputXmlBendExclusionAudit
} from '../src/managed-stage-inputxml-bend-exclusion.js';
import {
  assertManagedStageInputXmlNodeLocalElbowAudit
} from '../src/managed-stage-inputxml-node-local-elbows.js';
import {
  assertManagedStageInputXmlBendEndpointLockAudit
} from '../src/managed-stage-inputxml-bend-endpoint-lock.js';
import {
  isInputXmlBasedManagedStageProfile,
  resolveManagedStageJsonProcessingConfig
} from '../src/managed-stage-json-processing-config.js';
import { buildManagedStageRvmExportModel } from '../src/managed-stage-rvm-export-model.js';
import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const profile = parseManagedStageProfile(JSON.stringify(createBmCiiManagedStageFixture()));
assert.equal(isInputXmlBasedManagedStageProfile(profile), true);

const defaultConfig = resolveManagedStageJsonProcessingConfig(profile);
assert.equal(defaultConfig.excludeBendsWhileProcessingInputXmlBasedJson, true);
assert.equal(defaultConfig.genericInputXmlBendRadiusMultiplier, 1.5);
assert.equal(defaultConfig.inputXmlBendTrimMaxContractFraction, 0.35);

const nativeConfig = resolveManagedStageJsonProcessingConfig(profile, { excludeBendsWhileProcessingInputXmlBasedJson: false });
assert.equal(nativeConfig.excludeBendsWhileProcessingInputXmlBasedJson, false);

const contractSet = buildManagedStageGeometryContractSet(profile);
const hintedContracts = applyManagedStageElbowTangentHints(contractSet.contracts);
const excluded = applyManagedStageInputXmlBendExclusion(hintedContracts, defaultConfig);
assertManagedStageInputXmlBendExclusionAudit(excluded.audit, {
  enabled: true,
  code4BendsExcluded: 7,
  genericCode8BendsPlanned: 7,
  genericCode8BendPrimitiveCount: 7,
  nodeBasedReconstructedBendCount: 0,
  chordFallbackBendCount: 0
});
assert.equal(excluded.audit.mode, 'inputxml-json-source-route-bend-cylinders');
assert.equal(excluded.audit.trimMaxContractFraction, 0.35);
assert.equal(excluded.audit.sourceRouteBendCount, 7);
assert.equal(excluded.audit.trimmedContractCount, 0);
assert.equal(excluded.audit.trimApplicationCount, 0);
assert.equal(excluded.audit.genericBends.every((bend) => bend.emittedAs === 'code8-source-route-cylinder'), true);
assert.equal(excluded.audit.genericBends.every((bend) => bend.reconstructionMode === 'source-route-centerline-preserved'), true);
assert.equal(excluded.audit.genericBends.every((bend) => bend.segmentCount === 1), true);
assert.equal(excluded.contracts.filter((contract) => contract.inputXmlBendTrimmed).length, 0);
assert.equal(excluded.contracts.filter((contract) => contract.rvmTrimStartOffsetMm || contract.rvmTrimEndOffsetMm).length, 0);
assert.equal(excluded.contracts.filter((contract) => contract.excludeCode4Bend).length, 7);

const firstBend = excluded.contracts.find((contract) => contract.name === 'PE_014_BEND_120_TO_130');
assert.equal(firstBend.genericInputXmlBend.schema, 'ManagedStageInputXmlGenericBend.v5');
assert.equal(firstBend.genericInputXmlBend.mode, 'code8-source-route-cylinder');
assert.equal(firstBend.genericInputXmlBend.sourceRoutePreserved, true);
assert.equal(firstBend.genericInputXmlBend.segments.length, 1);
assert.equal(firstBend.genericInputXmlBend.segments[0].role, 'source-route');
assert.deepEqual(firstBend.genericInputXmlBend.segments[0].startMm, firstBend.startMm);
assert.deepEqual(firstBend.genericInputXmlBend.segments[0].endMm, firstBend.endMm);

const model = buildManagedStageRvmExportModel(profile);
const primitives = model.root.children[0].children[0].children.flatMap((node) => node.primitives);
assert.equal(model.audit.inputXmlBendExclusionAudit.code4BendsExcluded, 7);
assert.equal(model.audit.inputXmlBendExclusionAudit.genericCode8BendPrimitiveCount, 7);
assert.equal(model.audit.inputXmlBendExclusionAudit.nodeBasedReconstructedBendCount, 0);
assert.equal(model.audit.inputXmlBendExclusionAudit.chordFallbackBendCount, 0);
assert.equal(model.audit.inputXmlBendExclusionAudit.sourceRouteBendCount, 7);
assert.equal(model.audit.inputXmlBendExclusionAudit.trimmedContractCount, 0);
assert.equal(model.audit.inputXmlBendExclusionAudit.trimApplicationCount, 0);
assertManagedStageInputXmlNodeLocalElbowAudit(model.audit.inputXmlNodeLocalElbowAudit, {
  enabled: true,
  nodeLocalElbowCount: 7,
  genericNodeLocalElbowPrimitiveCount: 28,
  trimmedContractCount: 12,
  trimApplicationCount: 14
});
assert.deepEqual(model.audit.inputXmlNodeLocalElbowAudit.elbows.map((entry) => entry.node), ['130', '160', '170', '200', '210', '220', '250']);
assertManagedStageInputXmlBendEndpointLockAudit(model.audit.inputXmlBendEndpointLockAudit);
assert.equal(model.audit.inputXmlBendEndpointLockAudit.checkedBendCount, 7);
assert.equal(model.audit.inputXmlBendEndpointLockAudit.lockedBendCount, 0);
assert.equal(model.audit.inputXmlBendEndpointLockAudit.cappedEndpointCorrectionCount, 0);
assert.equal(primitives.filter((primitive) => primitive.kind === 'elbow').length, 0);
assert.equal(primitives.every((primitive) => primitive.kind === 'cylinder'), true, 'InputXML bend-exclusion path must emit only code-8 cylinder primitives');
assert.ok(primitives.length >= 91, 'InputXML bend-exclusion path must keep at least the original source-route, node-local elbow, branch fitting, and component-symbol primitive coverage');
assert.equal(primitives.filter((primitive) => primitive.genericInputXmlBend).length, 7);
assert.equal(primitives.filter((primitive) => primitive.inputXmlSourceRouteBend).length, 7);
assert.equal(primitives.filter((primitive) => primitive.genericInputXmlNodeLocalElbow).length, 28);
assert.equal(primitives.filter((primitive) => primitive.genericInputXmlBranchFitting).length, 15);
assert.equal(primitives.filter((primitive) => primitive.recipeTrimStartOffsetMm || primitive.recipeTrimEndOffsetMm).length, 5);
assert.equal(primitives.filter((primitive) => primitive.primitiveRole === 'inputxml-source-route-bend-cylinder').length, 7);
assert.equal(primitives.filter((primitive) => primitive.primitiveRole === 'inputxml-node-local-1p5d-elbow').length, 28);

const node170ElbowSegments = primitives.filter((primitive) => primitive.genericInputXmlNodeLocalElbow && primitive.nodeLocalElbowNode === '170');
assert.equal(node170ElbowSegments.length, 4);
const pe018Source = primitives.find((entry) => entry.sourceContractName === 'PE_018_BEND_160_TO_170' && entry.inputXmlSourceRouteBend);
const pe019Source = primitives.find((entry) => entry.sourceContractName === 'PE_019_PIPE_170_TO_180' && entry.localName === 'body');
assert.ok(pe018Source);
assert.ok(pe019Source);
assert.deepEqual(node170ElbowSegments[0].startMm, pe018Source.endMm);
assert.deepEqual(node170ElbowSegments.at(-1).endMm, pe019Source.startMm);

for (const bend of model.root.children[0].children[0].children.filter((node) => node.attributes.DTXR === 'BEND')) {
  const primitive = bend.primitives.find((entry) => entry.inputXmlSourceRouteBend);
  assert.ok(primitive, `Expected source-route primitive for ${bend.reviewName}`);
  assert.equal(primitive.primitiveRole, 'inputxml-source-route-bend-cylinder');
}

const nativeModel = buildManagedStageRvmExportModel(profile, { excludeBendsWhileProcessingInputXmlBasedJson: false });
const nativePrimitives = nativeModel.root.children[0].children[0].children.flatMap((node) => node.primitives);
assert.equal(nativeModel.audit.inputXmlBendExclusionAudit.enabled, false);
assert.equal(nativeModel.audit.inputXmlNodeLocalElbowAudit.enabled, false);
assert.equal(nativePrimitives.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.ok(nativePrimitives.filter((primitive) => primitive.kind === 'cylinder').length >= 56, 'native path must keep pipe/flange/valve/branch-fitting cylinder coverage');
assert.equal(nativePrimitives.filter((primitive) => primitive.genericInputXmlBranchFitting).length, 15);

console.log('Managed-stage InputXML BEND source-route RVM export, node-local elbows, and branch fittings passed');

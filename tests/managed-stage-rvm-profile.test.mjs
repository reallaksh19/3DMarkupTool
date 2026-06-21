import assert from 'node:assert/strict';

import { assertManagedStageRvmAuditGate } from '../src/managed-stage-rvm-audit-gate.js';
import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { auditManagedStageTopology } from '../src/managed-stage-topology-audit.js';
import { planManagedStagePrimitives } from '../src/managed-stage-rvm-primitive-planner.js';
import { buildManagedStageRvmExportModel } from '../src/managed-stage-rvm-export-model.js';
import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const source = JSON.stringify(createBmCiiManagedStageFixture());
const profile = parseManagedStageProfile(source);

assert.equal(profile.geometryRecords.length, 40);
assert.equal(profile.supportRecords.length, 12);
assert.equal(profile.inputStats.restraints, 48);

const topology = auditManagedStageTopology(profile.geometryRecords);
assert.equal(topology.zeroLength.length, 0);
assert.equal(topology.maxCenterlineGapMm, 0);
for (const node of ['30', '70', '100', '140', '150']) assert.ok(topology.branchNodes.includes(node));
for (const node of ['10', '190', '240', '310', '340']) assert.ok(topology.terminalNodes.includes(node));
assert.deepEqual(topology.dtxrHistogram, {
  FLANGE_PAIR: 2,
  PIPE: 18,
  FLANGE: 6,
  FLANGED_VALVE: 3,
  BEND: 7,
  VALVE: 3,
  UNSPECIFIED: 1
});

const rawPlanned = profile.geometryRecords.flatMap((record) => planManagedStagePrimitives(record));
assert.equal(rawPlanned.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.equal(rawPlanned.filter((primitive) => primitive.kind === 'cylinder').length, 41);
assert.equal(rawPlanned.length, 48);
assert.ok(rawPlanned.every((primitive) => primitive.kind === 'cylinder' || primitive.kind === 'elbow'));
for (const bad of ['box', 'pyramid', 'sphere', 'mesh', 'cone', 'frustum']) {
  assert.equal(rawPlanned.some((primitive) => primitive.kind === bad), false);
}

const exportModel = buildManagedStageRvmExportModel(profile);
const subgroup = exportModel.root.children[0].children[0];
const exportPrimitives = subgroup.children.flatMap((node) => node.primitives);
assert.equal(exportModel.root.reviewName, '/BM_CII');
assert.equal(exportModel.root.children[0].reviewName, '/BM_CII-CU-PI');
assert.equal(subgroup.reviewName, '/BM_CII-CU-PI-P');
assert.equal(subgroup.children.length, 40);
assert.equal(exportModel.audit.primitiveCount, 48);
assert.equal(exportModel.audit.processingConfig.excludeBendsWhileProcessingInputXmlBasedJson, true);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.code4BendsExcluded, 7);
assert.equal(exportPrimitives.filter((primitive) => primitive.kind === 'elbow').length, 0);
assert.equal(exportPrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 48);
assert.equal(exportPrimitives.filter((primitive) => primitive.genericInputXmlBend).length, 7);

const nativeBendModel = buildManagedStageRvmExportModel(profile, { excludeBendsWhileProcessingInputXmlBasedJson: false });
const nativePrimitives = nativeBendModel.root.children[0].children[0].children.flatMap((node) => node.primitives);
assert.equal(nativeBendModel.audit.inputXmlBendExclusionAudit.enabled, false);
assert.equal(nativePrimitives.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.equal(nativePrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 41);

const expectations = {
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  code4: 0,
  code8: 48,
  cntbCount: 43,
  primCount: 48
};
const result = convertManagedStageJsonToRvmAtt(source, { strictAuditExpectations: expectations });
assert.ok(result.rvm instanceof ArrayBuffer);
assert.ok(result.rvm.byteLength > 1000);
assert.ok(result.att.includes('NEW /BM_CII'));
assert.equal(result.audit.inputCounts.geometryComponents, 40);
assert.equal(result.audit.inputCounts.supportRecordsSkippedFromGeometry, 12);
assert.equal(result.audit.inputCounts.statsRestraintsMismatch, true);
assert.equal(result.audit.processingConfig.inputXmlBasedJson, true);
assert.equal(result.audit.processingConfig.excludeBendsWhileProcessingInputXmlBasedJson, true);
assert.equal(result.audit.inputXmlBendExclusionAudit.code4BendsExcluded, 7);
assert.equal(result.audit.primitiveHistogram[4] || 0, 0);
assert.equal(result.audit.primitiveHistogram[8], 48);
assert.equal(result.audit.chunkHierarchy.cntbCount, 43);
assert.equal(result.audit.chunkHierarchy.primCount, 48);
assert.equal(result.audit.chunkHierarchy.colrCount >= 5, true);
assert.equal(result.audit.torusOrientationAssumptions.length, 0);
assert.equal(result.audit.genericInputXmlBendAssumptions.length, 7);
assert.equal(result.audit.boundingExtentsMm.cntbBboxFieldsWritten, false);
assert.equal(result.audit.stitchManifest.schema, 'ManagedStageRvmStitchManifest.v1');
assert.equal(result.audit.stitchManifest.elementCount, 40);
assert.equal(result.audit.stitchManifest.exportElementNodeCount, 40);
assert.equal(result.audit.stitchManifest.primitiveCount, 48);
assert.equal(result.audit.stitchManifest.decodedPrimitiveCount, 48);
assert.equal(result.audit.stitchManifest.allElementsMapped, true);
assert.equal(result.audit.stitchManifest.elementOrderStable, true);
assert.deepEqual(result.audit.stitchManifest.primitiveCodeHistogram, { 8: 48 });
assert.equal(result.audit.stitchManifest.elements[0].inputName, 'PE_001_FLANGE_PAIR_10_TO_20');
assert.equal(result.audit.stitchManifest.elements[0].primitiveCount, 2);
assert.equal(result.audit.stitchManifest.elements[6].inputName, 'PE_007_FLANGED_VALVE_83_TO_86');
assert.equal(result.audit.stitchManifest.elements[6].primitiveCount, 3);
assert.equal(result.audit.stitchManifest.elements[13].inputName, 'PE_014_BEND_120_TO_130');
assert.deepEqual(result.audit.stitchManifest.elements[13].primitiveCodes, [8]);
assert.equal(result.audit.stitchManifest.elements[13].primitives[0].localName, 'generic-1p5d-bend');
assert.equal(result.audit.stitchManifestGate.ok, true);
assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(result.audit.managedStageStrictGate.stitchManifestPresent, true);
assert.deepEqual(result.audit.managedStageStrictGate.primitiveHistogram, { 8: 48 });
for (const bad of [2, 5, 6, 7, 11]) {
  assert.equal(result.audit.primitiveHistogram[bad] || 0, 0);
}
assert.throws(
  () => assertManagedStageRvmAuditGate({ ...result.audit, primitiveHistogram: { ...result.audit.primitiveHistogram, 2: 1 } }),
  /forbidden primitive code 2/
);
assert.throws(
  () => assertManagedStageRvmAuditGate({ ...result.audit, stitchManifest: { ...result.audit.stitchManifest, allElementsMapped: false } }),
  /stitchManifest\.allElementsMapped/
);

console.log('Managed-stage BM_CII InputXML bend-excluded cylinder RVM strict audit and stitch manifest gate passed');

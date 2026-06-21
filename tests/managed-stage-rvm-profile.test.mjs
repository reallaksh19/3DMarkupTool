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
const discipline = exportModel.root.children[0];
const subgroup = discipline.children[0];
const supportGroup = discipline.children[1];
const exportPrimitives = subgroup.children.flatMap((node) => node.primitives);
const supportPrimitives = supportGroup.children.flatMap((node) => node.primitives);
assert.equal(exportModel.root.reviewName, '/BM_CII');
assert.equal(discipline.reviewName, '/BM_CII-CU-PI');
assert.equal(subgroup.reviewName, '/BM_CII-CU-PI-P');
assert.equal(supportGroup.reviewName, '/BM_CII-CU-PI-SUPPORTS');
assert.equal(subgroup.children.length, 40);
assert.equal(supportGroup.children.length, 12);
assert.equal(exportModel.audit.primitiveCount, 116);
assert.equal(exportModel.audit.geometryPrimitiveCount, 91);
assert.equal(exportModel.audit.supportGeometryEmitted, true);
assert.equal(exportModel.audit.supportRvmPrimitiveCount, 25);
assert.equal(exportModel.audit.supportRvmExportAudit.supportRecordCount, 12);
assert.equal(exportModel.audit.supportRvmExportAudit.supportNodeCount, 12);
assert.equal(exportModel.audit.supportRvmExportAudit.supportPrimitiveCount, 25);
assert.equal(exportModel.audit.supportRvmExportAudit.connectorPrimitiveCount, 8);
assert.equal(exportModel.audit.supportRvmExportAudit.clusteredSupportRecordCount, 8);
assert.deepEqual(exportModel.audit.supportRvmExportAudit.familyHistogram, { REST: 7, GUIDE: 2, LINE_STOP: 3 });
assert.equal(exportModel.audit.processingConfig.excludeBendsWhileProcessingInputXmlBasedJson, true);
assert.equal(exportModel.audit.processingConfig.inputXmlBendTrimMaxContractFraction, 0.35);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.code4BendsExcluded, 7);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.genericCode8BendPrimitiveCount, 7);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.nodeBasedReconstructedBendCount, 0);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.chordFallbackBendCount, 0);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.sourceRouteBendCount, 7);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.trimmedContractCount, 0);
assert.equal(exportModel.audit.inputXmlBendExclusionAudit.trimApplicationCount, 0);
assert.equal(exportModel.audit.inputXmlNodeLocalElbowAudit.nodeLocalElbowCount, 7);
assert.equal(exportModel.audit.inputXmlNodeLocalElbowAudit.genericNodeLocalElbowPrimitiveCount, 28);
assert.equal(exportModel.audit.inputXmlNodeLocalElbowAudit.trimmedContractCount, 12);
assert.equal(exportModel.audit.inputXmlNodeLocalElbowAudit.trimApplicationCount, 14);
assert.equal(exportModel.audit.inputXmlBranchFittingInferenceAudit.genericBranchFittingCount, 5);
assert.equal(exportModel.audit.inputXmlBranchFittingInferenceAudit.genericBranchFittingPrimitiveCount, 15);
assert.equal(exportPrimitives.filter((primitive) => primitive.kind === 'elbow').length, 0);
assert.equal(exportPrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 91);
assert.equal(supportPrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 25);
assert.equal(supportPrimitives.filter((primitive) => primitive.managedStageSupportRvmPrimitive).length, 25);
assert.equal(supportPrimitives.filter((primitive) => primitive.supportClusterConnector).length, 8);
assert.equal(exportPrimitives.filter((primitive) => primitive.genericInputXmlBend).length, 7);
assert.equal(exportPrimitives.filter((primitive) => primitive.inputXmlSourceRouteBend).length, 7);
assert.equal(exportPrimitives.filter((primitive) => primitive.genericInputXmlNodeLocalElbow).length, 28);
assert.equal(exportPrimitives.filter((primitive) => primitive.genericInputXmlBranchFitting).length, 15);
assert.equal(exportPrimitives.filter((primitive) => primitive.recipeTrimStartOffsetMm || primitive.recipeTrimEndOffsetMm).length, 5);

const nativeBendModel = buildManagedStageRvmExportModel(profile, { excludeBendsWhileProcessingInputXmlBasedJson: false });
const nativeGeometryPrimitives = nativeBendModel.root.children[0].children[0].children.flatMap((node) => node.primitives);
const nativeSupportPrimitives = nativeBendModel.root.children[0].children[1].children.flatMap((node) => node.primitives);
assert.equal(nativeBendModel.audit.inputXmlBendExclusionAudit.enabled, false);
assert.equal(nativeBendModel.audit.inputXmlNodeLocalElbowAudit.enabled, false);
assert.equal(nativeGeometryPrimitives.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.equal(nativeGeometryPrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 56);
assert.equal(nativeSupportPrimitives.length, 25);

const expectations = {
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  supportRecordsEmittedToRvm: 12,
  supportRvmPrimitiveCount: 25,
  code4: 0,
  code8: 116,
  cntbCount: 56,
  primCount: 116
};
const result = convertManagedStageJsonToRvmAtt(source, { strictAuditExpectations: expectations });
assert.ok(result.rvm instanceof ArrayBuffer);
assert.ok(result.rvm.byteLength > 1000);
assert.ok(result.att.includes('NEW /BM_CII'));
assert.ok(result.att.includes('NEW /BM_CII-CU-PI-SUPPORTS'));
assert.ok(result.att.includes('NEW INPUTXML-35-LINESTOP'));
assert.equal(result.audit.inputCounts.geometryComponents, 40);
assert.equal(result.audit.inputCounts.supportRecordsSkippedFromGeometry, 12);
assert.equal(result.audit.inputCounts.supportRecordsEmittedToRvm, 12);
assert.equal(result.audit.inputCounts.statsRestraintsMismatch, true);
assert.equal(result.audit.processingConfig.inputXmlBasedJson, true);
assert.equal(result.audit.processingConfig.excludeBendsWhileProcessingInputXmlBasedJson, true);
assert.equal(result.audit.processingConfig.inputXmlBendTrimMaxContractFraction, 0.35);
assert.equal(result.audit.inputXmlBendExclusionAudit.code4BendsExcluded, 7);
assert.equal(result.audit.inputXmlBendExclusionAudit.genericCode8BendPrimitiveCount, 7);
assert.equal(result.audit.inputXmlBendExclusionAudit.nodeBasedReconstructedBendCount, 0);
assert.equal(result.audit.inputXmlBendExclusionAudit.chordFallbackBendCount, 0);
assert.equal(result.audit.inputXmlBendExclusionAudit.sourceRouteBendCount, 7);
assert.equal(result.audit.inputXmlBendExclusionAudit.trimmedContractCount, 0);
assert.equal(result.audit.inputXmlBendExclusionAudit.trimApplicationCount, 0);
assert.equal(result.audit.inputXmlNodeLocalElbowAudit.nodeLocalElbowCount, 7);
assert.equal(result.audit.inputXmlNodeLocalElbowAudit.genericNodeLocalElbowPrimitiveCount, 28);
assert.equal(result.audit.inputXmlNodeLocalElbowAudit.trimmedContractCount, 12);
assert.equal(result.audit.inputXmlNodeLocalElbowAudit.trimApplicationCount, 14);
assert.equal(result.audit.inputXmlBranchFittingInferenceAudit.genericBranchFittingCount, 5);
assert.equal(result.audit.inputXmlBranchFittingInferenceAudit.genericBranchFittingPrimitiveCount, 15);
assert.equal(result.audit.supportRvmExportAudit.supportRecordCount, 12);
assert.equal(result.audit.supportRvmExportAudit.supportPrimitiveCount, 25);
assert.equal(result.audit.supportRvmExportAudit.connectorPrimitiveCount, 8);
assert.equal(result.audit.supportRvmExportAudit.clusteredSupportRecordCount, 8);
assert.equal(result.audit.primitiveHistogram[4] || 0, 0);
assert.equal(result.audit.primitiveHistogram[8], 116);
assert.equal(result.audit.chunkHierarchy.cntbCount, 56);
assert.equal(result.audit.chunkHierarchy.primCount, 116);
assert.equal(result.audit.chunkHierarchy.colrCount >= 6, true);
assert.equal(result.audit.torusOrientationAssumptions.length, 0);
assert.equal(result.audit.genericInputXmlBendAssumptions.length, 7);
assert.equal(result.audit.genericInputXmlNodeLocalElbowAssumptions.length, 28);
assert.equal(result.audit.genericInputXmlBranchFittingAssumptions.length, 15);
assert.equal(result.audit.exportedSupportRecords.length, 12);
assert.equal(result.audit.exportedSupportRecords.every((record) => record.rvmExported === true), true);
assert.equal(result.audit.boundingExtentsMm.primitiveCount, 116);
assert.equal(result.audit.boundingExtentsMm.cntbBboxFieldsWritten, false);
assert.equal(result.audit.stitchManifest.schema, 'ManagedStageRvmStitchManifest.v1');
assert.equal(result.audit.stitchManifest.elementCount, 40);
assert.equal(result.audit.stitchManifest.exportElementNodeCount, 40);
assert.equal(result.audit.stitchManifest.geometryPrimitiveCount, 91);
assert.equal(result.audit.stitchManifest.supportOverlayPrimitiveCount, 25);
assert.equal(result.audit.stitchManifest.primitiveCount, 116);
assert.equal(result.audit.stitchManifest.decodedPrimitiveCount, 116);
assert.equal(result.audit.stitchManifest.allElementsMapped, true);
assert.equal(result.audit.stitchManifest.elementOrderStable, true);
assert.deepEqual(result.audit.stitchManifest.primitiveCodeHistogram, { 8: 116 });
assert.equal(result.audit.stitchManifest.elements[0].inputName, 'PE_001_FLANGE_PAIR_10_TO_20');
assert.equal(result.audit.stitchManifest.elements[0].primitiveCount, 2);
assert.equal(result.audit.stitchManifest.elements[6].inputName, 'PE_007_FLANGED_VALVE_83_TO_86');
assert.equal(result.audit.stitchManifest.elements[6].primitiveCount, 3);
assert.equal(result.audit.stitchManifest.elements[13].inputName, 'PE_014_BEND_120_TO_130');
assert.deepEqual(result.audit.stitchManifest.elements[13].primitiveCodes, [8, 8, 8, 8, 8]);
assert.equal(result.audit.stitchManifest.elements[13].primitives[0].localName, 'source-route-bend');
assert.equal(result.audit.stitchManifest.elements[13].primitives.slice(1).every((primitive) => /^node-local-elbow-130-/.test(primitive.localName)), true);
assert.equal(result.audit.stitchManifestGate.ok, true);
assert.equal(result.audit.stitchManifestGate.supportOverlayPrimitiveCount, 25);
assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(result.audit.managedStageStrictGate.supportRecordsEmittedToRvm, 12);
assert.equal(result.audit.managedStageStrictGate.supportRvmPrimitiveCount, 25);
assert.equal(result.audit.managedStageStrictGate.stitchManifestPresent, true);
assert.deepEqual(result.audit.managedStageStrictGate.primitiveHistogram, { 8: 116 });
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

console.log('Managed-stage BM_CII InputXML source-route BEND, node-local elbows, inferred branch fitting, support RVM overlay, and strict audit passed');

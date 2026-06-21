import assert from 'node:assert/strict';

import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { auditManagedStageTopology } from '../src/managed-stage-topology-audit.js';
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

const exportModel = buildManagedStageRvmExportModel(profile);
const discipline = exportModel.root.children[0];
const pipingGroup = discipline.children[0];
const supportGroup = discipline.children[1];
const geometryPrimitives = pipingGroup.children.flatMap((node) => node.primitives);
const supportPrimitives = supportGroup.children.flatMap((node) => node.primitives);

assert.equal(exportModel.root.reviewName, '/BM_CII');
assert.equal(discipline.reviewName, '/BM_CII-CU-PI');
assert.equal(pipingGroup.reviewName, '/BM_CII-CU-PI-P');
assert.equal(supportGroup.reviewName, '/BM_CII-CU-PI-SUPPORTS');
assert.equal(pipingGroup.children.length, 40);
assert.equal(supportGroup.children.length, 12);

assert.equal(geometryPrimitives.length, 91);
assert.equal(supportPrimitives.length, 25);
assert.equal(exportModel.audit.primitiveCount, 116);
assert.equal(exportModel.audit.geometryPrimitiveCount, 91);
assert.equal(exportModel.audit.supportRvmPrimitiveCount, 25);
assert.equal(exportModel.audit.supportGeometryEmitted, true);
assert.equal(supportPrimitives.every((primitive) => primitive.kind === 'cylinder'), true);
assert.equal(supportPrimitives.every((primitive) => primitive.managedStageSupportRvmPrimitive === true), true);
assert.equal(supportPrimitives.filter((primitive) => primitive.supportClusterConnector).length, 8);

const supportAudit = exportModel.audit.supportRvmExportAudit;
assert.equal(supportAudit.schema, 'ManagedStageSupportRvmExport.v1');
assert.equal(supportAudit.supportRecordCount, 12);
assert.equal(supportAudit.supportNodeCount, 12);
assert.equal(supportAudit.supportPrimitiveCount, 25);
assert.equal(supportAudit.connectorPrimitiveCount, 8);
assert.equal(supportAudit.clusteredSupportRecordCount, 8);
assert.equal(supportAudit.familyHistogram.REST, 7);
assert.equal(supportAudit.familyHistogram.GUIDE, 2);
assert.equal(supportAudit.familyHistogram.LINE_STOP, 3);

assert.equal(exportModel.audit.inputXmlBendExclusionAudit.sourceRouteBendCount, 7);
assert.equal(exportModel.audit.inputXmlNodeLocalElbowAudit.genericNodeLocalElbowPrimitiveCount, 28);
assert.equal(exportModel.audit.inputXmlBranchFittingInferenceAudit.genericBranchFittingPrimitiveCount, 15);
assert.equal(geometryPrimitives.filter((primitive) => primitive.inputXmlSourceRouteBend).length, 7);
assert.equal(geometryPrimitives.filter((primitive) => primitive.genericInputXmlNodeLocalElbow).length, 28);
assert.equal(geometryPrimitives.filter((primitive) => primitive.genericInputXmlBranchFitting).length, 15);

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
assert.ok(result.att.includes('NEW /BM_CII'));
assert.ok(result.att.includes('NEW /BM_CII-CU-PI-SUPPORTS'));
assert.ok(result.att.includes('NEW INPUTXML-35-LINESTOP'));
assert.equal(result.audit.inputCounts.geometryComponents, 40);
assert.equal(result.audit.inputCounts.supportRecordsSkippedFromGeometry, 12);
assert.equal(result.audit.inputCounts.supportRecordsEmittedToRvm, 12);
assert.equal(result.audit.supportRvmExportAudit.supportPrimitiveCount, 25);
assert.equal(result.audit.primitiveHistogram[4] || 0, 0);
assert.equal(result.audit.primitiveHistogram[8], 116);
assert.equal(result.audit.chunkHierarchy.cntbCount, 56);
assert.equal(result.audit.chunkHierarchy.primCount, 116);
assert.equal(result.audit.stitchManifest.elementCount, 40);
assert.equal(result.audit.stitchManifest.geometryPrimitiveCount, 91);
assert.equal(result.audit.stitchManifest.supportOverlayPrimitiveCount, 25);
assert.equal(result.audit.stitchManifest.primitiveCount, 116);
assert.equal(result.audit.stitchManifest.decodedPrimitiveCount, 116);
assert.equal(result.audit.stitchManifest.allElementsMapped, true);
assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(result.audit.managedStageStrictGate.supportRecordsEmittedToRvm, 12);
assert.equal(result.audit.managedStageStrictGate.supportRvmPrimitiveCount, 25);
assert.deepEqual(result.audit.managedStageStrictGate.primitiveHistogram, { 8: 116 });

console.log('Managed-stage BM_CII support RVM overlay export contract passed');

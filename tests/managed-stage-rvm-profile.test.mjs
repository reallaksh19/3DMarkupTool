import assert from 'node:assert/strict';

import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const expectations = {
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  supportRecordsEmittedToRvm: 12,
  supportRvmPrimitiveCount: 42,
  topologyComponentCount: 52,
  topologyGeometryComponentCount: 40,
  topologySupportCount: 12,
  explicitBendRecordCount: 7,
  explicitBendDetailCount: 7,
  missingExplicitBendDetailCount: 0,
  synthetic1p5DTrimBlockedCount: 7,
  supportAssociationOnlyCount: 12,
  supportTopologyBlockedCount: 0,
  supportContinuityEdgeCount: 0,
  supportInlineFaceCount: 0,
  code1: 0,
  code4: 0,
  code8: 157,
  cntbCount: 56,
  primCount: 157,
  supportMaxGlyphExtentMm: 100,
  supportMaxClusterOffsetMm: 30,
  supportMaxPrimitiveSpanMm: 60,
  supportMaxBarRadiusMm: 3
};

const result = convertManagedStageJsonToRvmAtt(JSON.stringify(createBmCiiManagedStageFixture()), {
  strictAuditExpectations: expectations
});

assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(result.audit.managedStageStrictGate.topologyProofGateOk, true);
assert.equal(result.audit.managedStageTopologyProofGate.ok, true);
assert.equal(result.audit.managedStageTopologyProofGate.topologyComponentCount, 52);
assert.equal(result.audit.managedStageTopologyProofGate.topologyGeometryComponentCount, 40);
assert.equal(result.audit.managedStageTopologyProofGate.topologySupportCount, 12);
assert.equal(result.audit.managedStageTopologyProofGate.explicitBendRecordCount, 7);
assert.equal(result.audit.managedStageTopologyProofGate.explicitBendDetailCount, 7);
assert.equal(result.audit.managedStageTopologyProofGate.missingExplicitBendDetailCount, 0);
assert.equal(result.audit.managedStageTopologyProofGate.synthetic1p5DTrimBlockedCount, 7);
assert.equal(result.audit.managedStageTopologyProofGate.supportAssociationOnlyCount, 12);
assert.equal(result.audit.managedStageTopologyProofGate.supportTopologyBlockedCount, 0);
assert.equal(result.audit.managedStageTopologyProofGate.supportContinuityEdgeCount, 0);
assert.equal(result.audit.managedStageTopologyProofGate.supportInlineFaceCount, 0);
assert.equal(result.audit.rvmPrimitivePayloadContract.schema, 'ManagedStageRvmPrimitivePayloadContract.v2');
assert.deepEqual(result.audit.rvmPrimitivePayloadContract.allowedPrimitiveCodes, [1, 4, 8]);
assert.equal(result.audit.rvmPrimitivePayloadContract.unsupportedPrimitivePayloadsPresent, false);
assert.equal(result.audit.inputCounts.geometryComponents, 40);
assert.equal(result.audit.inputCounts.supportRecordsSkippedFromGeometry, 12);
assert.equal(result.audit.inputCounts.supportRecordsEmittedToRvm, 12);
assert.equal(result.audit.supportRvmExportAudit.supportRecordCount, 12);
assert.equal(result.audit.supportRvmExportAudit.supportPrimitiveCount, 42);
assert.equal(result.audit.supportRvmExportAudit.supportConePrimitiveCount, 0);
assert.equal(result.audit.supportRvmExportAudit.supportDirectionalGlyphPrimitiveCount, 34);
assert.equal(result.audit.supportRvmExportAudit.supportBarPrimitiveCount, 42);
assert.deepEqual(result.audit.supportRvmExportAudit.supportPrimitiveCodeHistogram, { 8: 42 });
assert.deepEqual(result.audit.supportRvmExportAudit.supportAllowedPrimitiveCodes, [8]);
assert.deepEqual(result.audit.supportRvmExportAudit.supportForbiddenPrimitiveCodesPresent, []);
assert.equal(result.audit.primitiveHistogram[1] || 0, 0);
assert.equal(result.audit.primitiveHistogram[4] || 0, 0);
assert.equal(result.audit.primitiveHistogram[8], 157);
assert.equal(result.audit.chunkHierarchy.cntbCount, 56);
assert.equal(result.audit.chunkHierarchy.primCount, 157);
assert.equal(result.audit.stitchManifest.geometryPrimitiveCount, 115);
assert.equal(result.audit.stitchManifest.supportOverlayPrimitiveCount, 42);
assert.equal(result.audit.stitchManifest.primitiveCount, 157);
assert.equal(result.audit.stitchManifest.decodedPrimitiveCount, 157);
assert.equal(sumValues(result.audit.supportRvmExportAudit.supportFamilies), 12);
assert.ok(result.audit.supportRvmExportAudit.supportMaxGlyphExtentMm <= 100);
assert.ok(result.audit.supportRvmExportAudit.supportMaxClusterOffsetMm <= 30);
assert.ok(result.audit.supportRvmExportAudit.supportMaxPrimitiveSpanMm <= 60);
assert.ok(result.audit.supportRvmExportAudit.supportMaxBarRadiusMm <= 3);
assert.ok(result.att.includes('NEW /BM_CII-CU-PI-SUPPORTS'));
assert.ok(result.att.includes('NEW INPUTXML-35-LINESTOP'));
assert.ok(result.att.includes("BEND_SOURCE_TRUTH := 'EXPLICIT_STAGEDJSON_BEND'"));
assert.ok(result.att.includes("BEND_CENTERLINE_KIND := 'arc'"));
assert.ok(result.att.includes("BEND_RADIUS_SOURCE := 'stagedJson.BEND_RADIUS'"));
assert.ok(result.att.includes("BEND_ANGLE_SOURCE := 'stagedJson.BEND_ANGLE'"));
assert.ok(result.att.includes("BEND_SOURCE := 'stagedJson.BEND_RADIUS+BEND_ANGLE'"));
assert.ok(result.att.includes("SYNTHETIC_1P5D_BEND_TRIM_BLOCKED := 'YES'"));
assert.ok(result.att.includes("SYNTHETIC_1P5D_BEND_TRIM_ALLOWED := 'NO'"));
assert.equal(countOccurrences(result.att, "BEND_SOURCE_TRUTH := 'EXPLICIT_STAGEDJSON_BEND'"), 7);
assert.equal(countOccurrences(result.att, "BEND_RADIUS_SOURCE := 'stagedJson.BEND_RADIUS'"), 7);
assert.equal(countOccurrences(result.att, "BEND_ANGLE_SOURCE := 'stagedJson.BEND_ANGLE'"), 7);
assert.equal(countOccurrences(result.att, "SYNTHETIC_1P5D_BEND_TRIM_BLOCKED := 'YES'"), 7);
assert.ok(result.att.includes("SUPPORT_TOPOLOGY_GATE := 'ok'"));
assert.ok(result.att.includes("SUPPORT_TOPOLOGY_ASSOCIATION_ONLY := 'TRUE'"));
assert.ok(result.att.includes("SUPPORT_CONTINUITY_EDGE_BLOCKED := 'TRUE'"));
assert.ok(result.att.includes("SUPPORT_INLINE_FACE_BLOCKED := 'TRUE'"));
assert.equal(countOccurrences(result.att, "SUPPORT_TOPOLOGY_GATE := 'ok'"), 12);
assert.equal(countOccurrences(result.att, "SUPPORT_TOPOLOGY_ASSOCIATION_ONLY := 'TRUE'"), 12);
assert.equal(countOccurrences(result.att, "SUPPORT_CONTINUITY_EDGE_BLOCKED := 'TRUE'"), 12);
assert.equal(countOccurrences(result.att, "SUPPORT_INLINE_FACE_BLOCKED := 'TRUE'"), 12);

const componentAudit = result.exportModel.audit.componentPrimitiveSymbolExportAudit;
assert.equal(componentAudit.schema, 'ManagedStageComponentPrimitiveRvmExport.v1');
assert.ok(componentAudit.flangeNodeCount >= 8, 'BM_CII fixture must export flange/flange-pair primitive nodes');
assert.equal(componentAudit.valveNodeCount, 6);
assert.equal(componentAudit.supportNodeCount, 12);
assert.equal(componentAudit.supportPrimitiveCount, 42);
assert.equal(componentAudit.supportTopologyGatePass, true);
assert.equal(componentAudit.supportAssociationOnlyCount, 12);
assert.equal(componentAudit.supportContinuityEdgeCount, 0);
assert.ok(componentAudit.weldNeckFlangePrimitiveCount >= 12, 'BM_CII fixture must export weld-neck flange primitive bodies');
assert.equal(componentAudit.ballValvePrimitiveCount, 30);
assert.ok(componentAudit.recipeHistogram['weldneck-flange-contiguous-2part'] >= 6);
assert.equal(componentAudit.recipeHistogram['flanged-ball-valve-contiguous-5part'], 3);
assert.equal(componentAudit.recipeHistogram['ball-valve-contiguous-5part'], 3);
assert.ok(result.att.includes("RVM_COMPONENT_SYMBOL_EXPORTED := 'YES'"));
assert.ok(result.att.includes("RVM_COMPONENT_PRIMITIVE_RECIPE := 'weldneck-flange-contiguous-2part'"));
assert.ok(result.att.includes("RVM_COMPONENT_PRIMITIVE_RECIPE := 'flanged-ball-valve-contiguous-5part'"));

const supportNodes = result.exportModel.audit.supportRvmExportAudit.nodes;
const supportPrimitives = supportNodes.flatMap((node) => node.primitives.map((primitive) => ({ node, primitive })));
const supportCones = supportPrimitives.filter(({ primitive }) => primitive.supportPointCone === true);
const supportBars = supportPrimitives.filter(({ primitive }) => primitive.supportBar === true);
const supportStemBars = supportPrimitives.filter(({ primitive }) => primitive.supportGlyphStemBar === true);
const supportTipTicks = supportPrimitives.filter(({ primitive }) => primitive.supportGlyphTipTick === true);
assert.equal(supportCones.length, 0);
assert.equal(supportBars.length, 42);
assert.equal(supportStemBars.length, 17);
assert.equal(supportTipTicks.length, 17);
assert.ok(supportBars.every(({ primitive }) => primitive.kind === 'cylinder'));
assert.ok(supportBars.every(({ primitive }) => primitive.radius <= 3));
assert.ok(supportBars.every(({ primitive }) => primitive.length <= 60));
assert.ok(supportPrimitives.every(({ primitive }) => primitive.kind !== 'pyramid'));
assert.ok(supportPrimitives.every(({ primitive }) => primitive.supportPrimitiveCode === 8));
assert.ok(supportPrimitives.every(({ primitive }) => primitive.supportTopologyGate === 'ok'));
assert.ok(supportPrimitives.every(({ primitive }) => primitive.supportTopologyAssociationOnly === true));
assert.ok(supportPrimitives.every(({ primitive }) => primitive.supportContinuityEdgeBlocked === true));
assert.ok(supportPrimitives.filter(({ primitive }) => primitive.supportConeFanBlocked === true).length >= 34);

for (const { node, primitive } of supportPrimitives) {
  assert.ok(maxEndpointDistance(primitive, node.position) <= 100, `${primitive.name} exceeds compact support envelope`);
  if (primitive.supportClusterConnector) {
    assert.ok(primitive.length <= 30, `${primitive.name} exceeds compact cluster connector envelope`);
  }
}

console.log('Managed-stage BM_CII support, flange, valve, topology proof, and ATT parity RVM export gate passed');

function maxEndpointDistance(primitive, center) {
  return Math.max(distance(primitive.startMm, center), distance(primitive.endMm, center));
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function countOccurrences(text, needle) {
  return String(text).split(needle).length - 1;
}

function sumValues(values = {}) {
  return Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0);
}

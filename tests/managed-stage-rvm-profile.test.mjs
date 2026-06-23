import assert from 'node:assert/strict';

import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const expectations = {
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  supportRecordsEmittedToRvm: 12,
  supportRvmPrimitiveCount: 42,
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

const componentAudit = result.exportModel.audit.componentPrimitiveSymbolExportAudit;
assert.equal(componentAudit.schema, 'ManagedStageComponentPrimitiveRvmExport.v1');
assert.equal(componentAudit.flangeNodeCount, 8);
assert.equal(componentAudit.valveNodeCount, 6);
assert.equal(componentAudit.supportNodeCount, 12);
assert.equal(componentAudit.supportPrimitiveCount, 42);
assert.equal(componentAudit.weldNeckFlangePrimitiveCount, 12);
assert.equal(componentAudit.ballValvePrimitiveCount, 30);
assert.equal(componentAudit.recipeHistogram['weldneck-flange-contiguous-2part'], 6);
assert.equal(componentAudit.recipeHistogram['flanged-ball-valve-contiguous-5part'], 3);
assert.equal(componentAudit.recipeHistogram['ball-valve-contiguous-5part'], 3);
assert.ok(result.att.includes('RVM_COMPONENT_SYMBOL_EXPORTED\tYES'));
assert.ok(result.att.includes('RVM_COMPONENT_PRIMITIVE_RECIPE\tweldneck-flange-contiguous-2part'));
assert.ok(result.att.includes('RVM_COMPONENT_PRIMITIVE_RECIPE\tflanged-ball-valve-contiguous-5part'));

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
assert.ok(supportPrimitives.filter(({ primitive }) => primitive.supportConeFanBlocked === true).length >= 34);

for (const { node, primitive } of supportPrimitives) {
  assert.ok(maxEndpointDistance(primitive, node.position) <= 100, `${primitive.name} exceeds compact support envelope`);
  if (primitive.supportClusterConnector) {
    assert.ok(primitive.length <= 30, `${primitive.name} exceeds compact cluster connector envelope`);
  }
}

console.log('Managed-stage BM_CII support, flange, and valve RVM export gate passed');

function maxEndpointDistance(primitive, center) {
  return Math.max(distance(primitive.startMm, center), distance(primitive.endMm, center));
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function sumValues(values = {}) {
  return Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0);
}

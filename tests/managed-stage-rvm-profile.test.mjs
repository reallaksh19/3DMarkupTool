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
  code8: 133,
  cntbCount: 56,
  primCount: 133
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
assert.equal(result.audit.primitiveHistogram[1] || 0, 0);
assert.equal(result.audit.primitiveHistogram[4] || 0, 0);
assert.equal(result.audit.primitiveHistogram[8], 133);
assert.equal(result.audit.chunkHierarchy.cntbCount, 56);
assert.equal(result.audit.chunkHierarchy.primCount, 133);
assert.equal(result.audit.stitchManifest.geometryPrimitiveCount, 91);
assert.equal(result.audit.stitchManifest.supportOverlayPrimitiveCount, 42);
assert.equal(result.audit.stitchManifest.primitiveCount, 133);
assert.equal(result.audit.stitchManifest.decodedPrimitiveCount, 133);
assert.ok(result.att.includes('NEW /BM_CII-CU-PI-SUPPORTS'));
assert.ok(result.att.includes('NEW INPUTXML-35-LINESTOP'));

const supportPrimitives = result.exportModel.audit.supportRvmExportAudit.nodes.flatMap((node) => node.primitives);
const supportCones = supportPrimitives.filter((primitive) => primitive.supportPointCone === true);
const supportBars = supportPrimitives.filter((primitive) => primitive.supportBar === true);
const supportStemBars = supportPrimitives.filter((primitive) => primitive.supportGlyphStemBar === true);
const supportTipTicks = supportPrimitives.filter((primitive) => primitive.supportGlyphTipTick === true);
assert.equal(supportCones.length, 0);
assert.equal(supportBars.length, 42);
assert.equal(supportStemBars.length, 17);
assert.equal(supportTipTicks.length, 17);
assert.ok(supportBars.every((primitive) => primitive.kind === 'cylinder'));
assert.ok(supportBars.every((primitive) => primitive.radius <= 4.5));
assert.ok(supportPrimitives.every((primitive) => primitive.kind !== 'pyramid'));
assert.ok(supportPrimitives.filter((primitive) => primitive.supportConeFanBlocked === true).length >= 34);

console.log('Managed-stage BM_CII support RVM single/tick bar export gate passed');

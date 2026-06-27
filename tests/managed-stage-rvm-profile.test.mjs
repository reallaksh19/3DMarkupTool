import assert from 'node:assert/strict';

import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const result = convertManagedStageJsonToRvmAtt(JSON.stringify(createBmCiiManagedStageFixture()), {
  strictAuditExpectations: {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12,
    supportRvmPrimitiveCount: 42,
    code1: 0,
    code4: 0,
    code7: 6,
    code8: 145,
    code9: 6,
    cntbCount: 56,
    primCount: 157
  }
});

assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(result.audit.managedStageTopologyProofGate.ok, true);
assert.equal(result.audit.rvmPrimitivePayloadContract.schema, 'ManagedStageRvmPrimitivePayloadContract.v3');
assert.deepEqual(result.audit.rvmPrimitivePayloadContract.allowedPrimitiveCodes, [1, 4, 7, 8, 9]);
assert.deepEqual(result.audit.primitiveHistogram, { 7: 6, 8: 145, 9: 6 });
assert.equal(result.audit.chunkHierarchy.cntbCount, 56);
assert.equal(result.audit.chunkHierarchy.primCount, 157);
assert.equal(result.audit.stitchManifest.geometryPrimitiveCount, 115);
assert.equal(result.audit.stitchManifest.supportOverlayPrimitiveCount, 42);
assert.equal(result.audit.stitchManifest.primitiveCodeHistogram[7], 6);
assert.equal(result.audit.stitchManifest.primitiveCodeHistogram[8], 145);
assert.equal(result.audit.stitchManifest.primitiveCodeHistogram[9], 6);
assert.deepEqual(result.audit.supportRvmExportAudit.supportPrimitiveCodeHistogram, { 8: 42 });

const componentAudit = result.exportModel.audit.componentPrimitiveSymbolExportAudit;
assert.equal(componentAudit.schema, 'ManagedStageComponentPrimitiveRvmExport.v1');
assert.ok(componentAudit.flangeNodeCount >= 8);
assert.equal(componentAudit.valveNodeCount, 6);
assert.equal(componentAudit.supportPrimitiveCount, 42);
assert.ok(componentAudit.weldNeckFlangePrimitiveCount >= 12);
assert.equal(componentAudit.ballValvePrimitiveCount, 30);

const geometryPrimitives = result.audit.stitchManifest.elements.flatMap((element) => element.primitives);
assert.equal(geometryPrimitives.filter((primitive) => primitive.kind === 'snout').length, 6);
assert.equal(geometryPrimitives.filter((primitive) => primitive.kind === 'sphere').length, 6);
assert.equal(geometryPrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 103);
assert.equal(result.audit.stitchManifest.supportOverlayPrimitives.every((primitive) => primitive.kind === 'cylinder'), true);

console.log('Managed-stage BM_CII RVM export emits flange snouts and valve spheres while keeping supports code-8 only');

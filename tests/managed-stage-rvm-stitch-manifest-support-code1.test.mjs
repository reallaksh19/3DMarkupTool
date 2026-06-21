import assert from 'node:assert/strict';

import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const result = convertManagedStageJsonToRvmAtt(JSON.stringify(createBmCiiManagedStageFixture()), {
  strictAuditExpectations: {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12,
    supportRvmPrimitiveCount: 25,
    code1: 17,
    code4: 0,
    code8: 99,
    cntbCount: 56,
    primCount: 116
  }
});

const manifest = result.audit.stitchManifest;
assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(manifest.supportOverlayPrimitiveCount, 25);
assert.deepEqual(manifest.supportOverlayAllowedPrimitiveCodes, [1, 8]);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.emittedCode === 1).length, 17);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.emittedCode === 8).length, 8);
assert.ok(manifest.supportOverlayPrimitives.every((primitive) => primitive.expectedCode === primitive.emittedCode));
assert.deepEqual(result.audit.primitiveHistogram, { 1: 17, 8: 99 });

console.log('managed-stage stitch manifest accepts support cone code-1 primitives and support bar code-8 primitives');

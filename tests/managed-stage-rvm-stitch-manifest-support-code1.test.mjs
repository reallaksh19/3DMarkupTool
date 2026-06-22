import assert from 'node:assert/strict';

import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const result = convertManagedStageJsonToRvmAtt(JSON.stringify(createBmCiiManagedStageFixture()), {
  strictAuditExpectations: {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12,
    supportRvmPrimitiveCount: 76,
    code1: 0,
    code4: 0,
    code8: 167,
    cntbCount: 56,
    primCount: 167
  }
});

const manifest = result.audit.stitchManifest;
assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(manifest.supportOverlayPrimitiveCount, 76);
assert.deepEqual(manifest.supportOverlayAllowedPrimitiveCodes, [8]);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.emittedCode === 1).length, 0);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.kind === 'pyramid').length, 0);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.emittedCode === 8).length, 76);
assert.ok(manifest.supportOverlayPrimitives.every((primitive) => primitive.expectedCode === primitive.emittedCode));
assert.deepEqual(result.audit.primitiveHistogram, { 8: 167 });
assert.equal(result.audit.supportRvmExportAudit.supportConePrimitiveCount, 0);
assert.equal(result.audit.supportRvmExportAudit.supportDirectionalGlyphPrimitiveCount, 68);
assert.match(result.audit.supportRvmExportAudit.policy, /code-8 cylinder bar glyphs only/);

console.log('managed-stage stitch manifest blocks support code-1 pyramids and emits support arrows as code-8 bar glyphs');

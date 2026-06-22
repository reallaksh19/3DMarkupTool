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
    code8: 133,
    cntbCount: 56,
    primCount: 133,
    supportMaxGlyphExtentMm: 100,
    supportMaxClusterOffsetMm: 30,
    supportMaxPrimitiveSpanMm: 60,
    supportMaxBarRadiusMm: 3
  }
});

const manifest = result.audit.stitchManifest;
assert.equal(result.audit.managedStageStrictGate.ok, true);
assert.equal(manifest.supportOverlayPrimitiveCount, 42);
assert.deepEqual(manifest.supportOverlayAllowedPrimitiveCodes, [8]);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.emittedCode === 1).length, 0);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.kind === 'pyramid').length, 0);
assert.equal(manifest.supportOverlayPrimitives.filter((primitive) => primitive.emittedCode === 8).length, 42);
assert.ok(manifest.supportOverlayPrimitives.every((primitive) => primitive.expectedCode === primitive.emittedCode));
assert.deepEqual(result.audit.primitiveHistogram, { 8: 133 });
assert.deepEqual(result.audit.supportRvmExportAudit.supportPrimitiveCodeHistogram, { 8: 42 });
assert.deepEqual(result.audit.supportRvmExportAudit.supportForbiddenPrimitiveCodesPresent, []);
assert.equal(result.audit.supportRvmExportAudit.supportConePrimitiveCount, 0);
assert.equal(result.audit.supportRvmExportAudit.supportDirectionalGlyphPrimitiveCount, 34);
assert.match(result.audit.supportRvmExportAudit.policy, /code-8 cylinder bar glyphs only/);
assert.ok(result.audit.supportRvmExportAudit.supportMaxGlyphExtentMm <= 100);
assert.ok(result.audit.supportRvmExportAudit.supportMaxClusterOffsetMm <= 30);
assert.ok(result.audit.supportRvmExportAudit.supportMaxPrimitiveSpanMm <= 60);
assert.ok(result.audit.supportRvmExportAudit.supportMaxBarRadiusMm <= 3);

const supportPrimitives = result.exportModel.audit.supportRvmExportAudit.nodes.flatMap((node) => node.primitives);
assert.equal(supportPrimitives.filter((primitive) => primitive.supportConeFanBlocked === true).length, 34);
assert.equal(supportPrimitives.filter((primitive) => primitive.supportGlyphStemBar === true).length, 17);
assert.equal(supportPrimitives.filter((primitive) => primitive.supportGlyphTipTick === true).length, 17);
assert.ok(supportPrimitives.every((primitive) => primitive.kind === 'cylinder'));
assert.ok(supportPrimitives.every((primitive) => primitive.supportPointCone === false));
assert.ok(supportPrimitives.every((primitive) => primitive.supportPrimitiveCode === 8));

console.log('managed-stage stitch manifest emits support overlays as compact code-8 bars only');

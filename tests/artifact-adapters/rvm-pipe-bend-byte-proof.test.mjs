import assert from 'node:assert/strict';
import { scanRvmPrimitivePayloads } from '../../src/rvm-primitive-payload-decoder.js';
import { writeRvmTorusCode4TestBytes } from '../../src/artifact-adapters/rvm-code4-torus-test-byte-writer.js';

const model = { schema: 'RvmExportModel.v1', graphId: 'small-pipe-bend', units: 'mm', sourceAxisBasis: { authoring: 'authoring' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: [{ exportPrimitiveId: 'RVM-CYL-1', sourcePrimitiveId: 'PRIM-CYL-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0,0,0], axis: [0,0,1], lengthMm: 1000, radiusMm: 57.15, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'PIPE-1' }], testByteEligiblePrimitives: [{ exportPrimitiveId: 'RVM-TORUS-1', sourcePrimitiveId: 'PRIM-TORUS-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [100,0,0], normal: [0,0,1], startTangent: [1,0,0], endTangent: [0,1,0], majorRadiusMm: 152.4, tubeRadiusMm: 57.15, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', sourceRef: 'BEND-1', evidence: { centerSource: 'explicit-bend-arc-center' } }], blockedExports: [], deferredExports: [], sourceRefs: [] };
const result = writeRvmTorusCode4TestBytes(model, { mode: 'testOnly' });
const decoded = scanRvmPrimitivePayloads(result.data);
assert.equal(decoded.length, 2);
assert.equal(decoded.filter((entry) => entry.code === 8).length, 1);
assert.equal(decoded.filter((entry) => entry.code === 4).length, 1);
assert.equal(decoded.filter((entry) => [1,2,9].includes(entry.code)).length, 0);
assert.equal(result.metadata.primitiveCount, 2);
assert.equal(result.metadata.cylinderCount, 1);
assert.equal(result.metadata.torusCount, 1);

console.log('RVM pipe bend byte proof test passed');

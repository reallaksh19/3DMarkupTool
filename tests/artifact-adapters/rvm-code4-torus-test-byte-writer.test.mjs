import assert from 'node:assert/strict';
import { scanRvmPrimitivePayloads } from '../../src/rvm-primitive-payload-decoder.js';
import { validateRvmTorusCode4TestInput, writeRvmTorusCode4TestBytes } from '../../src/artifact-adapters/rvm-code4-torus-test-byte-writer.js';

const base = exportModel([torus()]);
assert.equal(validateRvmTorusCode4TestInput(base, { mode: 'testOnly' }).ok, true);
const result = writeRvmTorusCode4TestBytes(base, { mode: 'testOnly' });
assert.ok(result.data.byteLength > 0);
assert.match(result.metadata.checksumSha256, /^[0-9a-f]{64}$/);
const decoded = scanRvmPrimitivePayloads(result.data);
assert.equal(decoded.length, 1);
assert.equal(decoded[0].code, 4);
assert.equal(decoded[0].bodyLength, 92);
assert.equal(decoded[0].payloadWordCount, 3);
assert.equal(Number.isFinite(decoded[0].payloadSemantics.bendRadius), true);
assert.equal(Number.isFinite(decoded[0].payloadSemantics.tubeRadius), true);
assert.equal(Number.isFinite(decoded[0].payloadSemantics.sweepAngleRad), true);
assert.equal(JSON.stringify(result).includes('objectUrl'), false);
assert.equal(JSON.stringify(result).includes('downloadUrl'), false);

for (const [label, mutate] of [
  ['missing transform', (m) => { m.transformPolicy = 'bad'; }],
  ['transformApplied false', (m) => { m.transformApplied = false; }],
  ['basis not navis', (m) => { m.testByteEligiblePrimitives[0].basis = 'authoring'; }],
  ['missing normal', (m) => { delete m.testByteEligiblePrimitives[0].normal; }],
  ['non unit tangent', (m) => { m.testByteEligiblePrimitives[0].startTangent = [2,0,0]; }],
  ['zero radius', (m) => { m.testByteEligiblePrimitives[0].tubeRadiusMm = 0; }],
  ['zero angle', (m) => { m.testByteEligiblePrimitives[0].sweepAngleDeg = 0; }],
  ['chord midpoint evidence', (m) => { m.testByteEligiblePrimitives[0].evidence = { centerSource: 'inputxml-chord-midpoint-not-arc-center' }; }],
  ['unsupported kind', (m) => { m.testByteEligiblePrimitives[0].primitiveKind = 'BOX'; }]
]) {
  const model = structuredClone(base);
  mutate(model);
  assert.equal(validateRvmTorusCode4TestInput(model, { mode: 'testOnly' }).ok, false, label);
}
assert.equal(validateRvmTorusCode4TestInput(base, { mode: 'production' }).ok, false, 'production mode rejected');
assert.equal(validateRvmTorusCode4TestInput(base, { mode: 'testOnly', browser: true }).ok, false, 'browser invocation rejected');

console.log('RVM code4 TORUS test byte writer tests passed');

function exportModel(testPrimitives) { return { schema: 'RvmExportModel.v1', graphId: 'small-torus', units: 'mm', sourceAxisBasis: { authoring: 'authoring' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: [], testByteEligiblePrimitives: testPrimitives, blockedExports: [], deferredExports: [], sourceRefs: [] }; }
function torus() { return { exportPrimitiveId: 'RVM-TORUS-1', sourcePrimitiveId: 'PRIM-TORUS-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [0,0,0], normal: [0,0,1], startTangent: [1,0,0], endTangent: [0,1,0], majorRadiusMm: 152.4, tubeRadiusMm: 57.15, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', catalogueItemId: 'elbow-test', catalogueRef: { catalogue: 'base-piping' }, sourceRef: 'BEND-1', evidence: { centerSource: 'explicit-bend-arc-center' } }; }

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scanRvmPrimitivePayloads } from '../../src/rvm-primitive-payload-decoder.js';
import { validateRvmFlangeCylinderTestInput, writeRvmFlangeCylinderTestBytes } from '../../src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js';

const base = exportModel([flange()]);
assert.equal(validateRvmFlangeCylinderTestInput(base, { mode: 'testOnly' }).ok, true);
const first = writeRvmFlangeCylinderTestBytes(base, { mode: 'testOnly' });
const second = writeRvmFlangeCylinderTestBytes(base, { mode: 'testOnly' });
assert.ok(first.data instanceof ArrayBuffer);
assert.ok(first.data.byteLength > 0);
assert.match(first.metadata.checksumSha256, /^[0-9a-f]{64}$/);
assert.equal(first.metadata.checksumSha256, second.metadata.checksumSha256, 'checksum is deterministic');
assert.equal(first.metadata.sourceTrace[0].family, 'flange');
assert.equal(first.metadata.sourceTrace[0].primitiveKind, 'FLANGE_CYLINDER');
const decoded = scanRvmPrimitivePayloads(first.data);
assert.equal(decoded.length, 1);
assert.equal(decoded[0].code, 8);
assert.equal(first.metadata.flangeCylinderCount, 1);
assert.equal(first.metadata.pipeCylinderCount, 0);
assert.equal(first.metadata.torusCount, 0);
assert.equal(JSON.stringify(first).includes('objectUrl'), false);
assert.equal(JSON.stringify(first).includes('downloadUrl'), false);

for (const [label, mutate] of [
  ['missing catalogue id', (m) => { delete m.flangeTestByteEligiblePrimitives[0].catalogueItemId; }],
  ['missing catalogue ref', (m) => { delete m.flangeTestByteEligiblePrimitives[0].catalogueRef; }],
  ['missing transform policy', (m) => { m.transformPolicy = 'bad'; }],
  ['transformApplied false', (m) => { m.transformApplied = false; }],
  ['basis not review', (m) => { m.flangeTestByteEligiblePrimitives[0].basis = 'authoring'; }],
  ['non unit axis', (m) => { m.flangeTestByteEligiblePrimitives[0].axis = [2, 0, 0]; }],
  ['fallback evidence', (m) => { m.flangeTestByteEligiblePrimitives[0].evidence = { fallbackUsed: true }; }],
  ['pipe cylinder rejected', (m) => { m.flangeTestByteEligiblePrimitives[0].primitiveKind = 'CYLINDER'; }],
  ['torus rejected', (m) => { m.flangeTestByteEligiblePrimitives[0].primitiveKind = 'TORUS'; m.flangeTestByteEligiblePrimitives[0].primitiveCode = 4; }],
  ['support rejected', (m) => { m.flangeTestByteEligiblePrimitives[0].family = 'support'; }],
  ['valve rejected', (m) => { m.flangeTestByteEligiblePrimitives[0].family = 'valve'; }],
  ['outer <= bore rejected', (m) => { m.flangeTestByteEligiblePrimitives[0].outerRadiusMm = m.flangeTestByteEligiblePrimitives[0].boreRadiusMm; }],
  ['production mode rejected', (_m, opts) => { opts.mode = 'production'; }],
  ['browser mode rejected', (_m, opts) => { opts.browser = true; }]
]) {
  const model = structuredClone(base);
  const opts = { mode: 'testOnly' };
  mutate(model, opts);
  assert.equal(validateRvmFlangeCylinderTestInput(model, opts).ok, false, label);
}

for (const sourcePath of ['src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js']) {
  const source = await readFile(sourcePath, 'utf8');
  assert.equal(source.includes("from 'three'"), false);
  assert.equal(source.includes('src/app'), false);
  assert.equal(source.includes('createObjectURL'), false);
}

console.log('RVM flange cylinder test byte writer tests passed');

function exportModel(flanges) { return { schema: 'RvmExportModel.v1', graphId: 'small-flange', units: 'mm', sourceAxisBasis: { authoring: 'authoring' }, exportAxisBasis: { review: 'navis-review' }, transformPolicy: 'final-review-transform.v1', transformApplied: true, transformWarnings: [], primitives: [], testByteEligiblePrimitives: [], flangeTestByteEligiblePrimitives: flanges, blockedExports: [], deferredExports: [], sourceRefs: [] }; }
function flange() { return { exportPrimitiveId: 'RVM-FLANGE-1', sourcePrimitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', family: 'flange', type: 'weld-neck', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [0, 0, 1], lengthMm: 52, boreRadiusMm: 57.15, outerRadiusMm: 114.3, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only-phase-11c-b', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', catalogueItemId: 'flange-test', catalogueRef: { catalogue: 'base-piping', itemId: 'flange-test' }, sourceRef: 'FLANGE-1', evidence: { placementSource: 'explicit-inline-frame', fallbackUsed: false } }; }

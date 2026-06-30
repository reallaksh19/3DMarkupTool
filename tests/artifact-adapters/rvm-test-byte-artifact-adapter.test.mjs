import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertRvmTestArtifactByteProofContract,
  validateRvmTestArtifactByteProofContract
} from '../../src/contracts/index.js';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import {
  buildRvmTestArtifactByteProof,
  buildRvmTestArtifactByteProofAudit
} from '../../src/artifact-adapters/rvm-test-byte-artifact-adapter.js';

const exportModels = await readJson('samples/artifact-adapters/rvm-byte-proof.input.export-models.json');
const exportAudit = await readJson('samples/artifact-adapters/rvm-byte-proof.input.export-audit.json');
const writerAdapterPlan = await readJson('samples/artifact-adapters/rvm-byte-proof.input.writer-adapter-plan.json');
const writerAdapterAudit = await readJson('samples/artifact-adapters/rvm-byte-proof.input.writer-adapter-audit.json');
const testArtifactPlan = await readJson('samples/artifact-adapters/rvm-byte-proof.input.test-artifact-plan.json');
const testArtifactAudit = await readJson('samples/artifact-adapters/rvm-byte-proof.input.test-artifact-audit.json');
const expectedProof = await readJson('samples/artifact-adapters/rvm-byte-proof.expected.proof.json');
const expectedAudit = await readJson('samples/artifact-adapters/rvm-byte-proof.expected.audit.json');

const proof = buildRvmTestArtifactByteProof(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
assert.equal(proof.artifactReady, true, 'straight-pipe subset byte proof is ready');
assert.equal(proof.artifactGenerated, true, 'RVM bytes are generated in memory');
assert.equal(proof.artifactBlocked, false, 'byte proof itself is not blocked');
assert.ok(proof.artifactByteLength > 0, 'byte length is positive');
assert.match(proof.checksumSha256, /^[0-9a-f]{64}$/, 'checksum is present');
assert.match(proof.byteHeaderHex, /^[0-9a-f]+$/, 'header hex is present');
assert.equal(proof.primitiveCount, 1, 'one primitive written');
assert.equal(proof.cylinderPrimitiveCount, 1, 'one cylinder written');
assert.equal(proof.torusPrimitiveCount, 0, 'no torus written');
assert.equal(proof.boxPrimitiveCount, 0, 'no box written');
assert.equal(proof.spherePrimitiveCount, 0, 'no sphere written');
assert.equal(proof.pyramidPrimitiveCount, 0, 'no pyramid written');
assert.equal(proof.blockedArtifactItems.filter((entry) => entry.family === 'valve').length, 1, 'blocked valve remains blocked');
assert.equal(proof.deferredArtifactItems.filter((entry) => entry.family === 'support').length, 1, 'deferred support remains deferred');
assert.equal(JSON.stringify(proof).includes('attText'), false, 'no ATT payload');
assert.equal(JSON.stringify(proof).includes('glbBytes'), false, 'no GLB payload');
assert.equal(JSON.stringify(proof).includes('objectUrl'), false, 'no object URL');
assert.equal(JSON.stringify(proof).includes('downloadUrl'), false, 'no download URL');
assert.equal(assertRvmTestArtifactByteProofContract(proof).ok, true, 'generated proof validates');
assert.deepEqual(normalizeProof(proof), expectedProof, 'normalized proof matches golden fixture');

for (const forbidden of ['objectUrl', 'downloadUrl', 'domNode', 'canvas', 'threeObject', 'threeGeometry', 'meshGeometry', 'runtimeMutation', 'userVisibleDownload', 'productionWrite', 'appStateMutation', 'cacheKeyMutation', 'attText', 'glbBytes', 'gltfJson', 'fileBlob']) {
  const bad = structuredClone(proof);
  bad.blockedArtifactItems[0][forbidden] = forbidden;
  const result = validateRvmTestArtifactByteProofContract(bad);
  assert.equal(result.ok, false, `contract rejects ${forbidden}`);
  assert.ok(result.errors.some((entry) => entry.includes(forbidden)), `error list mentions ${forbidden}`);
}

const noFinalPolicyModels = structuredClone(exportModels);
noFinalPolicyModels.rvmExportModel.transformPolicy = 'phase7-authoring-to-navis-review.identity-placeholder.v1';
const noFinalPolicyProof = buildRvmTestArtifactByteProof(noFinalPolicyModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
assert.equal(noFinalPolicyProof.artifactGenerated, false, 'adapter refuses missing final policy');
assert.ok(noFinalPolicyProof.errors.some((entry) => entry.includes('final-review-transform.v1')));

const noTransformModels = structuredClone(exportModels);
noTransformModels.rvmExportModel.transformApplied = false;
const noTransformProof = buildRvmTestArtifactByteProof(noTransformModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
assert.equal(noTransformProof.artifactGenerated, false, 'adapter refuses transformApplied false');
assert.ok(noTransformProof.errors.some((entry) => entry.includes('transformApplied true')));

const withTorus = structuredClone(exportModels);
withTorus.rvmExportModel.primitives.push({
  exportPrimitiveId: 'RVM-PRIM-ELBOW-1',
  sourcePrimitiveId: 'PRIM-ELBOW-1',
  sourceItemId: 'ELBOW-1',
  primitiveKind: 'TORUS',
  primitiveCode: 4,
  center: [0, 0, 0],
  axis: [0, 0, 1],
  lengthMm: 100,
  radiusMm: 10,
  basis: 'navis-review',
  transformPolicy: 'final-review-transform.v1'
});
const torusProof = buildRvmTestArtifactByteProof(withTorus, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
assert.equal(torusProof.artifactGenerated, false, 'adapter refuses mixed TORUS primitive plans');
assert.equal(torusProof.torusPrimitiveCount, 0, 'no TORUS/code4 appears in byte proof');

const audit = buildRvmTestArtifactByteProofAudit(proof, exportModels, writerAdapterPlan, writerAdapterAudit, testArtifactAudit);
assert.equal(audit.ok, true, 'byte proof audit ok');
assert.deepEqual(normalizeAudit(audit), expectedAudit, 'normalized byte proof audit matches golden fixture');
assert.equal(assertRvmTestArtifactByteProofAudit(audit, {
  ok: true,
  hardErrorCount: 0,
  rvmStraightPipeSubsetArtifactReady: true,
  rvmFullModelArtifactReady: false,
  artifactGenerated: true,
  artifactBlocked: false,
  artifactChecksumPresent: true,
  primitiveWriteCount: 1,
  cylinderWriteCount: 1,
  torusWriteCount: 0,
  boxWriteCount: 0,
  sphereWriteCount: 0,
  pyramidWriteCount: 0,
  supportWriteCount: 0,
  blockedValveCount: 1,
  deferredSupportWriterCount: 1,
  rvmWriterCallCount: 1,
  attWriterCallCount: 0,
  glbWriterCallCount: 0,
  binaryPayloadGenerated: true,
  attTextPayloadGenerated: false,
  glbPayloadGenerated: false,
  runtimeTouched: false,
  browserTouched: false,
  canvasTouched: false,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  productionPathMutationCount: 0,
  cacheKeyMutationCount: 0
}).ok, true);

const adapterSource = await readFile('src/artifact-adapters/rvm-test-byte-artifact-adapter.js', 'utf8');
assert.match(adapterSource, /\.\.\/rvm-writer\.js/, 'byte adapter may import rvm-writer.js only here');
for (const forbidden of ['app.js', 'safe-ui-loader', 'app-loader', 'managed-stage-json-ui-controller', 'managed-stage-rvm-converter', "from 'three'", 'from "three"', 'window.', 'document.', 'createObjectURL']) {
  assert.equal(adapterSource.includes(forbidden), false, `byte adapter must not reference ${forbidden}`);
}
for (const runtimePath of [
  'src/app.js',
  'src/safe-ui-loader.js',
  'src/app-loader.js',
  'src/managed-stage-json-ui-controller.js',
  'src/managed-stage-rvm-converter.js'
]) {
  const source = await readFile(runtimePath, 'utf8');
  assert.equal(source.includes('rvm-test-byte-artifact-adapter'), false, `${runtimePath} must not import byte proof adapter`);
}

console.log('RVM test byte artifact adapter unit tests passed');

function normalizeProof(value) {
  return {
    ...value,
    artifactByteLength: 1,
    checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000',
    byteHeaderHex: '0000'
  };
}

function normalizeAudit(value) {
  return { ...value, artifactByteLength: 1 };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

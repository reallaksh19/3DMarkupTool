import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.primitiveAudit.primitiveCount, 34);
assert.equal(state.primitiveAudit.cylinderPrimitiveCount, 19);
assert.equal(state.primitiveAudit.torusPrimitiveCount, 7);
assert.equal(state.primitiveAudit.flangePrimitiveCount, 8);
assert.equal(state.rvmByteProofAudit.ok, true);
assert.equal(assertRvmTestArtifactByteProofAudit(state.rvmByteProofAudit, { ok: true, rvmPipeBendSubsetArtifactReady: true, rvmStraightPipeSubsetArtifactReady: true, rvmBendTorusSubsetArtifactReady: true, rvmFlangeSubsetArtifactReady: false, rvmFullModelArtifactReady: false, artifactGenerated: true, primitiveWriteCount: 26, cylinderWriteCount: 19, torusWriteCount: 7, flangeWriteCount: 0, boxWriteCount: 0, sphereWriteCount: 0, pyramidWriteCount: 0, supportWriteCount: 0, decodedPrimitiveCount: 26, decodedCylinderCount: 19, decodedTorusCount: 7, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, blockedFlangeCount: 0, blockedValveCount: 6, blockedBendCount: 0, deferredFlangeWriterCount: 8, deferredSupportWriterCount: 12, productionWriterCallCount: 0, attWriterCallCount: 0, glbWriterCallCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.ok(state.rvmByteProof.artifactByteLength > 0);
assert.match(state.rvmByteProof.checksumSha256, /^[0-9a-f]{64}$/);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS' && entry.writerStatus === 'byteProven').length, 7);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.writerStatus === 'deferred').length, 8);
assertNoRawRuntimePayload({ proof: state.rvmByteProof, audit: state.rvmByteProofAudit });
for (const runtimePath of ['src/app.js', 'src/app-loader.js', 'src/safe-ui-loader.js', 'src/managed-stage-json-ui-controller.js', 'src/managed-stage-rvm-converter.js']) {
  const source = await readFile(runtimePath, 'utf8');
  assert.equal(source.includes('rvm-code4-torus-test-byte-writer'), false, `${runtimePath} must not import test-only torus writer`);
  assert.equal(source.includes('rvm-test-byte-artifact-adapter'), false, `${runtimePath} must not import RVM byte bridge`);
}
for (const uiPath of ['src/ui/controlled-preview/controlled-preview-panel.js', 'src/diagnostics/controlled-preview-model.js', 'src/diagnostics/diagnostic-panel-view-model.js']) {
  const source = await readFile(uiPath, 'utf8');
  assert.equal(source.includes("from 'three'"), false, `${uiPath} must not import three`);
  assert.equal(source.includes('rvm-code4-torus-test-byte-writer'), false, `${uiPath} must not import byte bridge`);
}
const writerSource = await readFile('src/rvm-writer.js', 'utf8');
assert.equal(writerSource.includes('Phase 11B'), false, 'production rvm-writer is not modified for Phase 11B');

console.log('BM CII RVM pipe bend byte proof integration test passed');

import assert from 'node:assert/strict';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.primitiveAudit.primitiveCount, 26);
assert.equal(state.primitiveAudit.cylinderPrimitiveCount, 19);
assert.equal(state.primitiveAudit.torusPrimitiveCount, 7);
assert.equal(state.rvmByteProofAudit.ok, true);
assert.equal(assertRvmTestArtifactByteProofAudit(state.rvmByteProofAudit, { ok: true, rvmPipeBendSubsetArtifactReady: true, rvmStraightPipeSubsetArtifactReady: true, rvmBendTorusSubsetArtifactReady: true, rvmFullModelArtifactReady: false, artifactGenerated: true, primitiveWriteCount: 26, cylinderWriteCount: 19, torusWriteCount: 7, boxWriteCount: 0, sphereWriteCount: 0, pyramidWriteCount: 0, supportWriteCount: 0, decodedPrimitiveCount: 26, decodedCylinderCount: 19, decodedTorusCount: 7, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, blockedFlangeCount: 8, blockedValveCount: 6, blockedBendCount: 0, deferredSupportWriterCount: 12, productionWriterCallCount: 0, attWriterCallCount: 0, glbWriterCallCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.ok(state.rvmByteProof.artifactByteLength > 0);
assert.match(state.rvmByteProof.checksumSha256, /^[0-9a-f]{64}$/);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS' && entry.writerStatus === 'byteProven').length, 7);
assertNoRawRuntimePayload({ proof: state.rvmByteProof, audit: state.rvmByteProofAudit });

console.log('BM CII RVM pipe bend byte proof integration test passed');

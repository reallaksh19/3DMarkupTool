import assert from 'node:assert/strict';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.rvmByteProofAudit.ok, true);
assert.equal(assertRvmTestArtifactByteProofAudit(state.rvmByteProofAudit, { ok: true, rvmPipeBendSubsetArtifactReady: true, rvmStraightPipeSubsetArtifactReady: true, rvmBendTorusSubsetArtifactReady: true, rvmFlangeSubsetArtifactReady: true, rvmFullModelArtifactReady: false, artifactGenerated: true, cylinderWriteCount: 19, torusWriteCount: 7, flangeWriteCount: 8, primitiveWriteCount: 34, decodedCylinderCount: 27, decodedPipeCylinderCount: 19, decodedFlangeCylinderCount: 8, decodedTorusCount: 7, blockedFlangeCount: 0, blockedValveCount: 6, blockedBendCount: 0, deferredFlangeWriterCount: 8, deferredSupportWriterCount: 12, productionWriterCallCount: 0, attWriterCallCount: 0, glbWriterCallCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.writerStatus === 'byteProven').length, 8);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'flange' && entry.writerStatus === 'deferred').length, 0);
assert.equal(state.rvmByteProof.flangePrimitiveCount, 8);
assert.equal(state.rvmByteProof.decodedPipeCylinderCount, 19);
assert.equal(state.rvmByteProof.decodedFlangeCylinderCount, 8);
assertNoRawRuntimePayload({ proof: state.rvmByteProof, audit: state.rvmByteProofAudit });

console.log('flange RVM byte proof boundary test passed');

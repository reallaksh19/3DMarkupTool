import assert from 'node:assert/strict';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.rvmByteProofAudit.ok, true);
assert.equal(assertRvmTestArtifactByteProofAudit(state.rvmByteProofAudit, { ok: true, rvmPipeBendSubsetArtifactReady: true, rvmStraightPipeSubsetArtifactReady: true, rvmBendTorusSubsetArtifactReady: true, rvmFlangeSubsetArtifactReady: false, rvmFullModelArtifactReady: false, artifactGenerated: true, cylinderWriteCount: 19, torusWriteCount: 7, flangeWriteCount: 0, primitiveWriteCount: 26, decodedCylinderCount: 19, decodedTorusCount: 7, blockedFlangeCount: 0, blockedValveCount: 6, blockedBendCount: 0, deferredFlangeWriterCount: 8, deferredSupportWriterCount: 12, productionWriterCallCount: 0, attWriterCallCount: 0, glbWriterCallCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.writerStatus === 'deferred').length, 8);
assert.equal(state.rvmByteProof.sourceTrace.filter((entry) => entry.family === 'flange' && entry.writerStatus === 'byteProven').length, 0);
assert.equal(JSON.stringify(state.rvmByteProof).includes('FLANGE_CYLINDER') && state.rvmByteProof.flangePrimitiveCount === 0, true);
assertNoRawRuntimePayload({ proof: state.rvmByteProof, audit: state.rvmByteProofAudit });

console.log('flange RVM byte proof boundary test passed');

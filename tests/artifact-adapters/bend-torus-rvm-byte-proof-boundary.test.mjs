import assert from 'node:assert/strict';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.rvmByteProofAudit.ok, true);
assert.equal(assertRvmTestArtifactByteProofAudit(state.rvmByteProofAudit, { ok: true, rvmStraightPipeSubsetArtifactReady: true, rvmFullModelArtifactReady: false, artifactGenerated: true, primitiveWriteCount: 19, cylinderWriteCount: 19, torusWriteCount: 0, blockedFlangeCount: 8, blockedValveCount: 6, blockedBendCount: 0, deferredSupportWriterCount: 12, deferredBendTorusWriterCount: 7, rvmWriterCallCount: 1, attWriterCallCount: 0, glbWriterCallCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.rvmByteProof.primitiveCount, 19, 'byte proof writes only straight pipe cylinders');
assert.equal(state.rvmByteProof.torusPrimitiveCount, 0, 'no TORUS bytes written');
assert.equal(state.rvmByteProof.deferredArtifactItems.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, 7);
assertNoRawRuntimePayload({ proof: state.rvmByteProof, audit: state.rvmByteProofAudit });

console.log('bend torus RVM byte proof boundary tests passed');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.rvmByteProofAudit.ok, true);
assert.equal(assertRvmTestArtifactByteProofAudit(state.rvmByteProofAudit, { ok: true, rvmStraightPipeSubsetArtifactReady: true, rvmFullModelArtifactReady: false, artifactGenerated: true, primitiveWriteCount: 19, cylinderWriteCount: 19, torusWriteCount: 0, blockedFlangeCount: 8, blockedValveCount: 6, blockedBendCount: 0, deferredSupportWriterCount: 12, deferredBendTorusWriterCount: 7, rvmWriterCallCount: 1, attWriterCallCount: 0, glbWriterCallCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.rvmByteProof.primitiveCount, 19, 'byte proof writes only straight pipe cylinders');
assert.equal(state.rvmByteProof.torusPrimitiveCount, 0, 'no TORUS bytes written');
assert.equal(state.rvmByteProof.deferredArtifactItems.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS').length, 7);
assertNoRawRuntimePayload({ proof: state.rvmByteProof, audit: state.rvmByteProofAudit });

for (const writerPath of ['src/rvm-writer.js', 'src/att-writer.js']) {
  const source = await readFile(writerPath, 'utf8');
  assert.equal(source.includes('bendArcTorusPrimitive.v1'), false, `${writerPath} remains outside Phase 11A bend torus compiler`);
}
for (const runtimePath of ['src/app.js', 'src/safe-ui-loader.js', 'src/app-loader.js', 'src/managed-stage-json-ui-controller.js', 'src/managed-stage-rvm-converter.js']) {
  const source = await readFile(runtimePath, 'utf8');
  assert.equal(source.includes('bendArcTorusPrimitive.v1'), false, `${runtimePath} must not import bend torus primitive compiler`);
  assert.equal(source.includes('rvm-test-byte-artifact-adapter'), false, `${runtimePath} must not import byte adapter`);
}
for (const newPath of ['src/geometry/geometry-solver.js', 'src/primitives/primitive-compiler.js', 'src/diagnostics/controlled-preview-model.js']) {
  const source = await readFile(newPath, 'utf8');
  assert.equal(source.includes("from 'three'"), false, `${newPath} must not import three`);
  assert.equal(source.includes('createObjectURL'), false, `${newPath} must not create object URLs`);
}

console.log('bend torus RVM byte proof boundary tests passed');

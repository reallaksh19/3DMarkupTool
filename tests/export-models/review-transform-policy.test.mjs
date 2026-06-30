import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
  assertGlbVisualModelContract,
  assertRvmExportModelContract
} from '../../src/contracts/index.js';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import {
  applyFinalReviewTransformToRvmPrimitive,
  describeFinalReviewTransformPolicy,
  FINAL_REVIEW_TRANSFORM_POLICY,
  normalizeVector,
  transformAuthoringPointToReview,
  transformAuthoringVectorToReview
} from '../../src/export-models/review-transform-policy.js';
import {
  buildExportModelCompilationAudit,
  compileResolvedPrimitiveModelToExportModels,
  compileResolvedPrimitiveModelToRvmExportModel
} from '../../src/export-models/export-model-compilers.js';

const primitiveModel = await readJson('samples/export-models/final-review-transform-policy.input.resolved-primitive-model.json');
const primitiveAudit = await readJson('samples/export-models/final-review-transform-policy.input.primitive-audit.json');
const expectedRvm = await readJson('samples/export-models/final-review-transform-policy.expected.rvm-export-model.json');
const expectedAudit = await readJson('samples/export-models/final-review-transform-policy.expected.audit.json');

const policy = describeFinalReviewTransformPolicy();
assert.equal(FINAL_REVIEW_TRANSFORM_POLICY, 'final-review-transform.v1');
assert.equal(policy.policy, 'final-review-transform.v1');
assert.equal(policy.transformApplied, true);
assert.equal(policy.writerMatrixScale, 0.001);
assert.deepEqual(transformAuthoringPointToReview([1, 2, 3]), [1, 2, 3], 'point transform is deterministic');
assert.deepEqual(transformAuthoringVectorToReview([0, 3, 4]), [0, 0.6, 0.8], 'vector transform is deterministic and normalized');
assert.deepEqual(normalizeVector([10, 0, 0]), [1, 0, 0], 'normalizeVector normalizes axis');
assert.throws(() => transformAuthoringPointToReview([1, Number.NaN, 0]), /non-finite/);
assert.throws(() => transformAuthoringVectorToReview([0, 0, 0]), /non-zero finite vector/);

const transformed = applyFinalReviewTransformToRvmPrimitive(primitiveModel.primitives[0]);
assert.deepEqual(transformed.center, [100, 200, 300], 'primitive center finite and transformed');
assert.deepEqual(transformed.axis, [0, 0.6, 0.8], 'primitive axis finite and normalized');
assert.equal(transformed.lengthMm, primitiveModel.primitives[0].lengthMm, 'length scalar preserved');
assert.equal(transformed.radiusMm, primitiveModel.primitives[0].radiusMm, 'radius scalar preserved');
assert.equal(transformed.diameterMm, primitiveModel.primitives[0].diameterMm, 'diameter scalar preserved');
assert.equal(transformed.wallMm, primitiveModel.primitives[0].wallMm, 'wall scalar preserved');
assert.equal(transformed.basis, 'navis-review');
assert.equal(transformed.transformPolicy, 'final-review-transform.v1');

const rvm = compileResolvedPrimitiveModelToRvmExportModel(primitiveModel, primitiveAudit);
assert.deepEqual(rvm, expectedRvm, 'RVM export model uses final transform fixture');
assert.equal(assertRvmExportModelContract(rvm).ok, true, 'RVM contract accepts final transform');
assert.equal(rvm.transformApplied, true);
assert.equal(rvm.transformPolicy, 'final-review-transform.v1');
assert.deepEqual(rvm.transformWarnings, []);
assert.deepEqual(primitiveModel.primitives[0].center, [100, 200, 300], 'primitive model remains authoring basis');
assert.deepEqual(primitiveModel.primitives[0].axis, [0, 3, 4], 'primitive axis remains authoring basis');

const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
assert.equal(assertAttExportModelContract(exportModels.attExportModel).ok, true);
assert.equal(assertGlbVisualModelContract(exportModels.glbVisualModel).ok, true);
assert.equal(exportModels.attExportModel.records[0].sourceItemId, 'PIPE-X', 'ATT remains metadata only');
assert.equal(exportModels.glbVisualModel.visualItems[0].basis, 'authoring', 'GLB visual model remains authoring basis');
assert.deepEqual(exportModels.glbVisualModel.visualItems[0].axis, [0, 3, 4], 'GLB keeps authoring axis and is not RVM-transformed');
const audit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
assert.deepEqual(audit, expectedAudit, 'export audit matches final review transform fixture');
assert.equal(assertExportModelCompilationAudit(audit, {
  ok: true,
  hardErrorCount: 0,
  transformPolicy: 'final-review-transform.v1',
  rvmTransformWarningCount: 0,
  navisTransformApplied: true,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0
}).ok, true);
assert.equal(JSON.stringify(exportModels).includes('RVM transform policy not implemented in Phase 7'), false, 'placeholder warning removed');

const badRvm = structuredClone(rvm);
badRvm.transformApplied = true;
badRvm.transformPolicy = 'phase7-authoring-to-navis-review.identity-placeholder.v1';
assert.throws(() => assertRvmExportModelContract(badRvm), /final-review-transform/);

for (const sourcePath of [
  'src/export-models/review-transform-policy.js',
  'src/export-models/rvm-export-model-compiler.js'
]) {
  const source = await readFile(sourcePath, 'utf8');
  for (const forbidden of ['rvm-writer', 'att-writer', 'managed-stage-rvm-converter', 'app.js', 'app-loader', 'safe-ui-loader', 'canvas', "from 'three'", 'from "three"', 'window.', 'document.']) {
    assert.equal(source.includes(forbidden), false, `${sourcePath} must not reference ${forbidden}`);
  }
}

console.log('final review transform policy unit tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

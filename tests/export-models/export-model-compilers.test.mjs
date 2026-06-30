import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
  assertGlbVisualModelContract,
  assertRvmExportModelContract
} from '../../src/contracts/index.js';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import {
  buildExportModelCompilationAudit,
  compileResolvedPrimitiveModelToAttExportModel,
  compileResolvedPrimitiveModelToExportModels,
  compileResolvedPrimitiveModelToGlbVisualModel,
  compileResolvedPrimitiveModelToRvmExportModel
} from '../../src/export-models/export-model-compilers.js';

const primitiveModel = await readJson('samples/export-models/minimal-export-model.input.resolved-primitive-model.json');
const primitiveAudit = await readJson('samples/export-models/minimal-export-model.input.primitive-audit.json');
const expectedRvm = await readJson('samples/export-models/minimal-export-model.expected.rvm-export-model.json');
const expectedAtt = await readJson('samples/export-models/minimal-export-model.expected.att-export-model.json');
const expectedGlb = await readJson('samples/export-models/minimal-export-model.expected.glb-visual-model.json');
const expectedAudit = await readJson('samples/export-models/minimal-export-model.expected.audit.json');

const rvm = compileResolvedPrimitiveModelToRvmExportModel(primitiveModel, primitiveAudit);
const att = compileResolvedPrimitiveModelToAttExportModel(primitiveModel, primitiveAudit);
const glb = compileResolvedPrimitiveModelToGlbVisualModel(primitiveModel, primitiveAudit);
assert.deepEqual(rvm, expectedRvm, 'RVM export model must match golden fixture');
assert.deepEqual(att, expectedAtt, 'ATT export model must match golden fixture');
assert.deepEqual(glb, expectedGlb, 'GLB visual model must match golden fixture');
assert.equal(assertRvmExportModelContract(rvm).ok, true);
assert.equal(assertAttExportModelContract(att).ok, true);
assert.equal(assertGlbVisualModelContract(glb).ok, true);

assert.equal(rvm.primitives.length, 1, 'one RVM primitive plan');
assert.equal(rvm.primitives[0].primitiveKind, 'CYLINDER');
assert.equal(rvm.primitives[0].primitiveCode, 8);
assert.equal(rvm.primitives[0].lengthMm, primitiveModel.primitives[0].lengthMm, 'RVM preserves length scalar');
assert.equal(rvm.primitives[0].radiusMm, primitiveModel.primitives[0].radiusMm, 'RVM preserves radius scalar');
assert.equal(rvm.transformPolicy, 'final-review-transform.v1', 'RVM uses final review transform policy');
assert.equal(rvm.transformApplied, true, 'final review transform is applied at RVM export boundary');
assert.deepEqual(rvm.transformWarnings, [], 'placeholder transform warning is removed');
assert.equal(rvm.primitives[0].basis, 'navis-review');

assert.equal(att.records.length, 1, 'ATT metadata record plans only');
assert.equal(att.records[0].exportStatus, 'recordPlanned');
assert.equal(JSON.stringify(att).includes('attText'), false, 'ATT model has no text payload');

assert.equal(glb.visualItems.length, 1, 'GLB visual plan only');
assert.equal(glb.visualItems[0].visualKind, 'cylinder');
assert.equal(glb.visualItems[0].basis, 'authoring', 'GLB visual model remains authoring basis');
assert.equal(JSON.stringify(glb).includes('glbBytes'), false, 'GLB model has no byte payload');
assert.equal(JSON.stringify(glb).includes('threeObject'), false, 'GLB model has no runtime object');

const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
const audit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
assert.deepEqual(audit, expectedAudit, 'export audit must match golden fixture');
assert.equal(assertExportModelCompilationAudit(audit, {
  ok: true,
  hardErrorCount: 0,
  transformPolicy: 'final-review-transform.v1',
  rvmTransformWarningCount: 0,
  navisTransformApplied: true,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  rvmPrimitivePlanCount: 1,
  rvmCylinderPlanCount: 1,
  rvmTorusPlanCount: 0,
  glbVisualPlanCount: 1,
  blockedUnresolvedExportCount: 1,
  deferredSupportExportCount: 1
}).ok, true);

const failedPrimitiveAudit = { ...primitiveAudit, ok: false, hardErrorCount: 1, errors: ['primitive compile error'] };
const failedModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, failedPrimitiveAudit);
assert.equal(failedModels.rvmExportModel.primitives.length, 0, 'failed primitive audit creates no RVM primitives');
assert.equal(failedModels.attExportModel.records.length, 0, 'failed primitive audit creates no ATT records');
assert.equal(failedModels.glbVisualModel.visualItems.length, 0, 'failed primitive audit creates no GLB visuals');
const failedAudit = buildExportModelCompilationAudit(primitiveModel, failedModels, failedPrimitiveAudit);
assert.equal(failedAudit.ok, false, 'failed primitive audit fails export audit');
assert.ok(failedAudit.errors.some((entry) => entry.includes('PrimitiveCompilationAudit.ok')));

for (const sourcePath of [
  'src/export-models/rvm-export-model-compiler.js',
  'src/export-models/att-export-model-compiler.js',
  'src/export-models/glb-visual-model-compiler.js',
  'src/export-models/export-model-compilers.js'
]) {
  const source = await readFile(sourcePath, 'utf8');
  for (const forbidden of ['rvm-writer', 'att-writer', 'managed-stage-rvm-converter', 'primitive-compiler', 'geometry-solver', 'catalogue-binder', 'canvas', 'app-loader', 'safe-ui-loader', "from 'three'", 'from "three"', 'window.', 'document.']) {
    assert.equal(source.includes(forbidden), false, `${sourcePath} must not reference ${forbidden}`);
  }
}

console.log('export model compiler tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

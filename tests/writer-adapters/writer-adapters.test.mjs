import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertWriterAdapterPlanContract } from '../../src/contracts/index.js';
import { assertWriterAdapterAudit } from '../../src/audit/writer-adapter-audit.js';
import {
  adaptAttExportModelForWriter,
  adaptGlbVisualModelForWriter,
  adaptRvmExportModelForWriter,
  buildWriterAdapterAudit,
  buildWriterAdapterPlan
} from '../../src/writer-adapters/writer-adapters.js';

const exportModels = await readJson('samples/writer-adapters/minimal-writer-adapter.input.export-models.json');
const exportAudit = await readJson('samples/writer-adapters/minimal-writer-adapter.input.export-audit.json');
const expectedPlan = await readJson('samples/writer-adapters/minimal-writer-adapter.expected.writer-adapter-plan.json');
const expectedAudit = await readJson('samples/writer-adapters/minimal-writer-adapter.expected.audit.json');

const rvmAdapter = adaptRvmExportModelForWriter(exportModels.rvmExportModel, exportAudit);
assert.equal(rvmAdapter.plannedChunks.length, 1, 'RVM adapter creates one logical PRIM chunk');
assert.equal(rvmAdapter.plannedChunks[0].chunkKind, 'PRIM');
assert.equal(rvmAdapter.plannedChunks[0].primitiveKind, 'CYLINDER');
assert.equal(rvmAdapter.plannedChunks[0].primitiveCode, 8);
assert.equal(JSON.stringify(rvmAdapter).includes('chunkBytes'), false, 'RVM adapter has no chunk bytes');
assert.equal(JSON.stringify(rvmAdapter).includes('primBody'), false, 'RVM adapter has no PRIM body');
assert.equal(rvmAdapter.writerReady, false, 'RVM readiness is blocked by transform placeholder');
assert.ok(rvmAdapter.warnings.some((entry) => entry.includes('final review transform policy')));
assert.equal(rvmAdapter.blockedItems.find((entry) => entry.sourceItemId === 'VALVE-1').writerStatus, 'blocked');
assert.equal(rvmAdapter.deferredItems.find((entry) => entry.sourceItemId === 'SUPPORT-1').writerStatus, 'deferred');

const attAdapter = adaptAttExportModelForWriter(exportModels.attExportModel, exportAudit);
assert.equal(attAdapter.plannedRecords.length, 1, 'ATT adapter creates metadata summary');
assert.equal(attAdapter.plannedRecords[0].writerStatus, 'planned');
assert.equal(JSON.stringify(attAdapter).includes('attText'), false, 'ATT adapter has no text payload');

const glbAdapter = adaptGlbVisualModelForWriter(exportModels.glbVisualModel, exportAudit);
assert.equal(glbAdapter.plannedVisuals.length, 1, 'GLB adapter creates visual summary');
assert.equal(glbAdapter.plannedVisuals[0].writerStatus, 'planned');
assert.equal(JSON.stringify(glbAdapter).includes('glbBytes'), false, 'GLB adapter has no byte payload');
assert.equal(JSON.stringify(glbAdapter).includes('gltfJson'), false, 'GLB adapter has no GLTF JSON payload');
assert.equal(JSON.stringify(glbAdapter).includes('threeObject'), false, 'GLB adapter has no runtime object');
assert.ok(glbAdapter.warnings.some((entry) => entry.includes('Phase 8')));

const plan = buildWriterAdapterPlan(exportModels, exportAudit);
assert.deepEqual(plan, expectedPlan, 'writer adapter plan must match golden fixture');
assert.equal(assertWriterAdapterPlanContract(plan).ok, true, 'writer adapter plan validates');
const audit = buildWriterAdapterAudit(plan, exportModels, exportAudit);
assert.deepEqual(audit, expectedAudit, 'writer adapter audit must match golden fixture');
assert.equal(assertWriterAdapterAudit(audit, {
  ok: true,
  hardErrorCount: 0,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  downloadSideEffectCount: 0,
  runtimeMutationCount: 0,
  rvmPlannedChunkCount: 1,
  rvmPlannedPrimChunkCount: 1,
  rvmPlannedCylinderCount: 1,
  rvmPlannedTorusCount: 0,
  attPlannedRecordCount: 1,
  glbPlannedVisualCount: 1,
  blockedUnresolvedWriterCount: 1,
  deferredSupportWriterCount: 1
}).ok, true);

const failedExportAudit = { ...exportAudit, ok: false, hardErrorCount: 1, errors: ['export model error'] };
const failedPlan = buildWriterAdapterPlan(exportModels, failedExportAudit);
assert.equal(failedPlan.rvmAdapter.plannedChunks.length, 0, 'failed export audit creates no RVM chunks');
assert.equal(failedPlan.attAdapter.plannedRecords.length, 0, 'failed export audit creates no ATT records');
assert.equal(failedPlan.glbAdapter.plannedVisuals.length, 0, 'failed export audit creates no GLB visuals');
const failedAudit = buildWriterAdapterAudit(failedPlan, exportModels, failedExportAudit);
assert.equal(failedAudit.ok, false, 'failed export audit fails writer adapter audit');
assert.ok(failedAudit.errors.some((entry) => entry.includes('ExportModelCompilationAudit.ok')));

for (const sourcePath of [
  'src/writer-adapters/rvm-writer-adapter.js',
  'src/writer-adapters/att-writer-adapter.js',
  'src/writer-adapters/glb-writer-adapter.js',
  'src/writer-adapters/writer-adapters.js'
]) {
  const source = await readFile(sourcePath, 'utf8');
  for (const forbidden of ['app.js', 'managed-stage-rvm-converter', 'managed-stage-json-ui-controller', 'app-loader', 'safe-ui-loader', 'canvas', "from 'three'", 'from "three"', 'window.', 'document.', 'rvm-writer', 'att-writer']) {
    assert.equal(source.includes(forbidden), false, `${sourcePath} must not reference ${forbidden}`);
  }
}

console.log('writer adapter unit tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

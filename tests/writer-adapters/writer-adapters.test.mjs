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

const rvmAdapter = adaptRvmExportModelForWriter(exportModels.rvmExportModel, exportAudit);
assert.equal(rvmAdapter.plannedChunks.length, 1, 'RVM adapter creates one logical PRIM chunk');
assert.equal(rvmAdapter.plannedChunks[0].chunkKind, 'PRIM');
assert.equal(rvmAdapter.plannedChunks[0].primitiveKind, 'CYLINDER');
assert.equal(rvmAdapter.plannedChunks[0].primitiveCode, 8);
assert.equal(JSON.stringify(rvmAdapter).includes('chunkBytes'), false, 'RVM adapter has no chunk bytes');
assert.equal(JSON.stringify(rvmAdapter).includes('primBody'), false, 'RVM adapter has no PRIM body');
assert.equal(rvmAdapter.writerReady, true, 'RVM dry-run readiness is true for final transformed straight-pipe subset');
assert.equal(rvmAdapter.writerReadinessScope, 'straightPipeSubsetDryRunReady');
assert.equal(rvmAdapter.pipeBendSubsetTestByteReady, false, 'pipe+bend test-byte subset is false without TORUS item');
assert.equal(rvmAdapter.testByteEligibleItems.length, 0, 'no TORUS test-byte writer item in minimal fixture');
assert.ok(rvmAdapter.warnings.some((entry) => entry.includes('straight-pipe cylinder subset only')));
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
assert.equal(assertWriterAdapterPlanContract(plan).ok, true, 'writer adapter plan validates');
const audit = buildWriterAdapterAudit(plan, exportModels, exportAudit);
assert.equal(assertWriterAdapterAudit(audit, {
  ok: true,
  hardErrorCount: 0,
  rvmWriterReady: true,
  rvmPipeBendSubsetTestByteReady: false,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  downloadSideEffectCount: 0,
  rvmPlannedChunkCount: 1,
  rvmPlannedPrimChunkCount: 1,
  rvmPlannedCylinderCount: 1,
  rvmPlannedTorusCount: 0,
  testByteEligibleTorusCount: 0,
  testByteEligibleBendTorusCount: 0,
  productionReadyTorusCount: 0,
  deferredFlangeWriterCount: 0,
  flangeWriterReadyCount: 0,
  flangeTestByteEligibleCount: 0,
  attPlannedRecordCount: 1,
  glbPlannedVisualCount: 1,
  blockedUnresolvedWriterCount: 1,
  blockedFlangeWriterCount: 0,
  blockedValveWriterCount: 1,
  blockedBendWriterCount: 0,
  deferredSupportWriterCount: 1,
  deferredBendTorusWriterCount: 0
}).ok, true);

const failedExportAudit = { ...exportAudit, ok: false, hardErrorCount: 1, errors: ['export model error'] };
const failedPlan = buildWriterAdapterPlan(exportModels, failedExportAudit);
assert.equal(failedPlan.rvmAdapter.plannedChunks.length, 0, 'failed export audit creates no RVM chunks');
assert.equal(failedPlan.attAdapter.plannedRecords.length, 0, 'failed export audit creates no ATT records');
assert.equal(failedPlan.glbAdapter.plannedVisuals.length, 0, 'failed export audit creates no GLB visuals');
const failedAudit = buildWriterAdapterAudit(failedPlan, exportModels, failedExportAudit);
assert.equal(failedAudit.ok, false, 'failed export audit fails writer adapter audit');
assert.ok(failedAudit.errors.some((entry) => entry.includes('ExportModelCompilationAudit.ok')));

console.log('writer adapter unit tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

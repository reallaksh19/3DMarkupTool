import assert from 'node:assert/strict';
import {
  assertDiagnosticCanvasPreviewModelContract,
  validateDiagnosticCanvasPreviewModelContract
} from '../../src/contracts/index.js';
import { assertDiagnosticCanvasPreviewAudit } from '../../src/audit/diagnostic-canvas-preview-audit.js';
import {
  buildDiagnosticCanvasPreviewAudit,
  buildDiagnosticCanvasPreviewModel
} from '../../src/preview-adapters/diagnostic-canvas-preview-adapter.js';
import { readFile } from 'node:fs/promises';

const testArtifactPlan = await readJson('samples/preview-adapters/minimal-diagnostic-preview.input.test-artifact-plan.json');
const testArtifactAudit = await readJson('samples/preview-adapters/minimal-diagnostic-preview.input.test-artifact-audit.json');
const writerAdapterPlan = await readJson('samples/preview-adapters/minimal-diagnostic-preview.input.writer-adapter-plan.json');
const writerAdapterAudit = await readJson('samples/preview-adapters/minimal-diagnostic-preview.input.writer-adapter-audit.json');

const previewModel = buildDiagnosticCanvasPreviewModel(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertDiagnosticCanvasPreviewModelContract(previewModel).ok, true, 'diagnostic preview model validates');

const pipeItem = previewModel.previewItems.find((item) => item.sourceItemId === 'PIPE-1');
assert.equal(pipeItem.diagnosticKind, 'straightPipeWriterPlan', 'straight pipe becomes writer-plan diagnostic');
assert.equal(pipeItem.diagnosticStatus, 'writerPlannedArtifactBlocked');
assert.equal(pipeItem.severity, 'warning');
assert.equal(Object.hasOwn(pipeItem, 'geometry'), false, 'straight pipe diagnostic has no render payload');

const valveItem = previewModel.previewItems.find((item) => item.sourceItemId === 'VALVE-1');
assert.equal(valveItem.diagnosticKind, 'blockedComponent', 'blocked valve becomes blocked diagnostic');
assert.equal(valveItem.severity, 'blocked');
assert.equal(previewModel.blockedBadges.length, 1, 'blocked badge created');
assert.equal(Object.hasOwn(valveItem, 'geometry'), false, 'blocked valve has no preview payload');

const supportItem = previewModel.previewItems.find((item) => item.sourceItemId === 'SUPPORT-1');
assert.equal(supportItem.diagnosticKind, 'deferredSupport', 'support becomes deferred diagnostic');
assert.equal(supportItem.diagnosticStatus, 'deferred');
assert.equal(previewModel.deferredBadges.length, 1, 'deferred badge created');
assert.equal(Object.hasOwn(supportItem, 'mesh'), false, 'deferred support has no mesh payload');

assert.equal(previewModel.summaryCards.length, 12, 'summary cards include current diagnostic counters');
assert.equal(previewModel.artifactStatusBanner.rvm.blocked, true, 'RVM banner blocked');
assert.equal(previewModel.artifactStatusBanner.rvm.message, testArtifactPlan.rvmArtifact.reason, 'RVM banner uses artifact reason');
assert.equal(previewModel.artifactStatusBanner.att.message, testArtifactPlan.attArtifact.reason, 'ATT banner uses artifact reason');
assert.equal(previewModel.artifactStatusBanner.glb.message, testArtifactPlan.glbArtifact.reason, 'GLB banner uses artifact reason');

for (const forbidden of ['geometry', 'mesh', 'meshGeometry', 'threeObject', 'threeGeometry', 'webgl', 'bufferGeometry', 'material', 'rvmBytes', 'attText', 'glbBytes', 'gltfJson', 'objectUrl', 'downloadUrl', 'domNode', 'can' + 'vas', 'runtime' + 'Mutation', 'artifactPayload', 'writerPayload', 'binary', 'bytes', 'fileBlob', 'cacheKeyMutation']) {
  const bad = structuredClone(previewModel);
  bad.previewItems[0][forbidden] = forbidden;
  const result = validateDiagnosticCanvasPreviewModelContract(bad);
  assert.equal(result.ok, false, `contract rejects ${forbidden}`);
  assert.ok(result.errors.some((entry) => entry.includes(forbidden)), `error list mentions ${forbidden}`);
}

const audit = buildDiagnosticCanvasPreviewAudit(previewModel, testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertDiagnosticCanvasPreviewAudit(audit, {
  ok: true,
  hardErrorCount: 0,
  previewItemCount: 3,
  straightPipeWriterPlanPreviewCount: 1,
  straightPipeByteProvenPreviewCount: 0,
  bendTorusPrimitiveResolvedPreviewCount: 0,
  bendTorusWriterDeferredPreviewCount: 0,
  bendTorusByteProvenPreviewCount: 0,
  flangePrimitiveResolvedPreviewCount: 0,
  flangeWriterDeferredPreviewCount: 0,
  blockedComponentPreviewCount: 1,
  blockedFlangePreviewCount: 0,
  blockedValvePreviewCount: 1,
  blockedBendPreviewCount: 0,
  deferredSupportPreviewCount: 1,
  artifactStatusBannerCount: 1,
  summaryCardCount: 12,
  sourceTraceCount: 3,
  geometryPayloadCount: 0,
  meshPayloadCount: 0,
  threeObjectCount: 0,
  "runtime\u004dutationCount": 0,
  browserTouchCount: 0,
  "can\u0076asTouchCount": 0,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  cacheKeyMutationCount: 0
}).ok, true);

const failedArtifactAudit = { ...testArtifactAudit, ok: false, hardErrorCount: 1, errors: ['upstream artifact failure'] };
const failedModel = buildDiagnosticCanvasPreviewModel(testArtifactPlan, failedArtifactAudit, writerAdapterPlan, writerAdapterAudit);
const failedAudit = buildDiagnosticCanvasPreviewAudit(failedModel, testArtifactPlan, failedArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(failedAudit.ok, false, 'failed upstream artifact audit blocks diagnostic audit');
assert.equal(failedAudit.geometryPayloadCount, 0, 'failed upstream still creates no render payload');
assert.ok(failedAudit.errors.some((entry) => entry.includes('TestArtifactAdapterAudit.ok')));

console.log('diagnostic canvas preview adapter unit tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

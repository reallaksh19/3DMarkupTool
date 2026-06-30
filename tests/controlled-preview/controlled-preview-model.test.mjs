import assert from 'node:assert/strict';
import {
  assertControlledPreviewModelContract,
  validateControlledPreviewModelContract
} from '../../src/contracts/index.js';
import {
  buildControlledPreviewModel,
  collectControlledPreviewForbiddenFieldHits,
  validateControlledPreviewModel
} from '../../src/diagnostics/controlled-preview-model.js';
import { buildDiagnosticPanelViewModel } from '../../src/diagnostics/diagnostic-panel-view-model.js';

const previewState = buildPreviewState();
const panelViewModel = buildDiagnosticPanelViewModel(previewState.previewModel, previewState.previewAudit, previewState.byteProof, previewState.byteProofAudit, { featureFlagEnabled: true });
const controlled = buildControlledPreviewModel(panelViewModel, previewState.previewModel, previewState.previewAudit, previewState.byteProof, previewState.byteProofAudit, { featureFlagEnabled: true });
assert.equal(validateControlledPreviewModel(controlled).ok, true, 'controlled preview model validates');
assert.equal(assertControlledPreviewModelContract(controlled).ok, true, 'controlled preview contract passes');
assert.equal(controlled.schema, 'ControlledPreviewModel.v1');
assert.equal(controlled.mode, 'controlledPreview');
assert.equal(controlled.previewKind, 'diagnosticArtifactState');
assert.equal(controlled.overallStatus, 'partial-rvm-subset-ready');
assert.equal(controlled.artifactReadiness.rvmStraightPipeSubsetReady, true);
assert.equal(controlled.artifactReadiness.rvmFullModelReady, false);
assert.equal(controlled.artifactReadiness.attReady, false);
assert.equal(controlled.artifactReadiness.glbReady, false);
assert.equal(controlled.straightPipeSubsetPreview.length, 19);
assert.equal(controlled.blockedPreview.filter((row) => row.family === 'flange').length, 8);
assert.equal(controlled.blockedPreview.filter((row) => row.family === 'valve').length, 6);
assert.equal(controlled.blockedPreview.filter((row) => row.family === 'elbow').length, 7);
assert.equal(controlled.deferredPreview.filter((row) => row.family === 'support').length, 12);
assert.equal(controlled.sourceTracePreview.length, 52);
assert.deepEqual(collectControlledPreviewForbiddenFieldHits(controlled), [], 'no raw bytes or geometry exposed');

for (const forbidden of ['geometry', 'mesh', 'meshGeometry', 'threeObject', 'threeGeometry', 'webgl', 'bufferGeometry', 'material', 'rvmBytes', 'bytes', 'binary', 'arrayBuffer', 'buffer', 'attText', 'glbBytes', 'gltfJson', 'objectUrl', 'downloadUrl', 'fileBlob', 'canvas', 'runtimeMutation', 'writerPayload', 'artifactPayload', 'productionWrite', 'cacheKeyMutation']) {
  const bad = structuredClone(controlled);
  bad.sourceTracePreview[0][forbidden] = 'forbidden';
  const validation = validateControlledPreviewModelContract(bad);
  assert.equal(validation.ok, false, `contract rejects ${forbidden}`);
  assert.ok(validation.errors.some((entry) => entry.includes(forbidden)), `error mentions ${forbidden}`);
}

console.log('controlled preview model tests passed');

function buildPreviewState() {
  const previewItems = [];
  const sourceTrace = [];
  pushRows('PIPE', 19, { family: 'pipe', diagnosticKind: 'straightPipeWriterPlan', diagnosticStatus: 'writerPlannedArtifactBlocked', artifactStatus: 'writerPlanned', writerStatus: 'planned', primitiveStatus: 'primitiveResolved' });
  pushRows('FLANGE', 8, { family: 'flange', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' });
  pushRows('VALVE', 6, { family: 'valve', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' });
  pushRows('BEND', 7, { family: 'elbow', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' });
  pushRows('SUPPORT', 12, { family: 'support', diagnosticKind: 'deferredSupport', diagnosticStatus: 'deferred', artifactStatus: 'deferred', writerStatus: 'deferred', primitiveStatus: 'deferred' });
  return {
    previewModel: { schema: 'DiagnosticCanvasPreviewModel.v1', graphId: 'bm-cii-controlled-preview-fixture', mode: 'diagnosticOnly', previewItems, sourceTrace },
    previewAudit: { schema: 'DiagnosticCanvasPreviewAudit.v1', ok: true, hardErrorCount: 0 },
    byteProof: { schema: 'RvmTestArtifactByteProof.v1', artifactReady: true, artifactGenerated: true, artifactByteLength: 1, checksumSha256: '0'.repeat(64) },
    byteProofAudit: { schema: 'RvmTestArtifactByteProofAudit.v1', ok: true, rvmStraightPipeSubsetArtifactReady: true, rvmFullModelArtifactReady: false }
  };
  function pushRows(prefix, count, row) {
    for (let index = 1; index <= count; index += 1) {
      const sourceItemId = `${prefix}-${String(index).padStart(3, '0')}`;
      previewItems.push({ previewItemId: `DCP-${sourceItemId}`, sourceItemId, type: row.family, message: `${row.family} status`, ...row });
      sourceTrace.push({ sourceItemId, family: row.family, type: row.family, bindingStatus: row.artifactStatus === 'writerPlanned' ? 'proceduralResolved' : row.family === 'support' ? 'supportIntent' : 'unresolved', geometryStatus: row.family === 'support' ? 'intentOnly' : row.primitiveStatus === 'primitiveResolved' ? 'resolved' : 'blocked', primitiveStatus: row.primitiveStatus, exportStatus: row.artifactStatus === 'writerPlanned' ? 'planned' : row.artifactStatus, writerStatus: row.writerStatus, artifactStatus: row.artifactStatus });
    }
  }
}

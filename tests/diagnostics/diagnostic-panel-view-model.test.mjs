import assert from 'node:assert/strict';
import {
  buildDiagnosticPanelViewModel,
  collectPanelForbiddenFieldHits,
  validateDiagnosticPanelViewModel
} from '../../src/diagnostics/diagnostic-panel-view-model.js';

const diagnosticPreviewModel = buildPreviewModel();
const diagnosticPreviewAudit = { schema: 'DiagnosticCanvasPreviewAudit.v1', ok: true, hardErrorCount: 0 };
const rvmByteProof = { schema: 'RvmTestArtifactByteProof.v1', artifactReady: true, artifactGenerated: true, artifactByteLength: 1234, checksumSha256: '0'.repeat(64) };
const rvmByteProofAudit = { schema: 'RvmTestArtifactByteProofAudit.v1', ok: true, rvmStraightPipeSubsetArtifactReady: true, rvmFullModelArtifactReady: false };

const viewModel = buildDiagnosticPanelViewModel(diagnosticPreviewModel, diagnosticPreviewAudit, rvmByteProof, rvmByteProofAudit, { featureFlagEnabled: true });
assert.equal(validateDiagnosticPanelViewModel(viewModel).ok, true, 'view model validates');
assert.equal(viewModel.schema, 'DiagnosticPanelViewModel.v1');
assert.equal(viewModel.mode, 'readOnlyDiagnostics');
assert.equal(viewModel.featureFlagEnabled, true);
assert.equal(viewModel.overallStatus, 'partial-rvm-subset-ready');
assert.equal(viewModel.straightPipeSubsetCard.ready, true, 'RVM straight pipe subset ready');
assert.equal(viewModel.straightPipeSubsetCard.fullModelReady, false, 'RVM full model not ready');
assert.equal(viewModel.artifactCards.find((card) => card.key === 'att').status, 'BLOCKED');
assert.equal(viewModel.artifactCards.find((card) => card.key === 'glb').status, 'BLOCKED');
assert.equal(viewModel.summaryCards.find((card) => card.key === 'straightPipeCount').value, 19);
assert.equal(viewModel.summaryCards.find((card) => card.key === 'blockedFlangeCount').value, 8);
assert.equal(viewModel.summaryCards.find((card) => card.key === 'blockedValveCount').value, 6);
assert.equal(viewModel.summaryCards.find((card) => card.key === 'blockedBendCount').value, 7);
assert.equal(viewModel.summaryCards.find((card) => card.key === 'deferredSupportCount').value, 12);
assert.equal(viewModel.sourceTraceRows.length, 52);
assert.equal(viewModel.blockedGroups.find((group) => group.key === 'flange').count, 8);
assert.equal(viewModel.blockedGroups.find((group) => group.key === 'valve').count, 6);
assert.equal(viewModel.blockedGroups.find((group) => group.key === 'bend').count, 7);
assert.equal(viewModel.deferredGroups.find((group) => group.key === 'support').count, 12);
assert.deepEqual(collectPanelForbiddenFieldHits(viewModel), [], 'no geometry/mesh/binary/text payload fields');

const bad = structuredClone(viewModel);
bad.sourceTraceRows[0].rvmBytes = 'forbidden';
assert.equal(validateDiagnosticPanelViewModel(bad).ok, false, 'view model rejects raw RVM bytes');

console.log('diagnostic panel view-model tests passed');

function buildPreviewModel() {
  const previewItems = [];
  const sourceTrace = [];
  pushRows('PIPE', 19, { family: 'pipe', diagnosticKind: 'straightPipeWriterPlan', diagnosticStatus: 'writerPlannedArtifactBlocked', artifactStatus: 'writerPlanned', writerStatus: 'planned', primitiveStatus: 'primitiveResolved' });
  pushRows('FLANGE', 8, { family: 'flange', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' });
  pushRows('VALVE', 6, { family: 'valve', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' });
  pushRows('BEND', 7, { family: 'elbow', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' });
  pushRows('SUPPORT', 12, { family: 'support', diagnosticKind: 'deferredSupport', diagnosticStatus: 'deferred', artifactStatus: 'deferred', writerStatus: 'deferred', primitiveStatus: 'deferred' });
  return { schema: 'DiagnosticCanvasPreviewModel.v1', graphId: 'bm-cii-panel-fixture', mode: 'diagnosticOnly', previewItems, sourceTrace };

  function pushRows(prefix, count, row) {
    for (let index = 1; index <= count; index += 1) {
      const sourceItemId = `${prefix}-${String(index).padStart(3, '0')}`;
      const item = { previewItemId: `DCP-${sourceItemId}`, sourceItemId, type: row.family, message: `${row.family} status`, ...row };
      previewItems.push(item);
      sourceTrace.push({ sourceItemId, family: row.family, type: row.family, bindingStatus: row.artifactStatus === 'writerPlanned' ? 'proceduralResolved' : row.family === 'support' ? 'supportIntent' : 'unresolved', geometryStatus: row.family === 'support' ? 'intentOnly' : row.primitiveStatus === 'primitiveResolved' ? 'resolved' : 'blocked', primitiveStatus: row.primitiveStatus, exportStatus: row.artifactStatus === 'writerPlanned' ? 'planned' : row.artifactStatus, writerStatus: row.writerStatus, artifactStatus: row.artifactStatus });
    }
  }
}

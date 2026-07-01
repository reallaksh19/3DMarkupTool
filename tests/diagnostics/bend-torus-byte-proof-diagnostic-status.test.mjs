import assert from 'node:assert/strict';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.diagnosticPreviewAudit.ok, true);
assert.equal(state.diagnosticPreviewAudit.previewItemCount, 52);
assert.equal(state.diagnosticPreviewAudit.straightPipeByteProvenPreviewCount, 19);
assert.equal(state.diagnosticPreviewAudit.bendTorusPrimitiveResolvedPreviewCount, 7);
assert.equal(state.diagnosticPreviewAudit.bendTorusByteProvenPreviewCount, 7);
assert.equal(state.diagnosticPreviewAudit.bendTorusWriterDeferredPreviewCount, 0);
assert.equal(state.diagnosticPreviewAudit.flangePrimitiveResolvedPreviewCount, 8);
assert.equal(state.diagnosticPreviewAudit.flangeByteProvenPreviewCount, 8);
assert.equal(state.diagnosticPreviewAudit.flangeWriterDeferredPreviewCount, 0);
assert.equal(state.diagnosticPreviewAudit.blockedComponentPreviewCount, 6);
assert.equal(state.diagnosticPreviewAudit.blockedFlangePreviewCount, 0);
assert.equal(state.diagnosticPreviewAudit.blockedValvePreviewCount, 6);
assert.equal(state.diagnosticPreviewAudit.blockedBendPreviewCount, 0);
assert.equal(state.diagnosticPreviewAudit.deferredSupportPreviewCount, 12);
assert.equal(state.diagnosticPreviewAudit.sourceTraceCount, 52);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'bendTorusByteProvenCount').value, 7);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'bendTorusWriterDeferredCount').value, 0);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'blockedBendCount').value, 0);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'flangeByteProvenCount').value, 8);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'flangeWriterDeferredCount').value, 0);
assert.equal(state.diagnosticPanelViewModel.artifactCards.find((entry) => entry.key === 'bendTorus').status, 'READY');
assertNoRawRuntimePayload({ model: state.diagnosticPreviewModel, panel: state.diagnosticPanelViewModel });

console.log('bend torus byte proof diagnostic status test passed');

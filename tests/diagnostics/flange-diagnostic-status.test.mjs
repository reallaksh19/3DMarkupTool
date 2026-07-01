import assert from 'node:assert/strict';
import { assertDiagnosticCanvasPreviewAudit } from '../../src/audit/diagnostic-canvas-preview-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.diagnosticPreviewAudit.ok, true);
assert.equal(assertDiagnosticCanvasPreviewAudit(state.diagnosticPreviewAudit, { ok: true, previewItemCount: 52, straightPipeByteProvenPreviewCount: 19, bendTorusByteProvenPreviewCount: 7, flangePrimitiveResolvedPreviewCount: 8, flangeWriterDeferredPreviewCount: 8, blockedComponentPreviewCount: 6, blockedFlangePreviewCount: 0, blockedValvePreviewCount: 6, blockedBendPreviewCount: 0, deferredSupportPreviewCount: 12, geometryPayloadCount: 0, meshPayloadCount: 0, threeObjectCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'flangePrimitiveResolvedCount').value, 8);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'flangeWriterDeferredCount').value, 8);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'blockedFlangeCount').value, 0);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'blockedValveCount').value, 6);
assert.equal(state.diagnosticPanelViewModel.artifactCards.find((entry) => entry.key === 'flangePrimitive').status, 'DEFERRED');
assertNoRawRuntimePayload({ model: state.diagnosticPreviewModel, panel: state.diagnosticPanelViewModel });

console.log('flange diagnostic status test passed');

import assert from 'node:assert/strict';
import { assertDiagnosticCanvasPreviewAudit } from '../../src/audit/diagnostic-canvas-preview-audit.js';
import { buildBmCiiPhase11aState, assertNoRawRuntimePayload } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.diagnosticPreviewAudit.ok, true);
assert.equal(assertDiagnosticCanvasPreviewAudit(state.diagnosticPreviewAudit, { ok: true, previewItemCount: 52, straightPipeByteProvenPreviewCount: 19, bendTorusPrimitiveResolvedPreviewCount: 7, bendTorusByteProvenPreviewCount: 7, bendTorusWriterDeferredPreviewCount: 0, blockedComponentPreviewCount: 14, blockedFlangePreviewCount: 8, blockedValvePreviewCount: 6, blockedBendPreviewCount: 0, deferredSupportPreviewCount: 12, sourceTraceCount: 52, geometryPayloadCount: 0, meshPayloadCount: 0, threeObjectCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'bendTorusByteProvenCount').value, 7);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'bendTorusWriterDeferredCount').value, 0);
assert.equal(state.diagnosticPanelViewModel.summaryCards.find((entry) => entry.key === 'blockedBendCount').value, 0);
assert.equal(state.diagnosticPanelViewModel.artifactCards.find((entry) => entry.key === 'bendTorus').status, 'READY');
assertNoRawRuntimePayload({ model: state.diagnosticPreviewModel, panel: state.diagnosticPanelViewModel });

console.log('bend torus byte proof diagnostic status test passed');

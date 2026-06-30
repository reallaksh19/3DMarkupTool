import assert from 'node:assert/strict';
import { assertControlledPreviewAudit } from '../../src/audit/controlled-preview-audit.js';
import { renderControlledPreviewHtml } from '../../src/ui/controlled-preview/controlled-preview-panel.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.controlledPreviewAudit.ok, true);
assert.equal(assertControlledPreviewAudit(state.controlledPreviewAudit, { ok: true, controlledPreviewItemCount: 52, straightPipeSubsetPreviewCount: 19, bendTorusPrimitiveResolvedCount: 7, bendTorusWriterDeferredCount: 7, blockedComponentPreviewCount: 14, blockedFlangePreviewCount: 8, blockedValvePreviewCount: 6, blockedBendPreviewCount: 0, deferredSupportPreviewCount: 12, sourceTracePreviewCount: 52, rvmStraightPipeSubsetReady: true, rvmFullModelReady: false, attReady: false, glbReady: false, writerCallCount: 0, cacheKeyMutationCount: 0 }).ok, true);
const html = renderControlledPreviewHtml(state.controlledPreviewModel);
assert.ok(html.includes('Controlled shadow preview'));
assert.ok(html.includes('bends resolved as TORUS primitive'));
assert.ok(html.includes('bend TORUS writer/artifact deferred'));
assert.ok(html.includes('RVM full model: NOT READY'));
assert.equal(state.controlledPreviewModel.artifactReadiness.blockedBendCount, 0);
assert.equal(state.controlledPreviewModel.deferredPreview.filter((entry) => entry.previewStatus === 'bendTorusWriterDeferred').length, 7);

console.log('bend torus controlled preview status tests passed');

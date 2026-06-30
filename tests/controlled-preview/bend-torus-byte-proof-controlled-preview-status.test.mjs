import assert from 'node:assert/strict';
import { assertControlledPreviewAudit } from '../../src/audit/controlled-preview-audit.js';
import { renderControlledPreviewHtml } from '../../src/ui/controlled-preview/controlled-preview-panel.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.controlledPreviewAudit.ok, true);
assert.equal(assertControlledPreviewAudit(state.controlledPreviewAudit, { ok: true, controlledPreviewItemCount: 52, straightPipeSubsetPreviewCount: 26, bendTorusPrimitiveResolvedCount: 7, bendTorusByteProvenCount: 7, bendTorusWriterDeferredCount: 0, blockedComponentPreviewCount: 14, blockedFlangePreviewCount: 8, blockedValvePreviewCount: 6, blockedBendPreviewCount: 0, deferredSupportPreviewCount: 12, sourceTracePreviewCount: 52, rvmPipeBendSubsetReady: true, rvmStraightPipeSubsetReady: true, rvmFullModelReady: false, attReady: false, glbReady: false, geometryPayloadCount: 0, meshPayloadCount: 0, threeObjectCount: 0, runtimeMutationCount: 0, browserTouchCount: 0, canvasTouchCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, writerCallCount: 0, cacheKeyMutationCount: 0 }).ok, true);
const html = renderControlledPreviewHtml(state.controlledPreviewModel);
assert.ok(html.includes('RVM pipe+bend subset: READY'));
assert.ok(html.includes('Bend TORUS test byte proof: READY'));
assert.ok(html.includes('RVM full model: NOT READY'));
assert.equal(html.includes('Bend TORUS writer/artifact: DEFERRED'), false);
assert.equal(state.controlledPreviewModel.artifactReadiness.blockedBendCount, 0);
assert.equal(state.controlledPreviewModel.artifactReadiness.bendTorusByteProvenCount, 7);

console.log('bend torus byte proof controlled preview status test passed');

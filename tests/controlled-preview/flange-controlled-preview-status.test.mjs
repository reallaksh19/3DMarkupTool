import assert from 'node:assert/strict';
import { assertControlledPreviewAudit } from '../../src/audit/controlled-preview-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.controlledPreviewAudit.ok, true);
assert.equal(assertControlledPreviewAudit(state.controlledPreviewAudit, { ok: true, controlledPreviewItemCount: 52, straightPipeSubsetPreviewCount: 19, bendTorusByteProvenCount: 7, flangePrimitiveResolvedCount: 8, flangeWriterDeferredCount: 8, blockedComponentPreviewCount: 6, blockedFlangePreviewCount: 0, blockedValvePreviewCount: 6, blockedBendPreviewCount: 0, deferredSupportPreviewCount: 12, sourceTracePreviewCount: 52, rvmPipeBendSubsetReady: true, rvmStraightPipeSubsetReady: true, rvmFlangeSubsetReady: false, rvmFullModelReady: false, attReady: false, glbReady: false, geometryPayloadCount: 0, meshPayloadCount: 0, threeObjectCount: 0, runtimeMutationCount: 0, browserTouchCount: 0, canvasTouchCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, writerCallCount: 0, cacheKeyMutationCount: 0 }).ok, true);
assert.equal(state.controlledPreviewModel.artifactReadiness.flangePrimitiveResolvedCount, 8);
assert.equal(state.controlledPreviewModel.artifactReadiness.flangeWriterDeferredCount, 8);
assert.equal(state.controlledPreviewModel.artifactReadiness.blockedFlangeCount, 0);
assert.equal(state.controlledPreviewModel.artifactReadiness.blockedValveCount, 6);
assert.equal(state.controlledPreviewModel.artifactReadiness.rvmFullModelReady, false);

console.log('flange controlled preview status test passed');

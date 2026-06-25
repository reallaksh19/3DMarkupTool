import assert from 'node:assert/strict';
import {
  MANAGED_STAGE_SUPPORT_DEBUG_LOG_SCHEMA,
  buildManagedStageSupportDebugReport,
  formatManagedStageSupportDebugReport
} from '../src/managed-stage-support-debug-log.js';

function makeObject(name, userData = {}, children = []) {
  return {
    name,
    userData,
    children,
    traverse(callback) {
      callback(this);
      for (const child of children) {
        if (typeof child.traverse === 'function') child.traverse(callback);
        else callback(child);
      }
    }
  };
}

const supportRaw = makeObject('raw-guide', {
  primitiveKind: 'raw-staged-source-line',
  sourceName: 'PS-100 GUIDE',
  sourcePath: 'ROOT/PS-100',
  stagedType: 'SUPPORT',
  rawType: 'GUIDE',
  dtxr: 'GUIDE',
  sourceAposMm: { x: 0, y: 0, z: 0 },
  sourceLposMm: { x: 100, y: 0, z: 0 }
});
const pipeRaw = makeObject('raw-pipe', {
  primitiveKind: 'raw-staged-source-line',
  sourceName: 'PIPE-1',
  stagedType: 'PIPE',
  rawType: 'PIPE',
  dtxr: 'PIPE',
  sourceAposMm: { x: 0, y: 0, z: 0 },
  sourceLposMm: { x: 200, y: 0, z: 0 }
});
const overlay = makeObject('MANAGED_STAGE_SUPPORT_SOURCE_OVERLAY_STAGED_JSON', {}, [
  makeObject('support-symbol', {
    primitiveKind: 'managed-stage-support-symbol',
    managedStageSupportVisual: true,
    supportVisual: { family: 'GUIDE' }
  })
]);
const root = makeObject('model-root', {
  managedStageSupportSourcePreview: {
    diagnostics: {
      status: 'stagedJson',
      sourceMode: 'stagedJson',
      pass: true,
      pipeRecordCount: 1,
      stagedJsonSupportRecordCount: 1,
      overlayPrimitiveGroupCount: 1,
      supportSymbolCount: 1,
      supportFamilyHistogram: { GUIDE: 1 },
      supportCanvasAxisHistogram: { '+Z': 1 },
      supportRulePreviewRows: [
        { supportTag: 'PS-100', family: 'GUIDE', node: '100', sourceAxis: '-X', canvasAxis: '+Z', sign: '', gapMm: 10, emittedSymbolCount: 2, popupRequired: false }
      ]
    }
  },
  managedStageSupportPreviewAutoApply: {
    status: 'applied',
    requestedBy: 'viewer-model-loaded',
    sourceMode: 'stagedJson',
    supportSymbolCount: 1,
    bridgeStatus: 'stagedJson'
  }
}, [supportRaw, pipeRaw, overlay]);

const logNode = { textContent: '', scrollTop: 0, scrollHeight: 100 };
const report = buildManagedStageSupportDebugReport({
  win: {
    __3D_MARKUP_APP_LOADER_VERSION__: 'support-debug-log-20260623',
    __3D_MARKUP_APP_BOOT_COMPLETE__: true,
    __3D_MARKUP_SUPPORT_SOURCE_UI__: { sourceMode: 'stagedJson', mapperPresetId: 'caesar-default', axisBasis: { northSourceAxis: '-X', northCanvasAxis: '+Z' } },
    __3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__: { apply() {}, cacheKey: 'bridge-key' },
    __3D_MARKUP_SUPPORT_PREVIEW_AUTO_APPLY__: { apply() {}, cacheKey: 'auto-key' },
    __3D_MARKUP_VIEWER_RUNTIME__: { modelRoot: root }
  },
  doc: { getElementById: (id) => (id === 'log' ? logNode : null) },
  reason: 'unit-test'
});

assert.equal(report.schema, MANAGED_STAGE_SUPPORT_DEBUG_LOG_SCHEMA);
assert.equal(report.modelRootPresent, true);
assert.equal(report.scene.rawStagedLineCount, 2);
assert.equal(report.scene.rawSupportCandidateCount, 1);
assert.equal(report.scene.rawRejectedNoSupportTokenCount, 1);
assert.equal(report.scene.stagedOverlayRootCount, 1);
assert.equal(report.diagnostics.supportSymbolCount, 1);
assert.equal(report.autoApply.status, 'applied');

const text = formatManagedStageSupportDebugReport(report);
assert.match(text, /SUPPORT_DEBUG_BEGIN/);
assert.match(text, /support candidates=1/);
assert.match(text, /rejectedNoToken=1/);
assert.match(text, /familyHistogram=\{"GUIDE":1\}/);
assert.match(text, /tag=PS-100 family=GUIDE/);
assert.match(text, /SUPPORT_DEBUG_END/);

console.log('Managed-stage support debug log tests passed');

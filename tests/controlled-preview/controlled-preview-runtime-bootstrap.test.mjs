import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { maybeMountShadowDiagnosticsPanel } from '../../src/diagnostics/shadow-diagnostics-runtime-bootstrap.js';

const offDoc = fakeDocument();
const off = await maybeMountShadowDiagnosticsPanel({ locationLike: { search: '' }, storageLike: storage({ diagnostics: 'false', preview: 'false' }), documentLike: offDoc });
assert.equal(off.mounted, false, 'diagnostics flag off mounts nothing');
assert.equal(off.previewMounted, false, 'diagnostics flag off has no preview');
assert.equal(offDoc.body.children.length, 0, 'flag off creates no DOM');
assert.equal(off.heavyPipelineExecuted, false);

const diagOnlyDoc = fakeDocument();
const diagOnly = await maybeMountShadowDiagnosticsPanel({ locationLike: { search: '?shadowDiagnostics=1' }, storageLike: storage({ diagnostics: 'false', preview: 'false' }), documentLike: diagOnlyDoc, diagnosticState: buildDiagnosticState() });
assert.equal(diagOnly.mounted, true, 'diagnostics panel mounts');
assert.equal(diagOnly.previewMounted, false, 'preview does not mount without second flag');
assert.equal(diagOnlyDoc.body.children.length, 1, 'only diagnostic container created');
assert.ok(diagOnlyDoc.body.children[0].innerHTML.includes('RVM straight-pipe subset byte proof: READY'));
assert.equal(JSON.stringify(diagOnlyDoc).includes('Controlled shadow preview'), false, 'preview DOM absent when preview flag off');

const noModelDoc = fakeDocument();
const noModel = await maybeMountShadowDiagnosticsPanel({ locationLike: { search: '?shadowDiagnostics=1&shadowPreview=1' }, storageLike: storage({ diagnostics: 'false', preview: 'false' }), documentLike: noModelDoc });
assert.equal(noModel.mounted, true, 'diagnostics empty state mounts');
assert.equal(noModel.previewMounted, true, 'preview empty state mounts');
assert.ok(noModelDoc.body.children[1].innerHTML.includes('Controlled preview unavailable: diagnostic/artifact state not available.'), 'preview unavailable state shown');
assert.equal(noModel.heavyPipelineExecuted, false);

const previewDoc = fakeDocument();
const preview = await maybeMountShadowDiagnosticsPanel({ locationLike: { search: '' }, storageLike: storage({ diagnostics: 'true', preview: 'true' }), documentLike: previewDoc, diagnosticState: buildDiagnosticState() });
assert.equal(preview.mounted, true);
assert.equal(preview.previewMounted, true, 'preview mounts when both flags enabled');
assert.ok(previewDoc.body.children[1].innerHTML.includes('Controlled shadow preview — diagnostic/artifact state only, not geometry.'));
assert.ok(previewDoc.body.children[1].innerHTML.includes('RVM full model: NOT READY'));
assert.equal(JSON.stringify(previewDoc).includes('objectUrl'), false, 'no object URL');
assert.equal(JSON.stringify(previewDoc).includes('downloadUrl'), false, 'no download URL');
assert.equal(JSON.stringify(previewDoc).includes('attText'), false, 'no ATT text');
assert.equal(JSON.stringify(previewDoc).includes('glbBytes'), false, 'no GLB bytes');

const source = await readFile('src/diagnostics/shadow-diagnostics-runtime-bootstrap.js', 'utf8');
for (const forbidden of ['rvm-test-byte-artifact-adapter', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter', "from 'three'", 'from "three"', 'createObjectURL']) {
  assert.equal(source.includes(forbidden), false, `runtime bootstrap must not reference ${forbidden}`);
}
for (const runtimePath of ['src/app.js', 'src/safe-ui-loader.js', 'src/app-loader.js', 'src/managed-stage-json-ui-controller.js', 'src/managed-stage-rvm-converter.js']) {
  const runtimeSource = await readFile(runtimePath, 'utf8');
  assert.equal(runtimeSource.includes('rvm-test-byte-artifact-adapter'), false, `${runtimePath} must not import byte adapter`);
}

console.log('controlled preview runtime bootstrap tests passed');

function buildDiagnosticState() {
  const previewItems = [
    { previewItemId: 'DCP-PIPE-1', sourceItemId: 'PIPE-1', family: 'pipe', diagnosticKind: 'straightPipeWriterPlan', diagnosticStatus: 'writerPlannedArtifactBlocked', artifactStatus: 'writerPlanned', writerStatus: 'planned', primitiveStatus: 'primitiveResolved' },
    { previewItemId: 'DCP-VALVE-1', sourceItemId: 'VALVE-1', family: 'valve', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' },
    { previewItemId: 'DCP-SUPPORT-1', sourceItemId: 'SUPPORT-1', family: 'support', diagnosticKind: 'deferredSupport', diagnosticStatus: 'deferred', artifactStatus: 'deferred', writerStatus: 'deferred', primitiveStatus: 'deferred' }
  ];
  const sourceTrace = previewItems.map((item) => ({ sourceItemId: item.sourceItemId, family: item.family, type: item.family, primitiveStatus: item.primitiveStatus, writerStatus: item.writerStatus, artifactStatus: item.artifactStatus }));
  return {
    diagnosticPreviewModel: { schema: 'DiagnosticCanvasPreviewModel.v1', graphId: 'runtime-preview-test', mode: 'diagnosticOnly', previewItems, sourceTrace },
    diagnosticPreviewAudit: { schema: 'DiagnosticCanvasPreviewAudit.v1', ok: true, hardErrorCount: 0 },
    rvmByteProof: { schema: 'RvmTestArtifactByteProof.v1', artifactReady: true, artifactByteLength: 10, checksumSha256: '0'.repeat(64) },
    rvmByteProofAudit: { schema: 'RvmTestArtifactByteProofAudit.v1', ok: true, rvmStraightPipeSubsetArtifactReady: true, rvmFullModelArtifactReady: false }
  };
}

function storage(values) {
  return {
    getItem(key) {
      if (key === '3dmt.shadowDiagnostics.enabled') return values.diagnostics;
      if (key === '3dmt.shadowPreview.enabled') return values.preview;
      return null;
    },
    setItem() { throw new Error('setItem must not be called'); }
  };
}

function fakeDocument() {
  const body = { children: [], appendChild(node) { this.children.push(node); return node; } };
  return {
    body,
    documentElement: body,
    getElementById() { return null; },
    createElement(tag) {
      return { tagName: tag.toUpperCase(), innerHTML: '', id: '', attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, appendChild(child) { this.children = this.children || []; this.children.push(child); return child; } };
    }
  };
}

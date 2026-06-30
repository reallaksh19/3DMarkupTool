import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { maybeMountShadowDiagnosticsPanel } from '../../src/diagnostics/shadow-diagnostics-runtime-bootstrap.js';

const disabledDocument = fakeDocument();
const disabled = await maybeMountShadowDiagnosticsPanel({ locationLike: { search: '' }, storageLike: storage('false'), documentLike: disabledDocument });
assert.equal(disabled.mounted, false, 'flag off does not mount');
assert.equal(disabled.reason, 'feature flag disabled');
assert.equal(disabled.heavyPipelineExecuted, false, 'flag off does not execute heavy pipeline');
assert.equal(disabledDocument.created.length, 0, 'flag off creates no visible DOM');

const noModelDocument = fakeDocument();
const noModel = await maybeMountShadowDiagnosticsPanel({ locationLike: { search: '?shadowDiagnostics=1' }, storageLike: storage('false'), documentLike: noModelDocument });
assert.equal(noModel.mounted, true, 'flag on mounts empty state');
assert.equal(noModel.heavyPipelineExecuted, false, 'flag on still does not run heavy pipeline');
assert.ok(noModelDocument.body.children[0].innerHTML.includes('No diagnostic model available yet'), 'empty state rendered');

const modelDocument = fakeDocument();
const model = await maybeMountShadowDiagnosticsPanel({ locationLike: { search: '' }, storageLike: storage('true'), documentLike: modelDocument, diagnosticState: buildDiagnosticState() });
assert.equal(model.mounted, true, 'flag on with model mounts panel');
assert.equal(model.reason, 'mounted');
assert.equal(model.heavyPipelineExecuted, false, 'runtime does not run shadow pipeline');
assert.ok(modelDocument.body.children[0].innerHTML.includes('RVM straight-pipe subset byte proof: READY'));
assert.ok(modelDocument.body.children[0].innerHTML.includes('RVM full model: NOT READY'));
assert.equal(JSON.stringify(modelDocument).includes('objectUrl'), false, 'no object URLs');
assert.equal(JSON.stringify(modelDocument).includes('downloadUrl'), false, 'no downloads');
assert.equal(JSON.stringify(modelDocument).includes('attText'), false, 'no ATT payload');
assert.equal(JSON.stringify(modelDocument).includes('glbBytes'), false, 'no GLB payload');

const bootstrapSource = await readFile('src/diagnostics/shadow-diagnostics-runtime-bootstrap.js', 'utf8');
for (const forbidden of ['rvm-test-byte-artifact-adapter', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter', "from 'three'", 'from "three"', 'createObjectURL']) {
  assert.equal(bootstrapSource.includes(forbidden), false, `runtime bootstrap must not reference ${forbidden}`);
}
for (const runtimePath of ['src/app.js', 'src/safe-ui-loader.js', 'src/app-loader.js', 'src/managed-stage-json-ui-controller.js', 'src/managed-stage-rvm-converter.js']) {
  const source = await readFile(runtimePath, 'utf8');
  assert.equal(source.includes('rvm-test-byte-artifact-adapter'), false, `${runtimePath} must not import byte proof adapter`);
}
const appLoader = await readFile('src/app-loader.js', 'utf8');
assert.ok(appLoader.includes('loadShadowDiagnosticsPanelIfEnabled'), 'app-loader has one guarded diagnostics hook');
assert.ok(appLoader.includes('isShadowDiagnosticsMaybeEnabled'), 'app-loader checks flag before dynamic import');
assert.equal(appLoader.includes('rvm-writer'), false, 'app-loader does not import writer');

console.log('shadow diagnostics runtime bootstrap tests passed');

function buildDiagnosticState() {
  const previewItems = [
    { previewItemId: 'DCP-PIPE-1', sourceItemId: 'PIPE-1', family: 'pipe', diagnosticKind: 'straightPipeWriterPlan', diagnosticStatus: 'writerPlannedArtifactBlocked', artifactStatus: 'writerPlanned', writerStatus: 'planned', primitiveStatus: 'primitiveResolved' },
    { previewItemId: 'DCP-VALVE-1', sourceItemId: 'VALVE-1', family: 'valve', diagnosticKind: 'blockedComponent', diagnosticStatus: 'blockedUnresolved', artifactStatus: 'blocked', writerStatus: 'blocked', primitiveStatus: 'blocked' },
    { previewItemId: 'DCP-SUPPORT-1', sourceItemId: 'SUPPORT-1', family: 'support', diagnosticKind: 'deferredSupport', diagnosticStatus: 'deferred', artifactStatus: 'deferred', writerStatus: 'deferred', primitiveStatus: 'deferred' }
  ];
  const sourceTrace = previewItems.map((item) => ({ sourceItemId: item.sourceItemId, family: item.family, primitiveStatus: item.primitiveStatus, writerStatus: item.writerStatus, artifactStatus: item.artifactStatus }));
  return {
    diagnosticPreviewModel: { schema: 'DiagnosticCanvasPreviewModel.v1', graphId: 'runtime-test', mode: 'diagnosticOnly', previewItems, sourceTrace },
    diagnosticPreviewAudit: { schema: 'DiagnosticCanvasPreviewAudit.v1', ok: true, hardErrorCount: 0 },
    rvmByteProof: { schema: 'RvmTestArtifactByteProof.v1', artifactReady: true, artifactByteLength: 10, checksumSha256: '0'.repeat(64) },
    rvmByteProofAudit: { schema: 'RvmTestArtifactByteProofAudit.v1', ok: true, rvmStraightPipeSubsetArtifactReady: true, rvmFullModelArtifactReady: false }
  };
}

function storage(value) {
  return { getItem: () => value, setItem: () => { throw new Error('setItem must not be called'); } };
}

function fakeDocument() {
  const body = { children: [], appendChild(node) { this.children.push(node); return node; } };
  return {
    created: [],
    body,
    documentElement: body,
    getElementById() { return null; },
    createElement(tag) {
      const element = { tagName: tag.toUpperCase(), innerHTML: '', id: '', attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, appendChild(child) { this.children = this.children || []; this.children.push(child); return child; } };
      this.created.push(element);
      return element;
    }
  };
}

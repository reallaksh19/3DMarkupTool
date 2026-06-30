import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  mountControlledPreview,
  renderControlledPreviewHtml,
  unmountControlledPreview
} from '../../src/ui/controlled-preview/controlled-preview-panel.js';

const model = {
  schema: 'ControlledPreviewModel.v1',
  graphId: 'renderer-test',
  mode: 'controlledPreview',
  previewKind: 'diagnosticArtifactState',
  featureFlags: { shadowDiagnostics: true, shadowPreview: true },
  overallStatus: 'partial-rvm-subset-ready',
  provenance: {},
  artifactReadiness: { rvmStraightPipeSubsetReady: true, rvmFullModelReady: false, attReady: false, glbReady: false, blockedFlangeCount: 8, blockedValveCount: 6, blockedBendCount: 7, deferredSupportCount: 12 },
  previewSections: [],
  straightPipeSubsetPreview: [],
  blockedPreview: [],
  deferredPreview: [],
  sourceTracePreview: [
    { previewId: 'CP-1', sourceItemId: 'PIPE-<&>', family: 'pipe', type: 'pipe', previewStatus: 'rvmStraightPipeSubsetReady', readiness: 'ready', severity: 'info', label: 'Pipe', message: '<b>ready</b>', sourceRef: '' },
    { previewId: 'CP-2', sourceItemId: 'VALVE-1', family: 'valve', type: 'gate', previewStatus: 'blockedComponent', readiness: 'blocked', severity: 'blocked', label: 'Valve', message: 'blocked', sourceRef: '' },
    { previewId: 'CP-3', sourceItemId: 'SUPPORT-1', family: 'support', type: 'REST', previewStatus: 'deferredSupport', readiness: 'deferred', severity: 'warning', label: 'Support', message: 'deferred', sourceRef: '' }
  ],
  warnings: [],
  errors: []
};

const html = renderControlledPreviewHtml(model);
assert.ok(html.includes('Controlled shadow preview — diagnostic/artifact state only, not geometry.'), 'renders warning label');
assert.ok(html.includes('RVM straight-pipe subset: READY'), 'renders subset ready');
assert.ok(html.includes('RVM full model: NOT READY'), 'renders full model not ready');
assert.ok(html.includes('ATT: BLOCKED'), 'renders ATT blocked');
assert.ok(html.includes('GLB: BLOCKED'), 'renders GLB blocked');
assert.ok(html.includes('flanges blocked'), 'renders blocked counts');
assert.equal(html.includes('<b>ready</b>'), false, 'escapes HTML');
assert.ok(html.includes('&lt;b&gt;ready&lt;/b&gt;'), 'escaped HTML shown as text');
assert.equal(/<button/i.test(html), false, 'no buttons');
assert.equal(/download/i.test(html), false, 'no download controls');
assert.equal(/generate RVM/i.test(html), false, 'no generate controls');
assert.equal(/<canvas/i.test(html), false, 'no canvas');
assert.equal(/createObjectURL|objectUrl/i.test(html), false, 'no object URL APIs');

const container = { innerHTML: '', attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; } };
assert.equal(mountControlledPreview(container, model).mounted, true, 'mount succeeds');
assert.ok(container.innerHTML.includes('controlled-preview-panel'));
assert.equal(container.attrs['data-controlled-preview-mounted'], 'true');
assert.equal(unmountControlledPreview(container).mounted, false, 'unmount succeeds');
assert.equal(container.innerHTML, '', 'container cleared');

const source = await readFile('src/ui/controlled-preview/controlled-preview-panel.js', 'utf8');
for (const forbidden of ["from 'three'", 'from "three"', 'rvm-writer', 'att-writer', 'rvm-test-byte-artifact-adapter', 'managed-stage-rvm-converter', 'createObjectURL']) {
  assert.equal(source.includes(forbidden), false, `controlled preview renderer must not reference ${forbidden}`);
}

console.log('controlled preview renderer tests passed');

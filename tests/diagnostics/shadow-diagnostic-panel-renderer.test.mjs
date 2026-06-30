import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  mountShadowDiagnosticPanel,
  renderShadowDiagnosticPanelHtml,
  unmountShadowDiagnosticPanel
} from '../../src/ui/diagnostic-panel/shadow-diagnostic-panel.js';

const viewModel = {
  schema: 'DiagnosticPanelViewModel.v1',
  graphId: '<script>alert(1)</script>',
  mode: 'readOnlyDiagnostics',
  featureFlagEnabled: true,
  overallStatus: 'partial-rvm-subset-ready',
  artifactCards: [
    { key: 'rvmStraightPipeSubset', title: 'RVM straight-pipe subset byte proof', status: 'READY', reason: 'safe' },
    { key: 'rvmFullModel', title: 'RVM full model', status: 'NOT READY', reason: 'blocked/deferred content remains' },
    { key: 'att', title: 'ATT', status: 'BLOCKED', reason: '<img src=x onerror=alert(1)>' },
    { key: 'glb', title: 'GLB', status: 'BLOCKED', reason: 'blocked' }
  ],
  summaryCards: [
    { key: 'blockedFlangeCount', label: 'Flanges blocked', value: 8 },
    { key: 'blockedValveCount', label: 'Valves blocked', value: 6 },
    { key: 'blockedBendCount', label: 'Bends blocked', value: 7 },
    { key: 'deferredSupportCount', label: 'Supports deferred', value: 12 }
  ],
  blockedGroups: [{ key: 'valve', label: 'Valves blocked', count: 6, rows: [{ sourceItemId: 'VALVE-<&>', type: 'gate', reason: '<b>blocked</b>' }] }],
  deferredGroups: [{ key: 'support', label: 'Supports deferred', count: 12, rows: [{ sourceItemId: 'SUPPORT-1', type: 'REST', reason: 'deferred' }] }],
  straightPipeSubsetCard: { status: 'READY', fullModelReady: false },
  sourceTraceRows: [{ sourceItemId: 'PIPE-1', family: 'pipe', bindingStatus: 'proceduralResolved', geometryStatus: 'resolved', primitiveStatus: 'primitiveResolved', exportStatus: 'planned', writerStatus: 'planned', artifactStatus: 'writerPlanned' }],
  warnings: [],
  errors: []
};

const html = renderShadowDiagnosticPanelHtml(viewModel);
assert.ok(html.includes('RVM straight-pipe subset byte proof: READY'), 'renders RVM subset ready text');
assert.ok(html.includes('RVM full model: NOT READY'), 'renders full-model not-ready text');
assert.ok(html.includes('ATT: BLOCKED'), 'renders ATT blocked');
assert.ok(html.includes('GLB: BLOCKED'), 'renders GLB blocked');
assert.ok(html.includes('Flanges blocked'), 'renders blocked counts');
assert.ok(html.includes('Supports deferred'), 'renders deferred counts');
assert.equal(html.includes('<img src=x'), false, 'escapes HTML payload');
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'escaped HTML appears as text');
assert.equal(/<button/i.test(html), false, 'no buttons');
assert.equal(/download/i.test(html), false, 'no download controls');
assert.equal(/objectURL|createObjectURL/i.test(html), false, 'no object URL controls');
assert.equal(/<canvas/i.test(html), false, 'no canvas elements');

const container = { innerHTML: '', attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; } };
const mountResult = mountShadowDiagnosticPanel(container, viewModel);
assert.equal(mountResult.mounted, true, 'mount succeeds');
assert.ok(container.innerHTML.includes('shadow-diagnostic-panel'), 'panel mutates only provided container');
assert.equal(container.attributes['data-shadow-diagnostics-mounted'], 'true');
assert.equal(unmountShadowDiagnosticPanel(container).mounted, false, 'unmount succeeds');
assert.equal(container.innerHTML, '', 'container cleared');

const source = await readFile('src/ui/diagnostic-panel/shadow-diagnostic-panel.js', 'utf8');
for (const forbidden of ["from 'three'", 'from "three"', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter', 'createObjectURL']) {
  assert.equal(source.includes(forbidden), false, `renderer must not reference ${forbidden}`);
}

console.log('shadow diagnostic panel renderer tests passed');

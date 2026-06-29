import {
  NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS,
  transformNavisSourceAxisToCanvas
} from './support-axis-basis-config.js?v=bust-cache-4';
import { resolveSupportAxisTransform } from './support-axis-transform.js?v=bust-cache-4';

export const SUPPORT_AXIS_TRANSFORM_UI_DEBUG_SCHEMA = 'SupportAxisTransformUiDebugController.v1';

const AXIS_SAMPLE_ROWS = Object.freeze([
  '+X', '-X', '+Y', '-Y', '+Z', '-Z'
]);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportAxisTransformUiDebugController, { once: true });
} else {
  installSupportAxisTransformUiDebugController();
}

export function installSupportAxisTransformUiDebugController({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || !doc || win.__3D_MARKUP_SUPPORT_AXIS_TRANSFORM_UI_DEBUG__?.schema === SUPPORT_AXIS_TRANSFORM_UI_DEBUG_SCHEMA) {
    return win?.__3D_MARKUP_SUPPORT_AXIS_TRANSFORM_UI_DEBUG__ || null;
  }
  const api = {
    schema: SUPPORT_AXIS_TRANSFORM_UI_DEBUG_SCHEMA,
    basis: NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS,
    render: () => renderAxisTransformUi({ win, doc }),
    debugText: () => buildAxisTransformDebugText({ win })
  };
  win.__3D_MARKUP_SUPPORT_AXIS_TRANSFORM_UI_DEBUG__ = api;
  win.__3D_MARKUP_SUPPORT_AXIS_TRANSFORM_ACTIVE_CONFIG__ = buildAxisTransformConfigSummary(win);
  patchSupportDebugDump({ win, doc });
  renderAxisTransformUi({ win, doc });
  for (const eventName of [
    'managed-stage:support-settings-popup-ready',
    'managed-stage:support-source-ui-ready',
    'viewer:managed-stage-json-loaded',
    'viewer:app-module-loaded',
    'viewer:app-bundle-ready',
    'markup:safe-ui-status'
  ]) {
    win.addEventListener?.(eventName, () => setTimeout(() => {
      patchSupportDebugDump({ win, doc });
      renderAxisTransformUi({ win, doc });
    }, 0));
  }
  const timer = win.setInterval?.(() => {
    patchSupportDebugDump({ win, doc });
    renderAxisTransformUi({ win, doc });
  }, 750);
  win.setTimeout?.(() => win.clearInterval?.(timer), 15000);
  return api;
}

function renderAxisTransformUi({ win, doc }) {
  const mapperHost = doc.querySelector?.('#supportMappingSettingsDialog [data-support-settings-mapper-host]')
    || doc.querySelector?.('[data-support-settings-mapper-host]');
  if (!mapperHost) return false;
  let block = mapperHost.querySelector?.('[data-support-axis-transform-config]');
  if (!block) {
    block = doc.createElement('section');
    block.className = 'support-axis-transform-config-card';
    block.setAttribute('data-support-axis-transform-config', SUPPORT_AXIS_TRANSFORM_UI_DEBUG_SCHEMA);
    mapperHost.appendChild(block);
  }
  const summary = buildAxisTransformConfigSummary(win);
  block.innerHTML = [
    '<h4>Navis Axis Transform Config</h4>',
    `<p><strong>Status:</strong> active in source resolver (${escapeHtml(summary.resolverSchema)})</p>`,
    `<p><strong>Current loader:</strong> ${escapeHtml(summary.appLoaderVersion || 'unknown')} | <strong>bundle:</strong> ${escapeHtml(summary.bundleVersion || 'unknown')}</p>`,
    `<p><strong>Matrix:</strong> [xPrime, yPrime, zPrime] = [-y, x, z]</p>`,
    '<table><thead><tr><th>Source / Navis axis</th><th>Canvas axis</th><th>Proof</th></tr></thead><tbody>',
    ...summary.rows.map((row) => `<tr><td>${escapeHtml(row.sourceAxis)}</td><td>${escapeHtml(row.canvasAxis)}</td><td>${escapeHtml(row.proof)}</td></tr>`),
    '</tbody></table>',
    '<p class="support-axis-transform-config-note">Priority-2 proof target: source +X -&gt; canvas +Y. If the debug log still shows appLoaderVersion ...-f, the browser is running an old loader.</p>'
  ].join('');
  injectStyles(doc);
  cleanLauncherText(doc, summary);
  win.__3D_MARKUP_SUPPORT_AXIS_TRANSFORM_ACTIVE_CONFIG__ = summary;
  return true;
}

function cleanLauncherText(doc, summary) {
  const launcher = doc.querySelector?.('[data-support-settings-launcher-summary]');
  if (launcher && /â|Ã|†|‡/.test(launcher.textContent || '')) {
    launcher.textContent = `Support mapping: axis transform active | ${summary.rows.map((row) => `${row.sourceAxis}->${row.canvasAxis}`).join(', ')}`;
  }
  const north = doc.querySelector?.('[data-support-settings-north]');
  if (north) north.textContent = 'Navis signed-axis transform';
}

function patchSupportDebugDump({ win, doc }) {
  const api = win?.__3D_MARKUP_SUPPORT_DEBUG_LOG__;
  if (!api || typeof api.dump !== 'function' || api.__axisTransformDebugPatched) return false;
  const originalDump = api.dump.bind(api);
  api.dump = (options = {}) => {
    const report = originalDump(options);
    appendAxisTransformDebugToLog(doc, buildAxisTransformDebugText({ win, report }));
    return report;
  };
  api.__axisTransformDebugPatched = true;
  api.axisTransformDebugSchema = SUPPORT_AXIS_TRANSFORM_UI_DEBUG_SCHEMA;
  return true;
}

function buildAxisTransformDebugText({ win, report = null } = {}) {
  const summary = buildAxisTransformConfigSummary(win);
  const runtimeRows = collectRuntimeAxisRows(win, report);
  const lines = [
    '=== SUPPORT_AXIS_TRANSFORM_DEBUG_BEGIN ===',
    `schema=${SUPPORT_AXIS_TRANSFORM_UI_DEBUG_SCHEMA}`,
    `basisSchema=${summary.basisSchema}`,
    `resolverSchema=${summary.resolverSchema}`,
    `appLoaderVersion=${summary.appLoaderVersion}`,
    `bundleVersion=${summary.bundleVersion}`,
    `basisName=${summary.basisName}`,
    'matrix=[xPrime,yPrime,zPrime]=[-y,x,z]',
    `priorityProof source +X -> canvas ${transformNavisSourceAxisToCanvas('+X')}`,
    `transformTable=${summary.rows.map((row) => `${row.sourceAxis}->${row.canvasAxis}`).join(', ')}`,
    'resolvedSamples:'
  ];
  for (const row of summary.rows) {
    lines.push(`- sourceAxis=${row.sourceAxis} canvasAxis=${row.canvasAxis} actionAxis=${row.actionAxis} vector=${row.vector}`);
  }
  lines.push('familyRuleSamples:');
  for (const row of familyRuleSamples()) {
    lines.push(`- family=${row.family} sourceAction=${row.sourceActionAxes} canvasAxis=${row.canvasAxis} actionAxes=${row.actionAxes}`);
  }
  if (runtimeRows.length) {
    lines.push('runtimeAxisSamples:');
    for (const row of runtimeRows) {
      lines.push(`- name=${row.name} family=${row.family} sourceAxis=${row.sourceAxis} canvasAxis=${row.canvasAxis} actionAxes=${row.actionAxes} schema=${row.schema}`);
    }
  } else {
    lines.push('runtimeAxisSamples: none');
  }
  lines.push('=== SUPPORT_AXIS_TRANSFORM_DEBUG_END ===');
  return lines.join('\n');
}

function buildAxisTransformConfigSummary(win) {
  const rows = AXIS_SAMPLE_ROWS.map((axis) => {
    const resolved = resolveSupportAxisTransform({ sourceAxis: axis, supportFamily: 'UNKNOWN' });
    return {
      sourceAxis: axis,
      canvasAxis: resolved.canvasAxis,
      actionAxis: resolved.supportActionAxes?.join('/') || '',
      vector: vectorText(resolved.axisVector),
      proof: `${axis} -> ${resolved.canvasAxis}`
    };
  });
  return {
    schema: SUPPORT_AXIS_TRANSFORM_UI_DEBUG_SCHEMA,
    basisSchema: NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS.schema || '',
    resolverSchema: resolveSupportAxisTransform({ sourceAxis: '+X' }).schema || '',
    appLoaderVersion: String(win?.__3D_MARKUP_APP_LOADER_VERSION__ || ''),
    bundleVersion: String(win?.__3D_MARKUP_BUNDLED_ASSETS__?.version || ''),
    basisName: NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS.name || '',
    rows
  };
}

function familyRuleSamples() {
  return ['REST', 'HOLDDOWN', 'SPRING_CAN', 'GUIDE'].map((family) => {
    const resolved = resolveSupportAxisTransform({ supportFamily: family });
    return {
      family,
      sourceActionAxes: resolved.sourceActionAxes?.join('/') || '',
      canvasAxis: resolved.canvasAxis,
      actionAxes: resolved.supportActionAxes?.join('/') || ''
    };
  });
}

function collectRuntimeAxisRows(win, report) {
  const rows = [];
  const root = win?.__3D_MARKUP_VIEWER_RUNTIME__?.getModelRoot?.() || win?.__3D_MARKUP_VIEWER_RUNTIME__?.modelRoot || null;
  if (root?.traverse) {
    root.traverse((object) => {
      if (rows.length >= 12) return;
      const data = object?.userData || {};
      const axis = data.axisTransform || data.supportAxisTransform || data.managedStageSupportVisual?.axisTransform || null;
      const family = data.supportFamily || data.managedStageSupportVisual?.family || data.sourceAttributes?.SUPPORT_KIND_MAPPED || data.sourceAttributes?.SUPPORT_KIND || '';
      if (!axis && !family) return;
      rows.push({
        name: String(data.sourceName || object.name || ''),
        family: String(family || ''),
        sourceAxis: String(axis?.sourceAxis || data.axisRaw || data.sourceAttributes?.SUPPORT_AXIS || ''),
        canvasAxis: String(axis?.canvasAxis || data.axisCanvas || data.sourceAttributes?.SUPPORT_AXIS_CANVAS || ''),
        actionAxes: String(axis?.supportActionAxes?.join?.('/') || data.sourceAttributes?.SUPPORT_RESTRAINT_TYPE_ACTION_AXIS || ''),
        schema: String(axis?.schema || '')
      });
    });
  }
  const reportRows = report?.diagnostics?.supportRulePreviewRows || [];
  for (const row of reportRows) {
    if (rows.length >= 12) break;
    rows.push({
      name: String(row.supportTag || ''),
      family: String(row.family || ''),
      sourceAxis: String(row.sourceAxis || ''),
      canvasAxis: String(row.canvasAxis || ''),
      actionAxes: String(row.supportActionAxes?.join?.('/') || ''),
      schema: 'debug-report-row'
    });
  }
  return rows;
}

function appendAxisTransformDebugToLog(doc, text) {
  const log = doc?.getElementById?.('log');
  if (!log) return false;
  const ts = new Date().toLocaleTimeString();
  log.textContent += `${String(text || '').split('\n').map((line) => `[${ts}] ${line}`).join('\n')}\n`;
  log.scrollTop = log.scrollHeight;
  return true;
}

function injectStyles(doc) {
  if (doc.getElementById('supportAxisTransformUiDebugStyles')) return;
  const style = doc.createElement('style');
  style.id = 'supportAxisTransformUiDebugStyles';
  style.textContent = `
    .support-axis-transform-config-card{margin:10px 0 0;padding:10px;border:1px solid rgba(96,165,250,.38);border-radius:10px;background:rgba(30,64,175,.18);color:#dbeafe;font-size:12px;line-height:1.35}
    .support-axis-transform-config-card h4{margin:0 0 8px;color:#bfdbfe}
    .support-axis-transform-config-card p{margin:5px 0}.support-axis-transform-config-card table{width:100%;border-collapse:collapse;margin-top:8px}.support-axis-transform-config-card th,.support-axis-transform-config-card td{border:1px solid rgba(148,163,184,.24);padding:5px;text-align:left}.support-axis-transform-config-note{color:#fde68a!important}
  `;
  doc.head?.appendChild?.(style);
}

function vectorText(vector = {}) {
  return `(${Number(vector.x || 0)},${Number(vector.y || 0)},${Number(vector.z || 0)})`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

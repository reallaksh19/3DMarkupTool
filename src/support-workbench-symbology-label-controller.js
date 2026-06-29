const SUPPORT_WORKBENCH_SYMBOLOGY_SCHEMA = 'SupportWorkbenchSymbologyLabelController.v1';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportWorkbenchSymbologyLabelController, { once: true });
} else {
  installSupportWorkbenchSymbologyLabelController();
}

export function installSupportWorkbenchSymbologyLabelController() {
  if (window.__3D_MARKUP_SUPPORT_WORKBENCH_SYMBOLOGY_LABELS__?.schema === SUPPORT_WORKBENCH_SYMBOLOGY_SCHEMA) return window.__3D_MARKUP_SUPPORT_WORKBENCH_SYMBOLOGY_LABELS__;
  const api = { schema: SUPPORT_WORKBENCH_SYMBOLOGY_SCHEMA, refresh: normalizeWorkbenchSymbologyLabels };
  window.__3D_MARKUP_SUPPORT_WORKBENCH_SYMBOLOGY_LABELS__ = api;
  observeWorkbench();
  normalizeWorkbenchSymbologyLabels('install');
  window.addEventListener('viewer:managed-stage-json-loaded', () => setTimeout(() => normalizeWorkbenchSymbologyLabels('managed-stage-loaded'), 0));
  window.addEventListener('managed-stage:support-source-ui-ready', () => setTimeout(() => normalizeWorkbenchSymbologyLabels('support-source-ui-ready'), 0));
  return api;
}

function observeWorkbench() {
  const attach = () => {
    const body = document.getElementById('smwBody');
    if (!body || body.__supportSymbologyObserver) return;
    const observer = new MutationObserver(() => normalizeWorkbenchSymbologyLabels('mutation'));
    observer.observe(body, { childList: true, subtree: true, characterData: true });
    body.__supportSymbologyObserver = observer;
  };
  attach();
  const timer = setInterval(() => {
    attach();
    normalizeWorkbenchSymbologyLabels('interval');
    if (document.getElementById('smwBody')?.__supportSymbologyObserver) clearInterval(timer);
  }, 500);
}

function normalizeWorkbenchSymbologyLabels(source = 'refresh') {
  const table = document.querySelector('#smwBody .smw-table');
  if (!table) return false;
  let changed = 0;
  for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
    const cells = Array.from(row.children || []);
    if (cells.length < 7 || row.dataset.supportFallbackRow) continue;
    const detected = text(cells[1]);
    const normalized = normalizeFamily(text(cells[2]));
    const enriched = text(cells[4]);
    const status = text(cells[6]);
    const next = resolveSymbologyLabel({ detected, normalized, enriched, status });
    if (!next) continue;
    if (text(cells[5]) !== next) {
      cells[5].textContent = next;
      cells[5].dataset.symbologyNormalizedBy = SUPPORT_WORKBENCH_SYMBOLOGY_SCHEMA;
      changed += 1;
    }
  }
  if (changed) {
    window.__3D_MARKUP_SUPPORT_WORKBENCH_SYMBOLOGY_LAST__ = { schema: SUPPORT_WORKBENCH_SYMBOLOGY_SCHEMA, source, changed, at: new Date().toISOString() };
  }
  return Boolean(changed);
}

function resolveSymbologyLabel({ detected, normalized, enriched, status }) {
  const axis = parsedAxisFromText(`${detected} ${enriched}`);
  const matched = /matched|rendered/i.test(status || '');
  const axisOnlyUnknown = normalized === 'UNKNOWN' && axis;
  if (axisOnlyUnknown) return `directional-cones (read "${axis.replace(/^\+/, '')}" from parsed data)`;

  if (matched && normalized && normalized !== 'UNKNOWN' && normalized !== 'AXIS_ONLY') {
    if (normalized === 'LINESTOP') return 'LINESTOP';
    if (normalized === 'LINE_STOP') return 'LINESTOP';
    return normalized;
  }
  return '';
}

function parsedAxisFromText(value) {
  const textValue = String(value || '').toUpperCase();
  const singleAxis = textValue.match(/SINGLE\s+AXIS\s*([+-]?[XYZ])\b/);
  if (singleAxis) return normalizeAxis(singleAxis[1]);
  const action = textValue.match(/ACTION\s+([+-]?[XYZ])\b/);
  if (action) return normalizeAxis(action[1]);
  const canvas = textValue.match(/CANVAS\s+([+-]?[XYZ])\b/);
  if (canvas) return normalizeAxis(canvas[1]);
  const source = textValue.match(/SOURCE\s+([+-]?[XYZ])\b/);
  if (source) return normalizeAxis(source[1]);
  return '';
}

function normalizeAxis(value) {
  const match = String(value || '').toUpperCase().match(/([+-]?)(X|Y|Z)/);
  return match ? `${match[1] || '+'}${match[2]}` : '';
}

function normalizeFamily(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function text(node) {
  return String(node?.textContent || '').trim();
}

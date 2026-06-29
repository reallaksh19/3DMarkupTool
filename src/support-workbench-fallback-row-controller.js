const SUPPORT_WORKBENCH_FALLBACK_ROW_SCHEMA = 'SupportWorkbenchFallbackRowController.v2';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportWorkbenchFallbackRowController, { once: true });
} else {
  installSupportWorkbenchFallbackRowController();
}

export function installSupportWorkbenchFallbackRowController() {
  if (window.__3D_MARKUP_SUPPORT_WORKBENCH_FALLBACK_ROW__?.schema === SUPPORT_WORKBENCH_FALLBACK_ROW_SCHEMA) return window.__3D_MARKUP_SUPPORT_WORKBENCH_FALLBACK_ROW__;
  const api = { schema: SUPPORT_WORKBENCH_FALLBACK_ROW_SCHEMA, refresh: refreshFallbackRows, cleanup: hideObsoleteSupportPanel };
  window.__3D_MARKUP_SUPPORT_WORKBENCH_FALLBACK_ROW__ = api;
  observeWorkbench();
  refreshFallbackRows('install');
  hideObsoleteSupportPanel('install');
  window.addEventListener('viewer:managed-stage-json-loaded', () => setTimeout(() => { refreshFallbackRows('managed-stage-loaded'); hideObsoleteSupportPanel('managed-stage-loaded'); }, 0));
  window.addEventListener('managed-stage:support-source-ui-ready', () => setTimeout(() => { refreshFallbackRows('support-source-ui-ready'); hideObsoleteSupportPanel('support-source-ui-ready'); }, 0));
  window.addEventListener('markup:safe-ui-status', () => setTimeout(() => hideObsoleteSupportPanel('safe-ui-status'), 0));
  return api;
}

function observeWorkbench() {
  const attach = () => {
    const body = document.getElementById('smwBody');
    if (!body || body.__supportFallbackObserver) return;
    const observer = new MutationObserver(() => refreshFallbackRows('mutation'));
    observer.observe(body, { childList: true, subtree: true });
    body.__supportFallbackObserver = observer;
  };
  attach();
  const timer = setInterval(() => {
    attach();
    hideObsoleteSupportPanel('interval');
    if (document.getElementById('smwBody')?.__supportFallbackObserver) clearInterval(timer);
  }, 500);
}

function hideObsoleteSupportPanel(source = 'cleanup') {
  const section = document.querySelector('[data-section="support-mapping"]');
  if (section) {
    section.hidden = true;
    section.setAttribute('aria-hidden', 'true');
    section.dataset.obsoleteSupportPanelHiddenBy = SUPPORT_WORKBENCH_FALLBACK_ROW_SCHEMA;
  }
  for (const button of Array.from(document.querySelectorAll('button'))) {
    const text = button.textContent?.trim() || '';
    if (/^(Open\s+)?Support Mapping\s*\/\s*ISONOTE$/i.test(text) || /^Dump Support Debug$/i.test(text) || /^Mapping Rules$/i.test(text)) {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
    }
  }
  window.__3D_MARKUP_SUPPORT_PANEL_CLEANUP_LAST__ = { schema: SUPPORT_WORKBENCH_FALLBACK_ROW_SCHEMA, source, at: new Date().toISOString() };
  return true;
}

function refreshFallbackRows(source = 'refresh') {
  const body = document.getElementById('smwBody');
  const table = body?.querySelector?.('.smw-table');
  if (!table || table.dataset.fallbackRowApplied === 'true') return false;
  const tbody = table.querySelector('tbody');
  if (!tbody) return false;
  if (tbody.querySelector('[data-support-fallback-row]')) return true;
  const axes = collectVisibleAxes(tbody);
  const activeTab = activeWorkbenchTab();
  const row = document.createElement('tr');
  row.dataset.supportFallbackRow = SUPPORT_WORKBENCH_FALLBACK_ROW_SCHEMA;
  row.className = 'smw-fallback-row';
  row.innerHTML = [
    '<td>Fallback</td>',
    `<td>${escapeHtml(activeTab === 'isonote' ? 'ISONOTE directional fallback' : 'InputXML directional fallback')}</td>`,
    '<td>AXIS_ONLY / UNKNOWN</td>',
    '<td>matched pipe axis when available</td>',
    `<td>${escapeHtml(axes || 'source Y / +Z / -Z / +X / -X -> enriched canvas axis / action axis')}</td>`,
    '<td>directional-cones / explicit-axis marker</td>',
    '<td>Fallback row: used when a restraint has an axis token but no resolved support family/type-code mapping.</td>'
  ].join('');
  tbody.appendChild(row);
  table.dataset.fallbackRowApplied = 'true';
  injectStyles();
  window.__3D_MARKUP_SUPPORT_WORKBENCH_FALLBACK_LAST__ = { schema: SUPPORT_WORKBENCH_FALLBACK_ROW_SCHEMA, source, activeTab, axes, at: new Date().toISOString() };
  return true;
}

function collectVisibleAxes(tbody) {
  const tokens = new Set();
  for (const cell of Array.from(tbody.querySelectorAll('td'))) {
    const text = cell.textContent || '';
    for (const match of text.matchAll(/(?:source|canvas|action)\s+([+-]?[XYZ])\b/gi)) tokens.add(normalizeAxis(match[1]));
    for (const match of text.matchAll(/\b([+-][XYZ]|[XYZ])\b/g)) {
      const token = normalizeAxis(match[1]);
      if (token) tokens.add(token);
    }
  }
  const ordered = [...tokens].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return ordered.length ? `observed directional axes: ${ordered.join(', ')}` : '';
}

function activeWorkbenchTab() {
  return document.querySelector('#supportMappingIsonoteDialog [data-smw-tab].active')?.getAttribute('data-smw-tab') || 'inputxml';
}

function normalizeAxis(value) {
  const match = String(value || '').toUpperCase().match(/([+-]?)(X|Y|Z)/);
  return match ? `${match[1] || '+'}${match[2]}` : '';
}

function injectStyles() {
  if (document.getElementById('supportWorkbenchFallbackRowStyles')) return;
  const style = document.createElement('style');
  style.id = 'supportWorkbenchFallbackRowStyles';
  style.textContent = `.smw-fallback-row td{background:rgba(245,158,11,.08)!important;color:#fde68a}.smw-fallback-row td:first-child{font-weight:900}`;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

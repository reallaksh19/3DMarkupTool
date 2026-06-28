const SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS_SCHEMA = 'SupportAuditVisibleDiagnosticsController.v1';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportAuditVisibleDiagnostics, { once: true });
} else {
  installSupportAuditVisibleDiagnostics();
}

export function installSupportAuditVisibleDiagnostics() {
  if (window.__3D_MARKUP_SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS__?.schema === SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS_SCHEMA) return window.__3D_MARKUP_SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS__;
  const api = { schema: SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS_SCHEMA, render: renderSupportAuditDiagnostics };
  window.__3D_MARKUP_SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS__ = api;
  window.addEventListener('viewer:managed-stage-json-loaded', (event) => renderSupportAuditDiagnostics(event.detail?.audit || {}, event.detail || {}));
  return api;
}

export function renderSupportAuditDiagnostics(audit = {}, context = {}) {
  const supportExport = audit.supportRvmExportAudit || {};
  const completeness = supportExport.supportCompletenessAudit || {};
  if (!completeness.schema && !supportExport.supportCompletenessRows) return false;

  const summary = buildSummary(supportExport, completeness);
  const panel = ensurePanel();
  if (panel) {
    panel.textContent = renderSummary(summary);
    panel.dataset.schema = SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS_SCHEMA;
    panel.dataset.supportCompletenessPass = String(summary.pass);
    panel.dataset.supportRenderedRows = String(summary.renderedRows);
    panel.dataset.supportSourceRows = String(summary.sourceRows);
    panel.dataset.node205Rendered = String(summary.node205Rendered);
    panel.dataset.node205Source = String(summary.node205Source);
    panel.dataset.node205Y = String(summary.node205YRendered);
    panel.dataset.node205Spring = String(summary.node205SpringRendered);
    panel.dataset.unknownSupportCount = String(summary.unknownSupportCount);
    panel.dataset.xFallbackSupportCount = String(summary.xFallbackSupportCount);
  }

  appendLog(`Managed-stage support completeness: ${renderSummary(summary)}`);
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-support-audit-visible', { detail: { schema: SUPPORT_AUDIT_VISIBLE_DIAGNOSTICS_SCHEMA, sourceName: context.sourceName || '', summary } }));
  return true;
}

function buildSummary(supportExport, completeness) {
  const rows = Array.isArray(supportExport.supportCompletenessRows) ? supportExport.supportCompletenessRows : [];
  const sourceRows = numberOrZero(completeness.sourceRowCount ?? rows.length);
  const renderedRows = numberOrZero(completeness.renderedRowCount ?? rows.filter((row) => row.rendered).length);
  const missingRows = numberOrZero(completeness.missingRowCount ?? rows.filter((row) => !row.rendered).length);
  const node205Source = numberOrZero(completeness.node205SupportSourceCount ?? supportExport.node205SupportSourceCount);
  const node205Rendered = numberOrZero(completeness.node205RenderedSupportCount ?? supportExport.node205RenderedSupportCount);
  return {
    pass: (supportExport.supportCompletenessPass ?? completeness.pass) === true,
    sourceRows,
    renderedRows,
    missingRows,
    node205Source,
    node205Rendered,
    node205Missing: numberOrZero((completeness.node205MissingRows || supportExport.node205MissingRows || []).length),
    node205YRendered: Boolean(completeness.node205YSupportRendered ?? supportExport.node205YSupportRendered),
    node205SpringRendered: Boolean(completeness.node205SpringRendered ?? supportExport.node205SpringRendered),
    unknownSupportCount: numberOrZero(completeness.unknownSupportCount ?? supportExport.unknownSupportCount),
    xFallbackSupportCount: numberOrZero(completeness.xFallbackSupportCount ?? supportExport.xFallbackSupportCount)
  };
}

function renderSummary(summary) {
  return `Support completeness: ${summary.pass ? 'PASS' : 'FAIL'} (${summary.renderedRows}/${summary.sourceRows} rendered, missing ${summary.missingRows}) | Node 205 ${summary.node205Rendered}/${summary.node205Source}, Y=${summary.node205YRendered ? 'YES' : 'NO'}, spring=${summary.node205SpringRendered ? 'YES' : 'NO'} | Unknown=${summary.unknownSupportCount}, X fallback=${summary.xFallbackSupportCount}`;
}

function ensurePanel() {
  const existing = document.getElementById('managedStageSupportCompletenessDiagnostics');
  if (existing) return existing;
  const anchor = document.getElementById('managedStageTopologyDiagnostics') || document.getElementById('conversionStatus') || document.getElementById('runtimeStatus');
  if (!anchor) return null;
  const panel = document.createElement('div');
  panel.id = 'managedStageSupportCompletenessDiagnostics';
  panel.className = 'conversion-status managed-stage-support-completeness-diagnostics';
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-label', 'Managed-stage support completeness diagnostics');
  anchor.insertAdjacentElement('afterend', panel);
  return panel;
}

function appendLog(message) {
  const logEl = document.getElementById('log');
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (logEl) logEl.textContent += `${line}\n`;
  else console.log(line);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

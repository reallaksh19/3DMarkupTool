export const MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_SCHEMA = 'ManagedStageSupportMapperDiagnosticsUi.v1';
export const MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_CACHE_KEY = '20260623-staged-json-support-mapper-diagnostics-ui-3-preflight-issues';

const DIAGNOSTIC_ROW_KEYS = Object.freeze([
  ['sourceMode', 'Source mode'],
  ['status', 'Status'],
  ['mapperConfigApplied', 'Mapper config applied'],
  ['pipeRecordCount', 'Pipe records'],
  ['stagedJsonSupportRecordCount', 'stagedJson support records'],
  ['isonoteSupportRecordCount', 'ISONOTE support records'],
  ['supportSymbolCount', 'Support symbols'],
  ['stagedJsonSymbolCount', 'stagedJson symbols'],
  ['isonoteSymbolCount', 'ISONOTE symbols'],
  ['supportVisualPartCount', 'Symbol parts'],
  ['axisBasisAppliedCount', 'Axis-basis applied'],
  ['mapperPreflightIssueCount', 'Mapper preflight issues'],
  ['mapperPreflightWarningCount', 'Mapper preflight warnings'],
  ['mapperPreflightErrorCount', 'Mapper preflight errors'],
  ['mapperPreflightPopupRequiredCount', 'Mapper preflight popup required'],
  ['popupRequiredCount', 'Popup required'],
  ['warningCount', 'Warnings'],
  ['gapRecordScopedCount', 'Record-scoped gaps'],
  ['gapCarryForwardViolationCount', 'Gap carry-forward violations'],
  ['maxGapVisualSeparationMm', 'Max gap visual separation'],
  ['maxGlyphLengthMm', 'Max glyph length'],
  ['activeSourceExclusive', 'Active source exclusive'],
  ['pass', 'Pass']
]);

export function buildManagedStageSupportMapperDiagnosticsRows(diagnostics = {}) {
  const rows = DIAGNOSTIC_ROW_KEYS.map(([key, label]) => ({ key, label, value: normalizeDiagnosticValue(diagnostics[key]) }));
  rows.push({ key: 'supportFamilyHistogram', label: 'Family histogram', value: histogramText(diagnostics.supportFamilyHistogram) });
  rows.push({ key: 'supportCanvasAxisHistogram', label: 'Canvas axis histogram', value: histogramText(diagnostics.supportCanvasAxisHistogram) });
  rows.push({ key: 'mapperPreflightIssues', label: 'Preflight issue list', value: issueListText(diagnostics.mapperPreflightIssues) });
  return rows;
}

export function supportMapperDiagnosticsSummary(diagnostics = {}) {
  const sourceMode = String(diagnostics.sourceMode || 'unknown');
  const supportCount = Number(diagnostics.supportSymbolCount || 0);
  const warningCount = Number(diagnostics.warningCount || 0);
  const popupCount = Number(diagnostics.popupRequiredCount || 0);
  const gapViolations = Number(diagnostics.gapCarryForwardViolationCount || 0);
  const preflightErrors = Number(diagnostics.mapperPreflightErrorCount || 0);
  const preflightWarnings = Number(diagnostics.mapperPreflightWarningCount || 0);
  const issueListCount = Array.isArray(diagnostics.mapperPreflightIssues) ? diagnostics.mapperPreflightIssues.length : 0;
  const pass = diagnostics.pass === true || diagnostics.pass === 'true';
  return `Support mapper diagnostics: ${sourceMode}; symbols ${supportCount}; warnings ${warningCount}; popup ${popupCount}; preflight ${preflightErrors}E/${preflightWarnings}W; listed issues ${issueListCount}; gap carry-forward ${gapViolations}; ${pass ? 'PASS' : 'CHECK'}.`;
}

export function renderManagedStageSupportMapperDiagnostics(diagnostics = {}) {
  const rows = buildManagedStageSupportMapperDiagnosticsRows(diagnostics)
    .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
    .join('');
  return `<summary>Support mapper diagnostics</summary><p>${escapeHtml(supportMapperDiagnosticsSummary(diagnostics))}</p><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>${renderPreflightIssueList(diagnostics.mapperPreflightIssues)}`;
}

export function installManagedStageSupportMapperDiagnosticsUi({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || !doc || typeof doc.getElementById !== 'function') return null;
  if (win.__3D_MARKUP_SUPPORT_MAPPER_DIAGNOSTICS_UI__?.schema === MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_SCHEMA) return win.__3D_MARKUP_SUPPORT_MAPPER_DIAGNOSTICS_UI__;
  const api = {
    schema: MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_CACHE_KEY,
    update: (diagnostics = {}) => updateDiagnosticsDetails(doc, diagnostics)
  };
  win.__3D_MARKUP_SUPPORT_MAPPER_DIAGNOSTICS_UI__ = api;
  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => {
    win.setTimeout?.(() => api.update(readDiagnosticsFromModelRoot(event?.detail?.modelRoot)), 0);
  });
  doc.addEventListener?.('managed-stage:support-source-preview-updated', (event) => {
    api.update(event?.detail?.diagnostics || readDiagnosticsFromModelRoot(event?.detail?.modelRoot));
  });
  const currentRoot = win.__3D_MARKUP_CURRENT_MANAGED_STAGE_MODEL_ROOT__ || win.__3D_MARKUP_MANAGED_STAGE_MODEL_ROOT__;
  if (currentRoot) api.update(readDiagnosticsFromModelRoot(currentRoot));
  return api;
}

function updateDiagnosticsDetails(doc, diagnostics = {}) {
  const details = ensureDiagnosticsDetails(doc);
  if (!details) return null;
  details.innerHTML = renderManagedStageSupportMapperDiagnostics(diagnostics);
  details.dataset.supportMapperDiagnosticsPass = String(diagnostics.pass === true || diagnostics.pass === 'true');
  details.dataset.supportMapperDiagnosticsSourceMode = String(diagnostics.sourceMode || '');
  details.dataset.supportMapperPreflightIssueCount = String(diagnostics.mapperPreflightIssueCount || 0);
  return diagnostics;
}

function ensureDiagnosticsDetails(doc) {
  let details = doc.getElementById('supportMapperDiagnosticsDetails');
  if (details) return details;
  const parent = doc.getElementById('supportMapperConfigDetails')?.parentElement || doc.querySelector?.('[data-section="conversion"]') || doc.getElementById('conversion-options-body')?.parentElement;
  if (!parent) return null;
  details = doc.createElement('details');
  details.id = 'supportMapperDiagnosticsDetails';
  details.className = 'conversion-collapsible-content support-mapper-diagnostics-details';
  details.innerHTML = '<summary>Support mapper diagnostics</summary><p>No support mapper diagnostics yet. Load stagedJson or apply ISONOTE preview.</p>';
  const configDetails = doc.getElementById('supportMapperConfigDetails');
  if (configDetails?.nextSibling) parent.insertBefore(details, configDetails.nextSibling);
  else parent.appendChild(details);
  return details;
}

function readDiagnosticsFromModelRoot(modelRoot) {
  return modelRoot?.userData?.managedStageSupportSourcePreview?.diagnostics || {};
}

function normalizeDiagnosticValue(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (Array.isArray(value)) return issueListText(value);
  if (typeof value === 'object') return histogramText(value);
  return String(value);
}

function histogramText(histogram = {}) {
  const entries = Object.entries(histogram || {}).filter(([, value]) => Number(value) !== 0);
  if (!entries.length) return '—';
  return entries.map(([key, value]) => `${key}:${value}`).join(', ');
}

function issueListText(issues = []) {
  if (!Array.isArray(issues) || !issues.length) return '—';
  return issues.map((issue) => `${issue.severity || 'warning'}:${issue.code || 'issue'}:${issue.supportTag || issue.node || 'support'}`).join('; ');
}

function renderPreflightIssueList(issues = []) {
  if (!Array.isArray(issues) || !issues.length) return '<p class="support-mapper-preflight-issues-empty">No mapper preflight issue details.</p>';
  const items = issues.map((issue) => {
    const title = `${issue.severity || 'warning'} / ${issue.code || 'mapper-preflight-issue'}`;
    const context = [issue.sourceMode, issue.supportTag, issue.family, issue.node ? `node ${issue.node}` : '', issue.axis ? `axis ${issue.axis}` : ''].filter(Boolean).join(' · ');
    return `<li><strong>${escapeHtml(title)}</strong><br><span>${escapeHtml(context || 'support')}</span><br><small>${escapeHtml(issue.message || '')}</small></li>`;
  }).join('');
  return `<div class="support-mapper-preflight-issues"><h4>Preflight issue details</h4><ol>${items}</ol></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

if (typeof window !== 'undefined') {
  const start = () => installManagedStageSupportMapperDiagnosticsUi();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('markup:app-ready', start, { once: true });
}

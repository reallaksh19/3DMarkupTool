import { parseIsonoteRows, parseManagedStageIsonoteSupportRecords } from './managed-stage-isonote-support-mapper.js?v=bust-cache-4';
import {
  MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS,
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  getManagedStageSupportMapperPresetProfile,
  normalizeManagedStageSupportMapperPresetId,
  resolveManagedStageSupportMapperConfig
} from './managed-stage-support-mapper-config.js?v=bust-cache-4';

export const MANAGED_STAGE_ISONOTE_TEXT_WORKFLOW_SCHEMA = 'ManagedStageIsonoteTextWorkflow.v1';
export const MANAGED_STAGE_ISONOTE_TEXT_WORKFLOW_CACHE_KEY = '20260623-isonote-text-workflow-1';
export const DEFAULT_MANAGED_STAGE_ISONOTE_SIDELOAD_SAMPLE = [
  'NODE,ISONOTE',
  '100,"/PS-100:ISONOTE REST; GUIDE GAP=10mm"',
  '200,"/PS-200:ISONOTE LINE STOP AXIS -X GAP=25mm"',
  '300,"/PS-300:ISONOTE HOLDDOWN; SPRING CAN"'
].join('\n');

export function buildManagedStageIsonoteTextWorkflowModel(text = '', options = {}) {
  const sourceText = String(text || '');
  const mapperConfig = resolveIsonoteWorkflowMapperConfig(options.mapperConfig || options.config || {});
  const rows = parseIsonoteRows(sourceText);
  const records = parseManagedStageIsonoteSupportRecords(sourceText, mapperConfig);
  const issues = buildIsonoteTextWorkflowIssues(rows, records, sourceText);
  const status = resolveIsonoteWorkflowStatus(sourceText, rows, records, issues);
  return {
    schema: MANAGED_STAGE_ISONOTE_TEXT_WORKFLOW_SCHEMA,
    cacheKey: MANAGED_STAGE_ISONOTE_TEXT_WORKFLOW_CACHE_KEY,
    status,
    statusLabel: isonoteWorkflowStatusLabel(status),
    lineCount: countNonEmptyLines(sourceText),
    textLength: sourceText.length,
    rowCount: rows.length,
    supportRecordCount: records.length,
    issueCount: issues.length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    canApply: records.length > 0 && !issues.some((issue) => issue.severity === 'error'),
    mapperPresetId: mapperConfig.mapperPresetId,
    supportFamilyHistogram: histogram(records.map((record) => record.mapperRecord?.family || record.attrs?.SUPPORT_KIND || 'UNKNOWN')),
    supportNodeHistogram: histogram(records.map((record) => String(record.nodeId || record.attrs?.NODE || '').trim() || 'UNKNOWN')),
    previewRows: records.slice(0, 40).map((record, index) => ({
      index: index + 1,
      node: String(record.nodeId || record.attrs?.NODE || '').trim(),
      supportTag: String(record.supportTag || record.attrs?.SUPPORT_TAG || '').trim(),
      family: String(record.mapperRecord?.family || record.attrs?.SUPPORT_KIND || '').trim(),
      sourceAxis: String(record.mapperRecord?.axis?.sourceAxis || record.attrs?.SUPPORT_AXIS || '').trim(),
      sign: String(record.mapperRecord?.sign || record.attrs?.SUPPORT_SIGN || '').trim(),
      gapMm: record.mapperRecord?.gap?.value ?? record.attrs?.SUPPORT_GAP_MM ?? '',
      rawText: String(record.rawText || '').trim()
    })),
    issues
  };
}

export function buildIsonoteWorkflowSummary(model = {}) {
  const status = model.statusLabel || isonoteWorkflowStatusLabel(model.status);
  return `${status}: ${Number(model.rowCount || 0)} row(s), ${Number(model.supportRecordCount || 0)} support record(s), ${Number(model.issueCount || 0)} issue(s).`;
}

export function applyManagedStageIsonoteTextWorkflowToCanvas({ doc = globalThis.document, win = globalThis.window, text = null, mapperConfig = null } = {}) {
  const textarea = doc?.getElementById?.('isonoteText');
  const sourceText = text == null ? (textarea?.value || '') : String(text || '');
  const model = buildManagedStageIsonoteTextWorkflowModel(sourceText, { mapperConfig: mapperConfig || win?.__3D_MARKUP_SUPPORT_SOURCE_UI__?.mapperConfig });
  const supportMode = doc?.getElementById?.('supportMode');
  if (supportMode) {
    supportMode.value = MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE;
    dispatchDomEvent(supportMode, 'change');
  }
  const runtime = win?.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  const modelRoot = runtime.getModelRoot?.() || runtime.modelRoot || null;
  const bridge = win?.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__;
  const ui = win?.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {};
  let bridgeResult = null;
  if (modelRoot && typeof bridge?.apply === 'function') {
    bridgeResult = bridge.apply(modelRoot, {
      sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
      mapperConfig: ui.mapperConfig || mapperConfig,
      isonoteText: sourceText
    });
    runtime.renderOnce?.('isonote-workflow:apply');
  }
  dispatchCustomEvent(win, 'managed-stage:isonote-workflow-apply', { schema: MANAGED_STAGE_ISONOTE_TEXT_WORKFLOW_SCHEMA, appliedToCanvas: Boolean(bridgeResult), model, bridgeResult });
  return { ...model, appliedToCanvas: Boolean(bridgeResult), bridgeResult };
}

export function installManagedStageIsonoteTextWorkflowUi({ doc = globalThis.document, win = globalThis.window } = {}) {
  if (!doc || typeof doc.getElementById !== 'function') return null;
  const textarea = doc.getElementById('isonoteText');
  if (!textarea) return null;
  const panel = ensureIsonoteWorkflowPanel(doc, textarea);
  const refresh = () => {
    const model = buildManagedStageIsonoteTextWorkflowModel(textarea.value, { mapperConfig: win?.__3D_MARKUP_SUPPORT_SOURCE_UI__?.mapperConfig });
    renderIsonoteWorkflowPanel(panel, model);
    win.__3D_MARKUP_ISONOTE_TEXT_WORKFLOW__ = model;
    return model;
  };
  if (panel.dataset.isonoteWorkflowInstalled !== 'true') {
    panel.addEventListener?.('click', (event) => {
      const action = event?.target?.getAttribute?.('data-isonote-workflow-action');
      if (!action) return;
      event.preventDefault?.();
      if (action === 'sample') textarea.value = DEFAULT_MANAGED_STAGE_ISONOTE_SIDELOAD_SAMPLE;
      if (action === 'clear') textarea.value = '';
      const model = action === 'apply' ? applyManagedStageIsonoteTextWorkflowToCanvas({ doc, win, text: textarea.value }) : refresh();
      renderIsonoteWorkflowPanel(panel, model);
    });
    textarea.addEventListener?.('input', refresh);
    win?.addEventListener?.('managed-stage:support-source-ui-ready', refresh);
    panel.dataset.isonoteWorkflowInstalled = 'true';
  }
  const installed = refresh();
  dispatchCustomEvent(doc, 'managed-stage:isonote-workflow-ui-ready', installed);
  return installed;
}

function resolveIsonoteWorkflowMapperConfig(config = {}) {
  const requestedPreset = normalizeManagedStageSupportMapperPresetId(config.mapperPresetId || config.presetId || MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.ISONOTE_GENERIC);
  const profile = getManagedStageSupportMapperPresetProfile(requestedPreset === MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM ? MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.ISONOTE_GENERIC : requestedPreset);
  return resolveManagedStageSupportMapperConfig({ ...(profile.mapperConfig || {}), ...config, mapperPresetId: config.mapperPresetId || requestedPreset });
}

function buildIsonoteTextWorkflowIssues(rows, records, sourceText) {
  const issues = [];
  if (!String(sourceText || '').trim()) return issues;
  for (const row of rows) {
    if (!String(row.nodeId || '').trim()) issues.push({ severity: 'warning', code: 'MISSING_NODE', lineNumber: row.lineNumber, message: 'ISONOTE row has no node id.' });
  }
  if (rows.length > 0 && records.length === 0) issues.push({ severity: 'warning', code: 'NO_SUPPORT_RECORDS', message: 'ISONOTE text parsed, but no support terms were found.' });
  return issues;
}

function resolveIsonoteWorkflowStatus(sourceText, rows, records, issues) {
  if (!String(sourceText || '').trim()) return 'empty';
  if (issues.some((issue) => issue.severity === 'error')) return 'error';
  if (records.length > 0) return issues.length ? 'ready-with-warnings' : 'ready';
  if (rows.length > 0) return 'no-support-records';
  return 'empty';
}

function isonoteWorkflowStatusLabel(status) {
  if (status === 'ready') return 'Ready';
  if (status === 'ready-with-warnings') return 'Ready with warnings';
  if (status === 'no-support-records') return 'No support records';
  if (status === 'error') return 'Error';
  return 'Empty';
}

function ensureIsonoteWorkflowPanel(doc, textarea) {
  let panel = doc.getElementById('supportIsonoteWorkflowPanel');
  if (panel) return panel;
  panel = doc.createElement('details');
  panel.id = 'supportIsonoteWorkflowPanel';
  panel.className = 'sideload-collapsible-content support-isonote-workflow-panel';
  panel.open = true;
  panel.innerHTML = '<summary>ISONOTE support workflow</summary><div class="button-row support-isonote-workflow-actions"><button type="button" data-isonote-workflow-action="sample">Load ISONOTE sample</button><button type="button" data-isonote-workflow-action="clear">Clear ISONOTE</button><button type="button" data-isonote-workflow-action="preview">Parse preview</button><button type="button" data-isonote-workflow-action="apply">Apply to Canvas</button></div><small data-isonote-workflow-status aria-live="polite"></small><div data-isonote-workflow-preview></div>';
  const hostLabel = textarea.closest?.('label');
  if (hostLabel?.parentNode) hostLabel.parentNode.insertBefore(panel, hostLabel.nextSibling);
  else textarea.parentNode?.appendChild?.(panel);
  return panel;
}

function renderIsonoteWorkflowPanel(panel, model) {
  const status = panel?.querySelector?.('[data-isonote-workflow-status]');
  const preview = panel?.querySelector?.('[data-isonote-workflow-preview]');
  if (status) status.textContent = buildIsonoteWorkflowSummary(model);
  if (!preview) return;
  const supportRows = (model.previewRows || []).map((row) => `<tr><td>${row.index}</td><td>${escapeHtml(row.node)}</td><td>${escapeHtml(row.supportTag)}</td><td>${escapeHtml(row.family)}</td><td>${escapeHtml(row.sourceAxis)}</td><td>${escapeHtml(row.sign)}</td><td>${escapeHtml(row.gapMm)}</td></tr>`).join('');
  preview.innerHTML = `<table><thead><tr><th>#</th><th>Node</th><th>Tag</th><th>Family</th><th>Axis</th><th>Sign</th><th>Gap</th></tr></thead><tbody>${supportRows || '<tr><td colspan="7">No support records parsed.</td></tr>'}</tbody></table>`;
}

function histogram(values = []) {
  const result = {};
  for (const value of values) {
    const key = String(value || '').trim() || 'UNKNOWN';
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

function countNonEmptyLines(value) {
  return String(value || '').split(/\r?\n/).filter((line) => line.trim()).length;
}

function dispatchDomEvent(target, type) {
  const EventCtor = target?.ownerDocument?.defaultView?.Event || globalThis.Event;
  if (typeof EventCtor === 'function') target?.dispatchEvent?.(new EventCtor(type, { bubbles: true }));
}

function dispatchCustomEvent(target, type, detail) {
  const EventCtor = target?.defaultView?.CustomEvent || target?.CustomEvent || globalThis.CustomEvent;
  if (typeof EventCtor === 'function') target?.dispatchEvent?.(new EventCtor(type, { detail }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

if (typeof window !== 'undefined') {
  const start = () => installManagedStageIsonoteTextWorkflowUi();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('markup:app-ready', start, { once: true });
}

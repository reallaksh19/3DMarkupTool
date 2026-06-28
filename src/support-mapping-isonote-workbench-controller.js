const WORKBENCH_SCHEMA = 'SupportMappingIsonoteWorkbench.v1';
const BASIS = Object.freeze({ INPUTXML: 'stagedJson', ISONOTE: 'isonote' });
const FIELD_KEYS = Object.freeze({
  supportTag: 'supportTagFields',
  supportKind: 'supportKindFields',
  graphicsRule: 'graphicsRuleFields',
  axis: 'axisFields',
  sign: 'signFields',
  gap: 'gapFields',
  coordinate: 'coordinateFields'
});

const state = {
  activeTab: 'inputxml',
  artifact: null,
  sourceText: '',
  sourceName: '',
  lastEventDetail: null
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportMappingIsonoteWorkbench, { once: true });
} else {
  installSupportMappingIsonoteWorkbench();
}

export function installSupportMappingIsonoteWorkbench() {
  if (window.__3D_MARKUP_SUPPORT_MAPPING_ISONOTE_WORKBENCH__?.schema === WORKBENCH_SCHEMA) return window.__3D_MARKUP_SUPPORT_MAPPING_ISONOTE_WORKBENCH__;
  const api = { schema: WORKBENCH_SCHEMA, show, render, applyBasis, setTab };
  window.__3D_MARKUP_SUPPORT_MAPPING_ISONOTE_WORKBENCH__ = api;
  ensureDialog();
  window.addEventListener('viewer:managed-stage-json-loaded', (event) => {
    captureArtifact(event.detail || {});
    render();
    show();
  });
  window.addEventListener('managed-stage:support-source-ui-ready', render);
  return api;
}

function captureArtifact(detail = {}) {
  const api = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  state.artifact = api?.getActiveArtifact?.() || state.artifact || {};
  state.sourceText = detail.sourceText || state.artifact?.sourceText || api?.getActiveSourceText?.() || state.sourceText || '';
  state.sourceName = detail.sourceName || state.artifact?.sourceName || api?.getActiveSourceName?.() || state.sourceName || 'managed-stage.json';
  state.lastEventDetail = detail;
}

function ensureDialog() {
  if (document.getElementById('supportMappingIsonoteDialog')) return document.getElementById('supportMappingIsonoteDialog');
  injectStyles();
  const dialog = document.createElement('dialog');
  dialog.id = 'supportMappingIsonoteDialog';
  dialog.className = 'support-map-workbench';
  dialog.innerHTML = `
    <div class="smw-head">
      <div><h2>Support Mapping / ISONOTE</h2><p id="smwSubtitle">Load managed-stage JSON to inspect support basis resolution.</p></div>
      <button type="button" class="smw-close" data-smw-close aria-label="Close">×</button>
    </div>
    <div class="smw-actions">
      <button type="button" data-smw-apply="stagedJson" class="primary">Apply as per InputXML</button>
      <button type="button" data-smw-apply="isonote" class="primary alt">Apply as per ISONOTE</button>
      <span id="smwStatus" class="smw-status">Ready</span>
    </div>
    <div class="smw-tabs" role="tablist">
      <button type="button" data-smw-tab="inputxml" class="active">InputXML basis</button>
      <button type="button" data-smw-tab="isonote">Load ISONOTE</button>
      <button type="button" data-smw-tab="rules">Support Mapping rules</button>
    </div>
    <div id="smwBody" class="smw-body"></div>`;
  dialog.addEventListener('click', (event) => {
    const close = event.target.closest('[data-smw-close]');
    if (close) dialog.close();
    const tab = event.target.closest('[data-smw-tab]')?.getAttribute('data-smw-tab');
    if (tab) setTab(tab);
    const basis = event.target.closest('[data-smw-apply]')?.getAttribute('data-smw-apply');
    if (basis) applyBasis(basis);
    const save = event.target.closest('[data-smw-save-rules]');
    if (save) saveRuleEdits();
  });
  dialog.addEventListener('input', (event) => {
    if (event.target?.id === 'smwIsonoteText') syncIsonoteText(event.target.value);
  });
  document.body.appendChild(dialog);
  return dialog;
}

function show() {
  const dialog = ensureDialog();
  if (!dialog.open) dialog.showModal?.();
}

function setTab(tab) {
  state.activeTab = tab;
  render();
}

function render() {
  const dialog = ensureDialog();
  dialog.querySelectorAll('[data-smw-tab]').forEach((button) => button.classList.toggle('active', button.getAttribute('data-smw-tab') === state.activeTab));
  const artifact = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.getActiveArtifact?.() || state.artifact || {};
  state.artifact = artifact;
  const audit = artifact.audit || state.lastEventDetail?.audit || {};
  const sourceContract = artifact.sourceContract || state.lastEventDetail?.sourceContract || {};
  const sourceBasis = sourceContract.supportSourceBasis || audit.supportSourceBasis || audit.inputCounts?.supportSourceBasis || {};
  const subtitle = document.getElementById('smwSubtitle');
  if (subtitle) subtitle.textContent = `${state.sourceName || artifact.sourceName || 'managed-stage'} — active basis: ${sourceBasis.activeBasis || 'stagedJson'}`;
  const body = document.getElementById('smwBody');
  if (!body) return;
  if (state.activeTab === 'isonote') body.innerHTML = renderIsonoteTab(sourceContract, audit);
  else if (state.activeTab === 'rules') body.innerHTML = renderRulesTab();
  else body.innerHTML = renderInputXmlTab(sourceContract, audit);
}

function renderInputXmlTab(sourceContract = {}, audit = {}) {
  const rows = supportRows(sourceContract, audit).filter((row) => row.activeBasis !== BASIS.ISONOTE);
  return `
    <div class="smw-intro"><strong>InputXML basis</strong><span>Node-wise restraints detected from staged InputXML, normalized family, and app symbology resolution.</span></div>
    ${supportTable(rows, 'No InputXML support rows detected yet.')}`;
}

function renderIsonoteTab(sourceContract = {}, audit = {}) {
  const rows = supportRows(sourceContract, audit).filter((row) => row.activeBasis === BASIS.ISONOTE || row.isonoteRawText);
  const currentText = escapeHtml(document.getElementById('isonoteText')?.value || '');
  return `
    <div class="smw-intro"><strong>Load ISONOTE</strong><span>Paste or edit ISONOTE data, then click Apply as per ISONOTE to re-run support modules using ISONOTE Basis.</span></div>
    <textarea id="smwIsonoteText" rows="7" spellcheck="false" placeholder="NODE, ISONOTE">${currentText}</textarea>
    ${supportTable(rows, 'No ISONOTE-matched rows yet. Load ISONOTE text and click Apply as per ISONOTE.')}`;
}

function renderRulesTab() {
  const model = window.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {};
  const rows = Array.isArray(model.mapperRows) ? model.mapperRows : [];
  return `
    <div class="smw-intro"><strong>Support Mapping rules</strong><span>Edit the field candidates used to map, normalize, and resolve support symbology. Save, then apply InputXML or ISONOTE basis.</span></div>
    <table class="smw-table"><thead><tr><th>Purpose</th><th>User editable source fields</th><th>Normalized output</th><th>Current resolving rule</th></tr></thead><tbody>
    ${rows.map((row) => `<tr><td>${escapeHtml(row.label || row.fieldPurpose)}</td><td><input data-smw-rule="${escapeAttr(row.fieldPurpose)}" value="${escapeAttr((row.sourceFieldCandidates || []).join(', '))}"></td><td>${escapeHtml(row.normalizedOutput || '')}</td><td>${escapeHtml(row.graphicsRule || row.axisBasis || '')}</td></tr>`).join('') || '<tr><td colspan="4">Support mapper UI not ready yet.</td></tr>'}
    </tbody></table>
    <button type="button" class="primary" data-smw-save-rules>Save mapping / normalization / resolving choices</button>`;
}

function supportRows(sourceContract = {}, audit = {}) {
  const supports = Array.isArray(sourceContract.supports) ? sourceContract.supports : [];
  const completenessRows = audit.supportRvmExportAudit?.supportCompletenessRows || audit.rvmAtt?.supportRvmExportAudit?.supportCompletenessRows || [];
  if (supports.length) {
    return supports.map((support, index) => {
      const match = completenessRows.find((row) => sameNode(row.node, support.nodeNumber) && sameFamily(row.family, support.supportFamily)) || {};
      return {
        node: support.nodeNumber || match.node || '',
        tag: support.supportName || support.supportId || support.psTag || '',
        raw: support.supportKindRaw || support.rawType || '',
        family: support.supportFamily || support.supportKindNormalized || match.family || 'UNKNOWN',
        sourceAxis: support.axisRaw || match.sourceAxis || '',
        canvasAxis: support.axisCanvas || match.mappedCanvasAxis || '',
        actionAxis: (support.axisTransform?.supportActionAxes || support.visual?.supportActionAxes || match.supportActionAxes || []).join(' / ') || support.axisCanvas || '',
        symbology: symbologyLabel(support, match),
        rendered: match.rendered !== false,
        activeBasis: support.activeBasis || support.sourceMode || sourceContract.supportSourceBasis?.activeBasis || BASIS.INPUTXML,
        isonoteRawText: support.isonoteRawText || ''
      };
    });
  }
  return completenessRows.map((row) => ({
    node: row.node,
    tag: row.supportTag,
    raw: row.sourcePath,
    family: row.family,
    sourceAxis: row.sourceAxis,
    canvasAxis: row.mappedCanvasAxis,
    actionAxis: (row.supportActionAxes || []).join(' / '),
    symbology: row.xFallback ? 'X blocking-flow fallback' : row.exactAxisRepair ? 'Exact-axis code-8 glyph' : row.family,
    rendered: row.rendered,
    activeBasis: row.activeBasis || BASIS.INPUTXML,
    isonoteRawText: row.isonoteRawText || ''
  }));
}

function supportTable(rows, emptyMessage) {
  const grouped = [...rows].sort((a, b) => Number(a.node) - Number(b.node));
  return `<table class="smw-table"><thead><tr><th>Node</th><th>Detected restraint</th><th>Normalized support</th><th>Axis resolution</th><th>App symbology</th><th>Status</th></tr></thead><tbody>
    ${grouped.map((row) => `<tr><td>${escapeHtml(row.node)}</td><td>${escapeHtml(row.raw || row.tag)}</td><td>${escapeHtml(row.family)}</td><td>source ${escapeHtml(row.sourceAxis || 'N/A')} → canvas ${escapeHtml(row.canvasAxis || 'N/A')} / action ${escapeHtml(row.actionAxis || 'N/A')}</td><td>${escapeHtml(row.symbology)}</td><td>${row.rendered ? 'Rendered' : 'Missing / suppressed'}</td></tr>`).join('') || `<tr><td colspan="6">${escapeHtml(emptyMessage)}</td></tr>`}
  </tbody></table>`;
}

async function applyBasis(mode) {
  const supportMode = mode === BASIS.ISONOTE ? BASIS.ISONOTE : BASIS.INPUTXML;
  const select = document.getElementById('supportMode');
  if (select) {
    ensureOption(select, supportMode);
    select.value = supportMode;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  syncIsonoteText(document.getElementById('smwIsonoteText')?.value ?? document.getElementById('isonoteText')?.value ?? '');
  setStatus(`Applying ${supportMode === BASIS.ISONOTE ? 'ISONOTE' : 'InputXML'} Basis...`);
  const api = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  const sourceText = state.sourceText || api?.getActiveSourceText?.() || state.artifact?.sourceText || '';
  const sourceName = state.sourceName || api?.getActiveSourceName?.() || state.artifact?.sourceName || 'managed-stage.json';
  if (sourceText && api?.loadText) {
    await api.loadText(sourceText, sourceName);
  } else {
    document.getElementById('convertBtn')?.click();
  }
  setStatus(`${supportMode === BASIS.ISONOTE ? 'ISONOTE' : 'InputXML'} Basis applied`);
}

function saveRuleEdits() {
  const edits = Array.from(document.querySelectorAll('[data-smw-rule]'));
  if (!edits.length) return;
  const fieldMapper = {};
  for (const input of edits) {
    const purpose = input.getAttribute('data-smw-rule');
    const key = FIELD_KEYS[purpose];
    if (!key) continue;
    fieldMapper[key] = input.value.split(',').map((entry) => entry.trim()).filter(Boolean);
    const existing = document.querySelector(`[data-support-mapper-fields="${purpose}"]`);
    if (existing) existing.value = input.value;
  }
  const payload = { mapperPresetId: 'custom', fieldMapper };
  try { localStorage.setItem('managedStage.supportMapperConfig.v1', JSON.stringify(payload, null, 2)); } catch (_) {}
  const details = document.getElementById('supportMapperConfigDetails');
  details?.dispatchEvent(new Event('change', { bubbles: true }));
  const textarea = document.getElementById('supportMapperConfigJson');
  if (textarea) textarea.value = JSON.stringify(payload, null, 2);
  setStatus('Support mapping rules saved. Apply a basis to process support modules.');
}

function syncIsonoteText(value) {
  const target = document.getElementById('isonoteText');
  if (target && target.value !== value) target.value = value;
}

function ensureOption(select, value) {
  if (Array.from(select.options || []).some((option) => option.value === value)) return;
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  select.appendChild(option);
}

function symbologyLabel(support, row = {}) {
  if (row.xFallback || support.warningCode === 'UNKNOWN_SUPPORT_REQUIRES_MAPPING') return 'X blocking-flow fallback';
  if (row.exactAxisRepair) return 'Exact-axis code-8 glyph';
  const visual = support.visual || {};
  if (visual.previewGlyphGeometry) return visual.previewGlyphGeometry;
  if (visual.family) return visual.family;
  return support.supportFamily || row.family || 'Resolved support marker';
}

function setStatus(message) {
  const el = document.getElementById('smwStatus');
  if (el) el.textContent = message;
  const log = document.getElementById('log');
  if (log) log.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`;
}

function sameNode(a, b) { return String(Number(a || 0)) === String(Number(b || 0)); }
function sameFamily(a, b) { return String(a || '').toUpperCase().replace(/[\s-]+/g, '_') === String(b || '').toUpperCase().replace(/[\s-]+/g, '_'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

function injectStyles() {
  if (document.getElementById('supportMappingIsonoteWorkbenchStyles')) return;
  const style = document.createElement('style');
  style.id = 'supportMappingIsonoteWorkbenchStyles';
  style.textContent = `
    .support-map-workbench{width:min(1180px,94vw);max-height:88vh;border:1px solid rgba(148,163,184,.35);border-radius:16px;background:#111827;color:#e5e7eb;padding:0;box-shadow:0 24px 80px rgba(0,0,0,.45)}
    .support-map-workbench::backdrop{background:rgba(2,6,23,.62)}
    .smw-head{display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid rgba(148,163,184,.22)}
    .smw-head h2{margin:0;font-size:20px}.smw-head p{margin:4px 0 0;color:#94a3b8}.smw-close{font-size:26px;background:transparent;color:#e5e7eb;border:0;cursor:pointer}
    .smw-actions{display:flex;gap:10px;align-items:center;padding:12px 20px;border-bottom:1px solid rgba(148,163,184,.18)}
    .smw-actions .primary,.smw-body .primary{border:0;border-radius:10px;padding:9px 12px;background:#2563eb;color:white;cursor:pointer}.smw-actions .alt{background:#7c3aed}.smw-status{margin-left:auto;color:#cbd5e1;font-size:12px}
    .smw-tabs{display:flex;gap:8px;padding:12px 20px 0}.smw-tabs button{border:1px solid rgba(148,163,184,.28);border-radius:10px 10px 0 0;background:#1f2937;color:#cbd5e1;padding:10px 14px;cursor:pointer}.smw-tabs button.active{background:#0f172a;color:#fff;border-bottom-color:#0f172a}
    .smw-body{padding:16px 20px 20px;overflow:auto;max-height:62vh;background:#0f172a}.smw-intro{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px;color:#cbd5e1}.smw-intro strong{color:#fff}.smw-intro span{font-size:12px;color:#94a3b8}
    #smwIsonoteText{width:100%;box-sizing:border-box;background:#020617;color:#e5e7eb;border:1px solid rgba(148,163,184,.28);border-radius:10px;padding:10px;margin-bottom:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    .smw-table{width:100%;border-collapse:collapse;font-size:12px}.smw-table th,.smw-table td{border:1px solid rgba(148,163,184,.22);padding:8px;vertical-align:top}.smw-table th{background:#1e293b;color:#e2e8f0;text-align:left}.smw-table input{width:100%;box-sizing:border-box;background:#020617;color:#e5e7eb;border:1px solid rgba(148,163,184,.28);border-radius:8px;padding:7px}
  `;
  document.head.appendChild(style);
}

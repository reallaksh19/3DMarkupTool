export const MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_SCHEMA = 'ManagedStageSupportSettingsPopup.v2';
export const MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_CACHE_KEY = '20260623-support-settings-modal-2';

export function buildManagedStageSupportSettingsPopupModel({ supportUi = {}, isonoteWorkflow = {} } = {}) {
  const sourceMode = String(supportUi.sourceMode || 'stagedJson');
  const sourceLabel = supportUi.legacyFlags?.sourceLabel || sourceLabelFromMode(sourceMode);
  const mapperPresetLabel = supportUi.mapperPresetLabel || supportUi.mapperPresetId || 'CAESAR default';
  const northSourceAxis = supportUi.axisBasis?.northSourceAxis || '-X';
  const northCanvasAxis = supportUi.axisBasis?.northCanvasAxis || northSourceAxis;
  const recordCount = Number(isonoteWorkflow.supportRecordCount || 0);
  const issueCount = Number(isonoteWorkflow.issueCount || 0);
  const isonoteStatus = isonoteWorkflow.statusLabel || 'Not parsed';
  const disabled = sourceMode === 'off';
  const summaryText = disabled
    ? `Support mapping: Off • ${mapperPresetLabel}`
    : `Support mapping: ${sourceLabel} • ${mapperPresetLabel} • North ${northSourceAxis}→${northCanvasAxis}`;
  const isonoteSummaryText = `ISONOTE: ${isonoteStatus} • ${recordCount} support record(s) • ${issueCount} issue(s)`;
  return {
    schema: MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_CACHE_KEY,
    sourceMode,
    sourceLabel,
    mapperPresetLabel,
    northSourceAxis,
    northCanvasAxis,
    disabled,
    modal: true,
    mainPanelMode: 'summary-only',
    summaryText,
    isonoteSummaryText,
    isonoteSupportRecordCount: recordCount,
    isonoteIssueCount: issueCount,
    retiredStageSettingIds: ['renderActualSupport', 'renderExpectedSupport']
  };
}

export function installManagedStageSupportSettingsPopupUi({ doc = globalThis.document, win = globalThis.window } = {}) {
  if (!doc || typeof doc.getElementById !== 'function') return null;
  installSupportSettingsModalStyles(doc);
  const conversionSection = doc.querySelector?.('[data-section="conversion"]') || doc.getElementById('conversion-options-body')?.parentElement || doc.body;
  if (!conversionSection) return null;
  const shell = ensureSupportSettingsShell(doc, conversionSection);
  adoptSupportSettingControls(doc, shell);
  hideRetiredStageSettings(doc);
  hideEmptySideloadSection(doc);
  const refresh = () => {
    const model = buildManagedStageSupportSettingsPopupModel({
      supportUi: win?.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {},
      isonoteWorkflow: win?.__3D_MARKUP_ISONOTE_TEXT_WORKFLOW__ || {}
    });
    renderSupportSettingsShell(shell, model);
    win.__3D_MARKUP_SUPPORT_SETTINGS_POPUP__ = model;
    return model;
  };
  if (shell.dataset.supportSettingsPopupInstalled !== 'true') {
    shell.addEventListener?.('click', (event) => {
      const actionNode = event?.target?.closest?.('[data-support-settings-action]');
      const action = actionNode?.getAttribute?.('data-support-settings-action');
      if (!action) return;
      event.preventDefault?.();
      setPopupOpen(shell, action === 'open', doc);
    });
    doc.addEventListener?.('keydown', (event) => {
      if (event.key === 'Escape') setPopupOpen(shell, false, doc);
    });
    doc.addEventListener?.('change', refresh, true);
    doc.addEventListener?.('input', refresh, true);
    win?.addEventListener?.('managed-stage:support-source-ui-ready', refresh);
    win?.addEventListener?.('managed-stage:isonote-workflow-apply', refresh);
    shell.dataset.supportSettingsPopupInstalled = 'true';
  }
  const installed = refresh();
  dispatchCustomEvent(doc, 'managed-stage:support-settings-popup-ready', installed);
  return installed;
}

function ensureSupportSettingsShell(doc, parent) {
  let shell = doc.getElementById('supportMappingSettingsShell');
  if (shell) return shell;
  shell = doc.createElement('section');
  shell.id = 'supportMappingSettingsShell';
  shell.className = 'support-mapping-settings-shell';
  shell.setAttribute('aria-label', 'Support mapping and ISONOTE controls');
  shell.innerHTML = [
    '<div class="support-mapping-settings-launcher">',
    '<button type="button" class="support-mapping-settings-open" data-support-settings-action="open">Support mapping / ISONOTE…</button>',
    '<small data-support-settings-launcher-summary aria-live="polite"></small>',
    '</div>',
    '<div id="supportMappingSettingsBackdrop" class="support-mapping-settings-backdrop" data-support-settings-action="close" hidden></div>',
    '<div id="supportMappingSettingsPopup" class="support-mapping-settings-popup" role="dialog" aria-modal="true" aria-label="Support mapping settings" hidden>',
    '<div class="support-mapping-settings-popup-header"><div><h3>Support mapping / ISONOTE</h3><small data-support-settings-popup-status aria-live="polite"></small></div><button type="button" data-support-settings-action="close" aria-label="Close support mapping settings">×</button></div>',
    '<div class="support-mapping-settings-popup-grid">',
    '<section data-support-settings-controls><h4>Source, preset and axis</h4></section>',
    '<section data-support-settings-isonote-host><h4>ISONOTE side-load</h4></section>',
    '<section data-support-settings-mapper-host><h4>Mapper fields and import/export</h4></section>',
    '</div>',
    '</div>'
  ].join('');
  parent.insertBefore?.(shell, parent.firstChild || null) || parent.appendChild(shell);
  return shell;
}

function renderSupportSettingsShell(shell, model) {
  const launcher = shell.querySelector?.('[data-support-settings-launcher-summary]');
  const status = shell.querySelector?.('[data-support-settings-popup-status]');
  if (launcher) launcher.textContent = model.summaryText;
  if (status) status.textContent = `${model.summaryText}. ${model.isonoteSummaryText}.`;
}

function adoptSupportSettingControls(doc, shell) {
  const controlsHost = shell.querySelector?.('[data-support-settings-controls]');
  const mapperHost = shell.querySelector?.('[data-support-settings-mapper-host]');
  const isonoteHost = shell.querySelector?.('[data-support-settings-isonote-host]');
  adoptLabeledControl(doc, controlsHost, 'supportMode', 'Support source');
  adoptLabeledControl(doc, controlsHost, 'supportMapperPreset', 'Mapper preset');
  adoptLabeledControl(doc, controlsHost, 'supportNorthAxis', 'CAESAR North axis');
  adoptLabeledControl(doc, controlsHost, 'singleAxisDecision', 'Single-axis unresolved decision');
  adoptNode(mapperHost, doc.getElementById('supportMapperSourceSummary'));
  adoptNode(mapperHost, doc.getElementById('supportMapperConfigDetails'));
  adoptTextarea(doc, isonoteHost, 'lineNoText', 'Line No sideload CSV');
  adoptTextarea(doc, isonoteHost, 'isonoteText', 'ISONOTE sideload CSV / text');
  adoptNode(isonoteHost, doc.getElementById('supportIsonoteWorkflowPanel'));
}

function adoptLabeledControl(doc, host, id, labelText) {
  if (!host) return null;
  let control = doc.getElementById(id);
  if (!control) return null;
  let label = control.closest?.('label');
  if (!label || label.id === 'conversionOptionsCompatRoot') {
    label = doc.createElement('label');
    label.className = `field support-settings-field support-settings-${id}`;
    const span = doc.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);
    label.appendChild(control);
  }
  label.classList?.add('support-settings-popup-field');
  label.hidden = false;
  label.style.display = '';
  host.appendChild(label);
  return label;
}

function adoptTextarea(doc, host, id, labelText) {
  if (!host) return null;
  let textarea = doc.getElementById(id);
  if (!textarea) {
    textarea = doc.createElement('textarea');
    textarea.id = id;
  }
  let label = textarea.closest?.('label');
  if (!label || label.id === 'conversionOptionsCompatRoot') {
    label = doc.createElement('label');
    label.className = `field support-settings-textarea support-settings-${id}`;
    const span = doc.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);
    label.appendChild(textarea);
  }
  textarea.rows = Math.max(Number(textarea.rows || 0), id === 'isonoteText' ? 8 : 4);
  label.hidden = false;
  label.style.display = '';
  host.appendChild(label);
  return label;
}

function adoptNode(host, node) {
  if (!host || !node) return null;
  node.hidden = false;
  node.style.display = '';
  host.appendChild(node);
  return node;
}

function hideRetiredStageSettings(doc) {
  for (const id of ['renderActualSupport', 'renderExpectedSupport']) {
    const node = doc.getElementById(id);
    if (!node) continue;
    node.dataset.retiredStageSetting = 'true';
    const label = node.closest?.('label') || node.parentElement;
    if (label) {
      label.hidden = true;
      label.style.display = 'none';
      label.setAttribute?.('aria-hidden', 'true');
      label.setAttribute?.('data-retired-stage-setting', 'true');
    }
  }
}

function hideEmptySideloadSection(doc) {
  const section = doc.querySelector?.('[data-section="sideload"]');
  const body = doc.getElementById('sideload-options-body');
  if (!section || !body) return;
  const hasVisibleControls = [...body.querySelectorAll?.('input, textarea, select, button') || []]
    .some((node) => !node.closest('[hidden]') && node.offsetParent !== null);
  if (!hasVisibleControls) {
    section.hidden = true;
    section.setAttribute('aria-hidden', 'true');
    section.dataset.replacedBySupportSettingsModal = 'true';
  }
}

function setPopupOpen(shell, isOpen, doc) {
  const popup = shell.querySelector?.('#supportMappingSettingsPopup');
  const backdrop = shell.querySelector?.('#supportMappingSettingsBackdrop');
  if (!popup) return;
  popup.hidden = !isOpen;
  if (backdrop) backdrop.hidden = !isOpen;
  shell.dataset.supportSettingsOpen = isOpen ? 'true' : 'false';
  doc?.body?.classList?.toggle?.('support-settings-modal-open', Boolean(isOpen));
  if (isOpen) popup.querySelector?.('button, input, select, textarea, summary')?.focus?.();
}

function installSupportSettingsModalStyles(doc) {
  if (doc.getElementById('supportSettingsModalStyle')) return;
  const style = doc.createElement('style');
  style.id = 'supportSettingsModalStyle';
  style.textContent = `
    .support-mapping-settings-shell { display: grid; gap: 6px; margin: 6px 0 10px; padding: 8px; border: 1px solid rgba(148,163,184,.28); border-radius: 10px; background: rgba(15,23,42,.52); }
    .support-mapping-settings-launcher { display: grid; gap: 5px; }
    .support-mapping-settings-open { width: 100%; min-height: 34px; border-radius: 8px; border: 1px solid rgba(96,165,250,.55); background: rgba(30,64,175,.45); color: #dbeafe; font-weight: 700; cursor: pointer; }
    .support-mapping-settings-launcher small { color: #bfdbfe; line-height: 1.35; }
    .support-mapping-settings-backdrop { position: fixed; inset: 0; z-index: 9998; background: rgba(2,6,23,.68); backdrop-filter: blur(2px); }
    .support-mapping-settings-popup { position: fixed; z-index: 9999; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(1120px, calc(100vw - 36px)); max-height: min(84vh, 860px); overflow: auto; border: 1px solid rgba(148,163,184,.36); border-radius: 16px; background: #0f172a; color: #e5e7eb; box-shadow: 0 24px 80px rgba(0,0,0,.55); padding: 14px; }
    .support-mapping-settings-popup-header { position: sticky; top: -14px; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: -14px -14px 12px; padding: 14px; background: rgba(15,23,42,.98); border-bottom: 1px solid rgba(148,163,184,.22); }
    .support-mapping-settings-popup-header h3 { margin: 0 0 3px; font-size: 16px; }
    .support-mapping-settings-popup-header small { color: #cbd5e1; }
    .support-mapping-settings-popup-header button { width: 34px; height: 34px; border-radius: 999px; border: 1px solid rgba(148,163,184,.36); background: rgba(30,41,59,.95); color: #f8fafc; font-size: 22px; cursor: pointer; }
    .support-mapping-settings-popup-grid { display: grid; grid-template-columns: minmax(220px, .72fr) minmax(260px, .95fr) minmax(360px, 1.35fr); gap: 12px; align-items: start; }
    .support-mapping-settings-popup-grid > section { min-width: 0; padding: 12px; border: 1px solid rgba(148,163,184,.22); border-radius: 12px; background: rgba(15,23,42,.72); }
    .support-mapping-settings-popup-grid h4 { margin: 0 0 10px; color: #dbeafe; }
    .support-settings-popup-field, .support-settings-textarea { display: grid !important; gap: 5px; margin: 0 0 10px; }
    .support-settings-popup-field span, .support-settings-textarea span { color: #cbd5e1; font-size: 12px; }
    .support-settings-popup-field select, .support-settings-popup-field input, .support-settings-textarea textarea { width: 100%; box-sizing: border-box; border-radius: 8px; border: 1px solid rgba(148,163,184,.35); background: rgba(2,6,23,.62); color: #e5e7eb; padding: 7px; }
    .support-settings-textarea textarea { min-height: 92px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    body.support-settings-modal-open { overflow: hidden; }
    @media (max-width: 900px) { .support-mapping-settings-popup-grid { grid-template-columns: 1fr; } }
  `;
  doc.head?.appendChild(style);
}

function sourceLabelFromMode(sourceMode) {
  if (sourceMode === 'isonote') return 'ISONOTE side-load';
  if (sourceMode === 'off') return 'Off';
  return 'stagedJson';
}

function dispatchCustomEvent(target, type, detail) {
  const EventCtor = target?.defaultView?.CustomEvent || target?.CustomEvent || globalThis.CustomEvent;
  if (typeof EventCtor === 'function') target?.dispatchEvent?.(new EventCtor(type, { detail }));
}

if (typeof window !== 'undefined') {
  const start = () => installManagedStageSupportSettingsPopupUi();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('markup:app-ready', start, { once: true });
  window.addEventListener('managed-stage:isonote-workflow-ui-ready', start);
}

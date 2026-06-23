export const MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_SCHEMA = 'ManagedStageSupportSettingsPopup.v1';
export const MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_CACHE_KEY = '20260623-support-settings-popup-1';

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
    summaryText,
    isonoteSummaryText,
    isonoteSupportRecordCount: recordCount,
    isonoteIssueCount: issueCount,
    retiredStageSettingIds: ['renderActualSupport', 'renderExpectedSupport']
  };
}

export function installManagedStageSupportSettingsPopupUi({ doc = globalThis.document, win = globalThis.window } = {}) {
  if (!doc || typeof doc.getElementById !== 'function') return null;
  const conversionSection = doc.querySelector?.('[data-section="conversion"]') || doc.getElementById('conversion-options-body')?.parentElement || doc.body;
  if (!conversionSection) return null;
  const shell = ensureSupportSettingsShell(doc, conversionSection);
  adoptSupportSettingControls(doc, shell);
  hideRetiredStageSettings(doc);
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
      const action = event?.target?.getAttribute?.('data-support-settings-action');
      if (!action) return;
      event.preventDefault?.();
      setPopupOpen(shell, action === 'open');
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
  shell.className = 'conversion-collapsible-content support-mapping-settings-shell';
  shell.innerHTML = [
    '<div class="support-mapping-settings-launcher">',
    '<button type="button" data-support-settings-action="open">Support mapping / ISONOTE…</button>',
    '<small data-support-settings-launcher-summary aria-live="polite"></small>',
    '</div>',
    '<div id="supportMappingSettingsPopup" class="support-mapping-settings-popup" role="dialog" aria-modal="false" aria-label="Support mapping settings" hidden>',
    '<div class="support-mapping-settings-popup-header"><h3>Support mapping settings</h3><button type="button" data-support-settings-action="close" aria-label="Close support mapping settings">×</button></div>',
    '<small data-support-settings-popup-status aria-live="polite"></small>',
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

function setPopupOpen(shell, isOpen) {
  const popup = shell.querySelector?.('#supportMappingSettingsPopup');
  if (!popup) return;
  popup.hidden = !isOpen;
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

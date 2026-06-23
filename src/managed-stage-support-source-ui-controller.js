import {
  CAESAR_TO_CANVAS_AXIS_BASIS_PRESET,
  DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG,
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  mapManagedStageSupportAxisToCanvas
} from './managed-stage-support-mapper-config.js';

export const MANAGED_STAGE_SUPPORT_SOURCE_UI_SCHEMA = 'ManagedStageSupportSourceUi.v1';
export const MANAGED_STAGE_SUPPORT_SOURCE_UI_CACHE_KEY = '20260623-staged-json-support-source-ui-1';

export function normalizeManagedStageSupportSourceMode(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'off' || text === 'none' || text === 'disabled') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF;
  if (text === 'isonote' || text === 'iso_note' || text === 'iso-note' || text === 'note') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE;
  return MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON;
}

export function applyManagedStageSupportSourceModeToLegacyFlags(sourceMode) {
  const mode = normalizeManagedStageSupportSourceMode(sourceMode);
  return {
    schema: MANAGED_STAGE_SUPPORT_SOURCE_UI_SCHEMA,
    sourceMode: mode,
    renderActualSupport: mode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
    renderExpectedSupport: mode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    supportOverlayEnabled: mode !== MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF,
    sourceLabel: mode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE ? 'ISONOTE side-load' : mode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON ? 'stagedJson' : 'Off'
  };
}

export function buildManagedStageSupportSourceUiModel(options = {}) {
  const sourceMode = normalizeManagedStageSupportSourceMode(options.sourceMode || DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.defaultSourceMode);
  const northSourceAxis = normalizeSignedAxis(options.northSourceAxis || '-X') || '-X';
  const northMapped = mapManagedStageSupportAxisToCanvas(northSourceAxis, CAESAR_TO_CANVAS_AXIS_BASIS_PRESET);
  return {
    schema: MANAGED_STAGE_SUPPORT_SOURCE_UI_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_SOURCE_UI_CACHE_KEY,
    sourceMode,
    sourceOptions: [
      { value: MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF, label: 'Off' },
      { value: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON, label: 'stagedJson fields' },
      { value: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE, label: 'ISONOTE side-load text' }
    ],
    axisBasis: {
      preset: 'CAESAR',
      up: '+Y',
      down: '-Y',
      northSourceAxis,
      northCanvasAxis: northMapped.canvasAxis,
      northEngineeringDirection: northMapped.engineeringDirection || 'NORTH',
      editable: true
    },
    mapperColumns: [
      'supportTag',
      'supportKind',
      'graphicsRule',
      'axis',
      'sign',
      'gap',
      'coordinate'
    ],
    legacyFlags: applyManagedStageSupportSourceModeToLegacyFlags(sourceMode)
  };
}

export function installManagedStageSupportSourceUi({ doc = globalThis.document } = {}) {
  if (!doc || typeof doc.getElementById !== 'function') return null;
  const model = buildManagedStageSupportSourceUiModel({
    sourceMode: doc.getElementById('supportMode')?.value || readStoredSourceMode()
  });
  const conversionSection = doc.querySelector?.('[data-section="conversion"]') || doc.getElementById('conversion-options-body')?.parentElement;
  if (!conversionSection) return model;

  const sourceSelect = ensureSupportSourceSelect(doc, conversionSection, model);
  const axisSelect = ensureNorthAxisSelect(doc, conversionSection, model);
  const summary = ensureMapperSummary(doc, conversionSection);
  const sync = () => {
    const nextModel = buildManagedStageSupportSourceUiModel({
      sourceMode: sourceSelect.value,
      northSourceAxis: axisSelect.value
    });
    syncLegacySupportCheckboxes(doc, nextModel.legacyFlags);
    summary.textContent = supportSourceSummary(nextModel);
    try { globalThis.localStorage?.setItem?.('managedStage.supportSourceMode', nextModel.sourceMode); } catch (_) {}
    globalThis.__3D_MARKUP_SUPPORT_SOURCE_UI__ = nextModel;
    return nextModel;
  };
  sourceSelect.addEventListener?.('change', sync);
  axisSelect.addEventListener?.('change', sync);
  const installed = sync();
  doc.dispatchEvent?.(new CustomEvent('managed-stage:support-source-ui-ready', { detail: installed }));
  return installed;
}

function ensureSupportSourceSelect(doc, parent, model) {
  let select = doc.getElementById('supportMode');
  if (!select) {
    const label = doc.createElement('label');
    label.className = 'field conversion-collapsible-content support-source-field';
    label.innerHTML = '<span>Support source</span><select id="supportMode" aria-label="Support source"></select>';
    insertBeforeSingleAxis(parent, label);
    select = label.querySelector('select');
  }
  select.innerHTML = model.sourceOptions.map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`).join('');
  select.value = model.sourceMode;
  return select;
}

function ensureNorthAxisSelect(doc, parent, model) {
  let select = doc.getElementById('supportNorthAxis');
  if (!select) {
    const label = doc.createElement('label');
    label.className = 'field conversion-collapsible-content support-axis-field';
    label.innerHTML = '<span>CAESAR North axis</span><select id="supportNorthAxis" aria-label="CAESAR North source axis"><option value="-X">-X = North</option><option value="+X">+X = North</option><option value="+Z">+Z = North</option><option value="-Z">-Z = North</option></select>';
    insertBeforeSingleAxis(parent, label);
    select = label.querySelector('select');
  }
  select.value = model.axisBasis.northSourceAxis;
  return select;
}

function ensureMapperSummary(doc, parent) {
  let summary = doc.getElementById('supportMapperSourceSummary');
  if (!summary) {
    summary = doc.createElement('small');
    summary.id = 'supportMapperSourceSummary';
    summary.className = 'conversion-collapsible-content support-mapper-summary';
    summary.style.display = 'block';
    summary.style.opacity = '0.8';
    insertBeforeSingleAxis(parent, summary);
  }
  return summary;
}

function insertBeforeSingleAxis(parent, element) {
  const anchor = parent.querySelector?.('#singleAxisDecision')?.closest?.('label') || parent.querySelector?.('#conversion-options-body');
  if (anchor?.parentNode) anchor.parentNode.insertBefore(element, anchor);
  else parent.appendChild(element);
}

function syncLegacySupportCheckboxes(doc, flags) {
  const actual = doc.getElementById('renderActualSupport');
  const expected = doc.getElementById('renderExpectedSupport');
  if (actual) {
    actual.checked = flags.renderActualSupport;
    actual.disabled = true;
    actual.closest?.('label')?.setAttribute?.('title', 'Controlled by Support source');
  }
  if (expected) {
    expected.checked = flags.renderExpectedSupport;
    expected.disabled = true;
    expected.closest?.('label')?.setAttribute?.('title', 'Controlled by Support source');
  }
}

function supportSourceSummary(model) {
  if (model.sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF) return 'Support symbols disabled.';
  return `Support source: ${model.legacyFlags.sourceLabel}; CAESAR +Y=UP, ${model.axisBasis.northSourceAxis}=NORTH → Canvas ${model.axisBasis.northCanvasAxis}.`;
}

function readStoredSourceMode() {
  try { return globalThis.localStorage?.getItem?.('managedStage.supportSourceMode') || ''; } catch (_) { return ''; }
}

function normalizeSignedAxis(axisToken) {
  const match = String(axisToken || '').toUpperCase().trim().match(/([+-]?)(X|Y|Z)/);
  if (!match) return '';
  return `${match[1] || '+'}${match[2]}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

if (typeof window !== 'undefined') {
  const start = () => installManagedStageSupportSourceUi();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('markup:app-ready', start, { once: true });
}

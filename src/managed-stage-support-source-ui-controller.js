import {
  CAESAR_TO_CANVAS_AXIS_BASIS_PRESET,
  DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG,
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  mapManagedStageSupportAxisToCanvas,
  resolveManagedStageSupportMapperConfig
} from './managed-stage-support-mapper-config.js';

export const MANAGED_STAGE_SUPPORT_SOURCE_UI_SCHEMA = 'ManagedStageSupportSourceUi.v1';
export const MANAGED_STAGE_SUPPORT_SOURCE_UI_CACHE_KEY = '20260623-staged-json-support-source-ui-2';

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
  const axisBasisForUi = buildUiAxisBasis({ northSourceAxis, axisBasis: options.axisBasis });
  const northMapped = mapManagedStageSupportAxisToCanvas(northSourceAxis, axisBasisForUi);
  const mapperConfig = resolveManagedStageSupportMapperConfig(options.mapperConfig || {});
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
      editable: true,
      basis: axisBasisForUi
    },
    axisBasisRows: buildManagedStageSupportAxisBasisRows(axisBasisForUi),
    mapperColumns: [
      'fieldPurpose',
      'sourceFieldCandidates',
      'normalizedOutput',
      'graphicsRule',
      'axisBasis'
    ],
    mapperRows: buildManagedStageSupportMapperUiRows(mapperConfig),
    legacyFlags: applyManagedStageSupportSourceModeToLegacyFlags(sourceMode)
  };
}

export function buildManagedStageSupportMapperUiRows(config = {}) {
  const resolvedConfig = config?.schema ? config : resolveManagedStageSupportMapperConfig(config);
  const fieldMapper = resolvedConfig.fieldMapper || {};
  return [
    mapperRow('supportTag', 'Support tag / PS number', fieldMapper.supportTagFields, 'supportTag', 'identity'),
    mapperRow('supportKind', 'Support kind / restraint family', fieldMapper.supportKindFields, 'family', 'REST / GUIDE / HOLDDOWN / LINESTOP / SPRING_CAN'),
    mapperRow('graphicsRule', 'Graphics rule selector', fieldMapper.graphicsRuleFields, 'graphicsRule', 'symbol catalogue rule'),
    mapperRow('axis', 'Source axis / CAESAR axis', fieldMapper.axisFields, 'axis.sourceAxis', 'axis-basis mapper first'),
    mapperRow('sign', 'Axis sign / plus-minus', fieldMapper.signFields, 'sign', '+ / - / +/-'),
    mapperRow('gap', 'Record-local gap', fieldMapper.gapFields, 'gapMm', 'SUPPORT_GAP_MM first, then current-record *GAP*'),
    mapperRow('coordinate', 'Support coordinate', fieldMapper.coordinateFields, 'coord', 'Canvas coordinate mapper')
  ];
}

export function buildManagedStageSupportAxisBasisRows(axisBasis = CAESAR_TO_CANVAS_AXIS_BASIS_PRESET) {
  const basis = axisBasis?.axes ? axisBasis : CAESAR_TO_CANVAS_AXIS_BASIS_PRESET;
  return ['+Y', '-Y', '-X', '+X', '+Z', '-Z'].map((sourceAxis) => {
    const mapped = mapManagedStageSupportAxisToCanvas(sourceAxis, basis);
    return {
      sourceAxis,
      engineeringDirection: mapped.engineeringDirection,
      canvasAxis: mapped.canvasAxis,
      canvasVectorText: mapped.canvasVectorText,
      editable: !['+Y', '-Y'].includes(sourceAxis)
    };
  });
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
  const details = ensureMapperDetails(doc, conversionSection);
  const sync = () => {
    const nextModel = buildManagedStageSupportSourceUiModel({
      sourceMode: sourceSelect.value,
      northSourceAxis: axisSelect.value
    });
    syncLegacySupportCheckboxes(doc, nextModel.legacyFlags);
    summary.textContent = supportSourceSummary(nextModel);
    details.innerHTML = renderMapperDetails(nextModel);
    try { globalThis.localStorage?.setItem?.('managedStage.supportSourceMode', nextModel.sourceMode); } catch (_) {}
    try { globalThis.localStorage?.setItem?.('managedStage.supportNorthAxis', nextModel.axisBasis.northSourceAxis); } catch (_) {}
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

function ensureMapperDetails(doc, parent) {
  let details = doc.getElementById('supportMapperConfigDetails');
  if (!details) {
    details = doc.createElement('details');
    details.id = 'supportMapperConfigDetails';
    details.className = 'conversion-collapsible-content support-mapper-config-details';
    details.innerHTML = '<summary>Support mapper config</summary>';
    insertBeforeSingleAxis(parent, details);
  }
  return details;
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

function renderMapperDetails(model) {
  const rows = model.mapperRows.map((row) => `<tr><td>${escapeHtml(row.fieldPurpose)}</td><td>${escapeHtml(row.sourceFieldCandidates.join(', '))}</td><td>${escapeHtml(row.normalizedOutput)}</td><td>${escapeHtml(row.graphicsRule)}</td></tr>`).join('');
  const axisRows = model.axisBasisRows.map((row) => `<tr><td>${escapeHtml(row.sourceAxis)}</td><td>${escapeHtml(row.engineeringDirection)}</td><td>${escapeHtml(row.canvasAxis)}</td><td>${escapeHtml(row.canvasVectorText)}</td></tr>`).join('');
  return `<summary>Support mapper config</summary><table><thead><tr><th>Purpose</th><th>Source fields</th><th>Output</th><th>Rule</th></tr></thead><tbody>${rows}</tbody></table><table><thead><tr><th>Source axis</th><th>Meaning</th><th>Canvas axis</th><th>Vector</th></tr></thead><tbody>${axisRows}</tbody></table>`;
}

function buildUiAxisBasis({ northSourceAxis = '-X', axisBasis = {} } = {}) {
  const normalizedNorth = normalizeSignedAxis(northSourceAxis) || '-X';
  const base = resolveManagedStageSupportMapperConfig({ axisBasis }).axisBasis;
  return {
    ...base,
    name: `${base.name || 'CAESAR default axis basis'} with configurable project north`,
    axes: {
      ...(base.axes || {}),
      [normalizedNorth]: {
        ...(base.axes?.[normalizedNorth] || {}),
        engineeringDirection: 'NORTH',
        canvasAxis: normalizedNorth
      },
      '+Y': { ...(base.axes?.['+Y'] || {}), engineeringDirection: 'UP', canvasAxis: '+Y' },
      '-Y': { ...(base.axes?.['-Y'] || {}), engineeringDirection: 'DOWN', canvasAxis: '-Y' }
    }
  };
}

function mapperRow(fieldPurpose, label, sourceFieldCandidates = [], normalizedOutput, graphicsRule) {
  return {
    fieldPurpose,
    label,
    sourceFieldCandidates: [...(sourceFieldCandidates || [])],
    normalizedOutput,
    graphicsRule,
    editable: true
  };
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
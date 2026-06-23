import {
  CAESAR_TO_CANVAS_AXIS_BASIS_PRESET,
  DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG,
  MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS,
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  buildManagedStageSupportMapperPresetOptions,
  getManagedStageSupportMapperPresetProfile,
  mapManagedStageSupportAxisToCanvas,
  normalizeManagedStageSupportMapperPresetId,
  resolveManagedStageSupportMapperConfig
} from './managed-stage-support-mapper-config.js';

export const MANAGED_STAGE_SUPPORT_SOURCE_UI_SCHEMA = 'ManagedStageSupportSourceUi.v1';
export const MANAGED_STAGE_SUPPORT_MAPPER_EXPORT_SCHEMA = 'ManagedStageSupportMapperExport.v1';
export const MANAGED_STAGE_SUPPORT_SOURCE_UI_CACHE_KEY = '20260623-staged-json-support-source-ui-5';
export const MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY = 'managedStage.supportMapperConfig.v1';
export const MANAGED_STAGE_SUPPORT_MAPPER_PRESET_STORAGE_KEY = 'managedStage.supportMapperPreset.v1';

const FIELD_PURPOSE_TO_MAPPER_KEY = Object.freeze({
  supportTag: 'supportTagFields',
  supportKind: 'supportKindFields',
  graphicsRule: 'graphicsRuleFields',
  axis: 'axisFields',
  sign: 'signFields',
  gap: 'gapFields',
  coordinate: 'coordinateFields'
});

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
  const mapperPresetId = resolveUiMapperPresetId(options);
  const presetProfile = getManagedStageSupportMapperPresetProfile(mapperPresetId);
  const mapperConfigInput = mapperPresetId === MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM
    ? (options.mapperConfig || {})
    : { ...(presetProfile.mapperConfig || {}), mapperPresetId };
  const mapperConfig = resolveManagedStageSupportMapperConfig({ ...mapperConfigInput, mapperPresetId });
  return {
    schema: MANAGED_STAGE_SUPPORT_SOURCE_UI_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_SOURCE_UI_CACHE_KEY,
    sourceMode,
    sourceOptions: [
      { value: MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF, label: 'Off' },
      { value: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON, label: 'stagedJson fields' },
      { value: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE, label: 'ISONOTE side-load text' }
    ],
    mapperPresetId,
    mapperPresetLabel: presetProfile.label,
    mapperPresetDescription: presetProfile.description,
    mapperPresetOptions: buildManagedStageSupportMapperPresetOptions(),
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
    mapperConfig,
    mapperColumns: [
      'fieldPurpose',
      'sourceFieldCandidates',
      'normalizedOutput',
      'graphicsRule',
      'axisBasis'
    ],
    mapperRows: buildManagedStageSupportMapperUiRows(mapperConfig),
    mapperExportText: serializeManagedStageSupportMapperExportPayload(mapperConfig, { sourceMode, northSourceAxis, axisBasis: axisBasisForUi, mapperPresetId }),
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

export function normalizeManagedStageMapperFieldCandidates(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildManagedStageSupportMapperConfigFromUiFields(fields = {}) {
  const fieldMapper = {};
  for (const [fieldPurpose, mapperKey] of Object.entries(FIELD_PURPOSE_TO_MAPPER_KEY)) {
    const values = normalizeManagedStageMapperFieldCandidates(fields[fieldPurpose]);
    if (values.length) fieldMapper[mapperKey] = values;
  }
  return { mapperPresetId: MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM, fieldMapper };
}

export function serializeManagedStageSupportMapperConfig(config = {}) {
  const resolved = resolveManagedStageSupportMapperConfig(config);
  return JSON.stringify({ mapperPresetId: resolved.mapperPresetId, fieldMapper: resolved.fieldMapper }, null, 2);
}

export function parseManagedStageSupportMapperConfig(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(String(text));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function buildManagedStageSupportMapperExportPayload(config = {}, options = {}) {
  const mapperPresetId = normalizeManagedStageSupportMapperPresetId(options.mapperPresetId || config.mapperPresetId || config.presetId || MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
  const resolved = resolveManagedStageSupportMapperConfig({ ...config, mapperPresetId });
  const sourceMode = normalizeManagedStageSupportSourceMode(options.sourceMode || DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.defaultSourceMode);
  const northSourceAxis = normalizeSignedAxis(options.northSourceAxis || '-X') || '-X';
  const axisBasisForExport = buildUiAxisBasis({ northSourceAxis, axisBasis: options.axisBasis });
  return {
    schema: MANAGED_STAGE_SUPPORT_MAPPER_EXPORT_SCHEMA,
    sourceMode,
    mapperPresetId: resolved.mapperPresetId,
    mapperConfig: { mapperPresetId: resolved.mapperPresetId, fieldMapper: resolved.fieldMapper },
    axisBasis: {
      preset: 'CAESAR',
      northSourceAxis,
      axes: axisBasisForExport.axes
    }
  };
}

export function serializeManagedStageSupportMapperExportPayload(config = {}, options = {}) {
  return JSON.stringify(buildManagedStageSupportMapperExportPayload(config, options), null, 2);
}

export function parseManagedStageSupportMapperExportPayload(text) {
  const parsed = parseManagedStageSupportMapperConfig(text);
  if (parsed?.schema === MANAGED_STAGE_SUPPORT_MAPPER_EXPORT_SCHEMA && parsed.mapperConfig) return { ...parsed.mapperConfig, mapperPresetId: parsed.mapperPresetId || parsed.mapperConfig.mapperPresetId };
  if (parsed?.mapperConfig) return parsed.mapperConfig;
  if (parsed?.fieldMapper) return parsed;
  return {};
}

export function readStoredMapperConfig(storage = globalThis.localStorage) {
  try {
    return parseManagedStageSupportMapperConfig(storage?.getItem?.(MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY) || '');
  } catch (_) {
    return {};
  }
}

export function writeStoredMapperConfig(config = {}, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY, serializeManagedStageSupportMapperConfig(config));
  } catch (_) {}
}

export function resetStoredMapperConfig(storage = globalThis.localStorage, mapperPresetId = MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CAESAR_DEFAULT) {
  const presetProfile = getManagedStageSupportMapperPresetProfile(mapperPresetId);
  const config = resolveManagedStageSupportMapperConfig({ ...(presetProfile.mapperConfig || {}), mapperPresetId: presetProfile.id });
  try {
    if (typeof storage?.removeItem === 'function') storage.removeItem(MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY);
    else storage?.setItem?.(MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY, '');
    storage?.setItem?.(MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY, serializeManagedStageSupportMapperConfig(config));
  } catch (_) {}
  return config;
}

export function readStoredMapperPresetId(storage = globalThis.localStorage) {
  try { return normalizeManagedStageSupportMapperPresetId(storage?.getItem?.(MANAGED_STAGE_SUPPORT_MAPPER_PRESET_STORAGE_KEY) || ''); } catch (_) { return MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CAESAR_DEFAULT; }
}

export function writeStoredMapperPresetId(mapperPresetId, storage = globalThis.localStorage) {
  try { storage?.setItem?.(MANAGED_STAGE_SUPPORT_MAPPER_PRESET_STORAGE_KEY, normalizeManagedStageSupportMapperPresetId(mapperPresetId)); } catch (_) {}
}

export function installManagedStageSupportSourceUi({ doc = globalThis.document } = {}) {
  if (!doc || typeof doc.getElementById !== 'function') return null;
  const model = buildManagedStageSupportSourceUiModel({
    sourceMode: doc.getElementById('supportMode')?.value || readStoredSourceMode(),
    northSourceAxis: readStoredNorthAxis(),
    mapperPresetId: readStoredMapperPresetId(),
    mapperConfig: readStoredMapperConfig()
  });
  const conversionSection = doc.querySelector?.('[data-section="conversion"]') || doc.getElementById('conversion-options-body')?.parentElement;
  if (!conversionSection) return model;

  const sourceSelect = ensureSupportSourceSelect(doc, conversionSection, model);
  const presetSelect = ensureMapperPresetSelect(doc, conversionSection, model);
  const axisSelect = ensureNorthAxisSelect(doc, conversionSection, model);
  const summary = ensureMapperSummary(doc, conversionSection);
  const details = ensureMapperDetails(doc, conversionSection);
  const sync = () => {
    const selectedPresetId = normalizeManagedStageSupportMapperPresetId(presetSelect.value);
    const mapperConfig = selectedPresetId === MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM
      ? (readMapperConfigFromDetails(doc) || readStoredMapperConfig())
      : { ...(getManagedStageSupportMapperPresetProfile(selectedPresetId).mapperConfig || {}), mapperPresetId: selectedPresetId };
    const nextModel = buildManagedStageSupportSourceUiModel({
      sourceMode: sourceSelect.value,
      northSourceAxis: axisSelect.value,
      mapperPresetId: selectedPresetId,
      mapperConfig
    });
    syncLegacySupportCheckboxes(doc, nextModel.legacyFlags);
    summary.textContent = supportSourceSummary(nextModel);
    details.innerHTML = renderMapperDetails(nextModel);
    writeStoredMapperConfig(nextModel.mapperConfig);
    writeStoredMapperPresetId(nextModel.mapperPresetId);
    try { globalThis.localStorage?.setItem?.('managedStage.supportSourceMode', nextModel.sourceMode); } catch (_) {}
    try { globalThis.localStorage?.setItem?.('managedStage.supportNorthAxis', nextModel.axisBasis.northSourceAxis); } catch (_) {}
    globalThis.__3D_MARKUP_SUPPORT_SOURCE_UI__ = nextModel;
    return nextModel;
  };
  const handleMapperAction = (event) => {
    const action = event?.target?.getAttribute?.('data-support-mapper-action');
    if (!action) return;
    event.preventDefault?.();
    const textarea = doc.getElementById('supportMapperConfigJson');
    if (action === 'export') {
      const mapperConfig = presetSelect.value === MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM
        ? (readMapperConfigFromDetails(doc) || readStoredMapperConfig())
        : { ...(getManagedStageSupportMapperPresetProfile(presetSelect.value).mapperConfig || {}), mapperPresetId: presetSelect.value };
      const modelForExport = buildManagedStageSupportSourceUiModel({ sourceMode: sourceSelect.value, northSourceAxis: axisSelect.value, mapperPresetId: presetSelect.value, mapperConfig });
      if (textarea) textarea.value = modelForExport.mapperExportText;
      return;
    }
    if (action === 'import') {
      const imported = parseManagedStageSupportMapperExportPayload(textarea?.value || '');
      const importedPreset = normalizeManagedStageSupportMapperPresetId(imported.mapperPresetId || MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
      presetSelect.value = importedPreset;
      writeMapperConfigToDetails(doc, imported);
      writeStoredMapperConfig(imported);
      writeStoredMapperPresetId(importedPreset);
      sync();
      return;
    }
    if (action === 'reset') {
      const defaults = resetStoredMapperConfig(globalThis.localStorage, presetSelect.value);
      writeMapperConfigToDetails(doc, defaults);
      sync();
    }
  };
  sourceSelect.addEventListener?.('change', sync);
  presetSelect.addEventListener?.('change', sync);
  axisSelect.addEventListener?.('change', sync);
  details.addEventListener?.('change', () => {
    presetSelect.value = MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM;
    sync();
  });
  details.addEventListener?.('click', handleMapperAction);
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

function ensureMapperPresetSelect(doc, parent, model) {
  let select = doc.getElementById('supportMapperPreset');
  if (!select) {
    const label = doc.createElement('label');
    label.className = 'field conversion-collapsible-content support-mapper-preset-field';
    label.innerHTML = '<span>Support mapper preset</span><select id="supportMapperPreset" aria-label="Support mapper preset"></select>';
    insertBeforeSingleAxis(parent, label);
    select = label.querySelector('select');
  }
  select.innerHTML = model.mapperPresetOptions.map((option) => `<option value="${escapeAttribute(option.value)}" title="${escapeAttribute(option.description || '')}">${escapeHtml(option.label)}</option>`).join('');
  select.value = model.mapperPresetId;
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
  if (model.sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF) return `Support symbols disabled. Mapper preset: ${model.mapperPresetLabel}.`;
  return `Support source: ${model.legacyFlags.sourceLabel}; Mapper preset: ${model.mapperPresetLabel}; CAESAR +Y=UP, ${model.axisBasis.northSourceAxis}=NORTH → Canvas ${model.axisBasis.northCanvasAxis}. Mapper fields are editable, importable, exportable, resettable to preset, and persisted locally.`;
}

function renderMapperDetails(model) {
  const rows = model.mapperRows.map((row) => {
    const value = row.sourceFieldCandidates.join(', ');
    return `<tr><td>${escapeHtml(row.label || row.fieldPurpose)}</td><td><input data-support-mapper-fields="${escapeAttribute(row.fieldPurpose)}" value="${escapeAttribute(value)}" aria-label="${escapeAttribute(row.label || row.fieldPurpose)} fields"></td><td>${escapeHtml(row.normalizedOutput)}</td><td>${escapeHtml(row.graphicsRule)}</td></tr>`;
  }).join('');
  const axisRows = model.axisBasisRows.map((row) => `<tr><td>${escapeHtml(row.sourceAxis)}</td><td>${escapeHtml(row.engineeringDirection)}</td><td>${escapeHtml(row.canvasAxis)}</td><td>${escapeHtml(row.canvasVectorText)}</td></tr>`).join('');
  return `<summary>Support mapper config</summary><p>Preset: <strong>${escapeHtml(model.mapperPresetLabel)}</strong>. ${escapeHtml(model.mapperPresetDescription || '')}</p><p>Source fields are comma-separated and stored in browser localStorage.</p><table><thead><tr><th>Purpose</th><th>Source fields</th><th>Output</th><th>Rule</th></tr></thead><tbody>${rows}</tbody></table><table><thead><tr><th>Source axis</th><th>Meaning</th><th>Canvas axis</th><th>Vector</th></tr></thead><tbody>${axisRows}</tbody></table><div class="support-mapper-config-io"><button type="button" data-support-mapper-action="export">Export mapper config</button><button type="button" data-support-mapper-action="import">Import mapper config</button><button type="button" data-support-mapper-action="reset">Reset to selected preset</button><textarea id="supportMapperConfigJson" aria-label="Support mapper config JSON" rows="8">${escapeHtml(model.mapperExportText)}</textarea></div>`;
}

function readMapperConfigFromDetails(doc) {
  const nodes = Array.from(doc.querySelectorAll?.('[data-support-mapper-fields]') || []);
  if (!nodes.length) return null;
  const fields = {};
  for (const node of nodes) {
    const purpose = node.getAttribute?.('data-support-mapper-fields') || '';
    if (!purpose) continue;
    fields[purpose] = node.value || '';
  }
  return buildManagedStageSupportMapperConfigFromUiFields(fields);
}

function writeMapperConfigToDetails(doc, config = {}) {
  const rows = buildManagedStageSupportMapperUiRows(config);
  for (const row of rows) {
    const node = doc.querySelector?.(`[data-support-mapper-fields="${row.fieldPurpose}"]`);
    if (node) node.value = row.sourceFieldCandidates.join(', ');
  }
  const textarea = doc.getElementById?.('supportMapperConfigJson');
  if (textarea) textarea.value = serializeManagedStageSupportMapperExportPayload(config);
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

function resolveUiMapperPresetId(options = {}) {
  const explicit = options.mapperPresetId || options.presetId || options.mapperConfig?.mapperPresetId || options.mapperConfig?.presetId;
  if (explicit) return normalizeManagedStageSupportMapperPresetId(explicit);
  if (options.mapperConfig?.fieldMapper && Object.keys(options.mapperConfig.fieldMapper).length) return MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM;
  return MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CAESAR_DEFAULT;
}

function readStoredSourceMode() {
  try { return globalThis.localStorage?.getItem?.('managedStage.supportSourceMode') || ''; } catch (_) { return ''; }
}

function readStoredNorthAxis() {
  try { return globalThis.localStorage?.getItem?.('managedStage.supportNorthAxis') || '-X'; } catch (_) { return '-X'; }
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

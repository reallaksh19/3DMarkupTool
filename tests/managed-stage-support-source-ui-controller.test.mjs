import assert from 'node:assert/strict';
import {
  buildManagedStageSupportSourceUiModel,
  buildManagedStageSupportMapperUiRows,
  buildManagedStageSupportAxisBasisRows,
  applyManagedStageSupportSourceModeToLegacyFlags,
  normalizeManagedStageSupportSourceMode,
  normalizeManagedStageMapperFieldCandidates,
  buildManagedStageSupportMapperConfigFromUiFields,
  serializeManagedStageSupportMapperConfig,
  parseManagedStageSupportMapperConfig,
  buildManagedStageSupportMapperExportPayload,
  serializeManagedStageSupportMapperExportPayload,
  parseManagedStageSupportMapperExportPayload,
  readStoredMapperConfig,
  writeStoredMapperConfig,
  resetStoredMapperConfig,
  readStoredMapperPresetId,
  writeStoredMapperPresetId,
  MANAGED_STAGE_SUPPORT_MAPPER_EXPORT_SCHEMA,
  MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY,
  MANAGED_STAGE_SUPPORT_MAPPER_PRESET_STORAGE_KEY
} from '../src/managed-stage-support-source-ui-controller.js';
import {
  MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS,
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  buildManagedStageSupportMapperPresetOptions,
  getManagedStageSupportMapperPresetProfile,
  normalizeManagedStageSupportMapperPresetId,
  resolveManagedStageSupportMapperConfig
} from '../src/managed-stage-support-mapper-config.js';

assert.equal(normalizeManagedStageSupportSourceMode('off'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF);
assert.equal(normalizeManagedStageSupportSourceMode('none'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF);
assert.equal(normalizeManagedStageSupportSourceMode('iso_note'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(normalizeManagedStageSupportSourceMode('ISONOTE'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(normalizeManagedStageSupportSourceMode('stagedJson'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
assert.equal(normalizeManagedStageSupportSourceMode('unknown'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);

assert.equal(normalizeManagedStageSupportMapperPresetId('caesar'), MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CAESAR_DEFAULT);
assert.equal(normalizeManagedStageSupportMapperPresetId('staged-json'), MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.STAGED_JSON_GENERIC);
assert.equal(normalizeManagedStageSupportMapperPresetId('iso-note'), MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.ISONOTE_GENERIC);
assert.equal(normalizeManagedStageSupportMapperPresetId('custom'), MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.equal(getManagedStageSupportMapperPresetProfile('isonote').label, 'ISONOTE generic');
assert.deepEqual(buildManagedStageSupportMapperPresetOptions().map((option) => option.value), ['caesar-default', 'stagedjson-generic', 'isonote-generic', 'custom']);

const offFlags = applyManagedStageSupportSourceModeToLegacyFlags('off');
assert.equal(offFlags.supportOverlayEnabled, false);
assert.equal(offFlags.renderActualSupport, false);
assert.equal(offFlags.renderExpectedSupport, false);

const stagedFlags = applyManagedStageSupportSourceModeToLegacyFlags('stagedJson');
assert.equal(stagedFlags.supportOverlayEnabled, true);
assert.equal(stagedFlags.renderActualSupport, true, 'stagedJson must drive actual/staged support records');
assert.equal(stagedFlags.renderExpectedSupport, false, 'stagedJson mode must not also render ISONOTE records');

const isonoteFlags = applyManagedStageSupportSourceModeToLegacyFlags('isonote');
assert.equal(isonoteFlags.supportOverlayEnabled, true);
assert.equal(isonoteFlags.renderActualSupport, false, 'ISONOTE mode must not also render stagedJson support records');
assert.equal(isonoteFlags.renderExpectedSupport, true, 'ISONOTE mode must drive side-loaded support records');

const defaultModel = buildManagedStageSupportSourceUiModel();
assert.equal(defaultModel.schema, 'ManagedStageSupportSourceUi.v1');
assert.deepEqual(defaultModel.sourceOptions.map((option) => option.value), ['off', 'stagedJson', 'isonote']);
assert.equal(defaultModel.mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CAESAR_DEFAULT);
assert.equal(defaultModel.mapperPresetOptions.length, 4);
assert.equal(defaultModel.mapperPresetLabel, 'CAESAR default');
assert.equal(defaultModel.axisBasis.up, '+Y');
assert.equal(defaultModel.axisBasis.down, '-Y');
assert.equal(defaultModel.axisBasis.northSourceAxis, '-X');
assert.equal(defaultModel.axisBasis.northEngineeringDirection, 'NORTH');
assert.deepEqual(defaultModel.mapperColumns, ['fieldPurpose', 'sourceFieldCandidates', 'normalizedOutput', 'graphicsRule', 'axisBasis']);
assert.equal(defaultModel.mapperRows.some((row) => row.fieldPurpose === 'supportTag' && row.normalizedOutput === 'supportTag'), true);
assert.equal(defaultModel.mapperRows.some((row) => row.fieldPurpose === 'supportKind' && row.graphicsRule.includes('REST')), true);
assert.equal(defaultModel.mapperRows.some((row) => row.fieldPurpose === 'graphicsRule' && row.normalizedOutput === 'graphicsRule'), true);
assert.equal(defaultModel.mapperRows.some((row) => row.fieldPurpose === 'gap' && row.sourceFieldCandidates.includes('*GAP*')), true);
assert.equal(defaultModel.axisBasisRows.find((row) => row.sourceAxis === '+Y')?.engineeringDirection, 'UP');
assert.equal(defaultModel.axisBasisRows.find((row) => row.sourceAxis === '-Y')?.engineeringDirection, 'DOWN');
assert.equal(defaultModel.axisBasisRows.find((row) => row.sourceAxis === '-X')?.engineeringDirection, 'NORTH');
assert.equal(defaultModel.mapperExportText.includes(MANAGED_STAGE_SUPPORT_MAPPER_EXPORT_SCHEMA), true);
assert.equal(defaultModel.mapperExportText.includes('caesar-default'), true);

const stagedPresetConfig = resolveManagedStageSupportMapperConfig({ mapperPresetId: MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.STAGED_JSON_GENERIC });
assert.equal(stagedPresetConfig.mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.STAGED_JSON_GENERIC);
assert.equal(stagedPresetConfig.fieldMapper.supportKindFields.includes('SUPPORT_TAG'), true);
assert.equal(stagedPresetConfig.fieldMapper.gapFields.includes('GUIDE_GAP'), true);

const isonotePresetModel = buildManagedStageSupportSourceUiModel({ mapperPresetId: MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.ISONOTE_GENERIC });
assert.equal(isonotePresetModel.mapperPresetLabel, 'ISONOTE generic');
assert.equal(isonotePresetModel.mapperRows.find((row) => row.fieldPurpose === 'supportKind')?.sourceFieldCandidates.includes('RAW_TEXT'), true);
assert.equal(isonotePresetModel.mapperRows.find((row) => row.fieldPurpose === 'axis')?.sourceFieldCandidates.includes('RAW_TEXT'), true);

const explicitRows = buildManagedStageSupportMapperUiRows({
  fieldMapper: {
    supportTagFields: ['PS_NO'],
    supportKindFields: ['SUPPORT_TAG'],
    graphicsRuleFields: ['RULE'],
    gapFields: ['SUPPORT_GAP_MM', '*GAP*']
  }
});
assert.deepEqual(explicitRows.find((row) => row.fieldPurpose === 'supportTag')?.sourceFieldCandidates, ['PS_NO']);
assert.deepEqual(explicitRows.find((row) => row.fieldPurpose === 'supportKind')?.sourceFieldCandidates, ['SUPPORT_TAG']);
assert.deepEqual(explicitRows.find((row) => row.fieldPurpose === 'graphicsRule')?.sourceFieldCandidates, ['RULE']);

const axisRows = buildManagedStageSupportAxisBasisRows(defaultModel.axisBasis.basis);
assert.equal(axisRows.length, 6);
assert.equal(axisRows.find((row) => row.sourceAxis === '-X')?.canvasAxis, '-X');

const customNorth = buildManagedStageSupportSourceUiModel({ sourceMode: 'isonote', northSourceAxis: '+Z' });
assert.equal(customNorth.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(customNorth.axisBasis.northSourceAxis, '+Z');
assert.equal(customNorth.axisBasis.northCanvasAxis, '+Z');
assert.equal(customNorth.axisBasis.northEngineeringDirection, 'NORTH');
assert.equal(customNorth.axisBasisRows.find((row) => row.sourceAxis === '+Z')?.engineeringDirection, 'NORTH');
assert.equal(customNorth.legacyFlags.renderExpectedSupport, true);
assert.equal(customNorth.legacyFlags.renderActualSupport, false);

assert.deepEqual(normalizeManagedStageMapperFieldCandidates('SUPPORT_TAG, PS_NO,, NAME '), ['SUPPORT_TAG', 'PS_NO', 'NAME']);
assert.deepEqual(normalizeManagedStageMapperFieldCandidates([' TAG ', '', 'REF']), ['TAG', 'REF']);

const uiConfig = buildManagedStageSupportMapperConfigFromUiFields({
  supportTag: 'PS_NO, SUPPORT_TAG',
  supportKind: 'SUPPORT_KIND, DTXR',
  graphicsRule: 'SUPPORT_RULE',
  axis: 'CAESAR_AXIS',
  sign: 'PLUS_MINUS',
  gap: 'SUPPORT_GAP_MM, *GAP*',
  coordinate: 'SUPPORTCOORD'
});
assert.equal(uiConfig.mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.deepEqual(uiConfig.fieldMapper.supportTagFields, ['PS_NO', 'SUPPORT_TAG']);
assert.deepEqual(uiConfig.fieldMapper.supportKindFields, ['SUPPORT_KIND', 'DTXR']);
assert.deepEqual(uiConfig.fieldMapper.gapFields, ['SUPPORT_GAP_MM', '*GAP*']);

const customModel = buildManagedStageSupportSourceUiModel({ mapperConfig: uiConfig });
assert.equal(customModel.mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.deepEqual(customModel.mapperRows.find((row) => row.fieldPurpose === 'supportTag')?.sourceFieldCandidates, ['PS_NO', 'SUPPORT_TAG']);
assert.deepEqual(customModel.mapperRows.find((row) => row.fieldPurpose === 'axis')?.sourceFieldCandidates, ['CAESAR_AXIS']);

const serialized = serializeManagedStageSupportMapperConfig(uiConfig);
const parsed = parseManagedStageSupportMapperConfig(serialized);
assert.equal(parsed.mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.deepEqual(parsed.fieldMapper.supportTagFields, ['PS_NO', 'SUPPORT_TAG']);
assert.deepEqual(parsed.fieldMapper.coordinateFields, ['SUPPORTCOORD']);
assert.deepEqual(parseManagedStageSupportMapperConfig('{bad json'), {});

const exportPayload = buildManagedStageSupportMapperExportPayload(uiConfig, { sourceMode: 'isonote', northSourceAxis: '+Z' });
assert.equal(exportPayload.schema, MANAGED_STAGE_SUPPORT_MAPPER_EXPORT_SCHEMA);
assert.equal(exportPayload.sourceMode, 'isonote');
assert.equal(exportPayload.mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.equal(exportPayload.axisBasis.northSourceAxis, '+Z');
assert.deepEqual(exportPayload.mapperConfig.fieldMapper.graphicsRuleFields, ['SUPPORT_RULE']);
const serializedExport = serializeManagedStageSupportMapperExportPayload(uiConfig, { sourceMode: 'isonote', northSourceAxis: '+Z' });
assert.equal(serializedExport.includes('SUPPORT_RULE'), true);
assert.deepEqual(parseManagedStageSupportMapperExportPayload(serializedExport).fieldMapper.axisFields, ['CAESAR_AXIS']);
assert.equal(parseManagedStageSupportMapperExportPayload(serializedExport).mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.deepEqual(parseManagedStageSupportMapperExportPayload(serialized).fieldMapper.supportTagFields, ['PS_NO', 'SUPPORT_TAG']);
assert.deepEqual(parseManagedStageSupportMapperExportPayload('{bad json'), {});

const storage = new Map();
const storageShim = {
  getItem: (key) => storage.get(key) || '',
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
writeStoredMapperConfig(uiConfig, storageShim);
writeStoredMapperPresetId(MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM, storageShim);
assert.equal(storage.has(MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY), true);
assert.equal(storage.get(MANAGED_STAGE_SUPPORT_MAPPER_PRESET_STORAGE_KEY), MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.equal(readStoredMapperPresetId(storageShim), MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.CUSTOM);
assert.deepEqual(readStoredMapperConfig(storageShim).fieldMapper.supportTagFields, ['PS_NO', 'SUPPORT_TAG']);
const resetConfig = resetStoredMapperConfig(storageShim, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.ISONOTE_GENERIC);
assert.equal(storage.has(MANAGED_STAGE_SUPPORT_MAPPER_STORAGE_KEY), true);
assert.equal(resetConfig.mapperPresetId, MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.ISONOTE_GENERIC);
assert.equal(resetConfig.fieldMapper.supportKindFields.includes('RAW_TEXT'), true);

console.log('managed-stage support source UI controller: ok');

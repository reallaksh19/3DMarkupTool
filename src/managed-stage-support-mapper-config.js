import { normalizeManagedStageSupportGapAttributes } from './managed-stage-support-gap-mapper.js';

export const MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA = 'ManagedStageSupportMapperConfig.v1';

export const MANAGED_STAGE_SUPPORT_SOURCE_MODES = Object.freeze({
  OFF: 'off',
  STAGED_JSON: 'stagedJson',
  ISONOTE: 'isonote'
});

export const CAESAR_TO_CANVAS_AXIS_BASIS_PRESET = Object.freeze({
  schema: 'ManagedStageSupportAxisBasis.v1',
  name: 'CAESAR default axis basis',
  description: 'CAESAR-style signed axes mapped to configurable Canvas signed axes; +Y is UP and -X is NORTH by default.',
  axes: Object.freeze({
    '+Y': Object.freeze({ engineeringDirection: 'UP', canvasAxis: '+Y' }),
    '-Y': Object.freeze({ engineeringDirection: 'DOWN', canvasAxis: '-Y' }),
    '-X': Object.freeze({ engineeringDirection: 'NORTH', canvasAxis: '-X' }),
    '+X': Object.freeze({ engineeringDirection: 'SOUTH', canvasAxis: '+X' }),
    '+Z': Object.freeze({ engineeringDirection: 'PROJECT_POSITIVE_Z', canvasAxis: '+Z' }),
    '-Z': Object.freeze({ engineeringDirection: 'PROJECT_NEGATIVE_Z', canvasAxis: '-Z' })
  })
});

const DEFAULT_FIELD_MAPPER = Object.freeze({
  supportTagFields: Object.freeze(['SUPPORT_TAG', 'TAG', 'SUPPORT_NO', 'SUPPORT_ID', 'NAME', 'REF']),
  supportKindFields: Object.freeze(['SUPPORT_KIND', 'SUPPORT_TYPE', 'RESTRAINT_KIND', 'RESTRAINT', 'DTXR', 'RAW_TYPE', 'TYPE', 'NAME']),
  graphicsRuleFields: Object.freeze(['SUPPORT_GRAPHICS_RULE', 'SUPPORT_RULE', 'GRAPHICS_RULE', 'SUPPORT_KIND', 'SUPPORT_TAG', 'DTXR', 'NAME']),
  axisFields: Object.freeze(['SUPPORT_AXIS', 'RESTRAINT_AXIS', 'AXIS', 'DIRECTION', 'CAESAR_AXIS', 'DIRECTION_AXIS']),
  signFields: Object.freeze(['SUPPORT_SIGN', 'RESTRAINT_SIGN', 'SIGN', 'DIRECTION_SIGN', 'PLUS_MINUS']),
  gapFields: Object.freeze(['SUPPORT_GAP_MM', 'SUPPORT_GAP', 'GAP_MM', 'GAP', '*GAP*']),
  coordinateFields: Object.freeze(['SUPPORTCOORD', 'SUPPORT_COORD', 'POS', 'COORD', 'LOCATION'])
});

const DEFAULT_GRAPHICS_RULES = Object.freeze([
  Object.freeze({ match: Object.freeze(['SPRING CAN', 'CAN SPRING', 'SPRING_CAN']), family: 'SPRING_CAN', graphicsRule: 'warning-coil-below-pipe' }),
  Object.freeze({ match: Object.freeze(['HOLDDOWN', 'HOLD DOWN', '+/-Y']), family: 'HOLDDOWN', graphicsRule: 'double-vertical-y-arrows' }),
  Object.freeze({ match: Object.freeze(['LINE STOP', 'LINESTOP', 'LIMIT', 'LIM']), family: 'LINE_STOP', graphicsRule: 'axial-pair-or-explicit-sign' }),
  Object.freeze({ match: Object.freeze(['GUIDE']), family: 'GUIDE', graphicsRule: 'lateral-by-pipe-orientation' }),
  Object.freeze({ match: Object.freeze(['REST']), family: 'REST', graphicsRule: 'positive-y-upward-arrow' })
]);

export const DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG = Object.freeze({
  schema: MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA,
  sourceModes: Object.freeze([MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF, MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE]),
  defaultSourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
  fieldMapper: DEFAULT_FIELD_MAPPER,
  axisBasis: CAESAR_TO_CANVAS_AXIS_BASIS_PRESET,
  graphicsRules: DEFAULT_GRAPHICS_RULES,
  uiColumns: Object.freeze(['fieldPurpose', 'sourceFieldCandidates', 'normalizedOutput', 'axisBasis', 'graphicsRule'])
});

export function resolveManagedStageSupportMapperConfig(config = {}) {
  const fieldMapper = { ...DEFAULT_FIELD_MAPPER, ...(config.fieldMapper || {}) };
  const axisBasis = mergeAxisBasis(CAESAR_TO_CANVAS_AXIS_BASIS_PRESET, config.axisBasis || {});
  const graphicsRules = Array.isArray(config.graphicsRules) && config.graphicsRules.length ? config.graphicsRules : DEFAULT_GRAPHICS_RULES;
  const sourceMode = normalizeSourceMode(config.sourceMode || config.defaultSourceMode || DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.defaultSourceMode);
  return {
    schema: MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA,
    sourceMode,
    sourceModes: [...DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.sourceModes],
    fieldMapper,
    axisBasis,
    graphicsRules
  };
}

export function normalizeManagedStageSupportMapperRecord(record, config = {}) {
  const resolvedConfig = resolveManagedStageSupportMapperConfig(config);
  const rawAttrs = record?.attrs || record?.attributes || {};
  const attrs = normalizeManagedStageSupportGapAttributes(rawAttrs);
  const tagMatch = pickMappedValue(attrs, resolvedConfig.fieldMapper.supportTagFields);
  const kindMatch = pickMappedValue(attrs, resolvedConfig.fieldMapper.supportKindFields);
  const ruleMatch = matchManagedStageSupportGraphicsRule(attrs, resolvedConfig);
  const axisMatch = pickMappedValue(attrs, resolvedConfig.fieldMapper.axisFields);
  const signMatch = pickMappedValue(attrs, resolvedConfig.fieldMapper.signFields);
  const signedSourceAxis = normalizeSignedAxis(axisMatch.value, signMatch.value);
  const canvasAxis = mapManagedStageSupportAxisToCanvas(signedSourceAxis || axisMatch.value, resolvedConfig.axisBasis);
  const normalizedAttrs = {
    ...attrs,
    SUPPORT_MAPPER_SCHEMA: MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA,
    SUPPORT_SOURCE_MODE: resolvedConfig.sourceMode,
    SUPPORT_TAG_MAPPED: tagMatch.value || '',
    SUPPORT_TAG_SOURCE_FIELD: tagMatch.key || '',
    SUPPORT_KIND_MAPPED: ruleMatch.family || normalizeSupportFamily(kindMatch.value) || '',
    SUPPORT_KIND_SOURCE_FIELD: kindMatch.key || '',
    SUPPORT_GRAPHICS_RULE_MAPPED: ruleMatch.graphicsRule || '',
    SUPPORT_GRAPHICS_RULE_SOURCE_FIELD: ruleMatch.sourceField || '',
    SUPPORT_AXIS_SOURCE: signedSourceAxis || String(axisMatch.value || '').trim(),
    SUPPORT_AXIS_SOURCE_FIELD: axisMatch.key || '',
    SUPPORT_AXIS_CANVAS: canvasAxis.canvasAxis || '',
    SUPPORT_AXIS_ENGINEERING: canvasAxis.engineeringDirection || '',
    SUPPORT_AXIS_CANVAS_VECTOR: canvasAxis.canvasVectorText || '',
    SUPPORT_SIGN_MAPPED: signMatch.value || canvasAxis.sign || '',
    SUPPORT_SIGN_SOURCE_FIELD: signMatch.key || '',
    SUPPORT_FIELD_MAPPER_CONFIGURED: 'TRUE',
    SUPPORT_AXIS_BASIS_CONFIGURED: 'TRUE',
    SUPPORT_GRAPHICS_RULE_CONFIGURED: 'TRUE'
  };

  return {
    schema: MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA,
    sourceMode: resolvedConfig.sourceMode,
    supportTag: normalizedAttrs.SUPPORT_TAG_MAPPED,
    rawKind: kindMatch.value || '',
    family: normalizedAttrs.SUPPORT_KIND_MAPPED || 'UNKNOWN',
    graphicsRule: normalizedAttrs.SUPPORT_GRAPHICS_RULE_MAPPED,
    axis: {
      sourceAxis: normalizedAttrs.SUPPORT_AXIS_SOURCE,
      canvasAxis: normalizedAttrs.SUPPORT_AXIS_CANVAS,
      engineeringDirection: normalizedAttrs.SUPPORT_AXIS_ENGINEERING,
      canvasVector: canvasAxis.canvasVector
    },
    gap: {
      value: normalizedAttrs.SUPPORT_GAP_MM || normalizedAttrs.GAP_MM || normalizedAttrs.GAP || '',
      sourceField: normalizedAttrs.SUPPORT_GAP_SOURCE_FIELD || '',
      recordScoped: normalizedAttrs.SUPPORT_GAP_RECORD_SCOPED === 'TRUE',
      carryForward: normalizedAttrs.SUPPORT_GAP_CARRY_FORWARD === 'TRUE'
    },
    attrs: normalizedAttrs,
    config: resolvedConfig
  };
}

export function matchManagedStageSupportGraphicsRule(attrs = {}, config = {}) {
  const resolvedConfig = config.schema === MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA ? config : resolveManagedStageSupportMapperConfig(config);
  const graphicsFields = resolvedConfig.fieldMapper.graphicsRuleFields || DEFAULT_FIELD_MAPPER.graphicsRuleFields;
  const candidates = collectFieldTexts(attrs, graphicsFields);
  const combined = normalizeText(candidates.map((entry) => entry.value).join(' '));
  for (const rule of resolvedConfig.graphicsRules || DEFAULT_GRAPHICS_RULES) {
    for (const pattern of rule.match || []) {
      if (combined.includes(normalizeText(pattern))) {
        const source = candidates.find((entry) => normalizeText(entry.value).includes(normalizeText(pattern))) || candidates[0] || {};
        return { family: rule.family, graphicsRule: rule.graphicsRule, pattern, sourceField: source.key || '' };
      }
    }
  }
  const kind = normalizeSupportFamily(combined);
  return { family: kind || 'UNKNOWN', graphicsRule: kind ? `default-${kind.toLowerCase()}` : '', pattern: '', sourceField: candidates[0]?.key || '' };
}

export function mapManagedStageSupportAxisToCanvas(axisToken, axisBasis = CAESAR_TO_CANVAS_AXIS_BASIS_PRESET) {
  const sourceAxis = normalizeSignedAxis(axisToken);
  if (!sourceAxis) return { sourceAxis: '', canvasAxis: '', engineeringDirection: '', sign: '', axis: '', canvasVector: { x: 0, y: 0, z: 0 }, canvasVectorText: '0,0,0' };
  const basis = mergeAxisBasis(CAESAR_TO_CANVAS_AXIS_BASIS_PRESET, axisBasis || {});
  const entry = basis.axes[sourceAxis] || basis.axes[sourceAxis.replace('+', '')] || {};
  const canvasAxis = normalizeSignedAxis(entry.canvasAxis || sourceAxis) || sourceAxis;
  const vector = axisTokenToVector(canvasAxis);
  const sign = canvasAxis.startsWith('-') ? '-' : '+';
  const axis = canvasAxis.replace(/[+-]/g, '');
  return {
    sourceAxis,
    canvasAxis,
    engineeringDirection: entry.engineeringDirection || '',
    sign,
    axis,
    canvasVector: vector,
    canvasVectorText: `${vector.x},${vector.y},${vector.z}`
  };
}

function mergeAxisBasis(base, override) {
  const axes = { ...(base.axes || {}) };
  for (const [key, value] of Object.entries(override.axes || {})) {
    const normalizedKey = normalizeSignedAxis(key);
    if (!normalizedKey) continue;
    axes[normalizedKey] = { ...(axes[normalizedKey] || {}), ...(value || {}) };
  }
  return {
    schema: override.schema || base.schema,
    name: override.name || base.name,
    description: override.description || base.description,
    axes
  };
}

function pickMappedValue(attrs, fields = []) {
  for (const field of fields || []) {
    const token = String(field || '').trim();
    if (!token) continue;
    if (token.includes('*')) {
      const needle = normalizeKey(token).replace(/\*/g, '');
      const key = Object.keys(attrs || {}).find((candidate) => normalizeKey(candidate).includes(needle) && hasMeaningfulValue(attrs[candidate]));
      if (key) return { key, value: String(attrs[key]).trim(), match: 'wildcard' };
      continue;
    }
    if (hasMeaningfulValue(attrs?.[token])) return { key: token, value: String(attrs[token]).trim(), match: 'exact' };
  }
  return { key: '', value: '', match: '' };
}

function collectFieldTexts(attrs, fields) {
  const entries = [];
  for (const field of fields || []) {
    const match = pickMappedValue(attrs, [field]);
    if (match.value) entries.push(match);
  }
  return entries;
}

function normalizeSourceMode(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'off' || text === 'none') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF;
  if (text === 'isonote' || text === 'iso_note') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE;
  return MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON;
}

function normalizeSupportFamily(value) {
  const raw = normalizeText(value).replace(/[\s\-]+/g, '_');
  if (!raw) return '';
  if (/(CAN.*SPRING|SPRING.*CAN|SPRING_CAN)/.test(raw)) return 'SPRING_CAN';
  if (raw.includes('HOLDDOWN') || (raw.includes('HOLD') && raw.includes('DOWN'))) return 'HOLDDOWN';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LINE_STOP') || raw.includes('LINESTOP') || raw.includes('LIMIT') || /(^|_)LIM($|_)/.test(raw)) return 'LINE_STOP';
  if (raw.includes('REST')) return 'REST';
  return '';
}

function normalizeSignedAxis(axisToken, signToken = '') {
  const axisText = String(axisToken || '').toUpperCase().trim();
  const signText = String(signToken || '').toUpperCase().trim();
  const axisMatch = axisText.match(/([+-]?)(X|Y|Z)/);
  if (!axisMatch) return '';
  let sign = axisMatch[1] || '';
  if (!sign && signText) {
    if (/^-|MINUS|NEG/.test(signText)) sign = '-';
    if (/^\+|PLUS|POS/.test(signText)) sign = '+';
  }
  return `${sign || '+'}${axisMatch[2]}`;
}

function axisTokenToVector(axisToken) {
  const axis = normalizeSignedAxis(axisToken) || '+X';
  const sign = axis.startsWith('-') ? -1 : 1;
  const dim = axis.replace(/[+-]/g, '');
  if (dim === 'Y') return { x: 0, y: sign, z: 0 };
  if (dim === 'Z') return { x: 0, y: 0, z: sign };
  return { x: sign, y: 0, z: 0 };
}

function normalizeKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_');
}

function normalizeText(value) {
  return normalizeKey(value).replace(/_/g, ' ');
}

function hasMeaningfulValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

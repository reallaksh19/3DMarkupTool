export const SUPPORT_RESTRAINT_TYPE_MAPPER_SCHEMA = 'SupportRestraintTypeMapper.v1';
export const SUPPORT_RESTRAINT_TYPE_STORAGE_KEY = 'managedStage.supportRestraintTypeRules.v1';

export const DEFAULT_SUPPORT_RESTRAINT_TYPE_RULES = Object.freeze([
  Object.freeze({ restraintType: '17', family: 'REST', sourceAxis: '+Y', canvasAxis: '+Y', actionAxis: '+Y', graphicsRule: 'positive-y-upward-arrow', enabled: true }),
  Object.freeze({ restraintType: '18', family: 'GUIDE', sourceAxis: '+X', canvasAxis: '+X', actionAxis: '+X', graphicsRule: 'lateral-by-pipe-orientation', enabled: true }),
  Object.freeze({ restraintType: '19', family: 'LINE_STOP', sourceAxis: '+Z', canvasAxis: '+Z', actionAxis: '+Z', graphicsRule: 'axial-pair-or-explicit-sign', enabled: true }),
  Object.freeze({ restraintType: '20', family: 'HOLDDOWN', sourceAxis: '-Y', canvasAxis: '-Y', actionAxis: '-Y', graphicsRule: 'double-vertical-y-arrows', enabled: true }),
  Object.freeze({ restraintType: '21', family: 'SPRING_CAN', sourceAxis: '+Y', canvasAxis: '+Y', actionAxis: '+Y', graphicsRule: 'warning-coil-below-pipe', enabled: true })
]);

const RESTRAINT_TYPE_FIELDS = Object.freeze([
  'RESTRAINT_TYPE', 'RESTRAINTTYPE', 'RESTRAINT_TYPE_NO', 'RESTRAINTTYPE_NO', 'RESTRAINT_CODE', 'RESTRAINTCODE', 'TYPE_CODE', 'TYPECODE', 'SUPPORT_RESTRAINT_TYPE'
]);

export function loadSupportRestraintTypeRules(config = {}) {
  const configured = Array.isArray(config.restraintTypeRules) ? config.restraintTypeRules : null;
  if (configured?.length) return normalizeRules(configured);
  const stored = readStoredRules();
  if (stored.length) return normalizeRules(stored);
  return DEFAULT_SUPPORT_RESTRAINT_TYPE_RULES.map((rule) => ({ ...rule }));
}

export function saveSupportRestraintTypeRules(rules = []) {
  const normalized = normalizeRules(rules);
  try { globalThis.localStorage?.setItem(SUPPORT_RESTRAINT_TYPE_STORAGE_KEY, JSON.stringify(normalized, null, 2)); } catch (_) {}
  return normalized;
}

export function getSupportRestraintTypeCode(attrs = {}) {
  for (const key of RESTRAINT_TYPE_FIELDS) {
    const value = attrs?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return normalizeCode(value);
  }
  return '';
}

export function applySupportRestraintTypeToAttributes(attrs = {}, config = {}) {
  const code = getSupportRestraintTypeCode(attrs);
  if (!code) return { attrs, matched: false, rule: null, code: '' };
  const rule = findSupportRestraintTypeRule(code, config);
  if (!rule) return { attrs, matched: false, rule: null, code };
  return {
    attrs: {
      ...attrs,
      SUPPORT_RESTRAINT_TYPE_CODE: code,
      SUPPORT_RESTRAINT_TYPE_MAPPER_SCHEMA: SUPPORT_RESTRAINT_TYPE_MAPPER_SCHEMA,
      SUPPORT_RESTRAINT_TYPE_FAMILY: rule.family,
      SUPPORT_RESTRAINT_TYPE_SOURCE_AXIS: rule.sourceAxis,
      SUPPORT_RESTRAINT_TYPE_CANVAS_AXIS: rule.canvasAxis,
      SUPPORT_RESTRAINT_TYPE_ACTION_AXIS: rule.actionAxis,
      SUPPORT_RESTRAINT_TYPE_GRAPHICS_RULE: rule.graphicsRule,
      SUPPORT_KIND: rule.family,
      SUPPORT_TYPE: rule.family,
      SUPPORT_MAPPER_KIND: rule.family,
      SUPPORT_AXIS: rule.sourceAxis,
      SUPPORT_SIGN: rule.sourceAxis?.startsWith('-') ? '-' : '+',
      SUPPORT_GRAPHICS_RULE: rule.graphicsRule
    },
    matched: true,
    rule,
    code
  };
}

export function applySupportRestraintTypeToMapperRecord(mapperRecord = {}, attrs = {}, config = {}) {
  const code = getSupportRestraintTypeCode(attrs || mapperRecord.attrs || {});
  if (!code) return mapperRecord;
  const rule = findSupportRestraintTypeRule(code, config);
  if (!rule) return mapperRecord;
  const nextAttrs = {
    ...(mapperRecord.attrs || {}),
    SUPPORT_RESTRAINT_TYPE_CODE: code,
    SUPPORT_RESTRAINT_TYPE_MAPPER_SCHEMA: SUPPORT_RESTRAINT_TYPE_MAPPER_SCHEMA,
    SUPPORT_RESTRAINT_TYPE_FAMILY: rule.family,
    SUPPORT_RESTRAINT_TYPE_SOURCE_AXIS: rule.sourceAxis,
    SUPPORT_RESTRAINT_TYPE_CANVAS_AXIS: rule.canvasAxis,
    SUPPORT_RESTRAINT_TYPE_ACTION_AXIS: rule.actionAxis,
    SUPPORT_RESTRAINT_TYPE_GRAPHICS_RULE: rule.graphicsRule,
    SUPPORT_KIND_MAPPED: rule.family,
    SUPPORT_GRAPHICS_RULE_MAPPED: rule.graphicsRule,
    SUPPORT_AXIS_SOURCE: rule.sourceAxis,
    SUPPORT_AXIS_CANVAS: rule.canvasAxis,
    SUPPORT_SIGN_MAPPED: rule.canvasAxis?.startsWith('-') ? '-' : '+',
    SUPPORT_RESTRAINT_TYPE_APPLIED: 'TRUE'
  };
  return {
    ...mapperRecord,
    family: rule.family,
    graphicsRule: rule.graphicsRule,
    rawKind: String(attrs.SUPPORT_KIND || mapperRecord.rawKind || ''),
    axis: {
      ...(mapperRecord.axis || {}),
      sourceAxis: rule.sourceAxis,
      canvasAxis: rule.canvasAxis,
      engineeringDirection: rule.engineeringDirection || mapperRecord.axis?.engineeringDirection || '',
      canvasVector: axisTokenToVector(rule.canvasAxis)
    },
    attrs: nextAttrs,
    restraintTypeRule: { ...rule, code }
  };
}

export function findSupportRestraintTypeRule(code, config = {}) {
  const normalized = normalizeCode(code);
  return loadSupportRestraintTypeRules(config).find((rule) => rule.enabled !== false && normalizeCode(rule.restraintType) === normalized) || null;
}

function readStoredRules() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(SUPPORT_RESTRAINT_TYPE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeRules(rules = []) {
  return rules.map((rule) => ({
    restraintType: normalizeCode(rule.restraintType ?? rule.code ?? rule.type ?? ''),
    family: normalizeFamily(rule.family || rule.supportFamily || 'UNKNOWN'),
    sourceAxis: normalizeAxis(rule.sourceAxis || rule.axis || '+Y'),
    canvasAxis: normalizeAxis(rule.canvasAxis || rule.sourceAxis || rule.axis || '+Y'),
    actionAxis: normalizeAxis(rule.actionAxis || rule.canvasAxis || rule.sourceAxis || rule.axis || '+Y'),
    graphicsRule: String(rule.graphicsRule || '').trim(),
    enabled: rule.enabled !== false
  })).filter((rule) => rule.restraintType);
}

function normalizeCode(value) {
  const match = String(value ?? '').match(/[-+]?\d+/);
  return match ? String(Number(match[0])) : String(value ?? '').trim().toUpperCase();
}

function normalizeFamily(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_') || 'UNKNOWN';
}

function normalizeAxis(value) {
  const match = String(value || '').toUpperCase().match(/([+-]?)(X|Y|Z)/);
  if (!match) return '';
  return `${match[1] || '+'}${match[2]}`;
}

function axisTokenToVector(axisToken) {
  const axis = normalizeAxis(axisToken) || '+X';
  const sign = axis.startsWith('-') ? -1 : 1;
  const dim = axis.replace(/[+-]/g, '');
  if (dim === 'Y') return { x: 0, y: sign, z: 0 };
  if (dim === 'Z') return { x: 0, y: 0, z: sign };
  return { x: sign, y: 0, z: 0 };
}

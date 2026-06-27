import { normalizeManagedStageSupportGapAttributes } from './managed-stage-support-gap-mapper.js?v=bust-cache-4';

export const MANAGED_STAGE_PROFILE_SCHEMA = 'inputxml-managed-stage/v1';
export const MANAGED_STAGE_RVM_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';

const SUPPORT_RECORD_TYPES = new Set(['ATTA', 'ANCI', 'SUPP', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT']);
const SUPPORT_RESTRAINT_FAMILIES = new Set([
  'REST', 'RESTRAINT', 'GUIDE', 'GUID', 'HOLD_DOWN', 'HOLDDOWN', 'HOLD',
  'LINE_STOP', 'LINESTOP', 'LIMIT_STOP', 'LIMIT', 'LIM', 'ANCHOR', 'ANC',
  'SPRING_CAN', 'SPRINGCAN', 'CAN', 'SPRING'
]);
const CONTAINER_RECORD_TYPES = new Set(['BRAN', 'BRANCH', 'GROUP', 'ROOT', 'DISCIPLINE', 'ZONE', 'SITE']);
const SUPPORT_COORDINATE_FIELDS = Object.freeze(['SUPPORTCOORD', 'SUPPORT_COORD', 'SCOORD', 'SUPPORT_POINT', 'SUPPORT_POS', 'POS', 'BPOS']);

export function parseManagedStageProfile(sourceText) {
  const json = parseJson(sourceText);
  if (json.schema !== MANAGED_STAGE_PROFILE_SCHEMA) {
    throw new Error(`Unsupported managed-stage schema: ${json.schema || 'UNKNOWN'}`);
  }
  if (json.profile !== MANAGED_STAGE_RVM_PROFILE) {
    throw new Error(`Unsupported managed-stage profile: ${json.profile || 'UNKNOWN'}`);
  }
  if (json.units?.length !== 'mm') {
    throw new Error('Managed-stage RVM export requires units.length = mm');
  }

  const branches = Array.isArray(json.hierarchy) ? json.hierarchy : [];
  const records = [];
  for (const branch of branches) {
    const branchName = branch.name || '';
    const branchType = branch.type || '';
    for (const child of branch.children || []) {
      collectManagedStageRecord(child, { branchName, branchType, parentPath: branchName }, records);
    }
  }

  const supportRecords = records.filter(isSupportRecord);
  const geometryRecords = records.filter((record) => !isSupportRecord(record));
  return {
    schema: json.schema,
    profile: json.profile,
    source: json.source || 'UNKNOWN',
    converter: json.converter || '',
    generatedAt: json.generatedAt || '',
    units: 'mm',
    inputStats: json.stats || {},
    branches,
    records,
    geometryRecords,
    supportRecords,
    recordDiscovery: {
      schema: 'ManagedStageRecordDiscovery.v3',
      traversal: 'recursive-branch-children',
      supportRecordTypes: [...SUPPORT_RECORD_TYPES],
      supportRestraintFamilies: [...SUPPORT_RESTRAINT_FAMILIES],
      supportCoordinateFields: [...SUPPORT_COORDINATE_FIELDS],
      containerRecordTypesSkipped: [...CONTAINER_RECORD_TYPES],
      recordCount: records.length,
      geometryRecordCount: geometryRecords.length,
      supportRecordCount: supportRecords.length,
      supportGapMapperSchema: 'ManagedStageSupportGapMapper.v1',
      supportGapRecordScoped: true,
      supportGapCarryForward: false,
      supportCoordinateNormalization: 'object/array/numeric-string/directional E-N-U strings normalized to {x,y,z}'
    }
  };
}

function collectManagedStageRecord(node, context, records) {
  if (!node || typeof node !== 'object') return;
  const rawAttributes = node.attributes || {};
  const rawName = node.name || rawAttributes.NAME || 'UNNAMED';
  const name = rawAttributes.NAME || node.name || 'UNNAMED';
  const type = node.type || rawAttributes.TYPE || 'UNKNOWN';
  const attributes = isSupportLikeTokens(type, rawAttributes)
    ? normalizeSupportAttributes(rawAttributes)
    : rawAttributes;
  const path = context.parentPath ? `${context.parentPath}/${rawName}` : rawName;

  if (!CONTAINER_RECORD_TYPES.has(normalizeToken(type))) {
    records.push({
      branchName: context.branchName || '',
      branchType: context.branchType || '',
      path,
      rawName,
      name,
      type,
      attributes
    });
  }

  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectManagedStageRecord(child, { ...context, parentPath: path }, records);
  }
}

function normalizeSupportAttributes(attributes = {}) {
  const normalized = normalizeManagedStageSupportGapAttributes(attributes);
  return normalizeSupportCoordinateAttributes(normalized);
}

function normalizeSupportCoordinateAttributes(attributes = {}) {
  const normalized = { ...attributes };
  for (const field of SUPPORT_COORDINATE_FIELDS) {
    const value = findCaseInsensitive(attributes, field);
    const point = pointFrom(value);
    if (!point) continue;
    normalized[field] = point;
    if (field !== 'SUPPORTCOORD' && !pointFrom(normalized.SUPPORTCOORD)) normalized.SUPPORTCOORD = point;
    normalized.SUPPORT_COORDINATE_SOURCE_FIELD = field;
    normalized.SUPPORT_COORDINATE_NORMALIZED = 'TRUE';
    break;
  }
  return normalized;
}

function findCaseInsensitive(object = {}, key) {
  if (!object || typeof object !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(object, key)) return object[key];
  const lower = String(key).toLowerCase();
  const found = Object.keys(object).find((candidate) => String(candidate).toLowerCase() === lower);
  return found ? object[found] : undefined;
}

function pointFrom(value) {
  if (!value && value !== 0) return null;
  if (Array.isArray(value) && value.length >= 3) return pointFromArray(value);
  if (typeof value === 'object') return pointFromObject(value);
  const directional = parseDirectional(value);
  if (directional) return directional;
  const nums = String(value || '').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number).filter(Number.isFinite) || [];
  return nums.length >= 3 ? { x: nums[0], y: nums[1], z: nums[2] } : null;
}

function pointFromArray(value) {
  const x = asNumber(value[0]);
  const y = asNumber(value[1]);
  const z = asNumber(value[2]);
  return x == null || y == null || z == null ? null : { x, y, z };
}

function pointFromObject(value) {
  const x = asNumber(value.x ?? value.X ?? value.e ?? value.E);
  const y = asNumber(value.y ?? value.Y ?? value.n ?? value.N);
  const z = asNumber(value.z ?? value.Z ?? value.u ?? value.U);
  return x == null || y == null || z == null ? null : { x, y, z };
}

function parseDirectional(text) {
  const src = String(text || '').trim();
  if (!src) return null;
  const tokens = src.split(/\s+/g);
  const out = { x: 0, y: 0, z: 0 };
  let parsed = false;
  for (let i = 0; i < tokens.length - 1; i += 2) {
    const axis = String(tokens[i] || '').toUpperCase();
    const value = asNumber(tokens[i + 1]);
    if (value == null) continue;
    if (axis === 'E') { out.x = value; parsed = true; }
    else if (axis === 'W') { out.x = -value; parsed = true; }
    else if (axis === 'N') { out.y = value; parsed = true; }
    else if (axis === 'S') { out.y = -value; parsed = true; }
    else if (axis === 'U') { out.z = value; parsed = true; }
    else if (axis === 'D') { out.z = -value; parsed = true; }
  }
  return parsed ? out : null;
}

function asNumber(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/mm\b/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function isSupportRecord(record) {
  return isSupportLikeTokens(record?.type, record?.attributes || {});
}

function isSupportLikeTokens(type, attributes = {}) {
  const candidates = [
    type,
    attributes.TYPE,
    attributes.RAW_TYPE,
    attributes.DTXR,
    attributes.SUPPORT_KIND,
    attributes.SUPPORT_TYPE,
    attributes.RESTRAINT_KIND,
    attributes.RESTRAINT,
    attributes.SUPPORT_GRAPHICS_RULE,
    attributes.GRAPHICS_RULE,
    attributes.NAME
  ];
  return candidates.some((value) => isSupportToken(value));
}

function isSupportToken(value) {
  const token = normalizeToken(value);
  if (!token) return false;
  if (SUPPORT_RECORD_TYPES.has(token) || SUPPORT_RESTRAINT_FAMILIES.has(token)) return true;
  return token.includes('SUPPORT') || token.includes('RESTRAINT') || token.includes('GUIDE') || token.includes('LINE_STOP') || token.includes('HOLDDOWN') || token.includes('HOLD_DOWN') || token.includes('SPRING_CAN');
}

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-\/]+/g, '_');
}

function parseJson(sourceText) {
  if (typeof sourceText === 'string') return JSON.parse(sourceText);
  if (sourceText && typeof sourceText === 'object') return sourceText;
  throw new Error('Managed-stage profile parser expects JSON text or object');
}

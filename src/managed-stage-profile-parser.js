import { normalizeManagedStageSupportGapAttributes } from './managed-stage-support-gap-mapper.js';

export const MANAGED_STAGE_PROFILE_SCHEMA = 'inputxml-managed-stage/v1';
export const MANAGED_STAGE_RVM_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';

const SUPPORT_RECORD_TYPES = new Set(['ATTA', 'ANCI', 'SUPP', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT']);
const CONTAINER_RECORD_TYPES = new Set(['BRAN', 'BRANCH', 'GROUP', 'ROOT', 'DISCIPLINE', 'ZONE', 'SITE']);

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
      schema: 'ManagedStageRecordDiscovery.v2',
      traversal: 'recursive-branch-children',
      supportRecordTypes: [...SUPPORT_RECORD_TYPES],
      containerRecordTypesSkipped: [...CONTAINER_RECORD_TYPES],
      recordCount: records.length,
      geometryRecordCount: geometryRecords.length,
      supportRecordCount: supportRecords.length,
      supportGapMapperSchema: 'ManagedStageSupportGapMapper.v1',
      supportGapRecordScoped: true,
      supportGapCarryForward: false
    }
  };
}

function collectManagedStageRecord(node, context, records) {
  if (!node || typeof node !== 'object') return;
  const rawAttributes = node.attributes || {};
  const rawName = node.name || rawAttributes.NAME || 'UNNAMED';
  const name = rawAttributes.NAME || node.name || 'UNNAMED';
  const type = node.type || rawAttributes.TYPE || 'UNKNOWN';
  const attributes = SUPPORT_RECORD_TYPES.has(normalizeToken(type))
    || SUPPORT_RECORD_TYPES.has(normalizeToken(rawAttributes.RAW_TYPE))
    || SUPPORT_RECORD_TYPES.has(normalizeToken(rawAttributes.DTXR))
    ? normalizeManagedStageSupportGapAttributes(rawAttributes)
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

function isSupportRecord(record) {
  const attributes = record?.attributes || {};
  const type = normalizeToken(record?.type);
  const rawType = normalizeToken(attributes.RAW_TYPE);
  const dtxr = normalizeToken(attributes.DTXR);
  return SUPPORT_RECORD_TYPES.has(type) || SUPPORT_RECORD_TYPES.has(rawType) || SUPPORT_RECORD_TYPES.has(dtxr);
}

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, '_');
}

function parseJson(sourceText) {
  if (typeof sourceText === 'string') return JSON.parse(sourceText);
  if (sourceText && typeof sourceText === 'object') return sourceText;
  throw new Error('Managed-stage profile parser expects JSON text or object');
}

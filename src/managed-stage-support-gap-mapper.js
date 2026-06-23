export const MANAGED_STAGE_SUPPORT_GAP_MAPPER_SCHEMA = 'ManagedStageSupportGapMapper.v1';

const EXACT_GAP_FIELD_PRIORITY = Object.freeze([
  'SUPPORT_GAP_MM',
  'SUPPORT_GAP',
  'SUPPORTGAP',
  'GAP_MM',
  'GAPMM',
  'GAP',
  'GUIDE_GAP',
  'GUIDE_GAP_MM',
  'LINESTOP_GAP',
  'LINE_STOP_GAP',
  'LIMIT_GAP',
  'RESTRAINT_GAP'
]);

export const MANAGED_STAGE_SUPPORT_GAP_MAPPER_POLICY = Object.freeze({
  schema: MANAGED_STAGE_SUPPORT_GAP_MAPPER_SCHEMA,
  rules: [
    'support gap is read from the current stagedJson/jscon record only',
    'SUPPORT_GAP_MM has highest precedence for support records',
    'if no exact gap field exists, the first current-record attribute whose normalized key contains GAP is used',
    'gap values are normalized to canonical GAP/GAP_MM/SUPPORT_GAP_MM fields for downstream visual and RVM export resolvers',
    'no previous record, sibling record, branch attribute, or global value is carried forward'
  ],
  carryForward: false,
  exactGapFieldPriority: [...EXACT_GAP_FIELD_PRIORITY]
});

export function normalizeManagedStageSupportGapAttributes(attributes = {}) {
  const source = attributes && typeof attributes === 'object' ? attributes : {};
  const normalized = { ...source };
  const match = findRecordGapField(source);
  if (!match) {
    normalized.SUPPORT_GAP_RECORD_SCOPED = 'TRUE';
    normalized.SUPPORT_GAP_CARRY_FORWARD = 'FALSE';
    normalized.SUPPORT_GAP_SOURCE_FIELD = '';
    return normalized;
  }

  const gapText = String(match.value).trim();
  normalized.GAP = firstText(normalized.GAP, gapText);
  normalized.GAP_MM = firstText(normalized.GAP_MM, gapText);
  normalized.SUPPORT_GAP_MM = firstText(normalized.SUPPORT_GAP_MM, gapText);
  normalized.SUPPORT_GAP_SOURCE_FIELD = match.key;
  normalized.SUPPORT_GAP_RECORD_SCOPED = 'TRUE';
  normalized.SUPPORT_GAP_CARRY_FORWARD = 'FALSE';
  normalized.SUPPORT_GAP_MAPPER_SCHEMA = MANAGED_STAGE_SUPPORT_GAP_MAPPER_SCHEMA;
  return normalized;
}

export function findRecordGapField(attributes = {}) {
  const source = attributes && typeof attributes === 'object' ? attributes : {};
  for (const key of EXACT_GAP_FIELD_PRIORITY) {
    if (hasMeaningfulValue(source[key])) return { key, value: source[key], match: 'exact' };
  }

  const wildcard = Object.keys(source)
    .filter((key) => normalizeKey(key).includes('GAP'))
    .sort((a, b) => gapKeyRank(a) - gapKeyRank(b) || a.localeCompare(b))
    .find((key) => hasMeaningfulValue(source[key]));

  return wildcard ? { key: wildcard, value: source[wildcard], match: 'wildcard' } : null;
}

function gapKeyRank(key) {
  const normalized = normalizeKey(key);
  if (normalized === 'SUPPORT_GAP_MM') return 0;
  if (normalized.startsWith('SUPPORT_')) return 1;
  if (normalized.includes('GUIDE')) return 2;
  if (normalized.includes('LINESTOP') || normalized.includes('LINE_STOP') || normalized.includes('LIMIT')) return 3;
  if (normalized === 'GAP' || normalized === 'GAP_MM' || normalized === 'GAPMM') return 4;
  return 9;
}

function normalizeKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_');
}

function hasMeaningfulValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function firstText(...values) {
  for (const value of values) {
    if (hasMeaningfulValue(value)) return String(value).trim();
  }
  return '';
}

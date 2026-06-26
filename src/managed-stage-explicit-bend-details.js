export const MANAGED_STAGE_EXPLICIT_BEND_SCHEMA = 'ManagedStageExplicitBendDetails.v1';

const BEND_DTXR = new Set(['BEND', 'ELBO', 'ELBOW']);

export function isExplicitManagedStageBendRecord(record) {
  const attrs = record?.attributes || record?.attrs || {};
  const dtxr = normalizeToken(attrs.DTXR || attrs.RAW_TYPE || record?.dtxr || record?.type || '');
  const type = normalizeToken(attrs.TYPE || record?.type || '');
  return BEND_DTXR.has(dtxr) || BEND_DTXR.has(type);
}

export function resolveExplicitManagedStageBendDetails(record) {
  const attrs = record?.attributes || record?.attrs || {};
  const explicitBendRecord = isExplicitManagedStageBendRecord(record);
  const bendRadiusMm = parseMm(firstPresent(attrs.BEND_RADIUS, attrs.BENDRADIUS, attrs.CURVE_RADIUS, attrs.RADIUS, attrs.RAD, attrs.BEND_RADIUS_MM));
  const bendAngleDeg = parseNumber(firstPresent(attrs.BEND_ANGLE, attrs.BENDANGLE, attrs.ANGLE, attrs.DEG, attrs.BEND_ANGLE_DEG));
  const hasExplicitBendDetails = explicitBendRecord && bendRadiusMm > 0 && bendAngleDeg > 0;
  return {
    schema: MANAGED_STAGE_EXPLICIT_BEND_SCHEMA,
    explicitBendRecord,
    hasExplicitBendDetails,
    centerlineKind: explicitBendRecord ? 'arc' : 'line',
    bendRadiusMm: bendRadiusMm > 0 ? round(bendRadiusMm) : null,
    bendAngleDeg: bendAngleDeg > 0 ? round(bendAngleDeg) : null,
    bendSource: explicitBendRecord ? (hasExplicitBendDetails ? 'stagedJson.BEND_RADIUS+BEND_ANGLE' : 'stagedJson.BEND_WITH_MISSING_DETAILS') : 'not-a-bend',
    synthetic1p5DTrimAllowed: !explicitBendRecord,
    synthetic1p5DTrimBlocked: explicitBendRecord,
    sourceDtxr: attrs.DTXR || attrs.RAW_TYPE || record?.dtxr || record?.type || '',
    sourceElementId: attrs.SOURCE_ELEMENT_ID || attrs.REF || attrs.NAME || record?.name || ''
  };
}

export function summarizeExplicitBendRows(records = []) {
  const rows = records
    .map((record) => ({ record, details: resolveExplicitManagedStageBendDetails(record) }))
    .filter((entry) => entry.details.explicitBendRecord);
  return {
    schema: 'ManagedStageExplicitBendSummary.v1',
    explicitBendRecordCount: rows.length,
    explicitBendDetailCount: rows.filter((entry) => entry.details.hasExplicitBendDetails).length,
    missingExplicitBendDetailCount: rows.filter((entry) => !entry.details.hasExplicitBendDetails).length,
    rows: rows.map(({ record, details }) => ({
      name: record?.attributes?.NAME || record?.attrs?.NAME || record?.name || '',
      path: record?.path || '',
      fromNode: String(record?.attributes?.FROM_NODE || record?.attrs?.FROM_NODE || record?.fromNode || ''),
      toNode: String(record?.attributes?.TO_NODE || record?.attrs?.TO_NODE || record?.toNode || ''),
      bendRadiusMm: details.bendRadiusMm,
      bendAngleDeg: details.bendAngleDeg,
      bendSource: details.bendSource
    }))
  };
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function parseMm(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseFloat(String(value).replace(/mm\b/gi, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseFloat(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeToken(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function round(value) {
  return Number(Number(value).toFixed(9));
}

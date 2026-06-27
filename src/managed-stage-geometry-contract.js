import { distance, point3 } from './managed-stage-topology-audit.js?v=bust-cache-4';

const EPS_MM = 0.001;
const SUPPORTED_DTXR = new Set(['PIPE', 'UNSPECIFIED', 'BEND', 'FLANGE', 'FLANGE_PAIR', 'VALVE', 'FLANGED_VALVE']);
const DTXR_ALIASES = new Map([
  ['FLAN', 'FLANGE'],
  ['FLG', 'FLANGE'],
  ['FLNG', 'FLANGE'],
  ['WN', 'FLANGE'],
  ['WNF', 'FLANGE'],
  ['WELDNECK', 'FLANGE'],
  ['WELD_NECK', 'FLANGE'],
  ['WELDNECK_FLANGE', 'FLANGE'],
  ['WELD_NECK_FLANGE', 'FLANGE'],
  ['VALV', 'VALVE'],
  ['BV', 'VALVE'],
  ['BALL', 'VALVE'],
  ['BALLVALVE', 'VALVE'],
  ['BALL_VALVE', 'VALVE'],
  ['FLANGEDVALVE', 'FLANGED_VALVE'],
  ['FLANGED_VALVE', 'FLANGED_VALVE'],
  ['FLANGEDBALLVALVE', 'FLANGED_VALVE'],
  ['FLANGED_BALL_VALVE', 'FLANGED_VALVE']
]);

export function buildManagedStageGeometryContractSet(profileOrRecords, options = {}) {
  const geometryRecords = Array.isArray(profileOrRecords) ? profileOrRecords : profileOrRecords.geometryRecords || [];
  const supportRecords = Array.isArray(profileOrRecords) ? [] : profileOrRecords.supportRecords || [];
  const contracts = [];
  const warnings = [];
  const skippedContracts = [];
  for (const [index, record] of geometryRecords.entries()) {
    try {
      const contract = createManagedStageGeometryContract(record, index, options);
      contracts.push(contract);
      warnings.push(...(contract.nonBlockingGeometryWarnings || []));
    } catch (error) {
      if (!warningOnly(options)) throw error;
      const name = record?.attributes?.NAME || record?.name || `ELEMENT_${index + 1}`;
      const warning = geometryWarning('contract-skipped', name, error.message);
      warnings.push(warning);
      skippedContracts.push(warning);
    }
  }
  const audit = auditManagedStageGeometryContracts(contracts, {
    sourceGeometryRecordCount: geometryRecords.length,
    supportRecordsSkippedFromGeometry: supportRecords.length,
    nonBlockingWarnings: warnings,
    skippedContracts
  });
  return {
    schema: 'ManagedStageGeometryContractSet.v1',
    units: 'mm',
    contractCount: contracts.length,
    sourceGeometryRecordCount: geometryRecords.length,
    supportRecordsSkippedFromGeometry: supportRecords.length,
    contracts,
    audit
  };
}

export function createManagedStageGeometryContract(record, elementIndex = 0, options = {}) {
  const a = record.attributes || {};
  if (record.type === 'ATTA' || a.TYPE === 'ATTA') {
    throw new Error(`Support/restraint record is not a geometry contract: ${record.name || a.NAME || 'UNNAMED'}`);
  }
  const sourceDtxr = a.DTXR || a.RAW_TYPE || record.type || 'UNKNOWN';
  let dtxr = normalizeManagedStageGeometryDtxr(sourceDtxr);
  const warnings = [];
  if (!SUPPORTED_DTXR.has(dtxr)) {
    if (!warningOnly(options)) throw new Error(`Unsupported managed-stage geometry DTXR: ${sourceDtxr}`);
    warnings.push(geometryWarning('unsupported-dtxr-degraded', a.NAME || record.name || 'UNNAMED', `Unsupported managed-stage geometry DTXR ${sourceDtxr}; emitted as UNSPECIFIED`));
    dtxr = 'UNSPECIFIED';
  }

  const start = point3(a.APOS, `${record.name}.APOS`);
  const end = point3(a.LPOS, `${record.name}.LPOS`);
  const lengthMm = distance(start, end);
  if (!(lengthMm > 0)) throw new Error(`Zero-length managed-stage geometry contract: ${record.name || a.NAME || 'UNNAMED'}`);

  const diameterMm = parseMm(a.DIAMETER || a.BORE || a.ABORE || a.LBORE);
  if (!(diameterMm > 0)) throw new Error(`Missing/invalid diameter for ${record.name || a.NAME || 'UNNAMED'}`);

  const axis = normalize(vsub(end, start));
  const contract = {
    schema: 'ManagedStageGeometryContract.v1',
    elementIndex,
    elementId: a.SOURCE_ELEMENT_ID || a.REF || a.NAME || record.name || `ELEMENT_${elementIndex + 1}`,
    name: a.NAME || record.name || `ELEMENT_${elementIndex + 1}`,
    type: record.type || a.TYPE || 'UNKNOWN',
    rawType: a.RAW_TYPE || sourceDtxr,
    dtxr,
    sourceDtxr,
    dtxrNormalizedFromAlias: dtxr !== normalizeDtxrToken(sourceDtxr),
    componentClass: componentClassForDtxr(dtxr),
    fromNode: String(a.FROM_NODE || ''),
    toNode: String(a.TO_NODE || ''),
    emitGeometry: true,
    centerlineKind: dtxr === 'BEND' ? 'arc' : 'line',
    endpointLocked: true,
    startMm: start,
    endMm: end,
    centerMm: midpoint(start, end),
    axis,
    lengthMm,
    diameterMm,
    radiusMm: diameterMm / 2,
    material: a.MATERIAL || '',
    wallThickMm: parseOptionalMm(a.WALL_THICK),
    sourceFormat: a.SOURCE_FORMAT || '',
    sourceElementId: a.SOURCE_ELEMENT_ID || '',
    nonBlockingGeometryWarnings: warnings
  };

  if (contract.centerlineKind === 'arc') {
    const bendRadiusMm = parseOptionalMm(a.BEND_RADIUS);
    const bendAngleDeg = parseOptionalNumber(a.BEND_ANGLE);
    const bendIssues = [];
    if (!(bendRadiusMm > 0)) bendIssues.push(`Missing/invalid bend radius for ${contract.name}`);
    if (!(bendAngleDeg > 0)) bendIssues.push(`Missing/invalid bend angle for ${contract.name}`);
    if (bendIssues.length) {
      if (!warningOnly(options)) throw new Error(bendIssues[0]);
      for (const issue of bendIssues) warnings.push(geometryWarning('bend-arc-degraded-to-source-route', contract.name, issue));
      contract.centerlineKind = 'line';
      contract.excludeCode4Bend = true;
      contract.degradedBendToSourceRouteCylinder = true;
      contract.bendArcDegradationReason = bendIssues.join('; ');
    } else {
      contract.arc = {
        bendRadiusMm,
        tubeRadiusMm: contract.radiusMm,
        bendAngleDeg,
        sweepAngleRad: (bendAngleDeg * Math.PI) / 180,
        solverState: 'endpoint-contract-only'
      };
    }
  }

  return contract;
}

export function auditManagedStageGeometryContracts(contracts = [], options = {}) {
  const dtxrHistogram = {};
  const classHistogram = {};
  const centerlineKindHistogram = {};
  const zeroLength = [];
  const invalidAxis = [];
  const unsupportedDtxr = [];
  const missingNodes = [];
  const degradedBends = [];
  let maxAxisLengthError = 0;

  for (const contract of contracts) {
    dtxrHistogram[contract.dtxr] = (dtxrHistogram[contract.dtxr] || 0) + 1;
    classHistogram[contract.componentClass] = (classHistogram[contract.componentClass] || 0) + 1;
    centerlineKindHistogram[contract.centerlineKind] = (centerlineKindHistogram[contract.centerlineKind] || 0) + 1;
    if (!SUPPORTED_DTXR.has(contract.dtxr)) unsupportedDtxr.push(contract.name);
    if (contract.degradedBendToSourceRouteCylinder) degradedBends.push(contract.name);
    if (!(contract.lengthMm > 0)) zeroLength.push(contract.name);
    if (!contract.fromNode || !contract.toNode) missingNodes.push(contract.name);
    const axisLen = Math.hypot(contract.axis?.[0] || 0, contract.axis?.[1] || 0, contract.axis?.[2] || 0);
    const axisError = Math.abs(axisLen - 1);
    maxAxisLengthError = Math.max(maxAxisLengthError, axisError);
    if (axisError > EPS_MM) invalidAxis.push(contract.name);
  }

  return {
    schema: 'ManagedStageGeometryContractAudit.v1',
    toleranceMm: EPS_MM,
    sourceGeometryRecordCount: options.sourceGeometryRecordCount ?? contracts.length,
    contractCount: contracts.length,
    skippedContractCount: options.skippedContracts?.length || 0,
    supportRecordsSkippedFromGeometry: options.supportRecordsSkippedFromGeometry || 0,
    dtxrHistogram,
    classHistogram,
    centerlineKindHistogram,
    zeroLength,
    invalidAxis,
    unsupportedDtxr,
    missingNodes,
    degradedBends,
    nonBlockingWarnings: options.nonBlockingWarnings || [],
    nonBlockingWarningCount: (options.nonBlockingWarnings || []).length,
    skippedContracts: options.skippedContracts || [],
    maxAxisLengthError: round(maxAxisLengthError),
    allEndpointLocked: contracts.every((contract) => contract.endpointLocked === true),
    allEmitGeometry: contracts.every((contract) => contract.emitGeometry === true)
  };
}

export function assertManagedStageGeometryContractAudit(audit, expectations = {}) {
  if (audit.schema !== 'ManagedStageGeometryContractAudit.v1') throw new Error('Invalid managed-stage geometry contract audit schema');
  if (audit.zeroLength?.length) throw new Error(`Geometry contract zero-length components: ${audit.zeroLength.join(', ')}`);
  if (audit.invalidAxis?.length) throw new Error(`Geometry contract invalid axes: ${audit.invalidAxis.join(', ')}`);
  if (audit.unsupportedDtxr?.length) throw new Error(`Geometry contract unsupported DTXR records: ${audit.unsupportedDtxr.join(', ')}`);
  if (audit.missingNodes?.length) throw new Error(`Geometry contract missing nodes: ${audit.missingNodes.join(', ')}`);
  if (audit.allEndpointLocked !== true) throw new Error('Geometry contracts must be endpoint locked');
  if (audit.allEmitGeometry !== true) throw new Error('Geometry contracts must all emit geometry');
  if (expectations.contractCount !== undefined && audit.contractCount !== expectations.contractCount) {
    throw new Error(`Geometry contract count mismatch: expected ${expectations.contractCount}, got ${audit.contractCount}`);
  }
  if (expectations.supportRecordsSkippedFromGeometry !== undefined && audit.supportRecordsSkippedFromGeometry !== expectations.supportRecordsSkippedFromGeometry) {
    throw new Error(`Support skip count mismatch: expected ${expectations.supportRecordsSkippedFromGeometry}, got ${audit.supportRecordsSkippedFromGeometry}`);
  }
  return { ok: true, contractCount: audit.contractCount, dtxrHistogram: audit.dtxrHistogram };
}

export function normalizeManagedStageGeometryDtxr(value) {
  const token = normalizeDtxrToken(value);
  return DTXR_ALIASES.get(token) || token;
}

export function componentClassForDtxr(dtxr) {
  const normalized = normalizeManagedStageGeometryDtxr(dtxr);
  if (normalized === 'PIPE') return 'PIPE';
  if (normalized === 'UNSPECIFIED') return 'UNKNOWN_PIPELIKE';
  if (normalized === 'BEND') return 'BEND';
  if (normalized === 'FLANGE') return 'FLANGE';
  if (normalized === 'FLANGE_PAIR') return 'FLANGE_PAIR';
  if (normalized === 'VALVE') return 'VALVE';
  if (normalized === 'FLANGED_VALVE') return 'FLANGED_VALVE';
  return 'UNKNOWN';
}

function normalizeDtxrToken(value) {
  return String(value || 'UNKNOWN')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'UNKNOWN';
}

function warningOnly(options = {}) {
  return options.nonBlockingGeometryGates === true || options.warningOnlyManagedStageGates === true;
}

function geometryWarning(code, elementName, message) {
  return { code, severity: 'warning', elementName, message };
}

function parseMm(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '').replace(/mm$/i, '').trim());
}

function parseOptionalMm(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseMm(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (!(l > 0)) throw new Error('Zero-length geometry direction');
  return [v[0] / l, v[1] / l, v[2] / l];
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function vsub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function round(value) {
  return Number(Number(value).toFixed(9));
}

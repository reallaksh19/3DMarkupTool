import { distance, point3 } from './managed-stage-topology-audit.js';

const EPS_MM = 0.001;
const SUPPORTED_DTXR = new Set(['PIPE', 'UNSPECIFIED', 'BEND', 'FLANGE', 'FLANGE_PAIR', 'VALVE', 'FLANGED_VALVE']);

export function buildManagedStageGeometryContractSet(profileOrRecords) {
  const geometryRecords = Array.isArray(profileOrRecords) ? profileOrRecords : profileOrRecords.geometryRecords || [];
  const supportRecords = Array.isArray(profileOrRecords) ? [] : profileOrRecords.supportRecords || [];
  const contracts = geometryRecords.map((record, index) => createManagedStageGeometryContract(record, index));
  const audit = auditManagedStageGeometryContracts(contracts, { supportRecordsSkippedFromGeometry: supportRecords.length });
  return {
    schema: 'ManagedStageGeometryContractSet.v1',
    units: 'mm',
    contractCount: contracts.length,
    supportRecordsSkippedFromGeometry: supportRecords.length,
    contracts,
    audit
  };
}

export function createManagedStageGeometryContract(record, elementIndex = 0) {
  const a = record.attributes || {};
  if (record.type === 'ATTA' || a.TYPE === 'ATTA') {
    throw new Error(`Support/restraint record is not a geometry contract: ${record.name || a.NAME || 'UNNAMED'}`);
  }
  const dtxr = a.DTXR || a.RAW_TYPE || record.type || 'UNKNOWN';
  if (!SUPPORTED_DTXR.has(dtxr)) throw new Error(`Unsupported managed-stage geometry DTXR: ${dtxr}`);

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
    rawType: a.RAW_TYPE || dtxr,
    dtxr,
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
    sourceElementId: a.SOURCE_ELEMENT_ID || ''
  };

  if (contract.centerlineKind === 'arc') {
    const bendRadiusMm = parseOptionalMm(a.BEND_RADIUS);
    const bendAngleDeg = Number(a.BEND_ANGLE || 90);
    if (!(bendRadiusMm > 0)) throw new Error(`Missing/invalid bend radius for ${contract.name}`);
    if (!(bendAngleDeg > 0)) throw new Error(`Missing/invalid bend angle for ${contract.name}`);
    contract.arc = {
      bendRadiusMm,
      tubeRadiusMm: contract.radiusMm,
      bendAngleDeg,
      sweepAngleRad: (bendAngleDeg * Math.PI) / 180,
      solverState: 'endpoint-contract-only'
    };
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
  let maxAxisLengthError = 0;

  for (const contract of contracts) {
    dtxrHistogram[contract.dtxr] = (dtxrHistogram[contract.dtxr] || 0) + 1;
    classHistogram[contract.componentClass] = (classHistogram[contract.componentClass] || 0) + 1;
    centerlineKindHistogram[contract.centerlineKind] = (centerlineKindHistogram[contract.centerlineKind] || 0) + 1;
    if (!SUPPORTED_DTXR.has(contract.dtxr)) unsupportedDtxr.push(contract.name);
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
    contractCount: contracts.length,
    supportRecordsSkippedFromGeometry: options.supportRecordsSkippedFromGeometry || 0,
    dtxrHistogram,
    classHistogram,
    centerlineKindHistogram,
    zeroLength,
    invalidAxis,
    unsupportedDtxr,
    missingNodes,
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

export function componentClassForDtxr(dtxr) {
  if (dtxr === 'PIPE') return 'PIPE';
  if (dtxr === 'UNSPECIFIED') return 'UNKNOWN_PIPELIKE';
  if (dtxr === 'BEND') return 'BEND';
  if (dtxr === 'FLANGE') return 'FLANGE';
  if (dtxr === 'FLANGE_PAIR') return 'FLANGE_PAIR';
  if (dtxr === 'VALVE') return 'VALVE';
  if (dtxr === 'FLANGED_VALVE') return 'FLANGED_VALVE';
  return 'UNKNOWN';
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

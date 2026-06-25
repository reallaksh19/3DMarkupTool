import { parseManagedStageProfile } from './managed-stage-profile-parser.js';
import {
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  normalizeManagedStageSupportMapperRecord
} from './managed-stage-support-mapper-config.js';
import { parseManagedStageIsonoteSupportRecords } from './managed-stage-isonote-support-mapper.js';
import { resolveManagedStageSupportVisual } from './managed-stage-support-visual-resolver.js';

export const STAGEDJSON_SOURCE_CONTRACT_SCHEMA = 'StagedJsonSourceContract.v1';
export const STAGEDJSON_SOURCE_KIND = 'stagedJson';

const SUPPORT_FAMILY_MAP = Object.freeze({
  REST: 'REST',
  GUIDE: 'GUIDE',
  LINE_STOP: 'LINESTOP',
  LINESTOP: 'LINESTOP',
  LIMIT_STOP: 'LIMIT',
  LIMIT: 'LIMIT',
  HOLDDOWN: 'HOLDDOWN',
  HOLD_DOWN: 'HOLDDOWN',
  ANCHOR: 'ANCHOR',
  SPRING: 'SPRING',
  SPRING_CAN: 'SPRING',
  CAN: 'SPRING',
  HANGER: 'SPRING',
  SINGLE_AXIS_WARNING: 'UNKNOWN',
  UNKNOWN_RESTRAINT: 'UNKNOWN'
});

const LEGACY_FAMILY_MAP = Object.freeze({
  REST: 'REST',
  GUIDE: 'GUIDE',
  LINESTOP: 'LINE_STOP',
  LIMIT: 'LIMIT',
  HOLDDOWN: 'HOLDDOWN',
  ANCHOR: 'ANCHOR',
  SPRING: 'SPRING',
  UNKNOWN: 'AXIS_RESTRAINT_UNRESOLVED'
});

export function looksLikeStagedJsonSource(value) {
  const json = parseJsonMaybe(value);
  return Boolean(json && json.schema === 'inputxml-managed-stage/v1' && json.profile === 'AVEVA_JSON_FOR_3D_RVM_VIEWER');
}

export function parseStagedJsonSourceContract(sourceText, options = {}) {
  const profile = parseManagedStageProfile(sourceText);
  const adaptedRecords = profile.records.map(adaptManagedStageRecord);
  const isonoteRecords = parseManagedStageIsonoteSupportRecords(options.isonoteText || '', options.supportMapperConfig || {});
  const pipeSegments = profile.geometryRecords
    .map((record, index) => toPipeSegment(record, index))
    .filter(Boolean);
  const components = profile.geometryRecords.map((record, index) => toComponentRecord(record, index));
  const supports = profile.supportRecords.map((record, index) => toSupportContractRecord(record, index, adaptedRecords, isonoteRecords));
  const compatibility = buildCompatibilityModel(profile.geometryRecords, supports);
  const diagnostics = buildDiagnostics(profile, supports, isonoteRecords, compatibility);

  return {
    schema: STAGEDJSON_SOURCE_CONTRACT_SCHEMA,
    sourceKind: STAGEDJSON_SOURCE_KIND,
    sourceFile: options.filename || options.sourceFile || profile.source || '',
    sourceSchemaVersion: profile.schema,
    sourceProfile: profile.profile,
    units: profile.units,
    branches: profile.branches,
    components,
    pipeSegments,
    supports,
    isonoteRecords,
    diagnostics,
    sourcePaths: {
      root: '$',
      branches: '$.hierarchy[]',
      components: '$.hierarchy[].children[*]',
      supports: '$.hierarchy[].children[?type=ATTA|ANCI|SUPPORT]',
      isonoteRecords: 'options.isonoteText'
    },

    // Compatibility fields consumed by existing GLB/RVM converters while the
    // stagedJson pipeline is consolidated around the contract above.
    elements: compatibility.elements,
    nodes: compatibility.nodes,
    restraints: compatibility.restraints,
    lineMap: new Map(),
    isonoteMap: compatibility.isonoteMap,
    managedStageProfile: profile
  };
}

export function assertStagedJsonSourceContract(contract) {
  if (!contract || contract.schema !== STAGEDJSON_SOURCE_CONTRACT_SCHEMA) {
    throw new Error('Invalid stagedJson source contract schema');
  }
  if (contract.sourceKind !== STAGEDJSON_SOURCE_KIND) {
    throw new Error('Invalid stagedJson source kind');
  }
  for (const field of ['branches', 'components', 'pipeSegments', 'supports', 'isonoteRecords', 'diagnostics', 'sourcePaths']) {
    if (!(field in contract)) throw new Error(`stagedJson source contract missing ${field}`);
  }
  for (const support of contract.supports || []) {
    for (const field of [
      'supportId', 'sourceKind', 'sourcePath', 'nodeNumber', 'supportKindRaw',
      'supportKindNormalized', 'supportFamily', 'axisRaw', 'axisCanvas',
      'axisTransformApplied', 'gapMm', 'pipeOdMm', 'pipeRadiusMm', 'pipeAxis',
      'positionMm', 'matchedPipeRef', 'matchedIsonoteRecord', 'isonoteRawText',
      'isonoteNoteName', 'warningCode', 'warningMessage'
    ]) {
      if (!(field in support)) throw new Error(`stagedJson support ${support.supportId || '(unknown)'} missing ${field}`);
    }
  }
  return true;
}

function toSupportContractRecord(record, index, adaptedRecords, isonoteRecords) {
  const adapted = adaptManagedStageRecord(record);
  const mapperRecord = normalizeManagedStageSupportMapperRecord({ attrs: adapted.attrs }, { sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON });
  const visual = resolveManagedStageSupportVisual({ ...adapted, attrs: mapperRecord.attrs }, adaptedRecords, {});
  const normalizedFamily = normalizeContractFamily(visual.family || mapperRecord.family);
  const nodeNumber = String(mapperRecord.attrs.NODE || adapted.fromNode || adapted.toNode || visual.node || '');
  const supportTag = mapperRecord.supportTag || mapperRecord.attrs.SUPPORT_TAG_MAPPED || mapperRecord.attrs.NAME || record.name || '';
  const matchedIsonoteRecord = matchIsonoteRecord({ nodeNumber, supportTag, normalizedFamily, isonoteRecords });
  const positionMm = pointOrNull(adapted.source.supportCoord || adapted.source.pos || adapted.source.bpos || adapted.source.apos || adapted.source.lpos);
  const warningCode = mapperRecord.preflight?.issues?.[0]?.code || (visual.popupRequired ? 'popup-required' : '');
  const warningMessage = mapperRecord.preflight?.issues?.[0]?.message || visual.popupReason || '';

  return {
    supportId: supportTag || `SUPPORT_${index + 1}`,
    sourceKind: STAGEDJSON_SOURCE_KIND,
    sourcePath: record.path || '',
    nodeNumber,
    supportName: supportTag,
    psTag: supportTag,
    supportKindRaw: mapperRecord.rawKind || visual.rawKind || record.type || '',
    supportKindNormalized: mapperRecord.family || visual.family || 'UNKNOWN',
    supportFamily: normalizedFamily,
    axisRaw: mapperRecord.axis?.sourceAxis || visual.sourceAxis || '',
    axisCanvas: mapperRecord.axis?.canvasAxis || visual.canvasAxis || '',
    axisTransformApplied: Boolean(String(mapperRecord.attrs.SUPPORT_AXIS_CANVAS_APPLIED || '').toUpperCase() === 'TRUE' || visual.axisTransformApplied),
    gapMm: finiteNumber(visual.gapMm, 0),
    pipeOdMm: finiteNumber(visual.pipeDiameterMm, 0),
    pipeRadiusMm: finiteNumber(visual.pipeRadiusMm, 0),
    pipeAxis: visual.pipeAxis || '',
    positionMm,
    matchedPipeRef: visual.sourcePipePath || visual.sourcePipeRecord || '',
    matchedIsonoteRecord,
    isonoteRawText: matchedIsonoteRecord?.rawText || '',
    isonoteNoteName: matchedIsonoteRecord?.supportTag || matchedIsonoteRecord?.nodeId || '',
    warningCode,
    warningMessage,
    popupRequired: Boolean(visual.popupRequired || mapperRecord.preflight?.popupRequired),
    matchMethod: matchedIsonoteRecord ? 'node-family' : 'none',
    confidence: matchedIsonoteRecord ? 1 : 0,
    sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
    rawType: record.type || '',
    ref: adapted.attrs.REF || adapted.attrs.SOURCE_RESTRAINT_ID || '',
    name: record.name || '',
    visual
  };
}

function toComponentRecord(record, index) {
  const attrs = record.attributes || {};
  return {
    componentId: attrs.SOURCE_ELEMENT_ID || attrs.REF || attrs.NAME || record.name || `COMPONENT_${index + 1}`,
    sourceKind: STAGEDJSON_SOURCE_KIND,
    sourcePath: record.path || '',
    rawType: attrs.RAW_TYPE || attrs.DTXR || record.type || '',
    dtxr: attrs.DTXR || attrs.RAW_TYPE || record.type || '',
    fromNode: String(attrs.FROM_NODE || ''),
    toNode: String(attrs.TO_NODE || ''),
    apos: pointOrNull(attrs.APOS),
    lpos: pointOrNull(attrs.LPOS),
    pipeOdMm: parseMm(attrs.DIAMETER || attrs.BORE || attrs.ABORE || attrs.LBORE),
    sourceAttributes: attrs
  };
}

function toPipeSegment(record, index) {
  const attrs = record.attributes || {};
  const start = pointOrNull(attrs.APOS);
  const end = pointOrNull(attrs.LPOS);
  if (!start || !end) return null;
  return {
    pipeRef: attrs.NAME || attrs.REF || record.name || `PIPE_${index + 1}`,
    sourcePath: record.path || '',
    rawType: attrs.RAW_TYPE || attrs.DTXR || record.type || '',
    fromNode: String(attrs.FROM_NODE || ''),
    toNode: String(attrs.TO_NODE || ''),
    startMm: start,
    endMm: end,
    pipeOdMm: parseMm(attrs.DIAMETER || attrs.BORE || attrs.ABORE || attrs.LBORE),
    pipeAxis: dominantAxisFromPoints(start, end)
  };
}

function buildCompatibilityModel(geometryRecords, supports) {
  const nodes = new Map();
  const elements = [];
  const isonoteMap = new Map();

  geometryRecords.forEach((record, index) => {
    const attrs = record.attributes || {};
    const start = pointOrNull(attrs.APOS);
    const end = pointOrNull(attrs.LPOS);
    if (!start || !end) return;
    const fromNode = String(attrs.FROM_NODE || index * 10 + 10);
    const toNode = String(attrs.TO_NODE || index * 10 + 20);
    ensureNode(nodes, fromNode, start);
    ensureNode(nodes, toNode, end);
    const rawType = attrs.RAW_TYPE || attrs.DTXR || record.type || 'PIPE';
    const type = normalizeType(rawType);
    const id = attrs.NAME || attrs.REF || record.name || `STAGED_${index + 1}`;
    elements.push({
      id,
      fromNode,
      toNode,
      from: nodes.get(String(Number(fromNode))),
      to: nodes.get(String(Number(toNode))),
      dx: end.x - start.x,
      dy: end.y - start.y,
      dz: end.z - start.z,
      type,
      rawType,
      props: {
        id,
        refNo: attrs.REF || id,
        type,
        meshRole: rawType,
        fromNode,
        toNode,
        lineNo: attrs.LINE_NO || 'N/A',
        lineNoSource: attrs.LINE_NO ? 'stagedJson' : 'N/A',
        bore: numericText(attrs.DIAMETER || attrs.BORE || attrs.ABORE || attrs.LBORE) || '100',
        wallThickness: { value: numericText(attrs.WALL_THICK) || 'N/A', source: attrs.WALL_THICK ? 'stagedJson' : 'unavailable' },
        materialThickness: { value: numericText(attrs.WALL_THICK) || 'N/A', source: attrs.WALL_THICK ? 'stagedJson' : 'unavailable' },
        material: { value: attrs.MATERIAL || 'N/A', source: attrs.MATERIAL ? 'stagedJson' : 'unavailable' },
        pressure: { value: attrs.PRESSURE || 'N/A', source: attrs.PRESSURE ? 'stagedJson' : 'unavailable' },
        hydroPressure: { value: attrs.HYDRO_PRESSURE || 'N/A', source: attrs.HYDRO_PRESSURE ? 'stagedJson' : 'unavailable' },
        temp1: { value: attrs.TEMP1 || 'N/A', source: attrs.TEMP1 ? 'stagedJson' : 'unavailable' },
        temp2: { value: attrs.TEMP2 || 'N/A', source: attrs.TEMP2 ? 'stagedJson' : 'unavailable' },
        temp3: { value: attrs.TEMP3 || 'N/A', source: attrs.TEMP3 ? 'stagedJson' : 'unavailable' },
        source: STAGEDJSON_SOURCE_KIND,
        rawAttributes: attrs,
        bendRadius: numericText(attrs.BEND_RADIUS),
        bendAngle: numericText(attrs.BEND_ANGLE),
        rigidType: rawType,
        rigidWeight: attrs.WEIGHT || ''
      }
    });
  });

  const restraints = supports.map((support, index) => {
    if (support.isonoteRawText && support.nodeNumber) isonoteMap.set(String(Number(support.nodeNumber)), support.isonoteRawText);
    return {
      id: support.supportId || `STAGED_SUPPORT_${index + 1}`,
      source: STAGEDJSON_SOURCE_KIND,
      sourceMode: 'ACTUAL_STAGED_JSON',
      node: String(Number(support.nodeNumber || 0)),
      typeCode: support.supportKindNormalized,
      rawType: support.supportKindRaw,
      family: LEGACY_FAMILY_MAP[support.supportFamily] || 'AXIS_RESTRAINT_UNRESOLVED',
      axis: support.axisCanvas || support.axisRaw || 'PIPE_AXIAL_±',
      sign: support.axisCanvas?.startsWith('-') ? '-' : support.axisCanvas?.startsWith('+') ? '+' : 'UNKNOWN',
      gapMm: support.gapMm,
      sourceNoteName: support.isonoteNoteName || '',
      warningText: support.warningMessage || '',
      popupRequired: support.popupRequired,
      xCos: 0,
      yCos: 0,
      zCos: 0
    };
  });

  return { elements, nodes, restraints, isonoteMap };
}

function buildDiagnostics(profile, supports, isonoteRecords, compatibility) {
  return [{
    code: 'STAGEDJSON_SOURCE_CONTRACT_BUILT',
    severity: 'info',
    message: `stagedJson contract built: components=${profile.geometryRecords.length}, supports=${supports.length}, isonoteRecords=${isonoteRecords.length}`,
    counts: {
      branches: profile.branches.length,
      components: profile.geometryRecords.length,
      pipeSegments: compatibility.elements.length,
      supports: supports.length,
      isonoteRecords: isonoteRecords.length,
      popupRequired: supports.filter((support) => support.popupRequired).length,
      axisTransformed: supports.filter((support) => support.axisTransformApplied).length
    }
  }];
}

function adaptManagedStageRecord(record) {
  const attrs = record.attributes || record.attrs || {};
  return {
    ...record,
    attrs,
    fromNode: String(attrs.FROM_NODE || attrs.NODE || ''),
    toNode: String(attrs.TO_NODE || attrs.NODE || ''),
    dtxr: attrs.DTXR || attrs.RAW_TYPE || record.type || '',
    source: {
      apos: pointOrNull(attrs.APOS),
      lpos: pointOrNull(attrs.LPOS),
      pos: pointOrNull(attrs.POS),
      bpos: pointOrNull(attrs.BPOS),
      supportCoord: pointOrNull(attrs.SUPPORTCOORD || attrs.SUPPORT_COORD)
    }
  };
}

function matchIsonoteRecord({ nodeNumber, supportTag, normalizedFamily, isonoteRecords }) {
  const node = String(Number(nodeNumber || 0));
  const tag = normalizeText(supportTag);
  return (isonoteRecords || []).find((record) => {
    const recordNode = String(Number(record.nodeId || record.attrs?.NODE || 0));
    if (recordNode !== node) return false;
    const recordFamily = normalizeContractFamily(record.mapperRecord?.family || record.attrs?.SUPPORT_KIND_MAPPED || record.attrs?.SUPPORT_KIND || '');
    if (recordFamily !== normalizedFamily) return false;
    const recordTag = normalizeText(record.supportTag || record.attrs?.SUPPORT_TAG || '');
    return !tag || !recordTag || tag.includes(recordTag) || recordTag.includes(tag);
  }) || null;
}

function normalizeContractFamily(value) {
  const key = String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_');
  return SUPPORT_FAMILY_MAP[key] || 'UNKNOWN';
}

function ensureNode(nodes, id, point) {
  const key = String(Number(id));
  if (!nodes.has(key)) nodes.set(key, { id: key, x: point.x, y: point.y, z: point.z });
  return nodes.get(key);
}

function dominantAxisFromPoints(start, end) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const dz = Math.abs(end.z - start.z);
  if (dy >= dx && dy >= dz) return 'Y';
  if (dz >= dx && dz >= dy) return 'Z';
  return 'X';
}

function pointOrNull(value) {
  if (!value && value !== 0) return null;
  if (Array.isArray(value) && value.length >= 3) return pointFromArray(value);
  if (typeof value === 'object') return pointFromObject(value);
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

function asNumber(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace(/mm\b/gi, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMm(value) {
  return asNumber(value) || 0;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function numericText(value) {
  const n = asNumber(value);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

function normalizeType(value) {
  return String(value || 'PIPE').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'PIPE';
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function parseJsonMaybe(value) {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (value && typeof value === 'object') return value;
    return null;
  } catch {
    return null;
  }
}

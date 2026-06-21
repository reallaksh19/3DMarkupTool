import * as THREE from 'three';
import { cylinderBetween, mat } from './geometry.js?v=professional-viewer-3';

const PREVIEW_SCHEMA = 'ManagedStageRawPreview.v1';
const COORDINATE_AUDIT_SCHEMA = 'ManagedStageCoordinateAudit.v1';
const EPS_MM = 0.001;
const MAX_BRANCH_CUE_LEGS = 4;

const PREVIEW_COLORS = Object.freeze({
  PIPE: 0x3d74c5,
  FLAN: 0x9a9a9a,
  FLANGE: 0x9a9a9a,
  VALV: 0xcc2222,
  VALVE: 0xcc2222,
  BEND: 0xaa55aa,
  ELBO: 0xaa55aa,
  ELBOW: 0xaa55aa,
  TEE: 0x55aa55,
  OLET: 0x55aa55,
  SUPPORT: 0x2a9fd6,
  ATTA: 0x2a9fd6,
  ANCI: 0x2a9fd6,
  BRANCH: 0x446688,
  UNKNOWN: 0x73b9ff
});

const EXPORTABLE_DTXR = new Set(['PIPE', 'UNSPECIFIED', 'BEND', 'FLANGE', 'FLANGE_PAIR', 'VALVE', 'FLANGED_VALVE']);
const SUPPORT_TYPES = new Set(['ATTA', 'ANCI', 'SUPP', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT']);

export function createManagedStagePreviewScene(sourceTextOrJson, options = {}) {
  const json = parseManagedStageJson(sourceTextOrJson);
  const records = collectStagedRecords(json);
  const sourceName = options.sourceName || json?.source || 'managed-stage-json';
  const lengths = records
    .map((record) => record.source.start && record.source.end ? pointDistance(record.source.start, record.source.end) : 0)
    .filter((value) => Number.isFinite(value) && value > EPS_MM)
    .sort((a, b) => a - b);
  const medianLength = lengths.length ? lengths[Math.floor(lengths.length * 0.5)] : 100;
  const sourceRadius = Math.max(Math.min(medianLength * 0.025, 80), 5);
  const pointRadius = Math.max(sourceRadius * 1.4, 10);
  const root = new THREE.Group();
  root.name = 'MANAGED_STAGE_RAW_PREVIEW_ROOT';
  root.userData = {
    TYPE: 'MANAGED_STAGE_RAW_PREVIEW_ROOT',
    schema: PREVIEW_SCHEMA,
    source: 'raw staged JSON APOS/LPOS/POS preview',
    sourceName,
    exportedRvmGeometry: false
  };

  const renderRows = [];
  const endpointIndex = buildEndpointNodeIndex(records);

  for (const record of records) {
    const meshInfo = createRecordPreviewObject(record, sourceRadius, pointRadius);
    if (meshInfo.object) root.add(meshInfo.object);
    renderRows.push(createAuditRow(record, meshInfo));

    if (meshInfo.object && isBendLike(record)) {
      const cue = createBendCue(record, sourceRadius);
      if (cue) root.add(cue);
    }
  }

  const branchCueCount = addBranchTopologyCues(root, endpointIndex, sourceRadius);
  const audit = auditManagedStagePreviewCoordinatePreservation(renderRows, {
    schema: COORDINATE_AUDIT_SCHEMA,
    source: 'raw staged JSON APOS/LPOS/POS/BPOS/SUPPORTCOORD',
    planningPipeline: 'raw-staged-preview-no-rvm-primitive-planning',
    recordCount: records.length,
    branchCueCount,
    bendCueCount: root.children.filter((child) => child.userData?.previewAdditiveCue === true && child.userData?.cueKind === 'bend').length,
    rvmExportPrimitiveCount: countExportPrimitives(options.exportModel),
    rvmExportPreviewSeparated: true
  });

  const scene = new THREE.Scene();
  scene.name = 'ManagedStageRawPreviewScene';
  scene.userData = {
    app: 'inputxml-glb-standalone',
    previewSource: 'raw-managed-stage-json',
    previewSchema: PREVIEW_SCHEMA,
    sourceName,
    units: 'mm',
    axisBasis: 'source x/y/z preserved; no recenter, no scale conversion',
    managedStageCoordinateAudit: audit,
    // The old visible fallback patch is intentionally disabled for this scene.
    // This preview already contains every raw staged APOS/LPOS/POS record, and
    // duplicating the fallback overlay would make supports and centerlines appear twice.
    managedStageVisibleFallback: {
      schema: 'ManagedStageVisibleFallback.v1',
      candidateCount: records.length,
      meshCount: 0,
      skippedReason: 'native raw managed-stage preview scene already applied'
    }
  };
  scene.add(root);
  return scene;
}

export function auditManagedStagePreviewCoordinatePreservation(rows = [], base = {}) {
  const sourceLineRows = rows.filter((row) => row.sourceCoordinateKind === 'APOS_LPOS');
  const sourcePointRows = rows.filter((row) => row.sourceCoordinateKind !== 'APOS_LPOS' && row.sourceCoordinateKind !== 'NONE');
  const nonBendSourceLineRows = sourceLineRows.filter((row) => !row.isBend);
  const mutatedNonBendRows = nonBendSourceLineRows.filter((row) => row.deltaMm?.max > EPS_MM);
  const mutatedRows = rows.filter((row) => row.deltaMm?.max > EPS_MM);
  const supportPreviewOnlyRows = rows.filter((row) => row.supportLike && row.previewOnly);
  return {
    ...base,
    schema: COORDINATE_AUDIT_SCHEMA,
    toleranceMm: EPS_MM,
    rowCount: rows.length,
    sourceLineCount: sourceLineRows.length,
    sourcePointCount: sourcePointRows.length,
    nonBendSourceLineCount: nonBendSourceLineRows.length,
    supportPreviewOnlyCount: supportPreviewOnlyRows.length,
    mutatedRowCount: mutatedRows.length,
    mutatedNonBendRowCount: mutatedNonBendRows.length,
    maxDeltaMm: round(Math.max(0, ...rows.map((row) => row.deltaMm?.max || 0))),
    maxNonBendDeltaMm: round(Math.max(0, ...nonBendSourceLineRows.map((row) => row.deltaMm?.max || 0))),
    pass: mutatedNonBendRows.length === 0,
    rows
  };
}

export function assertManagedStagePreviewCoordinatePreservation(audit) {
  if (!audit || audit.schema !== COORDINATE_AUDIT_SCHEMA) throw new Error('Invalid managed-stage coordinate audit');
  if (audit.mutatedNonBendRowCount > 0) {
    const offenders = audit.rows
      .filter((row) => row.deltaMm?.max > EPS_MM && !row.isBend && row.sourceCoordinateKind === 'APOS_LPOS')
      .map((row) => `${row.name}: ${row.deltaMm.max}mm (${row.deltaReason || 'coordinate drift'})`)
      .join('; ');
    throw new Error(`Managed-stage preview moved non-bend source records above tolerance: ${offenders}`);
  }
  return { ok: true, maxNonBendDeltaMm: audit.maxNonBendDeltaMm, rowCount: audit.rowCount };
}

function createRecordPreviewObject(record, radius, pointRadius) {
  if (record.source.start && record.source.end && pointDistance(record.source.start, record.source.end) > EPS_MM) {
    const start = toVec(record.source.start);
    const end = toVec(record.source.end);
    const mesh = cylinderBetween(start, end, radiusForRecord(record, radius), mat(colorForRecord(record)), 18, record.path);
    stampSourceUserData(mesh, record, {
      primitiveKind: 'raw-staged-source-line',
      previewSourceGeometry: 'APOS_LPOS',
      previewStartMm: clonePoint(record.source.start),
      previewEndMm: clonePoint(record.source.end),
      previewOnly: isSupportLike(record),
      exportedRvmGeometry: false
    });
    return { object: mesh, renderedStart: clonePoint(record.source.start), renderedEnd: clonePoint(record.source.end), renderedPos: null };
  }

  const pos = record.source.pos || record.source.bpos || record.source.supportCoord || record.source.apos || record.source.lpos;
  if (!pos) return { object: null, renderedStart: null, renderedEnd: null, renderedPos: null };
  const geometry = isSupportLike(record)
    ? new THREE.BoxGeometry(pointRadius * 1.8, pointRadius * 1.8, pointRadius * 1.8)
    : new THREE.SphereGeometry(pointRadius, 14, 10);
  const mesh = new THREE.Mesh(geometry, mat(colorForRecord(record)));
  mesh.name = record.path;
  mesh.position.copy(toVec(pos));
  stampSourceUserData(mesh, record, {
    primitiveKind: isSupportLike(record) ? 'raw-staged-support-point' : 'raw-staged-source-point',
    previewSourceGeometry: sourcePointKind(record),
    previewPosMm: clonePoint(pos),
    previewOnly: true,
    exportedRvmGeometry: false
  });
  return { object: mesh, renderedStart: null, renderedEnd: null, renderedPos: clonePoint(pos) };
}

function stampSourceUserData(object, record, extra = {}) {
  object.userData = {
    ...(object.userData || {}),
    TYPE: isSupportLike(record) ? 'SUPPORT_RESTRAINT' : 'MANAGED_STAGE_RAW_PREVIEW',
    sourceName: record.name,
    sourcePath: record.path,
    rawType: record.rawType,
    stagedType: record.type,
    dtxr: record.dtxr,
    fromNode: record.fromNode,
    toNode: record.toNode,
    sourceAposMm: clonePoint(record.source.apos),
    sourceLposMm: clonePoint(record.source.lpos),
    sourcePosMm: clonePoint(record.source.pos || record.source.supportCoord || record.source.bpos),
    endpointLocked: true,
    coordinatePolicy: 'raw staged APOS/LPOS/POS coordinates preserved',
    ...extra
  };
}

function createBendCue(record, radius) {
  const start = record.source.start;
  const end = record.source.end;
  if (!start || !end) return null;
  const center = midpoint(start, end);
  const cueRadius = Math.max(radius * 1.35, 8);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(cueRadius, 16, 12), mat(PREVIEW_COLORS.BEND, { transparent: true, opacity: 0.72 }));
  mesh.name = `${record.path}__BEND_PREVIEW_CUE`;
  mesh.position.copy(toVec(center));
  mesh.userData = {
    TYPE: 'MANAGED_STAGE_PREVIEW_CUE',
    sourceName: record.name,
    sourcePath: record.path,
    cueKind: 'bend',
    previewAdditiveCue: true,
    previewOnly: true,
    exportedRvmGeometry: false,
    coordinatePolicy: 'additive local cue; source BEND APOS/LPOS line remains unmodified',
    sourceAposMm: clonePoint(start),
    sourceLposMm: clonePoint(end),
    previewPosMm: clonePoint(center)
  };
  return mesh;
}

function addBranchTopologyCues(root, endpointIndex, radius) {
  let count = 0;
  for (const [nodeId, entries] of endpointIndex.entries()) {
    if (entries.length < 3) continue;
    const point = entries[0].point;
    if (!point) continue;
    const group = new THREE.Group();
    group.name = `MANAGED_STAGE_BRANCH_CUE_NODE_${nodeId}`;
    group.userData = {
      TYPE: 'MANAGED_STAGE_PREVIEW_CUE',
      cueKind: 'branch-fitting',
      node: nodeId,
      connectionCount: entries.length,
      previewAdditiveCue: true,
      previewOnly: true,
      exportedRvmGeometry: false,
      coordinatePolicy: 'topology branch cue added at shared node; adjacent source records are not trimmed or moved',
      previewPosMm: clonePoint(point)
    };
    const material = mat(PREVIEW_COLORS.TEE, { transparent: true, opacity: 0.76 });
    const hub = new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius * 1.6, 10), 16, 12), material);
    hub.name = `${group.name}_HUB`;
    hub.position.copy(toVec(point));
    hub.userData = { ...group.userData, cuePart: 'hub' };
    group.add(hub);

    for (const entry of entries.slice(0, MAX_BRANCH_CUE_LEGS)) {
      const leg = createBranchCueLeg(point, entry.otherPoint, radius, material, `${group.name}_${entry.record.name}`);
      if (leg) group.add(leg);
    }
    root.add(group);
    count += 1;
  }
  return count;
}

function createBranchCueLeg(basePoint, otherPoint, radius, material, name) {
  if (!basePoint || !otherPoint) return null;
  const base = toVec(basePoint);
  const target = toVec(otherPoint);
  const delta = target.clone().sub(base);
  const len = delta.length();
  if (!(len > EPS_MM)) return null;
  const cueLen = Math.min(Math.max(radius * 4, 24), len * 0.18, 120);
  const end = base.clone().add(delta.normalize().multiplyScalar(cueLen));
  const mesh = cylinderBetween(base, end, Math.max(radius * 0.58, 4), material, 12, name);
  mesh.userData = {
    TYPE: 'MANAGED_STAGE_PREVIEW_CUE',
    cueKind: 'branch-fitting-leg',
    previewAdditiveCue: true,
    previewOnly: true,
    exportedRvmGeometry: false,
    coordinatePolicy: 'short additive branch cue only; no adjacent source APOS/LPOS mutation'
  };
  return mesh;
}

function createAuditRow(record, meshInfo) {
  const sourceCoordinateKind = record.source.start && record.source.end ? 'APOS_LPOS' : sourcePointKind(record);
  const beforePlanning = {
    startMm: clonePoint(record.source.start),
    endMm: clonePoint(record.source.end),
    posMm: clonePoint(record.source.pos || record.source.bpos || record.source.supportCoord || record.source.apos || record.source.lpos)
  };
  const afterPlanning = {
    ...beforePlanning,
    policy: 'unchanged for raw preview pipeline'
  };
  const rendered = {
    startMm: clonePoint(meshInfo.renderedStart),
    endMm: clonePoint(meshInfo.renderedEnd),
    posMm: clonePoint(meshInfo.renderedPos)
  };
  const deltaMm = computeDelta(beforePlanning, rendered, sourceCoordinateKind);
  return {
    recordName: record.rawName,
    name: record.name,
    path: record.path,
    type: record.type,
    rawType: record.rawType,
    dtxr: record.dtxr,
    fromNode: record.fromNode,
    toNode: record.toNode,
    APOS: clonePoint(record.source.apos),
    LPOS: clonePoint(record.source.lpos),
    POS: clonePoint(record.source.pos),
    BPOS: clonePoint(record.source.bpos),
    HPOS: clonePoint(record.source.hpos),
    TPOS: clonePoint(record.source.tpos),
    SUPPORTCOORD: clonePoint(record.source.supportCoord),
    sourceCoordinateKind,
    beforePlanning,
    afterPlanning,
    rendered,
    exportedToRvm: isExportableRecord(record),
    previewOnly: !isExportableRecord(record),
    supportLike: isSupportLike(record),
    isBend: isBendLike(record),
    deltaMm,
    deltaReason: deltaMm.max > EPS_MM ? 'raw preview coordinate drift' : ''
  };
}

function computeDelta(beforePlanning, rendered, kind) {
  const start = kind === 'APOS_LPOS' ? pointDistance(beforePlanning.startMm, rendered.startMm) : 0;
  const end = kind === 'APOS_LPOS' ? pointDistance(beforePlanning.endMm, rendered.endMm) : 0;
  const pos = kind !== 'APOS_LPOS' && kind !== 'NONE' ? pointDistance(beforePlanning.posMm, rendered.posMm) : 0;
  return { start: round(start), end: round(end), pos: round(pos), max: round(Math.max(start, end, pos)) };
}

function buildEndpointNodeIndex(records) {
  const map = new Map();
  const add = (nodeId, point, otherPoint, record) => {
    if (!nodeId || !point || !otherPoint || isSupportLike(record)) return;
    if (!map.has(nodeId)) map.set(nodeId, []);
    map.get(nodeId).push({ nodeId, point, otherPoint, record });
  };
  for (const record of records) {
    if (!record.source.apos || !record.source.lpos) continue;
    add(record.fromNode, record.source.apos, record.source.lpos, record);
    add(record.toNode, record.source.lpos, record.source.apos, record);
  }
  return map;
}

function collectStagedRecords(json) {
  const roots = Array.isArray(json?.hierarchy) ? json.hierarchy : [json].filter(Boolean);
  const records = [];
  const walk = (node, parentPath = '') => {
    if (!node || typeof node !== 'object') return;
    const attrs = attrsOf(node);
    const rawName = String(node.name || attrs.NAME || node.id || 'Node').trim() || 'Node';
    const name = String(attrs.NAME || rawName).trim() || rawName;
    const path = parentPath ? `${parentPath}/${rawName}` : rawName;
    const type = String(node.type || attrs.TYPE || 'UNKNOWN').trim() || 'UNKNOWN';
    const dtxr = String(attrs.DTXR || attrs.RAW_TYPE || type || 'UNKNOWN').trim() || 'UNKNOWN';
    const source = collectSourcePoints(node);
    records.push({
      node,
      attrs,
      rawName,
      name,
      path,
      type,
      rawType: String(attrs.RAW_TYPE || type || ''),
      dtxr,
      fromNode: String(attrs.FROM_NODE || ''),
      toNode: String(attrs.TO_NODE || ''),
      source
    });
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child, path);
  };
  for (const root of roots) walk(root, '');
  return records;
}

function collectSourcePoints(node) {
  const apos = pickPoint(node, ['APOS', 'A_POS', 'HPOS', 'H_POS', 'START', 'EP1', 'ABOP']);
  const lpos = pickPoint(node, ['LPOS', 'L_POS', 'TPOS', 'T_POS', 'END', 'EP2', 'LBOP']);
  const pos = pickPoint(node, ['POS', 'CPOS', 'CO_ORDS', 'COORDS', 'CO_ORD']);
  const bpos = pickPoint(node, ['BPOS', 'BRANCH_POINT', 'BRANCH1_POINT', 'BPOS1', 'BP']);
  const hpos = pickPoint(node, ['HPOS', 'H_POS']);
  const tpos = pickPoint(node, ['TPOS', 'T_POS']);
  const supportCoord = pickPoint(node, ['SUPPORTCOORD', 'SUPPORT_COORD', 'SCOORD', 'SUPPORT_POINT', 'SUPPORT_POS']);
  return {
    apos,
    lpos,
    pos,
    bpos,
    hpos,
    tpos,
    supportCoord,
    start: apos || hpos,
    end: lpos || tpos
  };
}

function sourcePointKind(record) {
  if (record.source.supportCoord) return 'SUPPORTCOORD';
  if (record.source.pos) return 'POS';
  if (record.source.bpos) return 'BPOS';
  if (record.source.apos) return 'APOS';
  if (record.source.lpos) return 'LPOS';
  return 'NONE';
}

function colorForRecord(record) {
  const normalized = normalizeType(record.type, record.dtxr);
  return PREVIEW_COLORS[normalized] || PREVIEW_COLORS[record.type] || PREVIEW_COLORS.UNKNOWN;
}

function radiusForRecord(record, radius) {
  const diameter = parseMm(record.attrs.DIAMETER || record.attrs.BORE || record.attrs.ABORE || record.attrs.LBORE || record.attrs.HBOR || record.attrs.TBOR);
  if (Number.isFinite(diameter) && diameter > 0) return Math.max(diameter * 0.5, 2);
  return radius;
}

function normalizeType(type, dtxr = '') {
  const raw = String(type || dtxr || '').toUpperCase().trim();
  if (raw === 'VALV') return 'VALVE';
  if (raw === 'FLAN') return 'FLANGE';
  if (raw === 'ELBO') return 'ELBOW';
  if (raw === 'ANCI' || raw === 'ATTA' || raw === 'SUPP') return 'SUPPORT';
  if (!raw) return 'UNKNOWN';
  return raw;
}

function isBendLike(record) {
  return String(record.dtxr || record.type || '').toUpperCase() === 'BEND'
    || String(record.type || '').toUpperCase() === 'ELBO'
    || String(record.type || '').toUpperCase() === 'ELBOW';
}

function isSupportLike(record) {
  const type = String(record.type || '').toUpperCase();
  const dtxr = String(record.dtxr || '').toUpperCase();
  return SUPPORT_TYPES.has(type) || SUPPORT_TYPES.has(dtxr);
}

function isExportableRecord(record) {
  if (isSupportLike(record)) return false;
  if (!record.source.start || !record.source.end) return false;
  return EXPORTABLE_DTXR.has(String(record.dtxr || '').toUpperCase());
}

function countExportPrimitives(exportModel) {
  let count = 0;
  const visit = (node) => {
    if (!node) return;
    count += Array.isArray(node.primitives) ? node.primitives.length : 0;
    for (const child of Array.isArray(node.children) ? node.children : []) visit(child);
  };
  visit(exportModel?.root);
  return count;
}

function attrsOf(node) {
  return node && typeof node === 'object' && node.attributes && typeof node.attributes === 'object' ? node.attributes : {};
}

function pickPoint(node, keys) {
  const attrs = attrsOf(node);
  for (const key of keys) {
    const value = attrs[key] ?? attrs[key.toLowerCase?.()] ?? node?.[key] ?? node?.[key.toLowerCase?.()];
    const point = pointFrom(value);
    if (point) return point;
  }
  return null;
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

function parseManagedStageJson(sourceTextOrJson) {
  if (typeof sourceTextOrJson === 'string') return JSON.parse(sourceTextOrJson);
  if (sourceTextOrJson && typeof sourceTextOrJson === 'object') return sourceTextOrJson;
  throw new Error('Managed-stage preview expects JSON text or object');
}

function parseMm(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseFloat(String(value).replace(/mm\b/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function asNumber(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/mm\b/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function toVec(point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function clonePoint(point) {
  return point ? { x: point.x, y: point.y, z: point.z } : null;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5, z: (a.z + b.z) * 0.5 };
}

function pointDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Number(value).toFixed(9));
}

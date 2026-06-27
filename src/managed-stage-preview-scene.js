import * as THREE from 'three';
import { cylinderBetween, mat } from './geometry.js?v=bust-cache-4';
import { createManagedStageSupportPreviewObject, MANAGED_STAGE_SUPPORT_VISUAL_POLICY } from './managed-stage-support-visual-resolver.js?v=bust-cache-4';

const PREVIEW_SCHEMA = 'ManagedStageRawPreview.v1';
const COORDINATE_AUDIT_SCHEMA = 'ManagedStageCoordinateAudit.v1';
const EPS_MM = 0.001;
const MAX_BRANCH_CUE_LEGS = 4;
const ORTHOGONAL_DOT_TOLERANCE = 0.125;
const ELBOW_RADIUS_DIAMETER_MULTIPLIER = 1.5;
const ELBOW_ARC_SEGMENTS = 24;

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
  const elbowPlan = createOrthogonalElbowPreviewPlan(endpointIndex, sourceRadius);
  const supportOptions = { records, pointRadius, fallbackRadius: sourceRadius, processedNodes: new Map() };

  for (const record of records) {
    const trimInfo = elbowPlan.trimsByPath.get(record.path);
    const meshInfo = createRecordPreviewObject(record, sourceRadius, pointRadius, trimInfo, supportOptions);
    if (meshInfo.object) root.add(meshInfo.object);
    renderRows.push(createAuditRow(record, meshInfo, trimInfo));
  }

  for (const elbow of elbowPlan.elbows) {
    const cue = createOrthogonalElbowCue(elbow);
    if (cue) root.add(cue);
  }

  const branchCueCount = addBranchTopologyCues(root, endpointIndex, sourceRadius);
  const trimmedRows = renderRows.filter((row) => row.intentionalPreviewTrim);
  const audit = auditManagedStagePreviewCoordinatePreservation(renderRows, {
    schema: COORDINATE_AUDIT_SCHEMA,
    source: 'raw staged JSON APOS/LPOS/POS/BPOS/SUPPORTCOORD',
    planningPipeline: 'raw-staged-preview-with-local-orthogonal-elbow-trim-and-record-scoped-support-symbols',
    recordCount: records.length,
    branchCueCount,
    bendCueCount: elbowPlan.elbows.length,
    orthogonalElbowCount: elbowPlan.elbows.length,
    trimmedSourceLineCount: trimmedRows.length,
    trimmedNonBendSourceLineCount: trimmedRows.filter((row) => !row.isBend).length,
    elbowRadiusPolicy: '90-degree continuous two-record joins use centerline bend radius = 1.5D; adjacent preview cylinders are trimmed locally by the tangent distance',
    supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY,
    supportVisualCounts: countSupportVisualRows(renderRows),
    supportPopupRequiredCount: renderRows.filter((row) => row.supportVisual?.popupRequired).length,
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
    managedStageVisibleFallback: {
      schema: 'ManagedStageVisibleFallback.v1',
      candidateCount: records.length,
      meshCount: 0,
      skippedReason: 'native raw managed-stage preview scene already applied'
    }
  };
  scene.add(root);

  if (typeof window !== 'undefined' && window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__) {
    window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__.activeArtifact = {
      sourceName,
      previewScene: scene,
      previewCoordinateAudit: audit
    };
  }

  return scene;
}

export function auditManagedStagePreviewCoordinatePreservation(rows = [], base = {}) {
  const sourceLineRows = rows.filter((row) => row.sourceCoordinateKind === 'APOS_LPOS');
  const sourcePointRows = rows.filter((row) => row.sourceCoordinateKind !== 'APOS_LPOS' && row.sourceCoordinateKind !== 'NONE');
  const nonBendSourceLineRows = sourceLineRows.filter((row) => !row.isBend);
  const unexplainedNonBendRows = nonBendSourceLineRows.filter((row) => row.deltaMm?.max > EPS_MM && !row.intentionalPreviewTrim);
  const unexplainedRows = rows.filter((row) => row.deltaMm?.max > EPS_MM && !row.intentionalPreviewTrim);
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
    mutatedRowCount: unexplainedRows.length,
    mutatedNonBendRowCount: unexplainedNonBendRows.length,
    intentionalPreviewTrimRowCount: rows.filter((row) => row.intentionalPreviewTrim).length,
    maxDeltaMm: round(Math.max(0, ...rows.map((row) => row.deltaMm?.max || 0))),
    maxNonBendDeltaMm: round(Math.max(0, ...nonBendSourceLineRows.map((row) => row.deltaMm?.max || 0))),
    maxUnexplainedNonBendDeltaMm: round(Math.max(0, ...unexplainedNonBendRows.map((row) => row.deltaMm?.max || 0))),
    pass: unexplainedNonBendRows.length === 0,
    rows
  };
}

export function assertManagedStagePreviewCoordinatePreservation(audit) {
  if (!audit || audit.schema !== COORDINATE_AUDIT_SCHEMA) throw new Error('Invalid managed-stage coordinate audit');
  if (audit.mutatedNonBendRowCount > 0) {
    const offenders = audit.rows
      .filter((row) => row.deltaMm?.max > EPS_MM && !row.isBend && row.sourceCoordinateKind === 'APOS_LPOS' && !row.intentionalPreviewTrim)
      .map((row) => `${row.name}: ${row.deltaMm.max}mm (${row.deltaReason || 'coordinate drift'})`)
      .join('; ');
    throw new Error(`Managed-stage preview moved non-bend source records above tolerance without an intentional elbow-trim policy: ${offenders}`);
  }
  return { ok: true, maxUnexplainedNonBendDeltaMm: audit.maxUnexplainedNonBendDeltaMm, rowCount: audit.rowCount };
}

function createRecordPreviewObject(record, radius, pointRadius, trimInfo = null, supportOptions = { records: [] }) {
  const records = supportOptions.records || [];
  if (record.source.start && record.source.end && pointDistance(record.source.start, record.source.end) > EPS_MM) {
    const originalStart = record.source.start;
    const originalEnd = record.source.end;
    const rendered = applyOrthogonalElbowTrim(originalStart, originalEnd, trimInfo);
    const start = toVec(rendered.start);
    const end = toVec(rendered.end);
    const mesh = cylinderBetween(start, end, radiusForRecord(record, radius), mat(colorForRecord(record)), 18, record.path);
    stampSourceUserData(mesh, record, {
      primitiveKind: 'raw-staged-source-line',
      previewSourceGeometry: 'APOS_LPOS',
      sourceStartMm: clonePoint(originalStart),
      sourceEndMm: clonePoint(originalEnd),
      sourcePosMm: clonePoint(record.source.pos || record.source.bpos),
      previewStartMm: clonePoint(rendered.start),
      previewEndMm: clonePoint(rendered.end),
      previewOnly: isSupportLike(record),
      exportedRvmGeometry: false,
      previewTrimmedForOrthogonalElbow: rendered.trimmed,
      previewTrim: rendered.trimmed ? cloneTrimInfo(trimInfo) : null,
      coordinatePolicy: rendered.trimmed
        ? 'source APOS/LPOS preserved; visible cylinder endpoint locally trimmed for a 1.5D orthogonal elbow cue'
        : 'raw staged APOS/LPOS/POS coordinates preserved'
    });
    return {
      object: mesh,
      renderedStart: clonePoint(rendered.start),
      renderedEnd: clonePoint(rendered.end),
      renderedPos: null,
      intentionalPreviewTrim: rendered.trimmed,
      previewTrim: rendered.trimmed ? cloneTrimInfo(trimInfo) : null,
      supportVisual: null
    };
  }

  const pos = record.source.pos || record.source.bpos || record.source.supportCoord || record.source.apos || record.source.lpos;
  if (!pos) return { object: null, renderedStart: null, renderedEnd: null, renderedPos: null, intentionalPreviewTrim: false, previewTrim: null, supportVisual: null };

  if (isSupportLike(record)) {
    const supportPreview = createManagedStageSupportPreviewObject(record, supportOptions);
    if (supportPreview?.object) {
      stampSourceUserData(supportPreview.object, record, {
        primitiveKind: 'managed-stage-support-symbol',
        previewSourceGeometry: sourcePointKind(record),
        previewPosMm: clonePoint(pos),
        previewOnly: true,
        exportedRvmGeometry: false,
        managedStageSupportVisual: true,
        supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
        supportVisual: supportPreview.supportVisual,
        popupRequired: Boolean(supportPreview.supportVisual?.popupRequired),
        coordinatePolicy: 'record-scoped staged support visual resolver; source support coordinate preserved; support symbol excluded from RVM export'
      });
      return { object: supportPreview.object, renderedStart: null, renderedEnd: null, renderedPos: clonePoint(pos), intentionalPreviewTrim: false, previewTrim: null, supportVisual: supportPreview.supportVisual };
    }
  }

  const geometry = new THREE.SphereGeometry(pointRadius, 14, 10);
  const mesh = new THREE.Mesh(geometry, mat(colorForRecord(record)));
  mesh.name = record.path;
  mesh.position.copy(toVec(pos));
  stampSourceUserData(mesh, record, {
    primitiveKind: 'raw-staged-source-point',
    previewSourceGeometry: sourcePointKind(record),
    previewPosMm: clonePoint(pos),
    previewOnly: true,
    exportedRvmGeometry: false
  });
  return { object: mesh, renderedStart: null, renderedEnd: null, renderedPos: clonePoint(pos), intentionalPreviewTrim: false, previewTrim: null, supportVisual: null };
}

function stampSourceUserData(object, record, extra = {}) {
  object.userData = {
    ...(object.userData || {}),
    TYPE: isSupportLike(record) ? 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW' : 'MANAGED_STAGE_RAW_PREVIEW',
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

function createOrthogonalElbowPreviewPlan(endpointIndex, fallbackRadius) {
  const trimsByPath = new Map();
  const elbows = [];
  for (const [nodeId, entries] of endpointIndex.entries()) {
    if (entries.length !== 2) continue;
    const [a, b] = entries;
    if (!a?.point || !a?.otherPoint || !b?.point || !b?.otherPoint) continue;
    if (!isLineRecord(a.record) || !isLineRecord(b.record)) continue;

    const node = toVec(a.point);
    const dirA = toVec(a.otherPoint).sub(node);
    const dirB = toVec(b.otherPoint).sub(node);
    const lenA = dirA.length();
    const lenB = dirB.length();
    if (!(lenA > EPS_MM) || !(lenB > EPS_MM)) continue;
    dirA.normalize();
    dirB.normalize();
    const dot = dirA.dot(dirB);
    if (Math.abs(dot) > ORTHOGONAL_DOT_TOLERANCE) continue;

    const pipeRadius = Math.max(Math.min(radiusForRecord(a.record, fallbackRadius), radiusForRecord(b.record, fallbackRadius)), 2);
    const requestedTrim = pipeRadius * 2 * ELBOW_RADIUS_DIAMETER_MULTIPLIER;
    const trimDistance = Math.min(requestedTrim, lenA * 0.45, lenB * 0.45);
    if (!(trimDistance > EPS_MM)) continue;

    const elbow = {
      nodeId,
      nodePoint: clonePoint(a.point),
      recordA: a.record.name,
      recordB: b.record.name,
      recordPathA: a.record.path,
      recordPathB: b.record.path,
      endpointKindA: a.endpointKind,
      endpointKindB: b.endpointKind,
      directionA: vecToPoint(dirA),
      directionB: vecToPoint(dirB),
      tangentA: vecToPoint(node.clone().add(dirA.clone().multiplyScalar(trimDistance))),
      tangentB: vecToPoint(node.clone().add(dirB.clone().multiplyScalar(trimDistance))),
      pipeRadiusMm: round(pipeRadius),
      diameterMm: round(pipeRadius * 2),
      centerlineRadiusMm: round(trimDistance),
      requestedCenterlineRadiusMm: round(requestedTrim),
      radiusPolicy: '1.5D centerline elbow radius, clamped to 45% of each adjacent segment for preview safety',
      angleDeg: round(THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, dot)))))
    };
    elbows.push(elbow);
    registerTrim(trimsByPath, a.record.path, a.endpointKind, trimDistance, nodeId, elbow);
    registerTrim(trimsByPath, b.record.path, b.endpointKind, trimDistance, nodeId, elbow);
  }
  return { trimsByPath, elbows };
}

function registerTrim(map, path, endpointKind, distanceMm, nodeId, elbow) {
  if (!path || !endpointKind) return;
  if (!map.has(path)) map.set(path, { startTrimMm: 0, endTrimMm: 0, nodes: [], elbows: [] });
  const trim = map.get(path);
  if (endpointKind === 'start') trim.startTrimMm = Math.max(trim.startTrimMm || 0, distanceMm);
  else if (endpointKind === 'end') trim.endTrimMm = Math.max(trim.endTrimMm || 0, distanceMm);
  trim.nodes.push({ nodeId, endpointKind, distanceMm: round(distanceMm) });
  trim.elbows.push(elbow);
}

function applyOrthogonalElbowTrim(startPoint, endPoint, trimInfo) {
  if (!trimInfo) return { start: clonePoint(startPoint), end: clonePoint(endPoint), trimmed: false };
  const start = toVec(startPoint);
  const end = toVec(endPoint);
  const span = end.clone().sub(start);
  const length = span.length();
  if (!(length > EPS_MM)) return { start: clonePoint(startPoint), end: clonePoint(endPoint), trimmed: false };
  const dir = span.clone().normalize();
  let startTrim = Number(trimInfo.startTrimMm || 0);
  let endTrim = Number(trimInfo.endTrimMm || 0);
  if (startTrim + endTrim >= length - EPS_MM) {
    const scale = Math.max((length * 0.9) / Math.max(startTrim + endTrim, EPS_MM), 0);
    startTrim *= scale;
    endTrim *= scale;
  }
  const renderedStart = start.clone().add(dir.clone().multiplyScalar(startTrim));
  const renderedEnd = end.clone().add(dir.clone().multiplyScalar(-endTrim));
  const trimmed = startTrim > EPS_MM || endTrim > EPS_MM;
  return { start: vecToPoint(renderedStart), end: vecToPoint(renderedEnd), trimmed };
}

function createOrthogonalElbowCue(elbow) {
  if (!elbow) return null;
  const points = sampleOrthogonalElbowArc(elbow);
  if (points.length < 3) return null;
  const material = mat(PREVIEW_COLORS.BEND, { transparent: true, opacity: 0.9 });
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, ELBOW_ARC_SEGMENTS, Math.max(elbow.pipeRadiusMm, 2), 14, false), material);
  tube.name = `MANAGED_STAGE_1_5D_ELBOW_NODE_${elbow.nodeId}`;
  tube.userData = {
    TYPE: 'MANAGED_STAGE_PREVIEW_CUE',
    cueKind: 'bend',
    previewAdditiveCue: true,
    previewOnly: true,
    exportedRvmGeometry: false,
    node: elbow.nodeId,
    sourceRecordA: elbow.recordA,
    sourceRecordB: elbow.recordB,
    sourcePathA: elbow.recordPathA,
    sourcePathB: elbow.recordPathB,
    tangentA: clonePoint(elbow.tangentA),
    tangentB: clonePoint(elbow.tangentB),
    pipeRadiusMm: elbow.pipeRadiusMm,
    diameterMm: elbow.diameterMm,
    centerlineRadiusMm: elbow.centerlineRadiusMm,
    angleDeg: elbow.angleDeg,
    coordinatePolicy: 'additive 1.5D orthogonal elbow preview cue; adjacent visible straight cylinders are locally trimmed; source APOS/LPOS remains unchanged'
  };
  return tube;
}

function sampleOrthogonalElbowArc(elbow) {
  const corner = toVec(elbow.nodePoint);
  const dirA = toVec(elbow.directionA).normalize();
  const dirB = toVec(elbow.directionB).normalize();
  const radius = Number(elbow.centerlineRadiusMm || 0);
  if (!(radius > EPS_MM)) return [];
  const center = corner.clone().add(dirA.clone().multiplyScalar(radius)).add(dirB.clone().multiplyScalar(radius));
  const points = [];
  for (let i = 0; i <= ELBOW_ARC_SEGMENTS; i += 1) {
    const theta = (Math.PI * 0.5 * i) / ELBOW_ARC_SEGMENTS;
    points.push(center.clone()
      .add(dirB.clone().multiplyScalar(-radius * Math.cos(theta)))
      .add(dirA.clone().multiplyScalar(-radius * Math.sin(theta))));
  }
  return points;
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

function createAuditRow(record, meshInfo, trimInfo = null) {
  const sourceCoordinateKind = record.source.start && record.source.end ? 'APOS_LPOS' : sourcePointKind(record);
  const beforePlanning = {
    startMm: clonePoint(record.source.start),
    endMm: clonePoint(record.source.end),
    posMm: clonePoint(record.source.pos || record.source.bpos || record.source.supportCoord || record.source.apos || record.source.lpos)
  };
  const afterPlanning = {
    ...beforePlanning,
    policy: meshInfo.intentionalPreviewTrim
      ? 'source coordinates unchanged; local 1.5D elbow trim applied only to rendered preview mesh'
      : 'unchanged for raw preview pipeline',
    previewTrim: meshInfo.intentionalPreviewTrim ? cloneTrimInfo(trimInfo) : null,
    supportVisual: meshInfo.supportVisual || null
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
    supportVisual: meshInfo.supportVisual || null,
    isBend: isBendLike(record),
    intentionalPreviewTrim: Boolean(meshInfo.intentionalPreviewTrim),
    previewTrim: meshInfo.intentionalPreviewTrim ? cloneTrimInfo(trimInfo) : null,
    deltaMm,
    deltaReason: deltaMm.max > EPS_MM
      ? (meshInfo.intentionalPreviewTrim ? 'orthogonal 1.5D elbow preview trim; source coordinates preserved' : 'raw preview coordinate drift')
      : ''
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
  const add = (nodeId, point, otherPoint, record, endpointKind) => {
    if (!nodeId || !point || !otherPoint || isSupportLike(record)) return;
    if (!map.has(nodeId)) map.set(nodeId, []);
    map.get(nodeId).push({ nodeId, point, otherPoint, record, endpointKind });
  };
  for (const record of records) {
    if (!record.source.apos || !record.source.lpos) continue;
    add(record.fromNode, record.source.apos, record.source.lpos, record, 'start');
    add(record.toNode, record.source.lpos, record.source.apos, record, 'end');
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

function countSupportVisualRows(rows) {
  const counts = { total: 0, REST: 0, GUIDE: 0, LINE_STOP: 0, LIMIT_STOP: 0, HOLDDOWN: 0, SPRING_CAN: 0, SINGLE_AXIS_WARNING: 0, UNKNOWN_RESTRAINT: 0 };
  for (const row of rows || []) {
    const family = row.supportVisual?.family;
    if (!family) continue;
    counts.total += 1;
    counts[family] = (counts[family] || 0) + 1;
  }
  return counts;
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

function isLineRecord(record) {
  return Boolean(record?.source?.apos && record?.source?.lpos) && !isSupportLike(record);
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

function vecToPoint(vec) {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function clonePoint(point) {
  return point ? { x: point.x, y: point.y, z: point.z } : null;
}

function cloneTrimInfo(trimInfo) {
  if (!trimInfo) return null;
  return {
    startTrimMm: round(trimInfo.startTrimMm || 0),
    endTrimMm: round(trimInfo.endTrimMm || 0),
    nodes: Array.isArray(trimInfo.nodes) ? trimInfo.nodes.map((node) => ({ ...node })) : []
  };
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

import * as THREE from 'three';
import { createSpringCoil, createWarningTriangle, cylinderBetween, mat } from './geometry.js?v=professional-viewer-3';

const EPS_MM = 0.001;
const DEFAULT_SUPPORT_COLORS = Object.freeze({
  REST: 0xf8c34a,
  GUIDE: 0x18d5c0,
  LINE_STOP: 0xf2a93b,
  LIMIT_STOP: 0xf2a93b,
  HOLDDOWN: 0xf05ab9,
  SPRING_CAN: 0xd273ff,
  WARNING: 0xff8c73,
  FALLBACK: 0xb8c7d9
});

const SUPPORT_TYPES = new Set(['ATTA', 'ANCI', 'SUPP', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT']);
const AXIAL_FAMILIES = new Set(['LINE_STOP', 'LIMIT_STOP']);

export const MANAGED_STAGE_SUPPORT_VISUAL_POLICY = Object.freeze({
  schema: 'ManagedStageSupportVisualResolver.v1',
  rules: [
    'REST = +Y upward point cone',
    'HOLDDOWN = +/-Y double vertical point cones',
    'GUIDE = lateral point cones selected from pipe orientation: X pipe -> +/-Z; Z pipe -> +/-X; vertical pipe -> +/-X and +/-Z',
    'LINE STOP / LIMIT / LIM = axial point cones pointing to center as +/- pair unless explicit sign exists',
    'single-axis restraints without +/- are warning markers with popupRequired=true',
    'Can Spring / Spring Can = warning coil below pipe',
    'gap is record-scoped; no carry-forward attribute is used',
    'axial restraint tips touch unless gap is positive; positive gap creates 10x gap visual separation',
    'ODx2/3 resolver is applied only to final axial/pipe-parallel symbols',
    'known supports sharing the same staged node/POS are spread by a local support-cluster resolver',
    'unknown support fallback = translucent crossed X rods, never solid cube/block fallback'
  ]
});

export function createManagedStageSupportPreviewObject(record, options = {}) {
  const pos = record?.source?.supportCoord || record?.source?.pos || record?.source?.bpos || record?.source?.apos || record?.source?.lpos;
  if (!pos) return null;
  const visual = resolveManagedStageSupportVisual(record, options.records || [], options);
  const group = new THREE.Group();
  group.name = `MANAGED_STAGE_SUPPORT_${safeName(record?.name || record?.rawName || 'SUPPORT')}`;
  const sourceCenter = toVec(pos);
  const visualCenter = sourceCenter.clone().add(toVec(visual.cluster?.offsetMm));
  const odMm = Math.max(visual.pipeDiameterMm || options.pointRadius * 2 || 40, 1);
  const genericLength = clamp(odMm * 1.2, 60, 220);
  const axialLength = clamp(odMm * (2 / 3), 45, 180);
  const coneRadius = clamp(odMm * 0.25, 7, Math.max(genericLength * 0.34, 8));
  const warningScale = Math.max(Math.min(genericLength / 80, 2.6), 0.8);
  const material = mat(colorForFamily(visual.family), { transparent: true, opacity: 0.9 });

  const connector = createClusterConnector(sourceCenter, visualCenter, odMm, visual, `${group.name}_CLUSTER_OFFSET_CONNECTOR`);
  if (connector) group.add(connector);

  if (visual.family === 'SPRING_CAN') {
    const length = Math.max(odMm * 1.35, genericLength);
    const coil = createSpringCoil(
      visualCenter.clone().add(new THREE.Vector3(0, -length * 0.62, 0)),
      new THREE.Vector3(0, 1, 0),
      Math.max(odMm * 0.22, 8),
      length,
      mat(DEFAULT_SUPPORT_COLORS.SPRING_CAN, { transparent: true, opacity: 0.9 }),
      `${group.name}_WARNING_COIL_BELOW_PIPE`
    );
    stampPart(coil, visual, { role: 'warningCoilBelowPipe', popupRequired: true, visualCenterMm: vecToPoint(visualCenter) });
    group.add(coil);
  } else if (visual.fallbackCrossRods) {
    const rods = createFallbackCrossRods(
      visualCenter,
      Math.max(odMm * 1.5, genericLength),
      Math.max(odMm * 0.055, 3),
      mat(DEFAULT_SUPPORT_COLORS.FALLBACK, { transparent: true, opacity: 0.35 }),
      `${group.name}_FALLBACK_X_RODS`,
      visual
    );
    for (const rod of rods) group.add(rod);
  } else if (visual.popupRequired) {
    const warning = createWarningTriangle('!', warningScale);
    warning.name = `${group.name}_POPUP_REQUIRED`;
    warning.position.copy(visualCenter).add(new THREE.Vector3(0, genericLength * 0.75, 0));
    stampPart(warning, visual, { role: 'popupRequired', popupRequired: true, visualCenterMm: vecToPoint(visualCenter) });
    group.add(warning);
  } else {
    const tipSeparation = visual.gapMm > 0 && AXIAL_FAMILIES.has(visual.family) ? visual.gapMm * 10 : 0;
    for (const side of visual.coneSides) {
      const sideVec = axisVector(side.axis);
      const length = side.axialPipeParallel ? axialLength : genericLength;
      const gapFactor = side.explicitSingle ? 1 : 0.5;
      const tipOffset = AXIAL_FAMILIES.has(visual.family) ? sideVec.clone().multiplyScalar(tipSeparation * gapFactor) : new THREE.Vector3();
      const tip = visualCenter.clone().add(tipOffset);
      const towardTip = side.pointsTowardCenter ? sideVec.clone().multiplyScalar(-1) : sideVec;
      const cone = createPointCone(tip, towardTip, length, coneRadius, material, `${group.name}_${side.role}_${side.axis}`);
      stampPart(cone, visual, {
        role: side.role,
        axis: side.axis,
        axialPipeParallel: Boolean(side.axialPipeParallel),
        explicitSingle: Boolean(side.explicitSingle),
        tipMm: vecToPoint(tip),
        sourceTipMm: vecToPoint(sourceCenter),
        visualCenterMm: vecToPoint(visualCenter),
        pointsTowardCenter: side.pointsTowardCenter !== false,
        odTwoThirdsResolverApplied: Boolean(side.axialPipeParallel)
      });
      group.add(cone);
    }
  }

  group.userData = {
    TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
    primitiveKind: 'managed-stage-support-symbol',
    supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    managedStageSupportVisual: true,
    supportVisual: visual,
    supportCluster: visual.cluster,
    previewOnly: true,
    exportedRvmGeometry: false,
    popupRequired: Boolean(visual.popupRequired),
    coordinatePolicy: 'record-scoped staged support visual resolver; source POS/SUPPORTCOORD preserved; support symbol excluded from RVM export'
  };
  return { object: group, supportVisual: visual };
}

export function resolveManagedStageSupportVisual(record, records = [], options = {}) {
  const attrs = record?.attrs || {};
  const rawKind = firstText(
    attrs.SUPPORT_KIND,
    attrs.RESTRAINT_KIND,
    attrs.RESTRAINT,
    attrs.RESTYPE,
    attrs.SUPPORT_TYPE,
    attrs.TYPE_CODE,
    attrs.DIRECTION,
    attrs.AXIS,
    attrs.NAME,
    record?.name,
    record?.rawName
  );
  const explicitAxis = explicitAxisFrom(attrs.AXIS, attrs.DIRECTION, attrs.RESTRAINT_AXIS, attrs.RESTRAINT, attrs.SUPPORT_KIND, rawKind);
  const family = normalizeSupportFamily(rawKind, explicitAxis);
  const gapMm = parseRecordGapMm(attrs);
  const pipeContext = resolvePipeContext(record, records);
  const pipeAxis = dominantAxis(pipeContext.direction);
  const pipeAxisSigned = signedDominantAxis(pipeContext.direction);
  const pipeDiameterMm = pipeContext.diameterMm || parseDiameter(record) || Math.max(options.pointRadius * 2 || 0, 0);
  const cluster = resolveSupportCluster(record, records, pipeContext.direction, pipeDiameterMm);

  let coneSides = [];
  let popupRequired = false;
  let popupReason = '';
  let fallbackCrossRods = false;

  if (family === 'REST') {
    coneSides = [{ role: 'rest-upward-point-cone', axis: '+Y', pointsTowardCenter: false }];
  } else if (family === 'HOLDDOWN') {
    coneSides = [
      { role: 'holddown-bottom-point-cone', axis: '+Y', pointsTowardCenter: false },
      { role: 'holddown-top-point-cone', axis: '-Y', pointsTowardCenter: false }
    ];
  } else if (family === 'GUIDE') {
    coneSides = guideAxesForPipeAxis(pipeAxis).map((axis) => ({ role: 'guide-lateral-point-cone', axis, pointsTowardCenter: true }));
  } else if (family === 'LINE_STOP' || family === 'LIMIT_STOP') {
    const explicitSingle = Boolean(explicitAxis?.hasSign);
    const axialSides = explicitSingle
      ? [axisWithSign(explicitAxis)]
      : [pipeAxisSigned, invertAxis(pipeAxisSigned)];
    coneSides = axialSides.map((axis) => ({
      role: family === 'LIMIT_STOP' ? 'limit-axial-point-cone' : 'line-stop-axial-point-cone',
      axis,
      pointsTowardCenter: true,
      axialPipeParallel: true,
      explicitSingle
    }));
  } else if (family === 'SINGLE_AXIS_WARNING') {
    popupRequired = true;
    popupReason = 'single-axis restraint is missing explicit +/- sign';
  } else if (family === 'SPRING_CAN') {
    popupRequired = true;
    popupReason = 'spring can requires engineering resolution; warning coil below pipe only';
  } else {
    fallbackCrossRods = true;
    popupReason = 'unknown staged support restraint mapping; rendered as translucent crossed X rods fallback';
  }

  return {
    schema: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    rawKind,
    family,
    node: String(attrs.NODE || record?.fromNode || record?.toNode || ''),
    pipeAxis,
    pipeAxisSigned,
    pipeDirection: vecToPoint(pipeContext.direction),
    pipeDiameterMm: round(pipeDiameterMm),
    sourcePipeRecord: pipeContext.record?.name || '',
    sourcePipePath: pipeContext.record?.path || '',
    coneSides,
    coneCount: coneSides.length,
    explicitAxis: explicitAxis ? { ...explicitAxis } : null,
    explicitSignApplied: Boolean(explicitAxis?.hasSign && AXIAL_FAMILIES.has(family)),
    popupRequired,
    popupReason,
    fallbackCrossRods,
    cluster,
    gapMm: round(gapMm),
    gapSource: gapMm > 0 ? 'record' : 'none',
    gapRecordScoped: true,
    gapCarryForward: false,
    gapVisualSeparationMm: AXIAL_FAMILIES.has(family) && gapMm > 0 ? round(gapMm * 10) : 0,
    axialNoOdHalfRadialContact: AXIAL_FAMILIES.has(family),
    axialTipsTouchUnlessGap: AXIAL_FAMILIES.has(family),
    axialPipeParallelResolver: AXIAL_FAMILIES.has(family) ? 'ODx2/3 applies only to final axial/pipe-parallel support symbols' : 'not-applicable'
  };
}

function createPointCone(tip, dirTowardTip, length, radius, material, name) {
  const d = dirTowardTip.clone();
  if (d.lengthSq() <= EPS_MM) d.set(0, 1, 0);
  d.normalize();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 24), material);
  cone.name = name;
  cone.position.copy(tip).add(d.clone().multiplyScalar(-length / 2));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  return cone;
}

function createClusterConnector(sourceCenter, visualCenter, odMm, visual, name) {
  if (!sourceCenter || !visualCenter || sourceCenter.distanceTo(visualCenter) <= EPS_MM) return null;
  const rod = cylinderBetween(
    sourceCenter,
    visualCenter,
    Math.max(odMm * 0.035, 2),
    mat(DEFAULT_SUPPORT_COLORS.FALLBACK, { transparent: true, opacity: 0.28 }),
    8,
    name
  );
  stampPart(rod, visual, {
    role: 'clusterOffsetConnector',
    sourceTipMm: vecToPoint(sourceCenter),
    visualCenterMm: vecToPoint(visualCenter),
    clusterOffsetConnector: true
  });
  return rod;
}

function createFallbackCrossRods(center, length, radius, material, name, visual) {
  const half = length / 2;
  const diagonals = [
    [new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, half)],
    [new THREE.Vector3(-half, 0, half), new THREE.Vector3(half, 0, -half)]
  ];
  return diagonals.map(([a, b], index) => {
    const rod = cylinderBetween(center.clone().add(a), center.clone().add(b), radius, material, 10, `${name}_${index + 1}`);
    stampPart(rod, visual, {
      role: 'fallbackCrossRod',
      fallbackCrossRod: true,
      visualCenterMm: vecToPoint(center)
    });
    return rod;
  });
}

function stampPart(object, visual, extra = {}) {
  object.userData = {
    ...(object.userData || {}),
    TYPE: 'MANAGED_STAGE_SUPPORT_VISUAL_PART',
    supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    managedStageSupportVisualPart: true,
    supportFamily: visual.family,
    supportRawKind: visual.rawKind,
    previewOnly: true,
    exportedRvmGeometry: false,
    popupRequired: Boolean(visual.popupRequired),
    fallbackCrossRods: Boolean(visual.fallbackCrossRods),
    supportCluster: visual.cluster,
    gapMm: visual.gapMm,
    gapRecordScoped: true,
    gapCarryForward: false,
    ...extra
  };
}

function resolvePipeContext(record, records) {
  const supportPos = record?.source?.supportCoord || record?.source?.pos || record?.source?.bpos || record?.source?.apos || record?.source?.lpos;
  const node = String(record?.attrs?.NODE || record?.fromNode || record?.toNode || '').trim();
  const candidates = (records || [])
    .filter((candidate) => candidate && candidate !== record && !isSupportLike(candidate) && candidate.source?.apos && candidate.source?.lpos)
    .map((candidate) => {
      const start = toVec(candidate.source.apos);
      const end = toVec(candidate.source.lpos);
      const line = end.clone().sub(start);
      const len = line.length();
      const nodeMatch = Boolean(node && (String(candidate.fromNode) === node || String(candidate.toNode) === node));
      const distance = supportPos ? pointToSegmentDistance(toVec(supportPos), start, end) : Number.POSITIVE_INFINITY;
      const forward = String(candidate.toNode) === node ? start.clone().sub(end) : line.clone();
      return { record: candidate, len, nodeMatch, distance, direction: normalizedOr(forward, line) };
    })
    .filter((candidate) => candidate.len > EPS_MM)
    .sort((a, b) => Number(b.nodeMatch) - Number(a.nodeMatch) || a.distance - b.distance || b.len - a.len);
  const best = candidates[0];
  if (best) {
    return {
      record: best.record,
      direction: best.direction,
      diameterMm: parseDiameter(best.record)
    };
  }
  return { record: null, direction: new THREE.Vector3(1, 0, 0), diameterMm: 0 };
}

function resolveSupportCluster(record, records, pipeDirection, pipeDiameterMm) {
  const node = String(record?.attrs?.NODE || record?.fromNode || record?.toNode || '').trim();
  const pos = record?.source?.supportCoord || record?.source?.pos || record?.source?.bpos || record?.source?.apos || record?.source?.lpos;
  const recordIndex = (records || []).indexOf(record);
  const siblings = (records || [])
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate && isSupportLike(candidate) && isSameSupportCluster(record, candidate, node, pos))
    .sort((a, b) => a.index - b.index);
  const count = siblings.length;
  const index = Math.max(0, siblings.findIndex((entry) => entry.candidate === record));
  const spacingMm = clamp((Number(pipeDiameterMm) || 60) * 0.75, 35, 160);
  let offset = new THREE.Vector3();
  if (count > 1) {
    const { u, v } = clusterBasis(pipeDirection);
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / count);
    offset = u.multiplyScalar(Math.cos(angle) * spacingMm).add(v.multiplyScalar(Math.sin(angle) * spacingMm));
  }
  return {
    schema: 'ManagedStageSupportCluster.v1',
    node,
    sourceIndex: recordIndex,
    index,
    count,
    clustered: count > 1,
    spacingMm: round(spacingMm),
    offsetMm: vecToRoundedPoint(offset),
    offsetMagnitudeMm: round(offset.length()),
    policy: count > 1
      ? 'support symbols sharing the same staged node/POS are locally spread for readability; source POS/SUPPORTCOORD is preserved'
      : 'single support at staged node/POS; no visual cluster offset'
  };
}

function isSameSupportCluster(a, b, node, pos) {
  if (!a || !b) return false;
  const aNode = String(a?.attrs?.NODE || a?.fromNode || a?.toNode || '').trim();
  const bNode = String(b?.attrs?.NODE || b?.fromNode || b?.toNode || '').trim();
  if (node && aNode && bNode && aNode !== bNode) return false;
  const aPos = a?.source?.supportCoord || a?.source?.pos || a?.source?.bpos || a?.source?.apos || a?.source?.lpos;
  const bPos = b?.source?.supportCoord || b?.source?.pos || b?.source?.bpos || b?.source?.apos || b?.source?.lpos;
  if (!aPos || !bPos || !pos) return false;
  return pointDistance(aPos, bPos) <= 0.01;
}

function clusterBasis(direction) {
  const pipe = normalizedOr(direction, new THREE.Vector3(1, 0, 0));
  const seed = Math.abs(pipe.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let u = new THREE.Vector3().crossVectors(pipe, seed);
  if (u.lengthSq() <= EPS_MM) u = new THREE.Vector3(0, 0, 1);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(pipe, u).normalize();
  return { u, v };
}

function normalizeSupportFamily(rawKind, explicitAxis) {
  const raw = String(rawKind || '').toUpperCase().replace(/[\s\-]+/g, '_');
  if (/(CAN.*SPRING|SPRING.*CAN)/.test(raw)) return 'SPRING_CAN';
  if (raw.includes('HOLD') && raw.includes('DOWN')) return 'HOLDDOWN';
  if (raw.includes('HOLDDOWN')) return 'HOLDDOWN';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LINE_STOP') || raw.includes('LINESTOP') || raw.includes('LIMIT') || /\bLIM\b/.test(raw)) return raw.includes('LIMIT') || /\bLIM\b/.test(raw) ? 'LIMIT_STOP' : 'LINE_STOP';
  if (raw === 'REST' || raw.includes('REST')) return 'REST';
  if (explicitAxis && !explicitAxis.hasSign) return 'SINGLE_AXIS_WARNING';
  if (explicitAxis && explicitAxis.hasSign) return 'LINE_STOP';
  return 'UNKNOWN_RESTRAINT';
}

function guideAxesForPipeAxis(axis) {
  if (axis === 'X') return ['+Z', '-Z'];
  if (axis === 'Z') return ['+X', '-X'];
  return ['+X', '-X', '+Z', '-Z'];
}

function explicitAxisFrom(...values) {
  for (const value of values) {
    const text = String(value || '').toUpperCase().trim();
    if (!text) continue;
    const match = text.match(/(^|[^A-Z0-9])([+-]?)(X|Y|Z)([^A-Z0-9]|$)/);
    if (match) return { axis: match[3], sign: match[2] || '', hasSign: match[2] === '+' || match[2] === '-' };
  }
  return null;
}

function axisWithSign(axisInfo) {
  return `${axisInfo.sign || '+'}${axisInfo.axis}`;
}

function signedDominantAxis(vec) {
  const axis = dominantAxis(vec);
  const value = axis === 'X' ? vec.x : axis === 'Y' ? vec.y : vec.z;
  return `${value < 0 ? '-' : '+'}${axis}`;
}

function invertAxis(axis) {
  return String(axis || '+X').startsWith('-') ? String(axis).replace('-', '+') : String(axis).replace('+', '-');
}

function axisVector(axis) {
  const src = String(axis || '+X').trim().toUpperCase();
  const sign = src.startsWith('-') ? -1 : 1;
  const a = src.replace(/[+-]/g, '');
  if (a === 'Y') return new THREE.Vector3(0, sign, 0);
  if (a === 'Z') return new THREE.Vector3(0, 0, sign);
  return new THREE.Vector3(sign, 0, 0);
}

function dominantAxis(vec) {
  const v = vec && vec.lengthSq?.() > EPS_MM ? vec : new THREE.Vector3(1, 0, 0);
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  if (ay >= ax && ay >= az) return 'Y';
  if (az >= ax && az >= ay) return 'Z';
  return 'X';
}

function parseRecordGapMm(attrs = {}) {
  return parseMm(firstText(attrs.GAP, attrs.GAP_MM, attrs.GAPMM, attrs.SUPPORT_GAP, attrs.RESTRAINT_GAP)) || 0;
}

function parseDiameter(record) {
  return parseMm(record?.attrs?.DIAMETER || record?.attrs?.BORE || record?.attrs?.ABORE || record?.attrs?.LBORE || record?.attrs?.HBOR || record?.attrs?.TBOR) || 0;
}

function colorForFamily(family) {
  return DEFAULT_SUPPORT_COLORS[family] || DEFAULT_SUPPORT_COLORS.WARNING;
}

function isSupportLike(record) {
  const type = String(record?.type || '').toUpperCase();
  const dtxr = String(record?.dtxr || '').toUpperCase();
  return SUPPORT_TYPES.has(type) || SUPPORT_TYPES.has(dtxr);
}

function normalizedOr(primary, fallback) {
  const v = primary?.lengthSq?.() > EPS_MM ? primary.clone() : fallback?.clone?.();
  return v?.lengthSq?.() > EPS_MM ? v.normalize() : new THREE.Vector3(1, 0, 0);
}

function pointToSegmentDistance(point, start, end) {
  const ab = end.clone().sub(start);
  const denom = ab.lengthSq();
  if (denom <= EPS_MM) return point.distanceTo(start);
  const t = Math.max(0, Math.min(1, point.clone().sub(start).dot(ab) / denom));
  return point.distanceTo(start.clone().add(ab.multiplyScalar(t)));
}

function pointDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return toVec(a).distanceTo(toVec(b));
}

function firstText(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function parseMm(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseFloat(String(value).replace(/mm\b/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function toVec(point) {
  return new THREE.Vector3(Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0);
}

function vecToPoint(vec) {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function vecToRoundedPoint(vec) {
  return { x: round(vec.x), y: round(vec.y), z: round(vec.z) };
}

function safeName(value) {
  return String(value || 'SUPPORT').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'SUPPORT';
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Number(value).toFixed(9));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

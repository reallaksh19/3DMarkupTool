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
const SUPPORT_PREVIEW_SCALE_POLICY = Object.freeze({
  glyphLengthMinMm: 25,
  glyphLengthMaxMm: 60,
  axialGlyphLengthMaxMm: 55,
  fallbackLengthMaxMm: 60,
  springCanLengthMaxMm: 60,
  barRadiusMinMm: 1,
  barRadiusMaxMm: 3,
  clusterOffsetMaxMm: 28,
  gapVisualSeparationMaxMm: 28,
  maxPrimitiveBudgetPerSupportKind: 4
});

export const MANAGED_STAGE_SUPPORT_VISUAL_POLICY = Object.freeze({
  schema: 'ManagedStageSupportVisualResolver.v2',
  rules: [
    'REST/GUIDE/LINESTOP/HOLDDOWN preview uses compact cylinder bars, not solid cones',
    'vertical-pipe GUIDE uses four stem-only lateral bars to stay under the compact primitive budget',
    'RVM export and raw preview share a compact glyph envelope: support bars stay near the source POS/SUPPORTCOORD',
    'single-axis restraints without +/- are warning markers with popupRequired=true',
    'Can Spring / Spring Can = warning coil below pipe',
    'gap is record-scoped; no carry-forward attribute is used',
    'axial restraint tips touch unless gap is positive; positive gap creates capped visual separation',
    'ODx2/3 resolver is applied only to final axial/pipe-parallel symbols',
    'known supports sharing the same staged node/POS are spread by a capped local support-cluster resolver',
    'unknown support fallback = translucent crossed X rods, never solid cube/block/cone fallback'
  ],
  previewGeometry: 'compact-code8-equivalent-cylinder-bars-no-cones',
  blockedPreviewGeometry: ['ConeGeometry', 'solid-pyramid', 'cone-fan'],
  maxPrimitiveBudgetPerSupportKind: SUPPORT_PREVIEW_SCALE_POLICY.maxPrimitiveBudgetPerSupportKind
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
  const genericLength = supportGlyphLength(odMm, 0.38, SUPPORT_PREVIEW_SCALE_POLICY.glyphLengthMaxMm);
  const axialLength = supportGlyphLength(odMm, 0.32, SUPPORT_PREVIEW_SCALE_POLICY.axialGlyphLengthMaxMm);
  const fallbackLength = supportGlyphLength(odMm, 0.38, SUPPORT_PREVIEW_SCALE_POLICY.fallbackLengthMaxMm);
  const barRadius = supportBarRadius(odMm);
  const tickLength = clamp(genericLength * 0.32, 8, 18);
  const warningScale = Math.max(Math.min(genericLength / 80, 1.3), 0.7);
  const material = mat(colorForFamily(visual.family), { transparent: true, opacity: 0.9 });

  const connector = createClusterConnector(sourceCenter, visualCenter, odMm, visual, `${group.name}_CLUSTER_OFFSET_CONNECTOR`);
  if (connector) group.add(connector);

  if (visual.family === 'SPRING_CAN') {
    const length = supportGlyphLength(odMm, 0.34, SUPPORT_PREVIEW_SCALE_POLICY.springCanLengthMaxMm);
    const coil = createSpringCoil(
      visualCenter.clone().add(new THREE.Vector3(0, -length * 0.62, 0)),
      new THREE.Vector3(0, 1, 0),
      Math.max(odMm * 0.14, 5),
      length,
      mat(DEFAULT_SUPPORT_COLORS.SPRING_CAN, { transparent: true, opacity: 0.9 }),
      `${group.name}_WARNING_COIL_BELOW_PIPE`
    );
    stampPart(coil, visual, {
      role: 'warningCoilBelowPipe',
      popupRequired: true,
      visualCenterMm: vecToPoint(visualCenter),
      supportPreviewNoCone: true,
      supportPrimitiveBudgetCounted: true,
      supportPrimitiveBudgetUnitCount: 1
    });
    group.add(coil);
  } else if (visual.fallbackCrossRods) {
    const rods = createFallbackCrossRods(
      visualCenter,
      fallbackLength,
      barRadius,
      mat(DEFAULT_SUPPORT_COLORS.FALLBACK, { transparent: true, opacity: 0.35 }),
      `${group.name}_FALLBACK_X_RODS`,
      visual
    );
    for (const rod of rods) group.add(rod);
  } else if (visual.popupRequired) {
    const warning = createWarningTriangle('!', warningScale);
    warning.name = `${group.name}_POPUP_REQUIRED`;
    warning.position.copy(visualCenter).add(new THREE.Vector3(0, genericLength * 0.72, 0));
    stampPart(warning, visual, {
      role: 'popupRequired',
      popupRequired: true,
      visualCenterMm: vecToPoint(visualCenter),
      supportPreviewNoCone: true,
      supportPrimitiveBudgetCounted: true,
      supportPrimitiveBudgetUnitCount: 1
    });
    group.add(warning);
  } else {
    const rawTipSeparation = visual.gapMm > 0 && AXIAL_FAMILIES.has(visual.family) ? visual.gapMm * 10 : 0;
    const tipSeparation = clamp(rawTipSeparation, 0, SUPPORT_PREVIEW_SCALE_POLICY.gapVisualSeparationMaxMm);
    for (const side of visual.coneSides || []) {
      const sideVec = axisVector(side.axis);
      const length = side.axialPipeParallel ? axialLength : genericLength;
      const gapFactor = side.explicitSingle ? 1 : 0.5;
      const tipOffset = AXIAL_FAMILIES.has(visual.family) ? sideVec.clone().multiplyScalar(tipSeparation * gapFactor) : new THREE.Vector3();
      const tip = visualCenter.clone().add(tipOffset);
      const directionToTip = side.pointsTowardCenter ? sideVec.clone().multiplyScalar(-1) : sideVec;
      const bars = createDirectionalGlyphBars({
        tip,
        directionToTip,
        length,
        tickLength,
        barRadius,
        material,
        name: `${group.name}_${safeName(side.role || 'SUPPORT')}_${safeName(side.axis || 'X')}`,
        visual,
        side,
        sourceCenter,
        visualCenter,
        rawTipSeparation,
        tipSeparation
      });
      for (const bar of bars) group.add(bar);
    }
  }

  group.userData = {
    TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
    primitiveKind: 'managed-stage-support-symbol',
    supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    supportVisualGeometry: 'compact-cylinder-bars-no-cones',
    supportPreviewPrimitiveBudgetCount: visual.previewPrimitiveBudgetCount,
    supportPreviewPrimitiveBudgetLimit: visual.previewPrimitiveBudgetLimit,
    supportPreviewPrimitiveBudgetPass: visual.previewPrimitiveBudgetPass,
    managedStageSupportVisual: true,
    supportVisual: visual,
    supportCluster: visual.cluster,
    previewOnly: true,
    exportedRvmGeometry: false,
    popupRequired: Boolean(visual.popupRequired),
    supportPreviewNoCone: true,
    supportPyramidSubstituteBlocked: true,
    supportConeFanBlocked: true,
    coordinatePolicy: 'record-scoped staged support visual resolver; source POS/SUPPORTCOORD preserved; support preview uses compact cylinder bars and is excluded from RVM export'
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
    coneSides = [{ role: 'rest-upward-support-bar', axis: '+Y', pointsTowardCenter: false }];
  } else if (family === 'HOLDDOWN') {
    coneSides = [
      { role: 'holddown-bottom-support-bar', axis: '+Y', pointsTowardCenter: false },
      { role: 'holddown-top-support-bar', axis: '-Y', pointsTowardCenter: false }
    ];
  } else if (family === 'GUIDE') {
    const stemOnly = pipeAxis === 'Y';
    coneSides = guideAxesForPipeAxis(pipeAxis).map((axis) => ({
      role: stemOnly ? 'guide-vertical-pipe-lateral-stem' : 'guide-lateral-support-bar',
      axis,
      pointsTowardCenter: true,
      compactStemOnly: stemOnly
    }));
  } else if (family === 'LINE_STOP' || family === 'LIMIT_STOP') {
    const explicitSingle = Boolean(explicitAxis?.hasSign);
    const axialSides = explicitSingle
      ? [axisWithSign(explicitAxis)]
      : [pipeAxisSigned, invertAxis(pipeAxisSigned)];
    coneSides = axialSides.map((axis) => ({
      role: family === 'LIMIT_STOP' ? 'limit-axial-support-bar' : 'line-stop-axial-support-bar',
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

  const previewPrimitiveBudgetCount = previewPrimitiveBudgetFor({ family, coneSides, popupRequired, fallbackCrossRods });
  const previewPrimitiveBudgetLimit = SUPPORT_PREVIEW_SCALE_POLICY.maxPrimitiveBudgetPerSupportKind;

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
    directionalGlyphSides: coneSides,
    directionalGlyphCount: coneSides.length,
    previewGlyphGeometry: 'compact-cylinder-bars-no-cones',
    previewPrimitiveBudgetCount,
    previewPrimitiveBudgetLimit,
    previewPrimitiveBudgetPass: previewPrimitiveBudgetCount <= previewPrimitiveBudgetLimit,
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
    gapVisualSeparationMm: AXIAL_FAMILIES.has(family) && gapMm > 0 ? round(Math.min(gapMm * 10, SUPPORT_PREVIEW_SCALE_POLICY.gapVisualSeparationMaxMm)) : 0,
    axialNoOdHalfRadialContact: AXIAL_FAMILIES.has(family),
    axialTipsTouchUnlessGap: AXIAL_FAMILIES.has(family),
    axialPipeParallelResolver: AXIAL_FAMILIES.has(family) ? 'ODx2/3 applies only to final axial/pipe-parallel support symbols' : 'not-applicable'
  };
}

function createDirectionalGlyphBars({ tip, directionToTip, length, tickLength, barRadius, material, name, visual, side, sourceCenter, visualCenter, rawTipSeparation, tipSeparation }) {
  const direction = normalizedOr(directionToTip, new THREE.Vector3(0, 1, 0));
  const base = tip.clone().add(direction.clone().multiplyScalar(-length));
  const tickCenter = tip.clone().add(direction.clone().multiplyScalar(-clamp(length * 0.22, 5, 12)));
  const { u } = perpendicularBasis(direction);
  const tickStart = tickCenter.clone().add(u.clone().multiplyScalar(-tickLength / 2));
  const tickEnd = tickCenter.clone().add(u.clone().multiplyScalar(tickLength / 2));
  const common = {
    role: side.role,
    axis: side.axis,
    axialPipeParallel: Boolean(side.axialPipeParallel),
    explicitSingle: Boolean(side.explicitSingle),
    compactStemOnly: Boolean(side.compactStemOnly),
    tipMm: vecToPoint(tip),
    sourceTipMm: vecToPoint(sourceCenter),
    visualCenterMm: vecToPoint(visualCenter),
    pointsTowardCenter: side.pointsTowardCenter !== false,
    odTwoThirdsResolverApplied: Boolean(side.axialPipeParallel),
    supportPreviewNoCone: true,
    supportDirectionalCone: false,
    supportDirectionalGlyphBar: true,
    supportConeFanBlocked: true,
    supportPyramidSubstituteBlocked: true,
    supportGapVisualSeparationRawMm: round(rawTipSeparation),
    supportGapVisualSeparationExportMm: round(tipSeparation),
    supportGlyphLengthMm: round(length),
    supportPrimitiveBudgetCounted: true,
    supportPrimitiveBudgetLimit: visual.previewPrimitiveBudgetLimit,
    supportPrimitiveBudgetCount: visual.previewPrimitiveBudgetCount
  };
  const stem = cylinderBetween(base, tip, barRadius, material, 10, `${name}_STEM_BAR`);
  stampPart(stem, visual, { ...common, role: `${side.role}-preview-stem-bar`, supportGlyphStemBar: true, supportPrimitiveBudgetUnitCount: 1 });
  if (side.compactStemOnly) return [stem];
  const tick = cylinderBetween(tickStart, tickEnd, clamp(barRadius * 0.72, 1, 2.25), material, 10, `${name}_TIP_TICK`);
  stampPart(tick, visual, { ...common, role: `${side.role}-preview-tip-tick`, supportGlyphTipTick: true, supportGlyphTickStartMm: vecToPoint(tickStart), supportGlyphTickEndMm: vecToPoint(tickEnd), supportPrimitiveBudgetUnitCount: 1 });
  return [stem, tick];
}

function createClusterConnector(sourceCenter, visualCenter, odMm, visual, name) {
  if (!sourceCenter || !visualCenter || sourceCenter.distanceTo(visualCenter) <= EPS_MM) return null;
  const rod = cylinderBetween(
    sourceCenter,
    visualCenter,
    Math.max(Math.min(odMm * 0.012, SUPPORT_PREVIEW_SCALE_POLICY.barRadiusMaxMm), SUPPORT_PREVIEW_SCALE_POLICY.barRadiusMinMm),
    mat(DEFAULT_SUPPORT_COLORS.FALLBACK, { transparent: true, opacity: 0.28 }),
    8,
    name
  );
  stampPart(rod, visual, {
    role: 'clusterOffsetConnector',
    sourceTipMm: vecToPoint(sourceCenter),
    visualCenterMm: vecToPoint(visualCenter),
    clusterOffsetConnector: true,
    supportPreviewNoCone: true,
    supportPrimitiveBudgetCounted: false,
    supportPrimitiveBudgetUnitCount: 0
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
      visualCenterMm: vecToPoint(center),
      supportPreviewNoCone: true,
      supportPrimitiveBudgetCounted: true,
      supportPrimitiveBudgetUnitCount: 1
    });
    return rod;
  });
}

function stampPart(object, visual, extra = {}) {
  object.userData = {
    ...(object.userData || {}),
    TYPE: 'MANAGED_STAGE_SUPPORT_VISUAL_PART',
    supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    supportVisualGeometry: 'compact-cylinder-bars-no-cones',
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

function previewPrimitiveBudgetFor({ family, coneSides, popupRequired, fallbackCrossRods }) {
  if (family === 'SPRING_CAN') return 1;
  if (fallbackCrossRods) return 2;
  if (popupRequired) return 1;
  return (coneSides || []).reduce((sum, side) => sum + (side.compactStemOnly ? 1 : 2), 0);
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
  if (best) return { record: best.record, direction: best.direction, diameterMm: parseDiameter(best.record) };
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
  const rawSpacingMm = clamp((Number(pipeDiameterMm) || 60) * 0.75, 35, 160);
  const spacingMm = Math.min(rawSpacingMm, SUPPORT_PREVIEW_SCALE_POLICY.clusterOffsetMaxMm);
  let offset = new THREE.Vector3();
  if (count > 1) {
    const { u, v } = clusterBasis(pipeDirection);
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / count);
    offset = u.multiplyScalar(Math.cos(angle) * spacingMm).add(v.multiplyScalar(Math.sin(angle) * spacingMm));
  }
  return {
    schema: 'ManagedStageSupportCluster.v2',
    node,
    sourceIndex: recordIndex,
    index,
    count,
    clustered: count > 1,
    spacingMm: round(spacingMm),
    rawSpacingMm: round(rawSpacingMm),
    offsetMm: vecToRoundedPoint(offset),
    offsetMagnitudeMm: round(offset.length()),
    policy: count > 1
      ? 'support symbols sharing the same staged node/POS are locally spread with a capped compact offset; source POS/SUPPORTCOORD is preserved'
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

function perpendicularBasis(direction) {
  const d = normalizedOr(direction, new THREE.Vector3(0, 1, 0));
  const seed = Math.abs(d.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let u = new THREE.Vector3().crossVectors(d, seed);
  if (u.lengthSq() <= EPS_MM) u = new THREE.Vector3(1, 0, 0);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(d, u).normalize();
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

function supportGlyphLength(odMm, factor, maxMm) {
  return clamp(Number(odMm || 0) * factor, SUPPORT_PREVIEW_SCALE_POLICY.glyphLengthMinMm, maxMm);
}

function supportBarRadius(odMm) {
  return clamp(Number(odMm || 0) * 0.012, SUPPORT_PREVIEW_SCALE_POLICY.barRadiusMinMm, SUPPORT_PREVIEW_SCALE_POLICY.barRadiusMaxMm);
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

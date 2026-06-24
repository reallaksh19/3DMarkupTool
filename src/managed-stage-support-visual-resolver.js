import * as THREE from 'three';
import { cylinderBetween, mat } from './geometry.js?v=professional-viewer-3';

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
  coneLengthMinMm: 150,
  coneLengthMaxMm: 700,
  coneRadiusMinMm: 40,
  coneRadiusMaxMm: 200,
  fallbackLengthMinMm: 120,
  fallbackLengthMaxMm: 700,
  springCanLengthMinMm: 150,
  springCanLengthMaxMm: 700,
  springCanRadiusMinMm: 45,
  springCanRadiusMaxMm: 210,
  connectorRadiusMinMm: 5,
  connectorRadiusMaxMm: 24,
  clusterOffsetMaxMm: 28,
  gapVisualSeparationMaxMm: 280,
  maxPrimitiveBudgetPerSupportKind: 4
});

export const MANAGED_STAGE_SUPPORT_VISUAL_POLICY = Object.freeze({
  schema: 'ManagedStageSupportVisualResolver.v3',
  rules: [
    'REST preview = one upward cone below the pipe; OD/2 contact offset is applied by the visibility layer',
    'HOLDDOWN preview = two opposed vertical cones above and below the pipe',
    'GUIDE preview = lateral cone pair based on pipe axis; vertical-pipe GUIDE uses four lateral cones',
    'LINE_STOP/LIMIT preview = one signed axial cone or two unsigned axial cones; ODx2/3 display offset applies only to axial/pipe-parallel symbols',
    'single-axis restraints without +/- are warning cones with popupRequired=true',
    'Can Spring / Spring Can = three-cylinder can symbol below pipe',
    'gap is record-scoped; no carry-forward attribute is used',
    'positive axial gap creates 10x visual separation before ODx2/3 display offset',
    'known supports sharing the same staged node/POS are spread by a capped local support-cluster resolver',
    'unknown support fallback = translucent crossed X rods, never solid cube/block/pyramid fallback'
  ],
  previewGeometry: 'cone-and-can-support-glyphs',
  blockedPreviewGeometry: ['solid-pyramid', 'cone-fan', 'box-substitute'],
  maxPrimitiveBudgetPerSupportKind: SUPPORT_PREVIEW_SCALE_POLICY.maxPrimitiveBudgetPerSupportKind,
  supportConeCatalogue: true
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
  const coneLength = supportConeLength(odMm);
  const coneRadius = supportConeRadius(odMm);
  const fallbackLength = supportFallbackLength(odMm);
  const canLength = supportCanLength(odMm);
  const canRadius = supportCanRadius(odMm);
  const warningLength = clamp(coneLength * 0.75, SUPPORT_PREVIEW_SCALE_POLICY.coneLengthMinMm, SUPPORT_PREVIEW_SCALE_POLICY.coneLengthMaxMm);
  const warningRadius = clamp(coneRadius * 0.82, SUPPORT_PREVIEW_SCALE_POLICY.coneRadiusMinMm, SUPPORT_PREVIEW_SCALE_POLICY.coneRadiusMaxMm);
  const material = mat(colorForFamily(visual.family), { transparent: true, opacity: 0.94 });

  const connector = createClusterConnector(sourceCenter, visualCenter, odMm, visual, `${group.name}_CLUSTER_OFFSET_CONNECTOR`);
  if (connector) group.add(connector);

  if (visual.family === 'SPRING_CAN') {
    const canParts = createSpringCanSymbol({
      center: visualCenter,
      length: canLength,
      radius: canRadius,
      material,
      name: `${group.name}_SPRING_CAN`,
      visual,
      sourceCenter,
      visualCenter
    });
    for (const part of canParts) group.add(part);
  } else if (visual.fallbackCrossRods) {
    const rods = createFallbackCrossRods(
      visualCenter,
      fallbackLength,
      clamp(coneRadius * 0.16, SUPPORT_PREVIEW_SCALE_POLICY.connectorRadiusMinMm, SUPPORT_PREVIEW_SCALE_POLICY.connectorRadiusMaxMm),
      mat(DEFAULT_SUPPORT_COLORS.FALLBACK, { transparent: true, opacity: 0.35 }),
      `${group.name}_FALLBACK_X_RODS`,
      visual
    );
    for (const rod of rods) group.add(rod);
  } else if (visual.popupRequired) {
    const warning = createWarningCone({
      center: visualCenter,
      length: warningLength,
      radius: warningRadius,
      material: mat(DEFAULT_SUPPORT_COLORS.WARNING, { transparent: true, opacity: 0.96 }),
      name: `${group.name}_POPUP_REQUIRED_WARNING_CONE`,
      visual
    });
    group.add(warning);
  } else {
    const rawTipSeparation = visual.gapMm > 0 && AXIAL_FAMILIES.has(visual.family) ? visual.gapMm * 10 : 0;
    const tipSeparation = clamp(rawTipSeparation, 0, SUPPORT_PREVIEW_SCALE_POLICY.gapVisualSeparationMaxMm);
    for (const side of visual.coneSides || []) {
      const sideVec = axisVector(side.axis);
      const gapFactor = side.explicitSingle ? 1 : 0.5;
      const tipOffset = AXIAL_FAMILIES.has(visual.family)
        ? sideVec.clone().multiplyScalar(tipSeparation * gapFactor)
        : new THREE.Vector3();
      const tip = visualCenter.clone().add(tipOffset);
      const directionToTip = side.pointsTowardCenter ? sideVec.clone().multiplyScalar(-1) : sideVec;
      const cone = createDirectionalSupportCone({
        tip,
        directionToTip,
        length: coneLength,
        radius: coneRadius,
        material,
        name: `${group.name}_${safeName(side.role || 'SUPPORT')}_${safeName(side.axis || 'X')}_CONE`,
        visual,
        side,
        sourceCenter,
        visualCenter,
        rawTipSeparation,
        tipSeparation
      });
      group.add(cone);
    }
  }

  group.userData = {
    TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
    primitiveKind: 'managed-stage-support-symbol',
    supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    supportVisualGeometry: 'cone-and-can-support-glyphs',
    supportPreviewPrimitiveBudgetCount: visual.previewPrimitiveBudgetCount,
    supportPreviewPrimitiveBudgetLimit: visual.previewPrimitiveBudgetLimit,
    supportPreviewPrimitiveBudgetPass: visual.previewPrimitiveBudgetPass,
    managedStageSupportVisual: true,
    supportVisual: visual,
    supportCluster: visual.cluster,
    previewOnly: true,
    exportedRvmGeometry: false,
    popupRequired: Boolean(visual.popupRequired),
    supportPreviewNoCone: false,
    supportPreviewUsesConeCatalogue: true,
    supportPyramidSubstituteBlocked: true,
    supportConeFanBlocked: true,
    coordinatePolicy: 'record-scoped staged support visual resolver; source POS/SUPPORTCOORD preserved; support preview uses cone/can catalogue and is excluded from RVM export'
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
    coneSides = [{ role: 'rest-upward-cone', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'upward-support-reaction' }];
  } else if (family === 'HOLDDOWN') {
    coneSides = [
      { role: 'holddown-bottom-upward-cone', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'bottom-upward-reaction' },
      { role: 'holddown-top-downward-cone', axis: '-Y', pointsTowardCenter: false, coneSemantic: 'top-downward-restraint' }
    ];
  } else if (family === 'GUIDE') {
    coneSides = guideAxesForPipeAxis(pipeAxis).map((axis) => ({
      role: pipeAxis === 'Y' ? 'guide-vertical-pipe-lateral-cone' : 'guide-lateral-cone',
      axis,
      pointsTowardCenter: true,
      coneSemantic: 'lateral-guide-restraint'
    }));
  } else if (family === 'LINE_STOP' || family === 'LIMIT_STOP') {
    const explicitSingle = Boolean(explicitAxis?.hasSign);
    const axialSides = explicitSingle
      ? [axisWithSign(explicitAxis)]
      : [pipeAxisSigned, invertAxis(pipeAxisSigned)];
    coneSides = axialSides.map((axis) => ({
      role: family === 'LIMIT_STOP' ? 'limit-axial-cone' : 'line-stop-axial-cone',
      axis,
      pointsTowardCenter: true,
      axialPipeParallel: true,
      explicitSingle,
      coneSemantic: explicitSingle ? 'signed-axial-stop' : 'unsigned-axial-stop-pair'
    }));
  } else if (family === 'SINGLE_AXIS_WARNING') {
    popupRequired = true;
    popupReason = 'single-axis restraint is missing explicit +/- sign';
  } else if (family === 'SPRING_CAN') {
    popupRequired = true;
    popupReason = 'spring can requires engineering resolution; warning can below pipe only';
  } else {
    fallbackCrossRods = true;
    popupReason = 'unknown staged support restraint mapping; rendered as translucent crossed X rods fallback';
  }

  const previewPrimitiveBudgetCount = previewPrimitiveBudgetFor({ family, coneSides, popupRequired, fallbackCrossRods });
  const previewPrimitiveBudgetLimit = SUPPORT_PREVIEW_SCALE_POLICY.maxPrimitiveBudgetPerSupportKind;
  const gapVisualSeparationMm = AXIAL_FAMILIES.has(family) && gapMm > 0
    ? round(Math.min(gapMm * 10, SUPPORT_PREVIEW_SCALE_POLICY.gapVisualSeparationMaxMm))
    : 0;

  return {
    schema: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    rawKind,
    family,
    node: String(attrs.NODE || record?.fromNode || record?.toNode || ''),
    pipeAxis,
    pipeAxisSigned,
    pipeDirection: vecToPoint(pipeContext.direction),
    pipeDiameterMm: round(pipeDiameterMm),
    pipeRadiusMm: round((Number(pipeDiameterMm) || 0) / 2),
    sourcePipeRecord: pipeContext.record?.name || '',
    sourcePipePath: pipeContext.record?.path || '',
    coneSides,
    coneCount: coneSides.length,
    directionalGlyphSides: coneSides,
    directionalGlyphCount: coneSides.length,
    previewGlyphGeometry: family === 'SPRING_CAN' ? 'three-cylinder-can' : popupRequired ? 'warning-cone' : fallbackCrossRods ? 'fallback-cross-rods' : 'directional-cones',
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
    gapVisualSeparationMm,
    odHalfRadialContactApplies: !AXIAL_FAMILIES.has(family) && !fallbackCrossRods,
    axialNoOdHalfRadialContact: AXIAL_FAMILIES.has(family),
    axialTipsTouchUnlessGap: AXIAL_FAMILIES.has(family),
    axialPipeParallelResolver: AXIAL_FAMILIES.has(family) ? 'ODx2/3 applies only to final axial/pipe-parallel support symbols' : 'not-applicable',
    supportConeCatalogue: true
  };
}

function createDirectionalSupportCone({ tip, directionToTip, length, radius, material, name, visual, side, sourceCenter, visualCenter, rawTipSeparation, tipSeparation }) {
  const direction = normalizedOr(directionToTip, new THREE.Vector3(0, 1, 0));
  const base = tip.clone().add(direction.clone().multiplyScalar(-length));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, Math.max(length, EPS_MM), 24, 1, false), material);
  cone.name = name;
  cone.position.copy(base).add(tip).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  stampPart(cone, visual, {
    role: `${side.role}-preview-cone`,
    axis: side.axis,
    axialPipeParallel: Boolean(side.axialPipeParallel),
    explicitSingle: Boolean(side.explicitSingle),
    tipMm: vecToPoint(tip),
    baseMm: vecToPoint(base),
    sourceTipMm: vecToPoint(sourceCenter),
    visualCenterMm: vecToPoint(visualCenter),
    pointsTowardCenter: side.pointsTowardCenter !== false,
    odTwoThirdsResolverApplied: Boolean(side.axialPipeParallel),
    supportPreviewNoCone: false,
    supportDirectionalCone: true,
    supportDirectionalGlyphBar: false,
    supportConeFanBlocked: true,
    supportPyramidSubstituteBlocked: true,
    supportGapVisualSeparationRawMm: round(rawTipSeparation),
    supportGapVisualSeparationExportMm: round(tipSeparation),
    supportConeLengthMm: round(length),
    supportConeRadiusMm: round(radius),
    supportConeSemantic: side.coneSemantic || '',
    supportPrimitiveBudgetCounted: true,
    supportPrimitiveBudgetUnitCount: 1,
    supportPrimitiveBudgetLimit: visual.previewPrimitiveBudgetLimit,
    supportPrimitiveBudgetCount: visual.previewPrimitiveBudgetCount
  });
  return cone;
}

function createWarningCone({ center, length, radius, material, name, visual }) {
  const direction = new THREE.Vector3(0, 1, 0);
  const tip = center.clone().add(new THREE.Vector3(0, length * 0.9, 0));
  const base = tip.clone().add(direction.clone().multiplyScalar(-length));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, Math.max(length, EPS_MM), 24, 1, false), material);
  cone.name = name;
  cone.position.copy(base).add(tip).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  stampPart(cone, visual, {
    role: 'popupRequiredWarningCone',
    popupRequired: true,
    tipMm: vecToPoint(tip),
    baseMm: vecToPoint(base),
    visualCenterMm: vecToPoint(center),
    supportPreviewNoCone: false,
    supportDirectionalCone: true,
    supportWarningCone: true,
    supportPrimitiveBudgetCounted: true,
    supportPrimitiveBudgetUnitCount: 1,
    supportConeLengthMm: round(length),
    supportConeRadiusMm: round(radius)
  });
  return cone;
}

function createSpringCanSymbol({ center, length, radius, material, name, visual, sourceCenter, visualCenter }) {
  const bottom = center.clone().add(new THREE.Vector3(0, -length * 1.22, 0));
  const top = bottom.clone().add(new THREE.Vector3(0, length, 0));
  const capThickness = clamp(length * 0.10, 12, 55);
  const capRadius = radius * 1.18;
  const body = cylinderBetween(bottom, top, radius, material, 24, `${name}_BODY`);
  stampPart(body, visual, {
    role: 'springCanBodyBelowPipe',
    popupRequired: true,
    sourceTipMm: vecToPoint(sourceCenter),
    visualCenterMm: vecToPoint(visualCenter),
    supportPreviewNoCone: true,
    supportSpringCanCylinder: true,
    supportPrimitiveBudgetCounted: true,
    supportPrimitiveBudgetUnitCount: 1,
    supportCanLengthMm: round(length),
    supportCanRadiusMm: round(radius)
  });

  const topCap = cylinderBetween(
    top.clone().add(new THREE.Vector3(0, -capThickness / 2, 0)),
    top.clone().add(new THREE.Vector3(0, capThickness / 2, 0)),
    capRadius,
    material,
    24,
    `${name}_TOP_CAP`
  );
  stampPart(topCap, visual, {
    role: 'springCanTopCap',
    popupRequired: true,
    visualCenterMm: vecToPoint(visualCenter),
    supportPreviewNoCone: true,
    supportSpringCanCylinder: true,
    supportPrimitiveBudgetCounted: true,
    supportPrimitiveBudgetUnitCount: 1
  });

  const bottomCap = cylinderBetween(
    bottom.clone().add(new THREE.Vector3(0, -capThickness / 2, 0)),
    bottom.clone().add(new THREE.Vector3(0, capThickness / 2, 0)),
    capRadius,
    material,
    24,
    `${name}_BOTTOM_CAP`
  );
  stampPart(bottomCap, visual, {
    role: 'springCanBottomCap',
    popupRequired: true,
    visualCenterMm: vecToPoint(visualCenter),
    supportPreviewNoCone: true,
    supportSpringCanCylinder: true,
    supportPrimitiveBudgetCounted: true,
    supportPrimitiveBudgetUnitCount: 1
  });

  return [body, topCap, bottomCap];
}

function createClusterConnector(sourceCenter, visualCenter, odMm, visual, name) {
  if (!sourceCenter || !visualCenter || sourceCenter.distanceTo(visualCenter) <= EPS_MM) return null;
  const rod = cylinderBetween(
    sourceCenter,
    visualCenter,
    clamp(Number(odMm || 0) * 0.03, SUPPORT_PREVIEW_SCALE_POLICY.connectorRadiusMinMm, SUPPORT_PREVIEW_SCALE_POLICY.connectorRadiusMaxMm),
    mat(DEFAULT_SUPPORT_COLORS.FALLBACK, { transparent: true, opacity: 0.28 }),
    10,
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
    const rod = cylinderBetween(center.clone().add(a), center.clone().add(b), radius, material, 12, `${name}_${index + 1}`);
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
    supportVisualGeometry: 'cone-and-can-support-glyphs',
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
  if (family === 'SPRING_CAN') return 3;
  if (fallbackCrossRods) return 2;
  if (popupRequired) return 1;
  return (coneSides || []).length;
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
  return parseMm(firstText(attrs.SUPPORT_GAP_MM, attrs.SUPPORT_GAP, attrs.GAP_MM, attrs.GAP, attrs.GAPMM, attrs.RESTRAINT_GAP)) || 0;
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

function supportConeLength(odMm) {
  return clamp(Number(odMm || 0) * 1.0, SUPPORT_PREVIEW_SCALE_POLICY.coneLengthMinMm, SUPPORT_PREVIEW_SCALE_POLICY.coneLengthMaxMm);
}

function supportConeRadius(odMm) {
  return clamp(Number(odMm || 0) * 0.25, SUPPORT_PREVIEW_SCALE_POLICY.coneRadiusMinMm, SUPPORT_PREVIEW_SCALE_POLICY.coneRadiusMaxMm);
}

function supportFallbackLength(odMm) {
  return clamp(Number(odMm || 0) * 1.0, SUPPORT_PREVIEW_SCALE_POLICY.fallbackLengthMinMm, SUPPORT_PREVIEW_SCALE_POLICY.fallbackLengthMaxMm);
}

function supportCanLength(odMm) {
  return clamp(Number(odMm || 0) * 1.1, SUPPORT_PREVIEW_SCALE_POLICY.springCanLengthMinMm, SUPPORT_PREVIEW_SCALE_POLICY.springCanLengthMaxMm);
}

function supportCanRadius(odMm) {
  return clamp(Number(odMm || 0) * 0.27, SUPPORT_PREVIEW_SCALE_POLICY.springCanRadiusMinMm, SUPPORT_PREVIEW_SCALE_POLICY.springCanRadiusMaxMm);
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

import * as THREE from 'three';
import { cylinderBetween, mat } from './geometry.js?v=professional-viewer-3';

const EPS_MM = 0.001;
const COLORS = Object.freeze({
  REST: 0xf8c34a,
  GUIDE: 0x18d5c0,
  LINE_STOP: 0xf2a93b,
  LIMIT_STOP: 0xf2a93b,
  HOLDDOWN: 0xf05ab9,
  SPRING_CAN: 0xd273ff,
  CAN: 0xb795ff,
  HANGER: 0x9bd4ff,
  WARNING: 0xff8c73,
  FALLBACK: 0xb8c7d9
});
const SUPPORT_TYPES = new Set(['ATTA', 'ANCI', 'SUPP', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT']);
const AXIAL_FAMILIES = new Set(['LINE_STOP', 'LIMIT_STOP']);
const NON_AXIAL_EXPLICIT_AXIS_FAMILIES = new Set(['GUIDE']);
const POLICY = Object.freeze({
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
  springCoilCount: 5,
  maxPrimitiveBudgetPerSupportKind: 5
});

export const MANAGED_STAGE_SUPPORT_VISUAL_POLICY = Object.freeze({
  schema: 'ManagedStageSupportVisualResolver.v4',
  rules: [
    'REST = one upward cone below pipe using OD/2 radial contact',
    'HOLDDOWN = opposed vertical cones',
    'GUIDE = lateral cones by transformed Canvas axis when supplied, otherwise by pipe axis',
    'LINE_STOP/LIMIT = transformed Canvas axis when supplied, otherwise unsigned axial cone pair along pipe axis',
    'X/Y/Z/+X/-X/+Y/-Y/+Z/-Z all pass through the same signed-axis transformation path',
    'SPRING_CAN = five stacked coils below pipe; CAN below pipe; HANGER above pipe',
    'gap is record-scoped and has no carry-forward'
  ],
  previewGeometry: 'cone-and-can-support-glyphs',
  blockedPreviewGeometry: ['solid-pyramid', 'cone-fan', 'box-substitute'],
  maxPrimitiveBudgetPerSupportKind: POLICY.maxPrimitiveBudgetPerSupportKind,
  supportConeCatalogue: true,
  generalizedAxisTransform: true
});

export function createManagedStageSupportPreviewObject(record, options = {}) {
  const pos = supportPosition(record);
  if (!pos) return null;

  const visual = resolveManagedStageSupportVisual(record, options.records || [], options);
  const group = new THREE.Group();
  group.name = `MANAGED_STAGE_SUPPORT_${safeName(record?.name || record?.rawName || 'SUPPORT')}`;

  const sourceCenter = toVec(pos);
  const visualCenter = sourceCenter.clone().add(toVec(visual.cluster?.offsetMm));
  const odMm = Math.max(visual.pipeDiameterMm || options.pointRadius * 2 || 40, 1);
  const material = mat(colorForFamily(visual.family), { transparent: true, opacity: 0.94 });
  const coneLength = supportConeLength(odMm);
  const coneRadius = supportConeRadius(odMm);

  const connector = createClusterConnector(sourceCenter, visualCenter, odMm, visual, `${group.name}_CLUSTER_OFFSET_CONNECTOR`);
  if (connector) group.add(connector);

  if (visual.family === 'SPRING_CAN') {
    for (const part of createSpringCanSymbol({
      center: visualCenter,
      length: supportCanLength(odMm),
      radius: supportCanRadius(odMm),
      material,
      name: `${group.name}_SPRING_CAN`,
      visual,
      sourceCenter,
      visualCenter
    })) group.add(part);
  } else if (visual.family === 'CAN') {
    for (const part of createCanSymbol({
      center: visualCenter,
      length: supportCanLength(odMm),
      radius: supportCanRadius(odMm),
      material,
      name: `${group.name}_CAN`,
      visual,
      sourceCenter,
      visualCenter
    })) group.add(part);
  } else if (visual.family === 'HANGER') {
    for (const part of createHangerSymbol({
      center: visualCenter,
      length: supportCanLength(odMm),
      radius: clamp(coneRadius * 0.22, POLICY.connectorRadiusMinMm, POLICY.connectorRadiusMaxMm),
      material,
      name: `${group.name}_HANGER`,
      visual,
      sourceCenter,
      visualCenter
    })) group.add(part);
  } else if (visual.fallbackCrossRods) {
    for (const rod of createFallbackCrossRods(
      visualCenter,
      supportFallbackLength(odMm),
      clamp(coneRadius * 0.16, POLICY.connectorRadiusMinMm, POLICY.connectorRadiusMaxMm),
      mat(COLORS.FALLBACK, { transparent: true, opacity: 0.35 }),
      `${group.name}_FALLBACK_X_RODS`,
      visual
    )) group.add(rod);
  } else if (visual.popupRequired) {
    group.add(createWarningCone({
      center: visualCenter,
      length: clamp(coneLength * 0.75, POLICY.coneLengthMinMm, POLICY.coneLengthMaxMm),
      radius: clamp(coneRadius * 0.82, POLICY.coneRadiusMinMm, POLICY.coneRadiusMaxMm),
      material: mat(COLORS.WARNING, { transparent: true, opacity: 0.96 }),
      name: `${group.name}_POPUP_REQUIRED_WARNING_CONE`,
      visual
    }));
  } else {
    const rawTipSeparation = visual.gapMm > 0 && AXIAL_FAMILIES.has(visual.family) ? visual.gapMm * 10 : 0;
    const tipSeparation = clamp(rawTipSeparation, 0, POLICY.gapVisualSeparationMaxMm);
    for (const side of visual.coneSides || []) {
      const sideVec = axisVector(side.axis);
      const gapFactor = side.explicitSingle ? 1 : 0.5;
      const gapOffset = AXIAL_FAMILIES.has(visual.family) ? sideVec.clone().multiplyScalar(tipSeparation * gapFactor) : new THREE.Vector3();
      const contactOffset = supportContactOffsetForSide({ visual, side, sideVec, odMm });
      const tip = visualCenter.clone().add(contactOffset).add(gapOffset);
      const directionToTip = side.pointsTowardCenter ? sideVec.clone().multiplyScalar(-1) : sideVec;
      group.add(createDirectionalSupportCone({
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
      }));
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
    coordinatePolicy: 'record-scoped staged support visual resolver; transformed Canvas axis is authoritative for symbol geometry'
  };
  return { object: group, supportVisual: visual };
}

export function resolveManagedStageSupportVisual(record, records = [], options = {}) {
  const attrs = record?.attrs || {};
  const rawKind = firstText(attrs.SUPPORT_KIND, attrs.RESTRAINT_KIND, attrs.RESTRAINT, attrs.RESTYPE, attrs.SUPPORT_TYPE, attrs.TYPE_CODE, attrs.NAME, record?.name, record?.rawName);
  const axisInfo = resolveSupportAxis(attrs, rawKind);
  const explicitAxis = axisInfo.canvasAxisInfo || axisInfo.sourceAxisInfo;
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

  if (family === 'REST') coneSides = [{ role: 'rest-upward-cone', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'upward-support-reaction' }];
  else if (family === 'HOLDDOWN') coneSides = [
    { role: 'holddown-bottom-upward-cone', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'bottom-upward-reaction' },
    { role: 'holddown-top-downward-cone', axis: '-Y', pointsTowardCenter: false, coneSemantic: 'top-downward-restraint' }
  ];
  else if (family === 'GUIDE') {
    const guideAxes = transformedGuideAxes(axisInfo, pipeAxis);
    coneSides = guideAxes.map((axis) => ({
      role: pipeAxis === 'Y' ? 'guide-vertical-pipe-lateral-cone' : 'guide-lateral-cone',
      axis,
      pointsTowardCenter: true,
      coneSemantic: 'lateral-guide-restraint',
      axisTransformApplied: axisInfo.axisTransformApplied
    }));
  } else if (family === 'LINE_STOP' || family === 'LIMIT_STOP') {
    const explicitSingle = Boolean(explicitAxis);
    const axialSides = explicitSingle ? [axisWithSign(explicitAxis)] : [pipeAxisSigned, invertAxis(pipeAxisSigned)];
    coneSides = axialSides.map((axis) => ({
      role: family === 'LIMIT_STOP' ? 'limit-axial-cone' : 'line-stop-axial-cone',
      axis,
      pointsTowardCenter: true,
      axialPipeParallel: true,
      explicitSingle,
      coneSemantic: explicitSingle ? 'transformed-axis-axial-stop' : 'unsigned-axial-stop-pair',
      axisTransformApplied: axisInfo.axisTransformApplied
    }));
  } else if (family === 'SINGLE_AXIS_WARNING') {
    popupRequired = true;
    popupReason = 'single-axis restraint is missing support family; transformed axis is shown in diagnostics';
  } else if (family === 'SPRING_CAN') {
    popupRequired = true;
    popupReason = 'spring can rendered as five-coil can below pipe for engineering review';
  } else if (family === 'CAN') {
    popupReason = 'can support rendered below pipe';
  } else if (family === 'HANGER') {
    popupReason = 'hanger support rendered above pipe';
  } else {
    fallbackCrossRods = true;
    popupReason = 'unknown staged support restraint mapping; rendered as translucent crossed X rods fallback';
  }

  const previewPrimitiveBudgetCount = previewPrimitiveBudgetFor({ family, coneSides, popupRequired, fallbackCrossRods });
  const previewPrimitiveBudgetLimit = POLICY.maxPrimitiveBudgetPerSupportKind;
  const gapVisualSeparationMm = AXIAL_FAMILIES.has(family) && gapMm > 0 ? round(Math.min(gapMm * 10, POLICY.gapVisualSeparationMaxMm)) : 0;

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
    sourceAxis: axisInfo.sourceAxisText,
    canvasAxis: axisInfo.canvasAxisText,
    axisTransformApplied: axisInfo.axisTransformApplied,
    coneSides,
    coneCount: coneSides.length,
    directionalGlyphSides: coneSides,
    directionalGlyphCount: coneSides.length,
    previewGlyphGeometry: family === 'SPRING_CAN' ? 'five-coil-spring-can' : family === 'CAN' ? 'open-can-below-pipe' : family === 'HANGER' ? 'hanger-above-pipe' : popupRequired ? 'warning-cone' : fallbackCrossRods ? 'fallback-cross-rods' : 'directional-cones',
    previewPrimitiveBudgetCount,
    previewPrimitiveBudgetLimit,
    previewPrimitiveBudgetPass: previewPrimitiveBudgetCount <= previewPrimitiveBudgetLimit,
    explicitAxis: explicitAxis ? { ...explicitAxis } : null,
    explicitSignApplied: Boolean(explicitAxis && AXIAL_FAMILIES.has(family)),
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
    odHalfRadialContactAppliedInResolver: !AXIAL_FAMILIES.has(family) && !fallbackCrossRods,
    axialOdTwoThirdsDisplayOffsetAppliedInResolver: AXIAL_FAMILIES.has(family),
    axialNoOdHalfRadialContact: AXIAL_FAMILIES.has(family),
    axialTipsTouchUnlessGap: AXIAL_FAMILIES.has(family),
    axialPipeParallelResolver: AXIAL_FAMILIES.has(family) ? 'ODx2/3 applies only to final axial/pipe-parallel support symbols' : 'not-applicable',
    supportConeCatalogue: true,
    generalizedAxisTransform: true
  };
}

function createDirectionalSupportCone({ tip, directionToTip, length, radius, material, name, visual, side, sourceCenter, visualCenter, rawTipSeparation, tipSeparation }) {
  const direction = normalizedOr(directionToTip, new THREE.Vector3(0, 1, 0));
  const base = tip.clone().add(direction.clone().multiplyScalar(-length));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, Math.max(length, EPS_MM), 24, 1, true), material);
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
    axisTransformApplied: Boolean(side.axisTransformApplied),
    supportPreviewNoCone: false,
    supportDirectionalCone: true,
    supportDirectionalGlyphBar: false,
    supportConeOpenEnded: true,
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
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, Math.max(length, EPS_MM), 24, 1, true), material);
  cone.name = name;
  cone.position.copy(base).add(tip).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  stampPart(cone, visual, { role: 'popupRequiredWarningCone', popupRequired: true, tipMm: vecToPoint(tip), baseMm: vecToPoint(base), visualCenterMm: vecToPoint(center), supportPreviewNoCone: false, supportDirectionalCone: true, supportConeOpenEnded: true, supportWarningCone: true, supportPrimitiveBudgetCounted: true, supportPrimitiveBudgetUnitCount: 1, supportConeLengthMm: round(length), supportConeRadiusMm: round(radius) });
  return cone;
}

function createSpringCanSymbol({ center, length, radius, material, name, visual, sourceCenter, visualCenter }) {
  const bottom = center.clone().add(new THREE.Vector3(0, -length * 1.22, 0));
  const spacing = length / Math.max(POLICY.springCoilCount - 1, 1);
  const coilTubeRadius = clamp(radius * 0.08, 6, 22);
  const parts = [];
  for (let i = 0; i < POLICY.springCoilCount; i += 1) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(radius, coilTubeRadius, 8, 32), material);
    coil.name = `${name}_COIL_${i + 1}`;
    coil.position.copy(bottom).add(new THREE.Vector3(0, spacing * i, 0));
    coil.rotation.x = Math.PI / 2;
    stampPart(coil, visual, { role: 'springCanFiveCoilBelowPipe', popupRequired: true, sourceTipMm: vecToPoint(sourceCenter), visualCenterMm: vecToPoint(visualCenter), supportPreviewNoCone: true, supportSpringCanCoil: true, supportSpringCoilCount: POLICY.springCoilCount, supportPrimitiveBudgetCounted: true, supportPrimitiveBudgetUnitCount: 1, supportCanLengthMm: round(length), supportCanRadiusMm: round(radius) });
    parts.push(coil);
  }
  return parts;
}

function createCanSymbol({ center, length, radius, material, name, visual, sourceCenter, visualCenter }) {
  const bottom = center.clone().add(new THREE.Vector3(0, -length * 1.18, 0));
  const top = bottom.clone().add(new THREE.Vector3(0, length, 0));
  const body = cylinderBetween(bottom, top, radius, material, 24, `${name}_OPEN_BODY`);
  stampPart(body, visual, { role: 'canBodyBelowPipe', sourceTipMm: vecToPoint(sourceCenter), visualCenterMm: vecToPoint(visualCenter), supportPreviewNoCone: true, supportCanCylinder: true, supportCylinderOpenEnded: true, supportPrimitiveBudgetCounted: true, supportPrimitiveBudgetUnitCount: 1, supportCanLengthMm: round(length), supportCanRadiusMm: round(radius) });
  return [body];
}

function createHangerSymbol({ center, length, radius, material, name, visual, sourceCenter, visualCenter }) {
  const pipeTop = center.clone().add(new THREE.Vector3(0, length * 0.32, 0));
  const upper = pipeTop.clone().add(new THREE.Vector3(0, length, 0));
  const rod = cylinderBetween(pipeTop, upper, radius, material, 16, `${name}_ROD_ABOVE_PIPE`);
  stampPart(rod, visual, { role: 'hangerRodAbovePipe', sourceTipMm: vecToPoint(sourceCenter), visualCenterMm: vecToPoint(visualCenter), supportPreviewNoCone: true, supportHangerRod: true, supportPrimitiveBudgetCounted: true, supportPrimitiveBudgetUnitCount: 1, supportCanLengthMm: round(length), supportCanRadiusMm: round(radius) });
  return [rod];
}

function createClusterConnector(sourceCenter, visualCenter, odMm, visual, name) {
  if (!sourceCenter || !visualCenter || sourceCenter.distanceTo(visualCenter) <= EPS_MM) return null;
  const rod = cylinderBetween(sourceCenter, visualCenter, clamp(Number(odMm || 0) * 0.03, POLICY.connectorRadiusMinMm, POLICY.connectorRadiusMaxMm), mat(COLORS.FALLBACK, { transparent: true, opacity: 0.28 }), 10, name);
  stampPart(rod, visual, { role: 'clusterOffsetConnector', sourceTipMm: vecToPoint(sourceCenter), visualCenterMm: vecToPoint(visualCenter), clusterOffsetConnector: true, supportPreviewNoCone: true, supportPrimitiveBudgetCounted: false, supportPrimitiveBudgetUnitCount: 0 });
  return rod;
}

function createFallbackCrossRods(center, length, radius, material, name, visual) {
  const half = length / 2;
  return [
    [new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, half)],
    [new THREE.Vector3(-half, 0, half), new THREE.Vector3(half, 0, -half)]
  ].map(([a, b], index) => {
    const rod = cylinderBetween(center.clone().add(a), center.clone().add(b), radius, material, 12, `${name}_${index + 1}`);
    stampPart(rod, visual, { role: 'fallbackCrossRod', fallbackCrossRod: true, visualCenterMm: vecToPoint(center), supportPreviewNoCone: true, supportPrimitiveBudgetCounted: true, supportPrimitiveBudgetUnitCount: 1 });
    return rod;
  });
}

function supportContactOffsetForSide({ visual, side, sideVec, odMm }) {
  if (side.axialPipeParallel) return axialDisplayOffsetVector(visual.pipeDirection, sideVec).multiplyScalar(odMm * (2 / 3));
  const sign = side.pointsTowardCenter === false ? -1 : 1;
  const gap = Number(visual.gapMm || 0);
  return sideVec.clone().multiplyScalar(((odMm * 0.5) + gap) * sign);
}

function axialDisplayOffsetVector(pipeDirection, fallbackAxis) {
  const pipe = normalizedOr(vectorFromPoint(pipeDirection), fallbackAxis || new THREE.Vector3(1, 0, 0));
  const seed = Math.abs(pipe.y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const offset = new THREE.Vector3().crossVectors(pipe, seed);
  if (offset.lengthSq() <= EPS_MM) return new THREE.Vector3(0, 0, 1);
  return offset.normalize();
}

function vectorFromPoint(value) {
  if (value?.x !== undefined || value?.y !== undefined || value?.z !== undefined) return new THREE.Vector3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
  if (Array.isArray(value)) return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  return new THREE.Vector3(1, 0, 0);
}

function stampPart(object, visual, extra = {}) {
  object.userData = { ...(object.userData || {}), TYPE: 'MANAGED_STAGE_SUPPORT_VISUAL_PART', supportVisualPolicy: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema, supportVisualGeometry: 'cone-and-can-support-glyphs', managedStageSupportVisualPart: true, supportFamily: visual.family, supportRawKind: visual.rawKind, previewOnly: true, exportedRvmGeometry: false, popupRequired: Boolean(visual.popupRequired), fallbackCrossRods: Boolean(visual.fallbackCrossRods), supportCluster: visual.cluster, gapMm: visual.gapMm, gapRecordScoped: true, gapCarryForward: false, ...extra };
}

function previewPrimitiveBudgetFor({ family, coneSides, popupRequired, fallbackCrossRods }) {
  if (family === 'SPRING_CAN') return POLICY.springCoilCount;
  if (family === 'CAN' || family === 'HANGER') return 1;
  if (fallbackCrossRods) return 2;
  if (popupRequired) return 1;
  return (coneSides || []).length;
}

function resolvePipeContext(record, records) {
  const supportPos = supportPosition(record);
  const node = String(record?.attrs?.NODE || record?.fromNode || record?.toNode || '').trim();
  const candidates = (records || []).filter((candidate) => candidate && candidate !== record && !isSupportLike(candidate) && candidate.source?.apos && candidate.source?.lpos).map((candidate) => {
    const start = toVec(candidate.source.apos);
    const end = toVec(candidate.source.lpos);
    const line = end.clone().sub(start);
    const len = line.length();
    const nodeMatch = Boolean(node && (String(candidate.fromNode) === node || String(candidate.toNode) === node));
    const distance = supportPos ? pointToSegmentDistance(toVec(supportPos), start, end) : Number.POSITIVE_INFINITY;
    const forward = String(candidate.toNode) === node ? start.clone().sub(end) : line.clone();
    return { record: candidate, len, nodeMatch, distance, direction: normalizedOr(forward, line) };
  }).filter((candidate) => candidate.len > EPS_MM).sort((a, b) => Number(b.nodeMatch) - Number(a.nodeMatch) || a.distance - b.distance || b.len - a.len);
  const best = candidates[0];
  if (best) return { record: best.record, direction: best.direction, diameterMm: parseDiameter(best.record) };
  return { record: null, direction: new THREE.Vector3(1, 0, 0), diameterMm: 0 };
}

function resolveSupportCluster(record, records, pipeDirection, pipeDiameterMm) {
  const node = String(record?.attrs?.NODE || record?.fromNode || record?.toNode || '').trim();
  const pos = supportPosition(record);
  const recordIndex = (records || []).indexOf(record);
  const siblings = (records || []).map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => candidate && isSupportLike(candidate) && isSameSupportCluster(record, candidate, node, pos)).sort((a, b) => a.index - b.index);
  const count = siblings.length;
  const index = Math.max(0, siblings.findIndex((entry) => entry.candidate === record));
  const rawSpacingMm = clamp((Number(pipeDiameterMm) || 60) * 0.75, 35, 160);
  const spacingMm = Math.min(rawSpacingMm, POLICY.clusterOffsetMaxMm);
  let offset = new THREE.Vector3();
  if (count > 1) {
    const { u, v } = clusterBasis(pipeDirection);
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / count);
    offset = u.multiplyScalar(Math.cos(angle) * spacingMm).add(v.multiplyScalar(Math.sin(angle) * spacingMm));
  }
  return { schema: 'ManagedStageSupportCluster.v2', node, sourceIndex: recordIndex, index, count, clustered: count > 1, spacingMm: round(spacingMm), rawSpacingMm: round(rawSpacingMm), offsetMm: vecToRoundedPoint(offset), offsetMagnitudeMm: round(offset.length()), policy: count > 1 ? 'clustered support local offset' : 'single support; no visual cluster offset' };
}

function supportPosition(record) {
  return record?.source?.supportCoord || record?.source?.pos || record?.source?.bpos || record?.source?.apos || record?.source?.lpos;
}

function isSameSupportCluster(a, b, node, pos) {
  if (!a || !b) return false;
  const aNode = String(a?.attrs?.NODE || a?.fromNode || a?.toNode || '').trim();
  const bNode = String(b?.attrs?.NODE || b?.fromNode || b?.toNode || '').trim();
  if (node && aNode && bNode && aNode !== bNode) return false;
  const aPos = supportPosition(a);
  const bPos = supportPosition(b);
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
  if (/(CAN.*SPRING|SPRING.*CAN|SPRING_CAN)/.test(raw)) return 'SPRING_CAN';
  if (raw.includes('HANGER')) return 'HANGER';
  if (/^CAN$|_CAN$|^CAN_/.test(raw)) return 'CAN';
  if (raw.includes('HOLD') && raw.includes('DOWN')) return 'HOLDDOWN';
  if (raw.includes('HOLDDOWN')) return 'HOLDDOWN';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LINE_STOP') || raw.includes('LINESTOP') || raw.includes('LIMIT') || /\bLIM\b/.test(raw)) return raw.includes('LIMIT') || /\bLIM\b/.test(raw) ? 'LIMIT_STOP' : 'LINE_STOP';
  if (raw === 'REST' || raw.includes('REST')) return 'REST';
  if (explicitAxis) return explicitAxis.hasSign ? 'LINE_STOP' : 'SINGLE_AXIS_WARNING';
  return 'UNKNOWN_RESTRAINT';
}

function transformedGuideAxes(axisInfo, pipeAxis) {
  const axis = axisInfo.canvasAxisInfo || axisInfo.sourceAxisInfo;
  if (!axis) return guideAxesForPipeAxis(pipeAxis);
  const signed = axisWithSign(axis);
  if (axis.hasSign) return [signed];
  return [signed, invertAxis(signed)];
}

function guideAxesForPipeAxis(axis) {
  if (axis === 'X') return ['+Z', '-Z'];
  if (axis === 'Z') return ['+X', '-X'];
  return ['+X', '-X', '+Z', '-Z'];
}

function resolveSupportAxis(attrs = {}, rawKind = '') {
  const sourceAxisInfo = explicitAxisFrom(attrs.SUPPORT_AXIS_SOURCE_ORIGINAL, attrs.SUPPORT_AXIS_SOURCE, attrs.CAESAR_AXIS, attrs.SUPPORT_AXIS, attrs.RESTRAINT_AXIS, attrs.AXIS, attrs.DIRECTION, rawKind);
  const canvasAxisInfo = explicitAxisFrom(attrs.SUPPORT_AXIS_CANVAS, attrs.AXIS, attrs.DIRECTION, attrs.RESTRAINT_AXIS, attrs.SUPPORT_AXIS, attrs.CAESAR_AXIS, rawKind);
  const sourceAxisText = sourceAxisInfo ? axisWithSign(sourceAxisInfo) : '';
  const canvasAxisText = canvasAxisInfo ? axisWithSign(canvasAxisInfo) : '';
  const axisTransformApplied = String(attrs.SUPPORT_AXIS_CANVAS_APPLIED || '').toUpperCase() === 'TRUE'
    || Boolean(sourceAxisText && canvasAxisText && sourceAxisText !== canvasAxisText);
  return { sourceAxisInfo, canvasAxisInfo, sourceAxisText, canvasAxisText, axisTransformApplied };
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

function axisWithSign(axisInfo) { return `${axisInfo.sign || '+'}${axisInfo.axis}`; }
function signedDominantAxis(vec) { const axis = dominantAxis(vec); const value = axis === 'X' ? vec.x : axis === 'Y' ? vec.y : vec.z; return `${value < 0 ? '-' : '+'}${axis}`; }
function invertAxis(axis) { return String(axis || '+X').startsWith('-') ? String(axis).replace('-', '+') : String(axis).replace('+', '-'); }
function axisVector(axis) { const src = String(axis || '+X').trim().toUpperCase(); const sign = src.startsWith('-') ? -1 : 1; const a = src.replace(/[+-]/g, ''); if (a === 'Y') return new THREE.Vector3(0, sign, 0); if (a === 'Z') return new THREE.Vector3(0, 0, sign); return new THREE.Vector3(sign, 0, 0); }
function dominantAxis(vec) { const v = vec && vec.lengthSq?.() > EPS_MM ? vec : new THREE.Vector3(1, 0, 0); const ax = Math.abs(v.x); const ay = Math.abs(v.y); const az = Math.abs(v.z); if (ay >= ax && ay >= az) return 'Y'; if (az >= ax && az >= ay) return 'Z'; return 'X'; }
function parseRecordGapMm(attrs = {}) { return parseMm(firstText(attrs.SUPPORT_GAP_MM, attrs.SUPPORT_GAP, attrs.GAP_MM, attrs.GAP, attrs.GAPMM, attrs.RESTRAINT_GAP)) || 0; }
function parseDiameter(record) { return parseMm(record?.attrs?.DIAMETER || record?.attrs?.BORE || record?.attrs?.ABORE || record?.attrs?.LBORE || record?.attrs?.HBOR || record?.attrs?.TBOR) || 0; }
function colorForFamily(family) { return COLORS[family] || COLORS.WARNING; }
function isSupportLike(record) { const type = String(record?.type || '').toUpperCase(); const dtxr = String(record?.dtxr || '').toUpperCase(); return SUPPORT_TYPES.has(type) || SUPPORT_TYPES.has(dtxr); }
function normalizedOr(primary, fallback) { const v = primary?.lengthSq?.() > EPS_MM ? primary.clone() : fallback?.clone?.(); return v?.lengthSq?.() > EPS_MM ? v.normalize() : new THREE.Vector3(1, 0, 0); }
function pointToSegmentDistance(point, start, end) { const ab = end.clone().sub(start); const denom = ab.lengthSq(); if (denom <= EPS_MM) return point.distanceTo(start); const t = Math.max(0, Math.min(1, point.clone().sub(start).dot(ab) / denom)); return point.distanceTo(start.clone().add(ab.multiplyScalar(t))); }
function pointDistance(a, b) { if (!a || !b) return Number.POSITIVE_INFINITY; return toVec(a).distanceTo(toVec(b)); }
function supportConeLength(odMm) { return clamp(Number(odMm || 0) * 1.0, POLICY.coneLengthMinMm, POLICY.coneLengthMaxMm); }
function supportConeRadius(odMm) { return clamp(Number(odMm || 0) * 0.25, POLICY.coneRadiusMinMm, POLICY.coneRadiusMaxMm); }
function supportFallbackLength(odMm) { return clamp(Number(odMm || 0) * 1.0, POLICY.fallbackLengthMinMm, POLICY.fallbackLengthMaxMm); }
function supportCanLength(odMm) { return clamp(Number(odMm || 0) * 1.1, POLICY.springCanLengthMinMm, POLICY.springCanLengthMaxMm); }
function supportCanRadius(odMm) { return clamp(Number(odMm || 0) * 0.27, POLICY.springCanRadiusMinMm, POLICY.springCanRadiusMaxMm); }
function firstText(...values) { for (const value of values) if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim(); return ''; }
function parseMm(value) { if (value === undefined || value === null || value === '') return null; const n = Number.parseFloat(String(value).replace(/mm\b/gi, '').trim()); return Number.isFinite(n) ? n : null; }
function toVec(point) { return new THREE.Vector3(Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0); }
function vecToPoint(vec) { return { x: vec.x, y: vec.y, z: vec.z }; }
function vecToRoundedPoint(vec) { return { x: round(vec.x), y: round(vec.y), z: round(vec.z) }; }
function safeName(value) { return String(value || 'SUPPORT').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'SUPPORT'; }
function round(value) { if (!Number.isFinite(value)) return null; return Number(Number(value).toFixed(9)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }

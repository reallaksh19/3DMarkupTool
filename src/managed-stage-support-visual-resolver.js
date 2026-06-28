import * as THREE from 'three';
import { mat } from './geometry.js?v=bust-cache-4';
import { buildSupportMarkerRvmNode } from './support-marker-primitive-policy.js?v=bust-cache-4';

const EPS_MM = 0.001;
const SUPPORT_CONE_RADIAL_SEGMENTS = 8;
const SUPPORT_OPEN_CYLINDER_SEGMENTS = 10;
const RING_ARTIFACT_POLICY = 'REST/GUIDE/LINE_STOP/HOLDDOWN use open-ended low-segment cones with no cap discs, no torus rings, and no closed circular cylinder caps; torus geometry is allowed only for the five SPRING_CAN coils.';
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
  springCoilCount: 5,
  maxPrimitiveBudgetPerSupportKind: 5
});

export const MANAGED_STAGE_SUPPORT_VISUAL_POLICY = Object.freeze({
  schema: 'ManagedStageSupportVisualResolver.v6',
  rules: [
    'REST = one upward support-action axis +Y; matched pipe axis is context only',
    'HOLDDOWN = support-action axes +Y/-Y; matched pipe axis is context only',
    'GUIDE = lateral support-action axes by transformed Canvas axis when supplied, otherwise by pipe axis',
    'LINE_STOP/LIMIT = explicit transformed Canvas axis when supplied, otherwise unsigned axial pair along pipe axis',
    'X/Y/Z/+X/-X/+Y/-Y/+Z/-Z all pass through the same signed-axis transformation path',
    'Unknown ATTA/support family = visible X/fallback symbol, popupRequired=true',
    'support preview objects are non-raycast overlays so Canvas click selection remains component-safe',
    RING_ARTIFACT_POLICY
  ],
  previewGeometry: 'cone-and-can-support-glyphs',
  blockedPreviewGeometry: ['solid-pyramid', 'cone-fan', 'box-substitute', 'closed-disc-cap', 'annular-restraint-ring'],
  maxPrimitiveBudgetPerSupportKind: POLICY.maxPrimitiveBudgetPerSupportKind,
  supportConeCatalogue: true,
  generalizedAxisTransform: true,
  supportActionAxisSeparatedFromPipeAxis: true,
  ringArtifactPolicy: RING_ARTIFACT_POLICY,
  discCapsRemoved: true,
  supportPreviewRaycastDisabled: false
});

export function createManagedStageSupportPreviewObject(record, options = {}) {
  const pos = supportPosition(record);
  if (!pos) return null;

  const visual = resolveManagedStageSupportVisual(record, options.records || [], options);
  const nodeId = record.fromNode || record.toNode || record.attrs?.NODE || visual.node;
  const markerIdentity = buildPreviewMarkerIdentity(record, visual);
  const isonote = record.attrs?.ISONOTE || record.attrs?.NOTE || '';

  if (markerIdentity && options.processedNodes?.has(markerIdentity)) {
    const existing = options.processedNodes.get(markerIdentity);
    if (isonote && existing.userData) {
      existing.userData.isonoteText = existing.userData.isonoteText ? `${existing.userData.isonoteText}\n${isonote}` : isonote;
    }
    return { object: null, supportVisual: { ...visual, suppressedReason: 'duplicate-marker-identity' } };
  }

  const group = new THREE.Group();
  group.name = `MANAGED_STAGE_SUPPORT_${safeName(record?.name || record?.rawName || 'SUPPORT')}`;

  const sourceCenter = toVec(pos);
  const odMm = Math.max(visual.pipeDiameterMm || options.pointRadius * 2 || 40, 1);
  const isVerticalPipe = Math.abs(visual.pipeDirection?.y || 0) > 0.7;
  const matInstance = mat(0x00FF00, { transparent: true, opacity: 0.94 });
  const actionAxis = visual.supportActionAxes?.[0] || visual.canvasAxis || visual.sourceAxis || '+Y';

  const rvmNode = buildSupportMarkerRvmNode({
    supportFamily: visual.family,
    supportMarkerId: record.markerId || record.id || record.name || 'SUPPORT',
    positionMm: [sourceCenter.x, sourceCenter.y, sourceCenter.z],
    pipeOdMm: odMm,
    pipeAxis: visual.pipeAxisSigned || visual.pipeAxis,
    gapMm: visual.gapMm,
    axisCanvas: actionAxis,
    supportActionAxes: visual.supportActionAxes,
    matchedPipeAxis: visual.pipeAxisSigned || visual.pipeAxis
  }, { material: 0x00FF00 });

  const primitives = rvmNode.primitives || [];
  for (const p of primitives) {
    if (p.kind === 'box') {
      const [uLen, vLen, wLen] = p.lengths;
      const geom = new THREE.BoxGeometry(uLen, vLen, wLen);
      const mesh = new THREE.Mesh(geom, matInstance);
      mesh.position.set(p.center[0], p.center[1], p.center[2]);
      const mat4 = new THREE.Matrix4().makeBasis(
        new THREE.Vector3().fromArray(p.basis.x),
        new THREE.Vector3().fromArray(p.basis.y),
        new THREE.Vector3().fromArray(p.basis.z)
      );
      mesh.setRotationFromMatrix(mat4);
      group.add(mesh);
    } else if (p.kind === 'cylinder') {
      const start = new THREE.Vector3().fromArray(p.startMm);
      const end = new THREE.Vector3().fromArray(p.endMm);
      const length = start.distanceTo(end) || 0.001;
      const center = start.clone().lerp(end, 0.5);
      const geom = new THREE.CylinderGeometry(p.radius, p.radius, length, 8);
      const mesh = new THREE.Mesh(geom, matInstance);
      mesh.position.copy(center);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
      group.add(mesh);
    } else if (p.kind === 'sphere') {
      const geom = new THREE.SphereGeometry(p.radius, 16, 12);
      const mesh = new THREE.Mesh(geom, matInstance);
      mesh.position.set(p.center[0], p.center[1], p.center[2]);
      group.add(mesh);
    }
  }

  group.userData = {
    TYPE: 'SUPPORT_MARKER',
    isonoteText: isonote,
    pipeDiameterMm: odMm,
    isVerticalPipe,
    supportMarkerId: record.markerId || record.id || record.name,
    node: record.node || nodeId,
    family: record.family || visual.family,
    axis: actionAxis,
    sourceAxis: visual.sourceAxis,
    canvasAxis: visual.canvasAxis,
    supportActionAxes: visual.supportActionAxes,
    matchedPipeAxis: visual.pipeAxisSigned || visual.pipeAxis,
    matchedPipeRef: record.matchedPipeRef || visual.sourcePipePath || visual.sourcePipeRecord,
    isonoteRawText: record.isonote?.rawText || record.isonoteRawText || '',
    isonoteNoteName: record.isonote?.noteName || record.isonoteNoteName || '',
    matchMethod: record.isonote?.matchMethod || record.matchMethod || 'none',
    confidence: record.isonote?.confidence ?? record.confidence ?? 0,
    sourcePath: record.sourcePath || record.path,
    sourceKind: record.sourceKind,
    sourceAttributes: record.sourceAttributes || record.attrs,
    axisTransform: record.axisTransform,
    diagnostics: record.diagnostics,
    warningCode: record.warningCode || record.diagnostics?.[0]?.code,
    warningMessage: record.warningMessage || record.diagnostics?.[0]?.message,
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
    supportPreviewRaycastDisabled: false,
    coneCount: visual.coneCount,
    springCoilCount: visual.springCoilCount,
    canCount: visual.canCount,
    hangerCount: visual.hangerCount,
    discCapsRemoved: true,
    ringArtifactPolicy: RING_ARTIFACT_POLICY,
    coordinatePolicy: 'record-scoped staged support visual resolver; support action axis is separated from matched pipe axis'
  };
  if (markerIdentity && options.processedNodes) options.processedNodes.set(markerIdentity, group);
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
  let fallbackReason = '';

  if (family === 'REST') {
    coneSides = [{ role: 'rest-upward-cone', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'upward-support-reaction', axisSource: 'family-rule' }];
    fallbackReason = axisInfo.sourceAxisText || axisInfo.canvasAxisText ? '' : 'family-rule-axis';
  } else if (family === 'HOLDDOWN') {
    coneSides = [
      { role: 'holddown-bottom-upward-cone', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'bottom-upward-reaction', axisSource: 'family-rule' },
      { role: 'holddown-top-downward-cone', axis: '-Y', pointsTowardCenter: false, coneSemantic: 'top-downward-restraint', axisSource: 'family-rule' }
    ];
    fallbackReason = axisInfo.sourceAxisText || axisInfo.canvasAxisText ? '' : 'family-rule-axis';
  } else if (family === 'GUIDE') {
    const guideAxes = transformedGuideAxes(axisInfo, pipeAxis);
    fallbackReason = axisInfo.sourceAxisText || axisInfo.canvasAxisText ? '' : 'guide-lateral-from-pipe-axis';
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
    fallbackReason = explicitSingle ? '' : 'pipe-axis-fallback';
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
    fallbackReason = 'single-axis-warning';
    popupReason = 'single-axis restraint is missing support family; transformed axis is shown in diagnostics';
  } else if (family === 'SPRING_CAN') {
    coneSides = [{ role: 'spring-can-up-reference', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'spring-can-vertical-reference', axisSource: 'family-rule' }];
    popupReason = 'spring rendered as exactly five coils above pipe';
    fallbackReason = 'family-rule-axis';
  } else if (family === 'CAN') {
    coneSides = [{ role: 'can-vertical-reference', axis: '+Y', pointsTowardCenter: false, coneSemantic: 'can-vertical-reference', axisSource: 'family-rule' }];
    popupReason = 'can support rendered below pipe';
    fallbackReason = 'family-rule-axis';
  } else if (family === 'HANGER' || family === 'SPRING_HANGER') {
    coneSides = [{ role: 'hanger-down-reference', axis: '-Y', pointsTowardCenter: false, coneSemantic: 'hanger-vertical-reference', axisSource: 'family-rule' }];
    popupReason = 'hanger support rendered above pipe';
    fallbackReason = 'family-rule-axis';
  } else if (['U_BOLT', 'TRUNNION', 'SHOE', 'ANCHOR'].includes(family) || /^[+-]?[XYZ]$/.test(family)) {
    popupReason = `${family} support mapped to primitives`;
  } else {
    fallbackCrossRods = true;
    popupRequired = true;
    fallbackReason = 'unknown-x-blocking-flow';
    popupReason = 'unknown staged support restraint mapping; rendered as X blocking-flow fallback';
  }

  const supportActionAxes = uniqueAxes(coneSides.map((side) => side.axis));
  const previewPrimitiveBudgetCount = previewPrimitiveBudgetFor({ family, coneSides, popupRequired, fallbackCrossRods });
  const previewPrimitiveBudgetLimit = POLICY.maxPrimitiveBudgetPerSupportKind;
  const gapVisualSeparationMm = AXIAL_FAMILIES.has(family) && gapMm > 0 ? round(Math.min(gapMm * 10, 280)) : 0;
  const displayCanvasAxis = axisInfo.canvasAxisText || supportActionAxes[0] || '';

  return {
    schema: MANAGED_STAGE_SUPPORT_VISUAL_POLICY.schema,
    rawKind,
    family,
    node: String(attrs.NODE || record?.fromNode || record?.toNode || ''),
    pipeAxis,
    pipeAxisSigned,
    matchedPipeAxis: pipeAxisSigned,
    pipeDirection: vecToPoint(pipeContext.direction),
    pipeDiameterMm: round(pipeDiameterMm),
    pipeRadiusMm: round((Number(pipeDiameterMm) || 0) / 2),
    sourcePipeRecord: pipeContext.record?.name || '',
    sourcePipePath: pipeContext.record?.path || '',
    sourceAxis: axisInfo.sourceAxisText,
    mappedCanvasAxis: axisInfo.canvasAxisText,
    canvasAxis: displayCanvasAxis,
    supportActionAxes,
    primarySupportActionAxis: supportActionAxes[0] || displayCanvasAxis,
    axisTransformApplied: axisInfo.axisTransformApplied,
    axisFallbackReason: fallbackReason,
    coneSides,
    coneCount: coneSides.length,
    springCoilCount: family === 'SPRING_CAN' ? POLICY.springCoilCount : 0,
    canCount: family === 'CAN' ? 1 : 0,
    hangerCount: family === 'HANGER' ? 1 : 0,
    discCapsRemoved: true,
    ringArtifactPolicy: RING_ARTIFACT_POLICY,
    directionalGlyphSides: coneSides,
    directionalGlyphCount: coneSides.length,
    previewGlyphGeometry: family === 'SPRING_CAN' ? 'five-coil-spring-can' : family === 'CAN' ? 'open-can-below-pipe' : family === 'HANGER' ? 'hanger-above-pipe' : popupRequired ? 'warning-x-blocking-flow' : fallbackCrossRods ? 'fallback-cross-rods' : 'directional-cones',
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
    generalizedAxisTransform: true,
    supportActionAxisSeparatedFromPipeAxis: true,
    supportPreviewRaycastDisabled: false
  };
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
  const spacingMm = Math.min(rawSpacingMm, 28);
  let offset = new THREE.Vector3();
  if (count > 1) {
    const { u, v } = clusterBasis(pipeDirection);
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / count);
    offset = u.multiplyScalar(Math.cos(angle) * spacingMm).add(v.multiplyScalar(Math.sin(angle) * spacingMm));
  }
  return { schema: 'ManagedStageSupportCluster.v2', node, sourceIndex: recordIndex, index, count, clustered: count > 1, spacingMm: round(spacingMm), rawSpacingMm: round(rawSpacingMm), offsetMm: vecToRoundedPoint(offset), offsetMagnitudeMm: round(offset.length()), policy: count > 1 ? 'clustered support local offset' : 'single support; no visual cluster offset' };
}

function buildPreviewMarkerIdentity(record, visual) {
  return [
    record?.attrs?.SUPPORT_SOURCE_MODE || record?.sourceMode || 'stagedJson',
    record?.attrs?.NODE || record?.fromNode || record?.toNode || visual?.node || 'NO_NODE',
    visual?.family || record?.attrs?.SUPPORT_KIND || record?.family || 'UNKNOWN',
    record?.attrs?.REF || record?.attrs?.NAME || record?.sourcePath || record?.path || record?.name || record?.rawName || 'SUPPORT'
  ].map(safeName).join('/');
}

function supportPosition(record) { return record?.source?.supportCoord || record?.source?.pos || record?.source?.bpos || record?.source?.apos || record?.source?.lpos; }
function isSameSupportCluster(a, b, node, pos) { const aNode = String(a?.attrs?.NODE || a?.fromNode || a?.toNode || '').trim(); const bNode = String(b?.attrs?.NODE || b?.fromNode || b?.toNode || '').trim(); if (node && aNode && bNode && aNode !== bNode) return false; const aPos = supportPosition(a); const bPos = supportPosition(b); if (!aPos || !bPos || !pos) return false; return pointDistance(aPos, bPos) <= 0.01; }
function clusterBasis(direction) { const pipe = normalizedOr(direction, new THREE.Vector3(1, 0, 0)); const seed = Math.abs(pipe.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); let u = new THREE.Vector3().crossVectors(pipe, seed); if (u.lengthSq() <= EPS_MM) u = new THREE.Vector3(0, 0, 1); u.normalize(); const v = new THREE.Vector3().crossVectors(pipe, u).normalize(); return { u, v }; }
function normalizeSupportFamily(rawKind, explicitAxis) { const raw = String(rawKind || '').toUpperCase().replace(/[\s\-]+/g, '_'); if (/(CAN.*SPRING|SPRING.*CAN|SPRING_CAN)/.test(raw)) return 'SPRING_CAN'; if (raw === 'SPRING_HANGER') return 'SPRING_HANGER'; if (raw.includes('HANGER')) return 'HANGER'; if (/^CAN$|_CAN$|^CAN_/.test(raw)) return 'CAN'; if (raw.includes('HOLD') && raw.includes('DOWN')) return 'HOLDDOWN'; if (raw.includes('HOLDDOWN')) return 'HOLDDOWN'; if (raw.includes('GUIDE')) return 'GUIDE'; if (raw.includes('LINE_STOP') || raw.includes('LINESTOP') || raw.includes('LIMIT') || /\bLIM\b/.test(raw)) return raw.includes('LIMIT') || /\bLIM\b/.test(raw) ? 'LIMIT_STOP' : 'LINE_STOP'; if (raw === 'REST' || raw.includes('REST')) return 'REST'; const exactAllowed = ['U_BOLT', 'TRUNNION', 'SHOE', 'ANCHOR']; if (exactAllowed.includes(raw)) return raw; if (explicitAxis) return explicitAxis.hasSign ? 'LINE_STOP' : 'SINGLE_AXIS_WARNING'; if (/^[+-]?[XYZ]$/.test(raw)) return raw; return 'UNKNOWN_RESTRAINT'; }
function transformedGuideAxes(axisInfo, pipeAxis) { const axis = axisInfo.canvasAxisInfo || axisInfo.sourceAxisInfo; if (!axis) return guideAxesForPipeAxis(pipeAxis); const signed = axisWithSign(axis); if (axis.hasSign) return [signed]; return [signed, invertAxis(signed)]; }
function guideAxesForPipeAxis(axis) { if (axis === 'X') return ['+Z', '-Z']; if (axis === 'Z') return ['+X', '-X']; return ['+X', '-X', '+Z', '-Z']; }
function resolveSupportAxis(attrs = {}, rawKind = '') { const sourceAxisInfo = explicitAxisFrom(attrs.SUPPORT_AXIS_SOURCE_ORIGINAL, attrs.SUPPORT_AXIS_SOURCE, attrs.CAESAR_AXIS, attrs.SUPPORT_AXIS, attrs.RESTRAINT_AXIS, attrs.AXIS, attrs.DIRECTION, rawKind); const canvasAxisInfo = explicitAxisFrom(attrs.SUPPORT_AXIS_CANVAS, attrs.AXIS, attrs.DIRECTION, attrs.RESTRAINT_AXIS, attrs.SUPPORT_AXIS, attrs.CAESAR_AXIS, rawKind); const sourceAxisText = sourceAxisInfo ? axisWithSign(sourceAxisInfo) : ''; const canvasAxisText = canvasAxisInfo ? axisWithSign(canvasAxisInfo) : ''; const axisTransformApplied = String(attrs.SUPPORT_AXIS_CANVAS_APPLIED || '').toUpperCase() === 'TRUE' || Boolean(sourceAxisText && canvasAxisText && sourceAxisText !== canvasAxisText); return { sourceAxisInfo, canvasAxisInfo, sourceAxisText, canvasAxisText, axisTransformApplied }; }
function explicitAxisFrom(...values) { for (const value of values) { const text = String(value || '').toUpperCase().trim(); if (!text) continue; const match = text.match(/(^|[^A-Z0-9])([+-]?)(X|Y|Z)([^A-Z0-9]|$)/); if (match) return { axis: match[3], sign: match[2] || '', hasSign: match[2] === '+' || match[2] === '-' }; } return null; }
function axisWithSign(axisInfo) { return `${axisInfo.sign || '+'}${axisInfo.axis}`; }
function signedDominantAxis(vec) { const axis = dominantAxis(vec); const value = axis === 'X' ? vec.x : axis === 'Y' ? vec.y : vec.z; return `${value < 0 ? '-' : '+'}${axis}`; }
function invertAxis(axis) { return String(axis || '+X').startsWith('-') ? String(axis).replace('-', '+') : String(axis).replace('+', '-'); }
function dominantAxis(vec) { const v = vec && vec.lengthSq?.() > EPS_MM ? vec : new THREE.Vector3(1, 0, 0); const ax = Math.abs(v.x); const ay = Math.abs(v.y); const az = Math.abs(v.z); if (ay >= ax && ay >= az) return 'Y'; if (az >= ax && az >= ay) return 'Z'; return 'X'; }
function parseRecordGapMm(attrs = {}) { return parseMm(firstText(attrs.SUPPORT_GAP_MM, attrs.SUPPORT_GAP, attrs.GAP_MM, attrs.GAP, attrs.GAPMM, attrs.RESTRAINT_GAP)) || 0; }
function parseDiameter(record) { return parseMm(record?.attrs?.DIAMETER || record?.attrs?.BORE || record?.attrs?.ABORE || record?.attrs?.LBORE || record?.attrs?.HBOR || record?.attrs?.TBOR) || 0; }
function isSupportLike(record) { const type = String(record?.type || '').toUpperCase(); const dtxr = String(record?.dtxr || '').toUpperCase(); return SUPPORT_TYPES.has(type) || SUPPORT_TYPES.has(dtxr); }
function normalizedOr(primary, fallback) { const v = primary?.lengthSq?.() > EPS_MM ? primary.clone() : fallback?.clone?.(); return v?.lengthSq?.() > EPS_MM ? v.normalize() : new THREE.Vector3(1, 0, 0); }
function pointToSegmentDistance(point, start, end) { const ab = end.clone().sub(start); const denom = ab.lengthSq(); if (denom <= EPS_MM) return point.distanceTo(start); const t = Math.max(0, Math.min(1, point.clone().sub(start).dot(ab) / denom)); return point.distanceTo(start.clone().add(ab.multiplyScalar(t))); }
function pointDistance(a, b) { if (!a || !b) return Number.POSITIVE_INFINITY; return toVec(a).distanceTo(toVec(b)); }
function uniqueAxes(axes = []) { return [...new Set((axes || []).map((axis) => String(axis || '').trim()).filter(Boolean))]; }
function firstText(...values) { for (const value of values) if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim(); return ''; }
function parseMm(value) { if (value === undefined || value === null || value === '') return null; const n = Number.parseFloat(String(value).replace(/mm\b/gi, '').trim()); return Number.isFinite(n) ? n : null; }
function toVec(point) { return new THREE.Vector3(Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0); }
function vecToPoint(vec) { return { x: vec.x, y: vec.y, z: vec.z }; }
function vecToRoundedPoint(vec) { return { x: round(vec.x), y: round(vec.y), z: round(vec.z) }; }
function safeName(value) { return String(value || 'SUPPORT').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'SUPPORT'; }
function round(value) { if (!Number.isFinite(value)) return null; return Number(Number(value).toFixed(9)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }

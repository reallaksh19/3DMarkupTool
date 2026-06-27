import { buildEndpointLockedCylinderPrimitive } from './rvm-cylinder-primitive-builder.js?v=bust-cache-4';
import { resolveManagedStageSupportVisual } from './managed-stage-support-visual-resolver.js?v=bust-cache-4';

const SUPPORT_MATERIAL_ID = 9;
const EPS_MM = 0.001;
const SUPPORT_CODE8_CYLINDER = 8;
const BLOCKED_SUPPORT_PRIMITIVE_CODES = Object.freeze([1, 5, 6, 7, 11]);
const DEFAULT_RVM_SCALE_POLICY = Object.freeze({
  supportGlyphLengthMinMm: 25,
  supportGlyphLengthMaxMm: 60,
  supportAxialGlyphLengthMaxMm: 55,
  supportFallbackGlyphLengthMaxMm: 60,
  supportSpringCanLengthMaxMm: 60,
  supportBarRadiusMinMm: 1,
  supportBarRadiusMaxMm: 3,
  supportClusterOffsetMaxMm: 28,
  supportGapVisualSeparationMaxMm: 28,
  supportEndpointEnvelopeMaxMm: 100
});

export function buildManagedStageSupportRvmExportNodes(profile, options = {}) {
  const records = profile?.records || [];
  const supportRecords = profile?.supportRecords || [];
  const scalePolicy = resolveSupportRvmScalePolicy(options);
  const adaptedRecords = records.map(adaptRecordForSupportResolver);
  const supportNodes = [];
  const families = {};
  const primitiveCodeHistogram = {};
  const supportWarnings = [];
  let primitiveCount = 0;
  let conePrimitiveCount = 0;
  let barPrimitiveCount = 0;
  let glyphPrimitiveCount = 0;
  let clusteredSupportRecordCount = 0;
  let connectorPrimitiveCount = 0;
  let fallbackPrimitiveCount = 0;
  let warningPrimitiveCount = 0;
  let maxGlyphExtentMm = 0;
  let maxClusterOffsetMm = 0;
  let maxPrimitiveSpanMm = 0;
  let maxBarRadiusMm = 0;

  supportRecords.forEach((record, index) => {
    const adapted = adaptRecordForSupportResolver(record);
    const visual = resolveManagedStageSupportVisual(adapted, adaptedRecords, options);
    const node = supportElementNode(record, adapted, visual, index, { ...options, scalePolicy });
    supportNodes.push(node);
    primitiveCount += node.primitives.length;
    conePrimitiveCount += node.primitives.filter((primitive) => primitive.supportPointCone === true).length;
    barPrimitiveCount += node.primitives.filter((primitive) => primitive.supportBar === true).length;
    glyphPrimitiveCount += node.primitives.filter((primitive) => primitive.supportDirectionalGlyphBar === true).length;
    families[visual.family] = (families[visual.family] || 0) + 1;
    if (visual.cluster?.clustered) clusteredSupportRecordCount += 1;
    connectorPrimitiveCount += node.primitives.filter((primitive) => primitive.supportClusterConnector).length;
    fallbackPrimitiveCount += node.primitives.filter((primitive) => primitive.supportFallbackCrossRod).length;
    warningPrimitiveCount += node.primitives.filter((primitive) => primitive.supportWarningMarker).length;
    supportWarnings.push(...(node.supportWarnings || []));

    for (const primitive of node.primitives) {
      const code = primitive.kind === 'cylinder' ? SUPPORT_CODE8_CYLINDER : null;
      primitiveCodeHistogram[code] = (primitiveCodeHistogram[code] || 0) + 1;
      maxGlyphExtentMm = Math.max(maxGlyphExtentMm, primitiveMaxDistanceFrom(primitive, node.position));
      maxPrimitiveSpanMm = Math.max(maxPrimitiveSpanMm, Number(primitive.length || 0));
      maxBarRadiusMm = Math.max(maxBarRadiusMm, Number(primitive.radius || 0));
      if (primitive.supportClusterConnector) maxClusterOffsetMm = Math.max(maxClusterOffsetMm, Number(primitive.length || 0));
    }
  });

  const forbiddenPresent = BLOCKED_SUPPORT_PRIMITIVE_CODES.filter((code) => Number(primitiveCodeHistogram[code] || 0) > 0);

  return {
    schema: 'ManagedStageSupportRvmExport.v5',
    materialId: options.materialId || SUPPORT_MATERIAL_ID,
    supportRecordCount: supportRecords.length,
    supportNodeCount: supportNodes.length,
    supportRecordsExported: supportNodes.filter(n => n.primitives && n.primitives.length > 0).length,
    supportRecordsSkipped: supportNodes.filter(n => !n.primitives || n.primitives.length === 0).length,
    supportPrimitiveCount: primitiveCount,
    supportConePrimitiveCount: conePrimitiveCount,
    supportDirectionalGlyphPrimitiveCount: glyphPrimitiveCount,
    supportBarPrimitiveCount: barPrimitiveCount,
    connectorPrimitiveCount,
    fallbackPrimitiveCount,
    warningPrimitiveCount,
    clusteredSupportRecordCount,
    supportPrimitiveCodeHistogram: cleanHistogram(primitiveCodeHistogram),
    supportAllowedPrimitiveCodes: [SUPPORT_CODE8_CYLINDER],
    supportForbiddenPrimitiveCodes: [...BLOCKED_SUPPORT_PRIMITIVE_CODES],
    supportForbiddenPrimitiveCodesPresent: forbiddenPresent,
    supportMaxGlyphExtentMm: round(maxGlyphExtentMm),
    supportMaxClusterOffsetMm: round(maxClusterOffsetMm),
    supportMaxPrimitiveSpanMm: round(maxPrimitiveSpanMm),
    supportMaxBarRadiusMm: round(maxBarRadiusMm),
    supportFamilies: families,
    familyHistogram: families,
    supportWarnings,
    scalePolicy,
    nodes: supportNodes,
    policy: 'managed-stage ATTA/support records are emitted to RVM as compact Review-safe code-8 cylinder bar glyphs only; filled code-1 pyramid/cone substitutes and cone-fan glyphs are blocked; source POS/SUPPORTCOORD remains the anchor coordinate'
  };
}

function supportElementNode(record, adapted, visual, index, options = {}) {
  const scalePolicy = options.scalePolicy || resolveSupportRvmScalePolicy(options);
  const sourceCenter = toPoint(adapted.source.supportCoord || adapted.source.pos || adapted.source.bpos || adapted.source.apos || adapted.source.lpos);
  const rawOffset = toPoint(visual.cluster?.offsetMm || [0, 0, 0]);
  const offset = compactClusterOffset(rawOffset, scalePolicy);
  const visualCenter = add(sourceCenter, offset);
  const odMm = Math.max(Number(visual.pipeDiameterMm || 0), Number(options.pointRadius || 0) * 2, 40);
  const genericLength = supportGlyphLength(odMm, 0.38, scalePolicy.supportGlyphLengthMaxMm, scalePolicy);
  const axialLength = supportGlyphLength(odMm, 0.32, scalePolicy.supportAxialGlyphLengthMaxMm, scalePolicy);
  const fallbackLength = supportGlyphLength(odMm, 0.38, scalePolicy.supportFallbackGlyphLengthMaxMm, scalePolicy);
  const glyphCapLength = clamp(genericLength * 0.32, 8, 18);
  const barRadius = supportBarRadius(odMm, scalePolicy);
  const supportName = record.attributes?.NAME || record.name || `SUPPORT_${index + 1}`;
  const primitives = [];
  const supportWarnings = [];

  if (distance(rawOffset, offset) > EPS_MM) {
    supportWarnings.push({
      code: 'SUPPORT_CLUSTER_OFFSET_COMPACTED',
      support: supportName,
      rawOffsetMm: round(distance(rawOffset, [0, 0, 0])),
      exportOffsetMm: round(distance(offset, [0, 0, 0])),
      capMm: scalePolicy.supportClusterOffsetMaxMm
    });
  }

  if (distance(sourceCenter, visualCenter) > EPS_MM) {
    primitives.push(supportBar({
      name: `${supportName}_CLUSTER_OFFSET_BAR`,
      localName: 'support-cluster-offset-bar',
      startMm: sourceCenter,
      endMm: visualCenter,
      radiusMm: barRadius,
      record,
      visual,
      role: 'cluster-offset-connector',
      extra: {
        supportClusterConnector: true,
        supportRvmClusterOffsetCompacted: distance(rawOffset, offset) > EPS_MM,
        supportRvmClusterRawOffsetMm: rawOffset,
        supportRvmClusterExportOffsetMm: offset,
        supportSourceAnchorMm: sourceCenter,
        supportVisualCenterMm: visualCenter
      }
    }));
  }

  if (visual.family === 'SPRING_CAN') {
    primitives.push(...springCanBars(supportName, visualCenter, odMm, record, visual, scalePolicy));
  } else if (visual.fallbackCrossRods || visual.popupRequired) {
    const fallback = fallbackCrossBars(supportName, visualCenter, fallbackLength, barRadius, record, visual, visual.popupRequired);
    primitives.push(...fallback);
  } else {
    const rawTipSeparation = visual.gapMm > 0 && isAxialFamily(visual.family)
      ? Number(visual.gapVisualSeparationMm || visual.gapMm * 10)
      : 0;
    const tipSeparation = clamp(rawTipSeparation, 0, scalePolicy.supportGapVisualSeparationMaxMm);
    if (rawTipSeparation > tipSeparation + EPS_MM) {
      supportWarnings.push({
        code: 'SUPPORT_GAP_VISUAL_SEPARATION_CAPPED',
        support: supportName,
        rawGapVisualSeparationMm: round(rawTipSeparation),
        exportGapVisualSeparationMm: round(tipSeparation),
        capMm: scalePolicy.supportGapVisualSeparationMaxMm
      });
    }
    for (const side of visual.coneSides || []) {
      const sideVec = axisVector(side.axis);
      const length = side.axialPipeParallel ? axialLength : genericLength;
      const gapFactor = side.explicitSingle ? 1 : 0.5;
      const tip = add(visualCenter, isAxialFamily(visual.family) ? scale(sideVec, tipSeparation * gapFactor) : [0, 0, 0]);
      const directionToTip = side.pointsTowardCenter ? scale(sideVec, -1) : sideVec;
      primitives.push(...supportDirectionalGlyphBars({
        name: `${supportName}_${safeName(side.role || 'SUPPORT')}_${axisToken(side.axis)}`,
        localName: side.role || 'support-directional-glyph',
        tipMm: tip,
        directionToTip,
        lengthMm: length,
        capLengthMm: glyphCapLength,
        barRadiusMm: barRadius,
        record,
        visual,
        role: side.role || 'support-directional-glyph',
        extra: {
          supportAxis: side.axis,
          supportDirectionalRod: true,
          supportDirectionalCone: false,
          supportDirectionalGlyphBar: true,
          supportPointCone: false,
          supportPyramidSubstituteBlocked: true,
          supportConeFanBlocked: true,
          axialPipeParallel: Boolean(side.axialPipeParallel),
          explicitSingle: Boolean(side.explicitSingle),
          supportSourceAnchorMm: sourceCenter,
          supportTipMm: tip,
          supportVisualCenterMm: visualCenter,
          supportGapVisualSeparationRawMm: round(rawTipSeparation),
          supportGapVisualSeparationExportMm: round(tipSeparation),
          supportGlyphCapLengthMm: glyphCapLength,
          supportGlyphLengthMm: length,
          supportGlyphStyle: 'single-bar-with-tip-tick'
        }
      }));
    }
  }

  return {
    name: supportName,
    reviewName: supportName,
    material: options.materialId || SUPPORT_MATERIAL_ID,
    layer: 'SUPPORTS',
    position: visualCenter,
    sourceAnchor: sourceCenter,
    supportWarnings,
    attributes: {
      NAME: supportName,
      TYPE: record.type || 'ATTA',
      RAW_TYPE: record.attributes?.RAW_TYPE || record.type || 'ATTA',
      SUPPORT_KIND: record.attributes?.SUPPORT_KIND || record.attributes?.SUPPORT_TYPE || '',
      SUPPORT_FAMILY: visual.family,
      NODE: record.attributes?.NODE || '',
      MATERIAL_ID: String(options.materialId || SUPPORT_MATERIAL_ID),
      COMPONENT_CLASS: 'SUPPORT',
      SOURCE_RESTRAINT_ID: record.attributes?.SOURCE_RESTRAINT_ID || record.attributes?.REF || '',
      SOURCE_FORMAT: record.attributes?.SOURCE_FORMAT || 'inputxml-managed-stage/v1',
      RVM_SUPPORT_OVERLAY: 'YES',
      SUPPORT_SYMBOL_POLICY: 'CODE8_COMPACT_BAR_GLYPHS_NO_PYRAMIDS_NO_CONE_FAN',
      SUPPORT_RVM_ALLOWED_CODES: '8',
      SUPPORT_RVM_FORBIDDEN_CODES: BLOCKED_SUPPORT_PRIMITIVE_CODES.join(','),
      SUPPORT_RVM_PYRAMID_SUBSTITUTE_BLOCKED: 'TRUE',
      SUPPORT_RVM_CONE_FAN_BLOCKED: 'TRUE',
      SUPPORT_CLUSTER_INDEX: String(visual.cluster?.index ?? ''),
      SUPPORT_CLUSTER_COUNT: String(visual.cluster?.count ?? ''),
      SUPPORT_CLUSTER_RVM_OFFSET_MAX_MM: String(scalePolicy.supportClusterOffsetMaxMm),
      SUPPORT_GLYPH_RVM_LENGTH_MAX_MM: String(scalePolicy.supportGlyphLengthMaxMm),
      SUPPORT_BAR_RVM_RADIUS_MAX_MM: String(scalePolicy.supportBarRadiusMaxMm),
      SUPPORT_GAP_RVM_VISUAL_SEPARATION_MAX_MM: String(scalePolicy.supportGapVisualSeparationMaxMm)
    },
    primitives,
    children: []
  };
}

function supportDirectionalGlyphBars({ name, localName, tipMm, directionToTip, lengthMm, capLengthMm, barRadiusMm, record, visual, role, extra = {} }) {
  const direction = normalize(directionToTip, [0, 1, 0]);
  const tip = vector3(tipMm);
  const base = add(tip, scale(direction, -lengthMm));
  const capInset = clamp(lengthMm * 0.22, 5, 12);
  const capCenter = add(tip, scale(direction, -capInset));
  const { u } = perpendicularBasis(direction);
  const capHalf = clamp(capLengthMm, 8, 18) / 2;
  const capStart = add(capCenter, scale(u, -capHalf));
  const capEnd = add(capCenter, scale(u, capHalf));

  const commonExtra = {
    ...extra,
    supportGlyphTipMm: tip,
    supportGlyphBaseMm: base,
    supportGlyphCapCenterMm: capCenter,
    supportPrimitiveCode: SUPPORT_CODE8_CYLINDER,
    orientationAssumption: 'Support/ATTA record exported as compact single/tick Review-safe code-8 cylinder glyph; canvas may use true THREE.ConeGeometry but RVM export never emits filled code-1 pyramid substitutes or multi-spoke cone fans'
  };

  return [
    supportBar({
      name: `${name}_RVM_STEM_BAR`,
      localName: `${localName}-rvm-stem-bar`,
      startMm: base,
      endMm: tip,
      radiusMm: barRadiusMm,
      record,
      visual,
      role: `${role}-rvm-stem-bar`,
      extra: {
        ...commonExtra,
        supportGlyphStemBar: true
      }
    }),
    supportBar({
      name: `${name}_RVM_TIP_TICK`,
      localName: `${localName}-rvm-tip-tick`,
      startMm: capStart,
      endMm: capEnd,
      radiusMm: clamp(barRadiusMm * 0.72, 1, 2.25),
      record,
      visual,
      role: `${role}-rvm-tip-tick`,
      extra: {
        ...commonExtra,
        supportGlyphTipTick: true,
        supportGlyphTickStartMm: capStart,
        supportGlyphTickEndMm: capEnd
      }
    })
  ];
}

function supportBar({ name, localName, startMm, endMm, radiusMm, record, visual, role, extra = {} }) {
  const primitive = buildEndpointLockedCylinderPrimitive({
    name,
    localName,
    startMm,
    endMm,
    radiusMm,
    material: SUPPORT_MATERIAL_ID,
    sourceContractName: record.attributes?.NAME || record.name || '',
    sourceElementId: record.attributes?.SOURCE_RESTRAINT_ID || record.attributes?.REF || record.name || '',
    primitiveRole: `managed-stage-rvm-support-${role}`,
    parentStartMm: startMm,
    parentEndMm: endMm,
    startOffsetMm: 0,
    endOffsetMm: 0
  });
  return {
    ...primitive,
    ...extra,
    recipeName: 'managed-stage-rvm-support-overlay-bar',
    managedStageSupportRvmPrimitive: true,
    supportPrimitiveCode: SUPPORT_CODE8_CYLINDER,
    supportPointCone: false,
    supportBar: true,
    supportFamily: visual.family,
    supportRawKind: visual.rawKind,
    supportNode: visual.node,
    supportGapMm: visual.gapMm,
    supportGapRecordScoped: true,
    supportCluster: visual.cluster,
    orientationAssumption: extra.orientationAssumption || 'Support/ATTA record exported as compact Review-safe code-8 cylinder bar for connectors/fallback/support warnings'
  };
}

function springCanBars(name, center, odMm, record, visual, scalePolicy) {
  const length = supportGlyphLength(odMm, 0.34, scalePolicy.supportSpringCanLengthMaxMm, scalePolicy);
  const radius = supportBarRadius(odMm, scalePolicy);
  const bottom = add(center, [0, -length, 0]);
  const bandHalf = clamp(length * 0.22, 8, 14);
  return [
    supportBar({ name: `${name}_SPRING_CAN_VERTICAL`, localName: 'spring-can-warning-vertical', startMm: center, endMm: bottom, radiusMm: radius, record, visual, role: 'spring-can-warning-vertical', extra: { supportWarningMarker: true, supportVisualCenterMm: center } }),
    supportBar({ name: `${name}_SPRING_CAN_BAND_1`, localName: 'spring-can-warning-band-1', startMm: add(bottom, [-bandHalf, 0, 0]), endMm: add(bottom, [bandHalf, 0, 0]), radiusMm: radius, record, visual, role: 'spring-can-warning-band', extra: { supportWarningMarker: true, supportVisualCenterMm: center } }),
    supportBar({ name: `${name}_SPRING_CAN_BAND_2`, localName: 'spring-can-warning-band-2', startMm: add(bottom, [0, length * 0.32, -bandHalf]), endMm: add(bottom, [0, length * 0.32, bandHalf]), radiusMm: radius, record, visual, role: 'spring-can-warning-band', extra: { supportWarningMarker: true, supportVisualCenterMm: center } })
  ];
}

function fallbackCrossBars(name, center, length, radius, record, visual, warning = false) {
  const half = length / 2;
  const pairs = [
    [[-half, 0, -half], [half, 0, half]],
    [[-half, 0, half], [half, 0, -half]]
  ];
  return pairs.map(([a, b], index) => supportBar({
    name: `${name}_${warning ? 'WARNING' : 'FALLBACK'}_X_BAR_${index + 1}`,
    localName: warning ? `support-warning-x-bar-${index + 1}` : `support-fallback-x-bar-${index + 1}`,
    startMm: add(center, a),
    endMm: add(center, b),
    radiusMm: radius,
    record,
    visual,
    role: warning ? 'support-warning-x-bar' : 'support-fallback-x-bar',
    extra: warning
      ? { supportWarningMarker: true, supportVisualCenterMm: center }
      : { supportFallbackCrossRod: true, supportVisualCenterMm: center }
  }));
}

function adaptRecordForSupportResolver(record) {
  const attrs = record?.attributes || {};
  return {
    ...record,
    attrs,
    fromNode: attrs.FROM_NODE || attrs.NODE || '',
    toNode: attrs.TO_NODE || attrs.NODE || '',
    source: {
      apos: pointOrNull(attrs.APOS),
      lpos: pointOrNull(attrs.LPOS),
      pos: pointOrNull(attrs.POS),
      bpos: pointOrNull(attrs.BPOS),
      supportCoord: pointOrNull(attrs.SUPPORTCOORD || attrs.SUPPORT_COORD)
    }
  };
}

function pointOrNull(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function toPoint(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (value && typeof value === 'object') return [Number(value.x), Number(value.y), Number(value.z)];
  return [0, 0, 0];
}

function vector3(value) {
  if (!Array.isArray(value) || value.length !== 3) return [0, 0, 0];
  return value.map((entry) => Number(entry));
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a, n) {
  return [a[0] * n, a[1] * n, a[2] * n];
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function normalize(value, fallback) {
  const vector = vector3(value);
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!Number.isFinite(length) || length <= EPS_MM) return [...fallback];
  return vector.map((entry) => entry / length);
}

function axisVector(axis) {
  const text = String(axis || '+X').toUpperCase();
  const sign = text.startsWith('-') ? -1 : 1;
  const raw = text.replace(/[+-]/g, '');
  if (raw === 'Y') return [0, sign, 0];
  if (raw === 'Z') return [0, 0, sign];
  return [sign, 0, 0];
}

function axisToken(axis) {
  return String(axis || 'X').replace('+', 'POS_').replace('-', 'NEG_').replace(/[^A-Za-z0-9_]/g, '_');
}

function isAxialFamily(family) {
  return family === 'LINE_STOP' || family === 'LIMIT_STOP';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function safeName(value) {
  return String(value || 'SUPPORT').replace(/[^A-Za-z0-9_.-]+/g, '_');
}

function resolveSupportRvmScalePolicy(options = {}) {
  return Object.freeze({
    supportGlyphLengthMinMm: finiteOption(options.rvmSupportGlyphLengthMinMm, DEFAULT_RVM_SCALE_POLICY.supportGlyphLengthMinMm),
    supportGlyphLengthMaxMm: finiteOption(options.rvmSupportGlyphLengthMaxMm, DEFAULT_RVM_SCALE_POLICY.supportGlyphLengthMaxMm),
    supportAxialGlyphLengthMaxMm: finiteOption(options.rvmSupportAxialGlyphLengthMaxMm, DEFAULT_RVM_SCALE_POLICY.supportAxialGlyphLengthMaxMm),
    supportFallbackGlyphLengthMaxMm: finiteOption(options.rvmSupportFallbackGlyphLengthMaxMm, DEFAULT_RVM_SCALE_POLICY.supportFallbackGlyphLengthMaxMm),
    supportSpringCanLengthMaxMm: finiteOption(options.rvmSupportSpringCanLengthMaxMm, DEFAULT_RVM_SCALE_POLICY.supportSpringCanLengthMaxMm),
    supportBarRadiusMinMm: finiteOption(options.rvmSupportBarRadiusMinMm, DEFAULT_RVM_SCALE_POLICY.supportBarRadiusMinMm),
    supportBarRadiusMaxMm: finiteOption(options.rvmSupportBarRadiusMaxMm, DEFAULT_RVM_SCALE_POLICY.supportBarRadiusMaxMm),
    supportClusterOffsetMaxMm: finiteOption(options.rvmSupportClusterOffsetMaxMm, DEFAULT_RVM_SCALE_POLICY.supportClusterOffsetMaxMm),
    supportGapVisualSeparationMaxMm: finiteOption(options.rvmSupportGapVisualSeparationMaxMm, DEFAULT_RVM_SCALE_POLICY.supportGapVisualSeparationMaxMm),
    supportEndpointEnvelopeMaxMm: finiteOption(options.rvmSupportEndpointEnvelopeMaxMm, DEFAULT_RVM_SCALE_POLICY.supportEndpointEnvelopeMaxMm)
  });
}

function supportGlyphLength(odMm, multiplier, maxMm, policy) {
  const maxLength = Math.min(Number(maxMm), policy.supportGlyphLengthMaxMm);
  return clamp(Number(odMm) * multiplier, policy.supportGlyphLengthMinMm, maxLength);
}

function supportBarRadius(odMm, policy) {
  return clamp(Number(odMm) * 0.012, policy.supportBarRadiusMinMm, policy.supportBarRadiusMaxMm);
}

function compactClusterOffset(offset, policy) {
  const vector = vector3(offset);
  const maxMm = Number(policy.supportClusterOffsetMaxMm);
  if (!Number.isFinite(maxMm) || maxMm < 0) return vector;
  const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
  if (magnitude <= maxMm || magnitude <= EPS_MM) return vector;
  return scale(vector, maxMm / magnitude);
}

function primitiveMaxDistanceFrom(primitive, center) {
  const c = vector3(center);
  return Math.max(
    pointDistanceOrZero(primitive.startMm, c),
    pointDistanceOrZero(primitive.endMm, c)
  );
}

function pointDistanceOrZero(point, center) {
  if (!Array.isArray(point)) return 0;
  return distance(vector3(point), center);
}

function perpendicularBasis(direction) {
  const d = normalize(direction, [0, 1, 0]);
  const seed = Math.abs(d[1]) < 0.85 ? [0, 1, 0] : [1, 0, 0];
  let u = cross(d, seed);
  if (Math.hypot(u[0], u[1], u[2]) <= EPS_MM) u = [0, 0, 1];
  u = normalize(u, [0, 0, 1]);
  const v = normalize(cross(d, u), [1, 0, 0]);
  return { u, v };
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function finiteOption(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanHistogram(histogram) {
  const out = {};
  for (const [key, value] of Object.entries(histogram)) {
    if (key === 'null') continue;
    out[Number(key)] = Number(value);
  }
  return out;
}

function round(value) {
  return Number(Number(value || 0).toFixed(6));
}

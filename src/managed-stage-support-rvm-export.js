import { buildEndpointLockedCylinderPrimitive } from './rvm-cylinder-primitive-builder.js';
import { resolveManagedStageSupportVisual } from './managed-stage-support-visual-resolver.js';

const SUPPORT_MATERIAL_ID = 9;
const EPS_MM = 0.001;
const DEFAULT_RVM_CLUSTER_OFFSET_MAX_MM = 28;

export function buildManagedStageSupportRvmExportNodes(profile, options = {}) {
  const records = profile?.records || [];
  const supportRecords = profile?.supportRecords || [];
  const adaptedRecords = records.map(adaptRecordForSupportResolver);
  const supportNodes = [];
  const families = {};
  let primitiveCount = 0;
  let conePrimitiveCount = 0;
  let barPrimitiveCount = 0;
  let glyphPrimitiveCount = 0;
  let clusteredSupportRecordCount = 0;
  let connectorPrimitiveCount = 0;
  let fallbackPrimitiveCount = 0;
  let warningPrimitiveCount = 0;

  supportRecords.forEach((record, index) => {
    const adapted = adaptRecordForSupportResolver(record);
    const visual = resolveManagedStageSupportVisual(adapted, adaptedRecords, options);
    const node = supportElementNode(record, adapted, visual, index, options);
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
  });

  return {
    schema: 'ManagedStageSupportRvmExport.v3',
    materialId: options.materialId || SUPPORT_MATERIAL_ID,
    supportRecordCount: supportRecords.length,
    supportNodeCount: supportNodes.length,
    supportPrimitiveCount: primitiveCount,
    supportConePrimitiveCount: conePrimitiveCount,
    supportDirectionalGlyphPrimitiveCount: glyphPrimitiveCount,
    supportBarPrimitiveCount: barPrimitiveCount,
    connectorPrimitiveCount,
    fallbackPrimitiveCount,
    warningPrimitiveCount,
    clusteredSupportRecordCount,
    familyHistogram: families,
    nodes: supportNodes,
    policy: 'managed-stage ATTA/support records are emitted to RVM as Review-safe code-8 cylinder bar glyphs only; filled code-1 pyramid/cone substitutes are blocked; source POS/SUPPORTCOORD remains the anchor coordinate'
  };
}

function supportElementNode(record, adapted, visual, index, options = {}) {
  const sourceCenter = toPoint(adapted.source.supportCoord || adapted.source.pos || adapted.source.bpos || adapted.source.apos || adapted.source.lpos);
  const rawOffset = toPoint(visual.cluster?.offsetMm || [0, 0, 0]);
  const offset = compactClusterOffset(rawOffset, options);
  const visualCenter = add(sourceCenter, offset);
  const odMm = Math.max(Number(visual.pipeDiameterMm || 0), Number(options.pointRadius || 0) * 2, 40);
  const genericLength = clamp(odMm * 0.72, 42, 105);
  const axialLength = clamp(odMm * 0.52, 34, 82);
  const glyphBaseRadius = clamp(odMm * 0.18, 6, 18);
  const barRadius = clamp(odMm * 0.028, 1.5, 4.5);
  const supportName = record.attributes?.NAME || record.name || `SUPPORT_${index + 1}`;
  const primitives = [];

  if (distance(sourceCenter, visualCenter) > EPS_MM) {
    primitives.push(supportBar({
      name: `${supportName}_CLUSTER_OFFSET_BAR`,
      localName: 'support-cluster-offset-bar',
      startMm: sourceCenter,
      endMm: visualCenter,
      radiusMm: Math.max(odMm * 0.018, 1.25),
      record,
      visual,
      role: 'cluster-offset-connector',
      extra: {
        supportClusterConnector: true,
        supportRvmClusterOffsetCompacted: distance(rawOffset, offset) > EPS_MM,
        supportRvmClusterRawOffsetMm: rawOffset,
        supportRvmClusterExportOffsetMm: offset
      }
    }));
  }

  if (visual.family === 'SPRING_CAN') {
    primitives.push(...springCanBars(supportName, visualCenter, odMm, record, visual));
  } else if (visual.fallbackCrossRods || visual.popupRequired) {
    const fallback = fallbackCrossBars(supportName, visualCenter, Math.max(odMm * 0.95, genericLength), barRadius, record, visual, visual.popupRequired);
    primitives.push(...fallback);
  } else {
    const tipSeparation = visual.gapMm > 0 && isAxialFamily(visual.family) ? visual.gapMm * 10 : 0;
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
        baseRadiusMm: glyphBaseRadius,
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
          axialPipeParallel: Boolean(side.axialPipeParallel),
          explicitSingle: Boolean(side.explicitSingle),
          supportTipMm: tip,
          supportVisualCenterMm: visualCenter,
          supportGlyphBaseRadiusMm: glyphBaseRadius,
          supportGlyphLengthMm: length
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
      SUPPORT_SYMBOL_POLICY: 'CODE8_BAR_GLYPHS_NO_PYRAMIDS',
      SUPPORT_RVM_PYRAMID_SUBSTITUTE_BLOCKED: 'TRUE',
      SUPPORT_CLUSTER_INDEX: String(visual.cluster?.index ?? ''),
      SUPPORT_CLUSTER_COUNT: String(visual.cluster?.count ?? ''),
      SUPPORT_CLUSTER_RVM_OFFSET_MAX_MM: String(Number(options.rvmSupportClusterOffsetMaxMm ?? DEFAULT_RVM_CLUSTER_OFFSET_MAX_MM))
    },
    primitives,
    children: []
  };
}

function supportDirectionalGlyphBars({ name, localName, tipMm, directionToTip, lengthMm, baseRadiusMm, barRadiusMm, record, visual, role, extra = {} }) {
  const direction = normalize(directionToTip, [0, 1, 0]);
  const tip = vector3(tipMm);
  const baseCenter = add(tip, scale(direction, -lengthMm));
  const { u, v } = perpendicularBasis(direction);
  const basePoints = [
    add(baseCenter, scale(u, baseRadiusMm)),
    add(baseCenter, scale(u, -baseRadiusMm)),
    add(baseCenter, scale(v, baseRadiusMm)),
    add(baseCenter, scale(v, -baseRadiusMm))
  ];

  return basePoints.map((start, index) => supportBar({
    name: `${name}_RVM_BAR_${index + 1}`,
    localName: `${localName}-rvm-bar-${index + 1}`,
    startMm: start,
    endMm: tip,
    radiusMm: barRadiusMm,
    record,
    visual,
    role: `${role}-rvm-bar`,
    extra: {
      ...extra,
      supportGlyphSpokeIndex: index + 1,
      supportGlyphBaseMm: start,
      supportGlyphTipMm: tip,
      orientationAssumption: 'Support/ATTA record exported as Review-safe code-8 cylinder wire-glyph; canvas may use true THREE.ConeGeometry but RVM export never emits filled code-1 pyramid substitutes'
    }
  }));
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

function springCanBars(name, center, odMm, record, visual) {
  const length = clamp(odMm * 0.85, 55, 115);
  const radius = clamp(odMm * 0.026, 1.5, 4.5);
  const bottom = add(center, [0, -length, 0]);
  return [
    supportBar({ name: `${name}_SPRING_CAN_VERTICAL`, localName: 'spring-can-warning-vertical', startMm: center, endMm: bottom, radiusMm: radius, record, visual, role: 'spring-can-warning-vertical', extra: { supportWarningMarker: true } }),
    supportBar({ name: `${name}_SPRING_CAN_BAND_1`, localName: 'spring-can-warning-band-1', startMm: add(bottom, [-odMm * 0.24, 0, 0]), endMm: add(bottom, [odMm * 0.24, 0, 0]), radiusMm: radius, record, visual, role: 'spring-can-warning-band', extra: { supportWarningMarker: true } }),
    supportBar({ name: `${name}_SPRING_CAN_BAND_2`, localName: 'spring-can-warning-band-2', startMm: add(bottom, [0, length * 0.32, -odMm * 0.24]), endMm: add(bottom, [0, length * 0.32, odMm * 0.24]), radiusMm: radius, record, visual, role: 'spring-can-warning-band', extra: { supportWarningMarker: true } })
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
    extra: warning ? { supportWarningMarker: true } : { supportFallbackCrossRod: true }
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

function compactClusterOffset(offset, options = {}) {
  const vector = vector3(offset);
  const maxMm = Number(options.rvmSupportClusterOffsetMaxMm ?? DEFAULT_RVM_CLUSTER_OFFSET_MAX_MM);
  if (!Number.isFinite(maxMm) || maxMm < 0) return vector;
  const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
  if (magnitude <= maxMm || magnitude <= EPS_MM) return vector;
  return scale(vector, maxMm / magnitude);
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

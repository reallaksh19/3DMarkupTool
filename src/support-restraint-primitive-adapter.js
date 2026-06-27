import { resolveSupportRestraintVisualSpec } from './support-restraint-visual-catalog.js?v=bust-cache-4';
import { ALLOWED_RVM_PRIMITIVE_KINDS } from './rvm-primitive-kind-contract.js?v=bust-cache-4';
import { assertSafeApproximationPrimitives } from './rvm-safe-primitive-approximation-policy.js?v=bust-cache-4';

const WRITER_SAFE_KINDS = new Set(ALLOWED_RVM_PRIMITIVE_KINDS);

export function buildSupportRestraintPrimitiveRecords(record, context = {}) {
  const spec = resolveSupportRestraintVisualSpec(record);
  const base = normalizeContext(record, context, spec);
  const primitives = buildByFamily(record || {}, spec, base);
  return primitives.map((primitive, index) => stampPrimitive(primitive, spec, index));
}

export function assertSupportRestraintWriterSafePrimitives(primitives) {
  assertSafeApproximationPrimitives(primitives || [], 'support/restraint RVM catalogue primitive output');
  for (const primitive of primitives || []) {
    if (!WRITER_SAFE_KINDS.has(primitive.kind)) {
      throw new Error(`Unsupported support/restraint RVM primitive kind: ${primitive.kind}`);
    }
    assertFiniteVector(primitive.center, `${primitive.name}.center`);
    if (primitive.direction) assertFiniteVector(primitive.direction, `${primitive.name}.direction`);
    if (primitive.kind === 'cylinder') assertPositiveFinite(primitive.radius, `${primitive.name}.radius`);
    if (primitive.kind === 'cylinder') assertPositiveFinite(primitive.length, `${primitive.name}.length`);
    if (primitive.kind === 'pyramid') assertPositiveFinite(primitive.height, `${primitive.name}.height`);
    if (primitive.kind === 'sphere') assertPositiveFinite(primitive.diameter, `${primitive.name}.diameter`);
    if (primitive.kind === 'box') {
      if (!Array.isArray(primitive.lengths) || primitive.lengths.length !== 3) throw new Error(`${primitive.name}.lengths must have 3 entries`);
      primitive.lengths.forEach((value, index) => assertPositiveFinite(value, `${primitive.name}.lengths[${index}]`));
    }
  }
}

function buildByFamily(record, spec, base) {
  const { point, tangent, od, contactRadius, gap, symbolLength, arrowRadius, material, prefix } = base;
  if (spec.family === 'REST') {
    const tip = add(point, [0, -contactRadius - gap, 0]);
    return arrowTowardTip(`${prefix}_PLUS_Y`, tip, [0, 1, 0], symbolLength, arrowRadius, material, 'REST_ARROW');
  }
  if (spec.family === 'HOLDDOWN') {
    const topTip = add(point, [0, contactRadius + gap, 0]);
    const bottomTip = add(point, [0, -contactRadius - gap, 0]);
    return arrowTowardTip(`${prefix}_DOWN`, topTip, [0, -1, 0], symbolLength, arrowRadius, material, 'HOLDDOWN_DOWN')
      .concat(arrowTowardTip(`${prefix}_UP`, bottomTip, [0, 1, 0], symbolLength, arrowRadius, material, 'HOLDDOWN_UP'));
  }
  if (spec.family === 'GUIDE') {
    return guideAxesForTangent(tangent).flatMap((axis) => {
      const dir = axisVector(`+${axis}`);
      const plusTip = add(point, scale(dir, contactRadius + gap));
      const minusTip = add(point, scale(dir, -contactRadius - gap));
      return arrowTowardTip(`${prefix}_PLUS_${axis}`, plusTip, scale(dir, -1), symbolLength, arrowRadius, material, `GUIDE_PLUS_${axis}`)
        .concat(arrowTowardTip(`${prefix}_MINUS_${axis}`, minusTip, dir, symbolLength, arrowRadius, material, `GUIDE_MINUS_${axis}`));
    });
  }
  if (spec.family === 'LINE_STOP' || spec.family === 'LIMIT_STOP') {
    return axialPair(prefix, point, tangent, base.visualLane, gap, symbolLength, arrowRadius, material, spec.family);
  }
  if (spec.family === 'ANCHOR') {
    const axial = axialPair(prefix, point, tangent, base.visualLane, gap, symbolLength, arrowRadius, material, 'ANCHOR_AXIAL');
    const lateral = guideAxesForTangent(tangent).flatMap((axis) => {
      const dir = axisVector(`+${axis}`);
      const lanePoint = add(point, scale(orthogonal(tangent), base.visualLane * 1.15));
      const plusTip = add(lanePoint, scale(dir, contactRadius + gap));
      const minusTip = add(lanePoint, scale(dir, -contactRadius - gap));
      return arrowTowardTip(`${prefix}_ANCHOR_PLUS_${axis}`, plusTip, scale(dir, -1), symbolLength * 0.85, arrowRadius, material, `ANCHOR_PLUS_${axis}`)
        .concat(arrowTowardTip(`${prefix}_ANCHOR_MINUS_${axis}`, minusTip, dir, symbolLength * 0.85, arrowRadius, material, `ANCHOR_MINUS_${axis}`));
    });
    return axial.concat(lateral);
  }
  if (spec.family === 'AXIS_RESTRAINT') {
    const dir = axisVector(record.axis || record.signAxis || '+X');
    const parallel = Math.abs(dot(dir, tangent)) > 0.85;
    const lane = parallel ? scale(orthogonal(tangent), base.visualLane) : [0, 0, 0];
    const tip = add(add(point, lane), scale(dir, contactRadius + gap));
    return arrowTowardTip(`${prefix}_${String(record.axis || 'AXIS').replace(/[^A-Za-z0-9_+-]+/g, '_')}`, tip, scale(dir, -1), symbolLength, arrowRadius, material, 'AXIS_RESTRAINT_ARROW');
  }
  if (spec.family === 'SPRING') {
    return springStack(prefix, add(point, [0, -contactRadius - gap - symbolLength * 0.65, 0]), tangent, od, material, spec.coilCount || 5);
  }
  return [boxPrimitive(`${prefix}_UNKNOWN_BOX`, add(point, [0, Math.max(od, 100), od * 0.65]), [od * 0.5, od * 0.5, od * 0.5], material, 'UNKNOWN_WARNING_BOX')];
}

function normalizeContext(record, context, spec) {
  const od = positiveNumber(context.od ?? context.bore ?? record?.od ?? record?.bore, 100);
  const point = vector3(context.point ?? context.center ?? record?.point, [0, 0, 0]);
  const tangent = normalize(vector3(context.tangent ?? record?.tangent, [1, 0, 0]));
  const gapMm = Number(context.gapMm ?? record?.gapMm);
  const gap = Number.isFinite(gapMm) ? gapMm * 10 : 0;
  const symbolLength = Math.max(od * spec.symbolLengthFactor, spec.minimumSymbolLength);
  const arrowRadius = Math.max(od * spec.arrowRadiusFactor, spec.minimumArrowRadius);
  const safeNode = String(record?.node ?? context.node ?? 'NODE').replace(/[^A-Za-z0-9_+-]+/g, '_');
  const sourceClass = String(record?.sourceClass || context.sourceClass || 'SUPPORT').replace(/[^A-Za-z0-9_+-]+/g, '_');
  return {
    point,
    tangent,
    od,
    contactRadius: od / 2,
    visualLane: od * 2 / 3,
    gap,
    symbolLength,
    arrowRadius,
    material: context.material ?? record?.material ?? 0,
    prefix: `${sourceClass}_${safeNode}_${spec.family}`
  };
}

function stampPrimitive(primitive, spec, index) {
  return Object.freeze({
    ...primitive,
    supportCatalogue: true,
    supportVisualKey: spec.visualKey,
    supportVisualRecipeId: spec.recipeId,
    supportVisualSchema: spec.catalogSchemaVersion,
    supportVisualFamily: spec.family,
    proportionalFallback: spec.proportionalFallback,
    vendorDimensionalDbBacked: spec.vendorDimensionalDbBacked,
    adapterOrdinal: index,
    safeApproximationPolicyApplied: true
  });
}

function axialPair(prefix, point, tangent, visualLane, gap, symbolLength, arrowRadius, material, rolePrefix) {
  const lane = scale(orthogonal(tangent), visualLane);
  const center = add(point, lane);
  const separation = gap > 0 ? gap : 0;
  const tipA = add(center, scale(tangent, separation / 2));
  const tipB = add(center, scale(tangent, -separation / 2));
  return arrowTowardTip(`${prefix}_AXIAL_A`, tipA, scale(tangent, -1), symbolLength, arrowRadius, material, `${rolePrefix}_A`)
    .concat(arrowTowardTip(`${prefix}_AXIAL_B`, tipB, tangent, symbolLength, arrowRadius, material, `${rolePrefix}_B`));
}

function arrowTowardTip(name, tip, directionTowardTip, length, radius, material, role) {
  const dir = normalize(directionTowardTip);
  const headLength = length * 0.32;
  const stemLength = length - headLength;
  const stemCenter = sub(tip, scale(dir, headLength + stemLength / 2));
  const headCenter = sub(tip, scale(dir, headLength / 2));
  return [
    {
      kind: 'cylinder',
      name: `${name}_STEM`,
      role: `${role}_STEM`,
      center: stemCenter,
      direction: dir,
      radius: radius * 0.35,
      length: stemLength,
      material
    },
    {
      kind: 'pyramid',
      name: `${name}_HEAD`,
      role: `${role}_HEAD`,
      center: headCenter,
      direction: dir,
      bottom: [radius * 2, radius * 2],
      top: [Math.max(radius * 0.05, 0.01), Math.max(radius * 0.05, 0.01)],
      offset: [0, 0],
      height: headLength,
      material
    }
  ];
}

function boxPrimitive(name, center, lengths, material, role) {
  return {
    kind: 'box',
    name,
    role,
    center,
    direction: [0, 0, 1],
    lengths,
    material
  };
}

function springStack(prefix, center, tangent, od, material, count) {
  const spacing = Math.max(od * 0.18, 18);
  const radius = Math.max(od * 0.06, 6);
  const length = Math.max(od * 0.55, 45);
  const lateral = orthogonal(tangent);
  const primitives = [];
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spacing;
    primitives.push({
      kind: 'cylinder',
      name: `${prefix}_SPRING_${index + 1}`,
      role: `SPRING_COIL_${index + 1}`,
      center: add(center, scale(tangent, offset)),
      direction: lateral,
      radius,
      length,
      material
    });
  }
  return primitives;
}

function guideAxesForTangent(tangent) {
  const axis = dominantAxis(tangent);
  if (axis === 'X') return ['Z'];
  if (axis === 'Z') return ['X'];
  return ['X', 'Z'];
}

function dominantAxis(vector) {
  const values = [Math.abs(vector[0]), Math.abs(vector[1]), Math.abs(vector[2])];
  if (values[0] >= values[1] && values[0] >= values[2]) return 'X';
  if (values[1] >= values[0] && values[1] >= values[2]) return 'Y';
  return 'Z';
}

function axisVector(axis) {
  const value = String(axis || '+X');
  const sign = value.startsWith('-') ? -1 : 1;
  const name = value.replace(/[+\-]/g, '').toUpperCase();
  if (name === 'Y') return [0, sign, 0];
  if (name === 'Z') return [0, 0, sign];
  return [sign, 0, 0];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function vecLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const length = vecLength(vector);
  return length > 1e-12 ? scale(vector, 1 / length) : [1, 0, 0];
}

function orthogonal(direction) {
  const dir = normalize(direction);
  const reference = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(dir, reference));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function vector3(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const parsed = [Number(value[0]), Number(value[1]), Number(value[2])];
  return parsed.every(Number.isFinite) ? parsed : fallback;
}

function assertFiniteVector(vector, label) {
  if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new Error(`${label} must be a finite 3-vector`);
  }
}

function assertPositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

import { assertSafeApproximationPrimitives, safeApproximationPolicyForIntent } from './rvm-safe-primitive-approximation-policy.js?v=bust-cache-4';
import { buildValveFlangePrimitiveAdapterPlan } from './valve-flange-primitive-adapter.js?v=bust-cache-4';

export const RVM_CATALOGUE_PRIMITIVE_TRANSLATOR_SCHEMA = 'RvmCataloguePrimitiveTranslator.v1';
export const RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS = Object.freeze(['cylinder', 'box', 'pyramid', 'sphere']);
export const RVM_CATALOGUE_METADATA = Object.freeze({
  CATALOGUE_VISUAL: 'TRUE',
  PROPORTIONAL_FALLBACK: 'TRUE',
  ASME_DIMENSIONAL_DB_BACKED: 'FALSE',
  RVM_CATALOGUE_PARITY: 'TRUE'
});

/**
 * Translates the shared valve/flange adapter plan into RVM-writer-safe primitive records.
 *
 * This module is the C3 safety seam: adapter kinds such as frustum, valve-body,
 * radial-cylinder, torus, direction-arrow, and bolt-pattern must be translated here
 * before they can reach src/rvm-writer.js. The writer is intentionally kept limited
 * to cylinder / box / pyramid / sphere primitives.
 */
export function buildRvmValveFlangeCatalogueExport(element = {}, metrics = {}, frame = {}, options = {}) {
  const plan = buildValveFlangePrimitiveAdapterPlan(element, metrics, options);
  if (!plan) return null;

  const resolvedFrame = resolveFrame(frame, metrics);
  const material = positiveNumber(frame.material, 27);
  const prefix = safeName(frame.namePrefix || plan.componentId || element.id || element.props?.id || 'CATALOGUE_COMPONENT');
  const primitives = [];
  const skippedExportKinds = [];

  for (const primitive of plan.visiblePrimitives) {
    const translated = translatePrimitive(primitive, plan.visiblePrimitives, resolvedFrame, material, prefix);
    if (translated.length) {
      primitives.push(...translated);
    } else {
      skippedExportKinds.push(primitive.exportKind || primitive.sourceKind || primitive.role || 'unknown');
    }
  }

  const safePrimitives = assertSafeApproximationPrimitives(primitives, 'RVM valve/flange catalogue translator');
  if (!safePrimitives.length) return null;

  return {
    schemaVersion: RVM_CATALOGUE_PRIMITIVE_TRANSLATOR_SCHEMA,
    sourceAdapterSchemaVersion: plan.schemaVersion,
    sourceExportPrimitiveSchemaVersion: plan.exportPrimitiveSchemaVersion,
    componentId: plan.componentId,
    componentClass: plan.componentClass,
    componentType: plan.componentType,
    visualKey: plan.visualKey,
    visualRecipeId: plan.visualRecipeId,
    catalogSchemaVersion: plan.catalogSchemaVersion,
    sourceSpecSchemaVersion: plan.sourceSpecSchemaVersion,
    primitiveCount: safePrimitives.length,
    sourcePrimitiveCount: plan.visiblePrimitiveCount,
    skippedExportKinds: Array.from(new Set(skippedExportKinds)),
    supportedPrimitiveKinds: RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS,
    attributes: rvmCatalogueAttributes(plan, safePrimitives, skippedExportKinds),
    primitives: safePrimitives,
    policies: {
      translatedBeforeRvmWriter: true,
      writerSupportedKindsOnly: safePrimitives.every((primitive) => RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS.includes(primitive.kind)),
      safeApproximationPolicyApplied: true,
      proportionalFallback: true,
      asmeDimensionalDatabaseBacked: false,
      productionRvmExportEnabled: false
    }
  };
}

export function buildRvmValveFlangeCataloguePrimitives(element = {}, metrics = {}, frame = {}, options = {}) {
  return buildRvmValveFlangeCatalogueExport(element, metrics, frame, options)?.primitives || [];
}

export function rvmCatalogueAttributes(plan, primitives = [], skippedExportKinds = []) {
  return {
    CATALOGUE_VISUAL: 'TRUE',
    CATALOGUE_CLASS: plan.componentClass,
    CATALOGUE_TYPE: plan.componentType,
    CATALOGUE_RECIPE_ID: plan.visualRecipeId,
    CATALOGUE_SCHEMA: plan.catalogSchemaVersion,
    CATALOGUE_ADAPTER_SCHEMA: plan.schemaVersion,
    CATALOGUE_EXPORT_PRIMITIVE_SCHEMA: plan.exportPrimitiveSchemaVersion,
    RVM_CATALOGUE_TRANSLATOR_SCHEMA: RVM_CATALOGUE_PRIMITIVE_TRANSLATOR_SCHEMA,
    PROPORTIONAL_FALLBACK: 'TRUE',
    ASME_DIMENSIONAL_DB_BACKED: 'FALSE',
    RVM_CATALOGUE_PARITY: 'TRUE',
    RVM_WRITER_SUPPORTED_KINDS: RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS.join(','),
    RVM_CATALOGUE_PRIMITIVE_COUNT: primitives.length,
    RVM_CATALOGUE_SKIPPED_EXPORT_KINDS: skippedExportKinds.length ? Array.from(new Set(skippedExportKinds)).join(',') : 'NONE'
  };
}

function translatePrimitive(primitive, allPrimitives, frame, material, prefix) {
  const kind = primitive.exportKind || primitive.sourceKind;
  if (kind === 'cylinder') return [cylinderFromSegment(primitive, frame, material, prefix)];
  if (kind === 'valve-body') return [cylinderFromSegment(primitive, frame, material, prefix)];
  if (kind === 'frustum') return steppedFrustum(primitive, frame, material, prefix);
  if (kind === 'bolt-pattern') return boltPatternSpheres(primitive, allPrimitives, frame, material, prefix);
  if (kind === 'radial-cylinder') return [radialCylinder(primitive, frame, material, prefix)];
  if (kind === 'direction-arrow') return directionArrow(primitive, frame, material, prefix);
  if (kind === 'torus') return torusFallbackRing(primitive, frame, material, prefix);
  return [];
}

function cylinderFromSegment(primitive, frame, material, prefix) {
  const start = numberOr(primitive.localAxisStart, -primitive.length / 2);
  const end = numberOr(primitive.localAxisEnd, primitive.length / 2);
  const length = Math.max(numberOr(primitive.length, end - start), 0.001);
  const center = pointAt(frame, numberOr(primitive.axialOffset, (start + end) / 2));
  const radius = Math.max(
    positiveNumber(primitive.radius, 0),
    positiveNumber(primitive.radiusStart, 0),
    positiveNumber(primitive.radiusEnd, 0),
    positiveNumber(primitive.diameter, 0) / 2,
    frame.pipeRadius * 0.25,
    0.001
  );
  return {
    kind: 'cylinder',
    name: safeName(`${prefix}_${primitive.role || 'CATALOGUE_CYLINDER'}`),
    center,
    direction: frame.axis,
    radius,
    length,
    material,
    catalogueRole: primitive.role,
    catalogueExportKind: primitive.exportKind
  };
}

function steppedFrustum(primitive, frame, material, prefix) {
  const policy = safeApproximationPolicyForIntent('frustum');
  if (!policy || policy.directEmissionAllowed || !policy.safeOutputKinds.includes('cylinder')) {
    throw new Error('RVM valve/flange catalogue translator has no safe stepped-cylinder policy for frustum intent.');
  }

  const start = numberOr(primitive.localAxisStart, -primitive.length / 2);
  const end = numberOr(primitive.localAxisEnd, primitive.length / 2);
  const span = end - start;
  if (!Number.isFinite(span) || Math.abs(span) <= 0.001) {
    return assertSafeApproximationPrimitives([
      {
        ...cylinderFromSegment(primitive, frame, material, prefix),
        sourceIntent: 'frustum',
        safeApproximationPolicy: policy.safeStrategy,
        blockedRhbgPrimitiveCode: policy.rhbgPrimitiveCode
      }
    ], 'RVM valve/flange degenerate frustum approximation');
  }

  const steps = 3;
  const primitives = [];
  const r0 = positiveNumber(primitive.radiusStart, positiveNumber(primitive.radius, frame.pipeRadius));
  const r1 = positiveNumber(primitive.radiusEnd, positiveNumber(primitive.radius, frame.pipeRadius));
  for (let index = 0; index < steps; index += 1) {
    const a = start + span * index / steps;
    const b = start + span * (index + 1) / steps;
    const t = (index + 0.5) / steps;
    const radius = Math.max(lerp(r0, r1, t), 0.001);
    primitives.push({
      kind: 'cylinder',
      name: safeName(`${prefix}_${primitive.role || 'FRUSTUM'}_STEP_${String(index + 1).padStart(2, '0')}`),
      center: pointAt(frame, (a + b) / 2),
      direction: frame.axis,
      radius,
      length: Math.max(Math.abs(b - a), 0.001),
      material,
      catalogueRole: primitive.role,
      catalogueExportKind: 'frustum',
      sourceIntent: 'frustum',
      safeApproximationPolicy: policy.safeStrategy,
      blockedRhbgPrimitiveCode: policy.rhbgPrimitiveCode
    });
  }
  return assertSafeApproximationPrimitives(primitives, 'RVM valve/flange stepped-frustum approximation');
}

function boltPatternSpheres(primitive, allPrimitives, frame, material, prefix) {
  const boltCount = Math.max(Math.round(positiveNumber(primitive.boltCount, 8)), 1);
  const boltCircleRadius = positiveNumber(primitive.boltCircleRadius, frame.pipeRadius * 1.7);
  const boltRadius = positiveNumber(primitive.boltRadius, Math.max(frame.pipeRadius * 0.055, 1));
  const targetRoles = Array.isArray(primitive.flangeRoles) && primitive.flangeRoles.length
    ? primitive.flangeRoles
    : ['BOLT_PATTERN'];
  const offsets = targetRoles
    .map((role) => allPrimitives.find((candidate) => candidate.role === role))
    .filter(Boolean)
    .map((candidate) => numberOr(candidate.axialOffset, midpoint(candidate.localAxisStart, candidate.localAxisEnd)))
    .filter(Number.isFinite);
  const axialOffsets = offsets.length ? offsets : [0];
  const result = [];

  for (const axialOffset of axialOffsets) {
    for (let index = 0; index < boltCount; index += 1) {
      const angle = Math.PI * 2 * index / boltCount;
      const radial = add(scale(frame.radialA, Math.cos(angle) * boltCircleRadius), scale(frame.radialB, Math.sin(angle) * boltCircleRadius));
      result.push({
        kind: 'sphere',
        name: safeName(`${prefix}_${primitive.role || 'BOLT_PATTERN'}_${String(result.length + 1).padStart(2, '0')}`),
        center: add(pointAt(frame, axialOffset), radial),
        diameter: boltRadius * 2.2,
        material,
        catalogueRole: primitive.role,
        catalogueExportKind: 'bolt-pattern'
      });
    }
  }
  return result;
}

function radialCylinder(primitive, frame, material, prefix) {
  const axialOffset = numberOr(primitive.axialOffset, 0);
  const radialOffset = positiveNumber(primitive.radialOffset, frame.pipeRadius * 1.7);
  const length = positiveNumber(primitive.handleLength, positiveNumber(primitive.length, frame.pipeRadius * 1.2));
  const radius = positiveNumber(primitive.radius, Math.max(frame.pipeRadius * 0.06, 1));
  return {
    kind: 'cylinder',
    name: safeName(`${prefix}_${primitive.role || 'RADIAL_CYLINDER'}`),
    center: add(pointAt(frame, axialOffset), scale(frame.radialA, radialOffset)),
    direction: frame.radialA,
    radius,
    length,
    material,
    catalogueRole: primitive.role,
    catalogueExportKind: 'radial-cylinder'
  };
}

function directionArrow(primitive, frame, material, prefix) {
  const axialOffset = numberOr(primitive.axialOffset, 0);
  const length = positiveNumber(primitive.handleLength, positiveNumber(primitive.length, frame.pipeRadius * 1.8));
  const radius = Math.max(frame.pipeRadius * 0.05, 1);
  const center = pointAt(frame, axialOffset);
  const stemLength = length * 0.68;
  const headLength = length - stemLength;
  const tip = add(center, scale(frame.axis, length / 2));
  return [
    {
      kind: 'cylinder',
      name: safeName(`${prefix}_${primitive.role || 'DIRECTION_ARROW'}_STEM`),
      center: sub(tip, scale(frame.axis, headLength + stemLength / 2)),
      direction: frame.axis,
      radius: radius * 0.45,
      length: stemLength,
      material,
      catalogueRole: primitive.role,
      catalogueExportKind: 'direction-arrow'
    },
    {
      kind: 'pyramid',
      name: safeName(`${prefix}_${primitive.role || 'DIRECTION_ARROW'}_HEAD`),
      center: sub(tip, scale(frame.axis, headLength / 2)),
      direction: frame.axis,
      bottom: [radius * 2.8, radius * 2.8],
      top: [Math.max(radius * 0.05, 0.01), Math.max(radius * 0.05, 0.01)],
      offset: [0, 0],
      height: headLength,
      material,
      catalogueRole: primitive.role,
      catalogueExportKind: 'direction-arrow'
    }
  ];
}

function torusFallbackRing(primitive, frame, material, prefix) {
  const radius = positiveNumber(primitive.radius, 0);
  if (radius <= 0) return [];
  const tubeRadius = Math.max(radius * 0.06, frame.pipeRadius * 0.025, 0.5);
  const ringCenter = add(pointAt(frame, 0), scale(frame.radialA, frame.pipeRadius * 1.95));
  const count = 12;
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count;
    const tangent = normalize(add(scale(frame.radialA, -Math.sin(angle)), scale(frame.radialB, Math.cos(angle))));
    const radial = add(scale(frame.radialA, Math.cos(angle) * radius), scale(frame.radialB, Math.sin(angle) * radius));
    result.push({
      kind: 'cylinder',
      name: safeName(`${prefix}_${primitive.role || 'TORUS'}_SEG_${String(index + 1).padStart(2, '0')}`),
      center: add(ringCenter, radial),
      direction: tangent,
      radius: tubeRadius,
      length: Math.max((Math.PI * 2 * radius) / count, tubeRadius * 2),
      material,
      catalogueRole: primitive.role,
      catalogueExportKind: 'torus'
    });
  }
  return result;
}

function resolveFrame(frame = {}, metrics = {}) {
  const start = vector3(frame.start, null);
  const end = vector3(frame.end, null);
  const axis = normalize(vector3(frame.direction, start && end ? sub(end, start) : [1, 0, 0]));
  const origin = vector3(frame.center, start && end ? scale(add(start, end), 0.5) : [0, 0, 0]);
  const radialA = normalize(vector3(frame.radialA, orthogonal(axis)));
  const radialB = normalize(vector3(frame.radialB, cross(axis, radialA)));
  const pipeRadius = positiveNumber(metrics.pipeRadius, positiveNumber(frame.pipeRadius, 50));
  return { origin, axis, radialA, radialB, pipeRadius };
}

function pointAt(frame, axialOffset) {
  return add(frame.origin, scale(frame.axis, numberOr(axialOffset, 0)));
}

function vector3(value, fallback) {
  if (Array.isArray(value) && value.length >= 3) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    const z = Number(value[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return [x, y, z];
  }
  return fallback;
}

function safeName(value) {
  const clean = String(value || 'UNNAMED').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || 'UNNAMED';
}

function positiveNumber(value, fallback) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function midpoint(a, b) {
  if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  return 0;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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
  const length = vecLength(vector || [0, 0, 0]);
  return length > 1e-12 ? scale(vector, 1 / length) : [1, 0, 0];
}

function orthogonal(direction) {
  const dir = normalize(direction);
  const reference = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(dir, reference));
}

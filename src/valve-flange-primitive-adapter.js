import {
  buildLinearVisualPrimitivePlan,
  getValveFlangeVisualSpec,
  primitiveLocalSpan,
  validateLinearVisualPrimitiveContinuity
} from './valve-flange-visual-catalog.js?v=bust-cache-4';

export const VALVE_FLANGE_PRIMITIVE_ADAPTER_SCHEMA = 'ValveFlangePrimitiveAdapter.v1';
export const VALVE_FLANGE_EXPORT_PRIMITIVE_SCHEMA = 'ValveFlangeExportPrimitive.v1';

/**
 * Shared bridge from the proportional valve/flange visual catalogue to
 * renderer/export-neutral primitive records.
 *
 * This module does not emit Three.js meshes and does not write RVM directly.
 * C2 deliberately creates the contract seam only; production RVM catalogue
 * export parity belongs to the next phase.
 */
export function buildValveFlangePrimitiveAdapterPlan(element = {}, metrics = {}, options = {}) {
  const spec = getValveFlangeVisualSpec(element);
  if (!spec) return null;

  const resolvedMetrics = resolveMetrics(spec, metrics);
  const cataloguePlan = buildLinearVisualPrimitivePlan(spec, resolvedMetrics);
  const continuity = validateLinearVisualPrimitiveContinuity(cataloguePlan, resolvedMetrics.length, {
    tolerance: options.tolerance
  });

  return {
    schemaVersion: VALVE_FLANGE_PRIMITIVE_ADAPTER_SCHEMA,
    exportPrimitiveSchemaVersion: VALVE_FLANGE_EXPORT_PRIMITIVE_SCHEMA,
    componentId: String(element.id || element.props?.id || ''),
    componentClass: spec.componentClass,
    componentType: spec.componentType,
    visualKey: spec.visualKey,
    visualRecipeId: spec.visualRecipeId,
    catalogSchemaVersion: spec.catalogSchemaVersion,
    sourceSpecSchemaVersion: spec.schemaVersion,
    metrics: resolvedMetrics,
    primitiveCount: cataloguePlan.length,
    visiblePrimitiveCount: cataloguePlan.filter(isVisibleExportPrimitive).length,
    cataloguePlan,
    primitives: cataloguePlan.map((primitive, index) => normalizeCataloguePrimitive(primitive, spec, resolvedMetrics, index)),
    visiblePrimitives: cataloguePlan
      .filter(isVisibleExportPrimitive)
      .map((primitive, index) => normalizeCataloguePrimitive(primitive, spec, resolvedMetrics, index)),
    continuity,
    policies: {
      proportionalFallback: true,
      rendererNeutral: true,
      rvmParityCandidate: true,
      productionRvmExportEnabled: false,
      asmeDimensionalDatabaseBacked: false
    }
  };
}

export function buildValveFlangeExportPrimitives(element = {}, metrics = {}, options = {}) {
  const plan = buildValveFlangePrimitiveAdapterPlan(element, metrics, options);
  return plan ? plan.visiblePrimitives : [];
}

export function isVisibleExportPrimitive(primitive = {}) {
  if (!primitive || typeof primitive !== 'object') return false;
  if (primitive.hiddenBoreFill) return false;
  if (primitive.kind === 'bolt-pattern') return true;
  if (primitive.overlayOnly && primitive.visualMaterial !== 'raised-face' && primitive.visualMaterial !== 'gasket') return false;
  return true;
}

function normalizeCataloguePrimitive(primitive = {}, spec, metrics, index) {
  const [localAxisStart, localAxisEnd] = spanForPrimitive(primitive);
  const length = Math.max(localAxisEnd - localAxisStart, 0);
  const axialOffset = Number.isFinite(primitive.axialOffset)
    ? primitive.axialOffset
    : (localAxisStart + localAxisEnd) / 2;

  const exportKind = classifyExportKind(primitive);
  const radius = positiveNumber(primitive.radius, null);
  const radiusStart = positiveNumber(primitive.radiusStart, positiveNumber(primitive.innerRadius, radius));
  const radiusEnd = positiveNumber(primitive.radiusEnd, positiveNumber(primitive.outerRadius, radius));

  return compactObject({
    schemaVersion: VALVE_FLANGE_EXPORT_PRIMITIVE_SCHEMA,
    index,
    role: primitive.role || `PRIMITIVE_${index + 1}`,
    sourceKind: primitive.kind || 'unknown',
    exportKind,
    componentClass: spec.componentClass,
    componentType: spec.componentType,
    visualKey: spec.visualKey,
    visualRecipeId: spec.visualRecipeId,
    localAxisStart: Number.isFinite(localAxisStart) ? localAxisStart : undefined,
    localAxisEnd: Number.isFinite(localAxisEnd) ? localAxisEnd : undefined,
    axialOffset: Number.isFinite(axialOffset) ? axialOffset : undefined,
    length: Number.isFinite(length) ? length : undefined,
    radius,
    radiusStart,
    radiusEnd,
    diameter: radius ? radius * 2 : undefined,
    replacesCenterlinePipe: primitive.replacesCenterlinePipe === true,
    overlayOnly: primitive.overlayOnly === true,
    hiddenBoreFill: primitive.hiddenBoreFill === true,
    continuityFiller: primitive.continuityFiller === true,
    thinPlate: primitive.thinPlate === true,
    thinRaisedFace: primitive.thinRaisedFace === true,
    proportionalShoulder: primitive.proportionalShoulder === true,
    materialRole: primitive.visualMaterial || materialRoleForPrimitive(primitive, spec),
    boltCount: primitive.boltCount,
    boltCircleRadius: primitive.boltCircleRadius,
    boltRadius: primitive.boltRadius,
    flangeRoles: primitive.flangeRoles,
    radialOffset: primitive.radialOffset,
    handleLength: primitive.length && !Number.isFinite(localAxisStart) ? primitive.length : undefined,
    metricsLength: metrics.length,
    metricsPipeRadius: metrics.pipeRadius
  });
}

function classifyExportKind(primitive = {}) {
  const role = String(primitive.role || '').toUpperCase();
  const kind = String(primitive.kind || '').toLowerCase();

  if (kind === 'bolt-pattern') return 'bolt-pattern';
  if (kind === 'torus') return 'torus';
  if (kind === 'lever') return 'radial-cylinder';
  if (kind === 'arrow') return 'direction-arrow';
  if (kind === 'actuator-cylinder') return 'radial-cylinder';
  if (kind === 'stem') return 'radial-cylinder';
  if (kind === 'cap') return 'cylinder';
  if (role === 'VALVE_BODY') return 'valve-body';
  if (isTaperedPrimitive(primitive)) return 'frustum';
  if (kind === 'disc') return 'cylinder';
  if (kind.endsWith('body')) return 'valve-body';
  return kind || 'unknown';
}

function isTaperedPrimitive(primitive = {}) {
  const radiusStart = Number(primitive.radiusStart);
  const radiusEnd = Number(primitive.radiusEnd);
  if (Number.isFinite(radiusStart) && Number.isFinite(radiusEnd) && Math.abs(radiusStart - radiusEnd) > 1e-6) return true;

  const innerRadius = Number(primitive.innerRadius);
  const outerRadius = Number(primitive.outerRadius);
  if (Number.isFinite(innerRadius) && Number.isFinite(outerRadius) && Math.abs(innerRadius - outerRadius) > 1e-6) {
    return primitive.proportionalShoulder === true || /(?:NECK|SHOULDER)/i.test(String(primitive.role || ''));
  }
  return false;
}

function spanForPrimitive(primitive = {}) {
  if (Number.isFinite(primitive.localAxisStart) && Number.isFinite(primitive.localAxisEnd)) {
    return primitiveLocalSpan(primitive);
  }
  return [undefined, undefined];
}

function resolveMetrics(spec, metrics = {}) {
  const length = positiveNumber(metrics.length, positiveNumber(spec.dimensions?.faceToFaceLength, 1));
  const pipeRadius = positiveNumber(metrics.pipeRadius, positiveNumber(spec.dimensions?.bore, 100) / 2);
  return { length, pipeRadius };
}

function materialRoleForPrimitive(primitive = {}, spec) {
  if (primitive.thinRaisedFace) return 'raised-face';
  if (primitive.subtleGasket) return 'gasket';
  if (primitive.kind === 'bolt-pattern') return 'bolt';
  if (spec.componentClass === 'FLANGE') return 'flange';
  if (spec.componentClass === 'VALVE') return 'valve';
  return 'component';
}

function positiveNumber(value, fallback) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

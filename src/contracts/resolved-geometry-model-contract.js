import { RESOLVED_GEOMETRY_MODEL_SCHEMA } from './platform-contract-schemas.js';

const FORBIDDEN_FIELDS = Object.freeze([
  'primitiveCode',
  'rvmCode',
  'materialId',
  'navisTransform',
  'glbMesh',
  'meshGeometry',
  'exportTransform',
  'rvmMatrix',
  'attRecord'
]);

export function validateResolvedGeometryModelContract(model, options = {}) {
  const errors = [];
  if (!model || typeof model !== 'object') errors.push('model must be an object');
  if (model?.schema !== RESOLVED_GEOMETRY_MODEL_SCHEMA) errors.push(`schema must be ${RESOLVED_GEOMETRY_MODEL_SCHEMA}`);
  if (!model?.graphId) errors.push('graphId is required');
  if (!model?.units) errors.push('units is required');
  if (!model?.axisBasis || typeof model.axisBasis !== 'object') errors.push('axisBasis object is required');
  if (!model?.axisBasis?.authoring) errors.push('axisBasis.authoring is required');
  if (options.expectedAuthoringBasis && model?.axisBasis?.authoring !== options.expectedAuthoringBasis) {
    errors.push('axisBasis.authoring must preserve PlantModelGraph authoring basis');
  }
  for (const key of ['nodes', 'routeFrames', 'itemFrames', 'supportPlacements', 'unresolvedGeometry', 'sourceRefs']) {
    if (!Array.isArray(model?.[key])) errors.push(`${key} array is required`);
  }

  for (const [index, node] of (model?.nodes || []).entries()) {
    if (!node?.id) errors.push(`nodes[${index}].id is required`);
    if (!isPoint3(node?.coord)) errors.push(`nodes[${index}].coord must be [x,y,z]`);
  }
  for (const [index, frame] of (model?.routeFrames || []).entries()) {
    if (!frame?.routeId) errors.push(`routeFrames[${index}].routeId is required`);
    if (!frame?.fromNode) errors.push(`routeFrames[${index}].fromNode is required`);
    if (!frame?.toNode) errors.push(`routeFrames[${index}].toNode is required`);
    if (!isPoint3(frame?.start)) errors.push(`routeFrames[${index}].start must be [x,y,z]`);
    if (!isPoint3(frame?.end)) errors.push(`routeFrames[${index}].end must be [x,y,z]`);
    if (!isPoint3(frame?.direction)) errors.push(`routeFrames[${index}].direction must be [x,y,z]`);
    if (!Number.isFinite(Number(frame?.lengthMm))) errors.push(`routeFrames[${index}].lengthMm must be numeric`);
  }
  for (const [index, frame] of (model?.itemFrames || []).entries()) {
    if (!frame?.itemId) errors.push(`itemFrames[${index}].itemId is required`);
    if (!frame?.geometryStatus) errors.push(`itemFrames[${index}].geometryStatus is required`);
    if (!frame?.resolver) errors.push(`itemFrames[${index}].resolver is required`);
  }
  for (const [index, placement] of (model?.supportPlacements || []).entries()) {
    if (!placement?.itemId) errors.push(`supportPlacements[${index}].itemId is required`);
    if (!isPoint3(placement?.position)) errors.push(`supportPlacements[${index}].position must be [x,y,z]`);
    if (placement?.geometryStatus !== 'intentOnly') errors.push(`supportPlacements[${index}].geometryStatus must be intentOnly`);
  }
  for (const [index, unresolved] of (model?.unresolvedGeometry || []).entries()) {
    if (!unresolved?.itemId) errors.push(`unresolvedGeometry[${index}].itemId is required`);
    if (unresolved?.geometryStatus !== 'blocked') errors.push(`unresolvedGeometry[${index}].geometryStatus must be blocked`);
    if (!unresolved?.reason) errors.push(`unresolvedGeometry[${index}].reason is required`);
  }

  const forbiddenHits = collectForbiddenFieldHits(model);
  errors.push(...forbiddenHits.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));

  return {
    schema: 'ResolvedGeometryModelValidation.v1',
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    forbiddenFieldCount: forbiddenHits.length,
    forbiddenFields: forbiddenHits
  };
}

export function assertResolvedGeometryModelContract(model, options = {}) {
  const result = validateResolvedGeometryModelContract(model, options);
  if (!result.ok) throw new Error(`ResolvedGeometryModel contract invalid: ${result.errors.join('; ')}`);
  return result;
}

export function collectForbiddenFieldHits(value, path = '$', hits = []) {
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectForbiddenFieldHits(entry, `${path}[${index}]`, hits));
    return hits;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.includes(key)) hits.push({ path: `${path}.${key}`, field: key });
    collectForbiddenFieldHits(entry, `${path}.${key}`, hits);
  }
  return hits;
}

function isPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

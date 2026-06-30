import { RESOLVED_PRIMITIVE_MODEL_SCHEMA } from './platform-contract-schemas.js';

const FORBIDDEN_FIELDS = Object.freeze([
  'binary',
  'bytes',
  'chunk',
  'cntb',
  'primBody',
  'rvmMatrix',
  'navisTransform',
  'exportTransform',
  'attRecord',
  'glbMesh',
  'meshGeometry',
  'threeGeometry',
  'materialId'
]);

export function validateResolvedPrimitiveModelContract(model, options = {}) {
  const errors = [];
  if (!model || typeof model !== 'object') errors.push('model must be an object');
  if (model?.schema !== RESOLVED_PRIMITIVE_MODEL_SCHEMA) errors.push(`schema must be ${RESOLVED_PRIMITIVE_MODEL_SCHEMA}`);
  if (!model?.graphId && !model?.sourceGraphId) errors.push('graphId or sourceGraphId is required');
  const isPhase6Shape = Boolean(model?.graphId || model?.units || model?.axisBasis || model?.blockedPrimitives || model?.deferredPrimitives);
  if (isPhase6Shape) {
    if (!model?.graphId) errors.push('graphId is required');
    if (!model?.units) errors.push('units is required');
    if (!model?.axisBasis || typeof model.axisBasis !== 'object') errors.push('axisBasis object is required');
    if (!model?.axisBasis?.authoring) errors.push('axisBasis.authoring is required');
    if (options.expectedAuthoringBasis && model?.axisBasis?.authoring !== options.expectedAuthoringBasis) {
      errors.push('axisBasis.authoring must preserve ResolvedGeometryModel authoring basis');
    }
  }
  if (!Array.isArray(model?.items)) errors.push('items array is required');
  if (!Array.isArray(model?.primitives)) errors.push('primitives array is required');
  if ('blockedPrimitives' in (model || {}) && !Array.isArray(model.blockedPrimitives)) errors.push('blockedPrimitives array is required when present');
  if ('deferredPrimitives' in (model || {}) && !Array.isArray(model.deferredPrimitives)) errors.push('deferredPrimitives array is required when present');
  if ('sourceRefs' in (model || {}) && !Array.isArray(model.sourceRefs)) errors.push('sourceRefs array is required when present');
  if (isPhase6Shape && !Array.isArray(model?.blockedPrimitives)) errors.push('blockedPrimitives array is required');
  if (isPhase6Shape && !Array.isArray(model?.deferredPrimitives)) errors.push('deferredPrimitives array is required');
  if (isPhase6Shape && !Array.isArray(model?.sourceRefs)) errors.push('sourceRefs array is required');

  const itemIds = new Set();
  for (const [index, item] of (model?.items || []).entries()) {
    if (!item?.id) errors.push(`items[${index}].id is required`);
    if (item?.id) itemIds.add(String(item.id));
    if (!['catalogue', 'procedural', 'fallback', 'unresolved', 'blocked', 'deferred'].includes(String(item?.resolutionMode || ''))) {
      errors.push(`items[${index}].resolutionMode must be catalogue/procedural/fallback/unresolved/blocked/deferred`);
    }
  }

  for (const [index, primitive] of (model?.primitives || []).entries()) {
    const id = primitive?.id || primitive?.primitiveId;
    if (!id) errors.push(`primitives[${index}].id or primitiveId is required`);
    if (!primitive?.sourceItemId) errors.push(`primitives[${index}].sourceItemId is required`);
    if (itemIds.size && !itemIds.has(String(primitive?.sourceItemId))) errors.push(`primitives[${index}].sourceItemId must reference an item`);
    const kind = primitive?.kind || primitive?.primitiveKind;
    if (!kind) errors.push(`primitives[${index}].kind or primitiveKind is required`);
    const code = primitive?.rvmCode ?? primitive?.primitiveCode;
    if (!Number.isInteger(Number(code))) errors.push(`primitives[${index}].rvmCode or primitiveCode must be integer-like`);
    if (!isPoint3(primitive?.center)) errors.push(`primitives[${index}].center must be [x,y,z]`);
    if (!isPoint3(primitive?.axis)) errors.push(`primitives[${index}].axis must be [x,y,z]`);
    if ('bbox' in primitive && !isBbox6(primitive?.bbox)) errors.push(`primitives[${index}].bbox must be [minX,minY,minZ,maxX,maxY,maxZ]`);
    if ('lengthMm' in primitive && !Number.isFinite(Number(primitive.lengthMm))) errors.push(`primitives[${index}].lengthMm must be numeric`);
    if ('radiusMm' in primitive && !Number.isFinite(Number(primitive.radiusMm))) errors.push(`primitives[${index}].radiusMm must be numeric`);
    if (primitive?.basis && primitive.basis !== 'authoring') errors.push(`primitives[${index}].basis must be authoring`);
  }

  for (const [index, primitive] of (model?.blockedPrimitives || []).entries()) {
    if (!primitive?.sourceItemId) errors.push(`blockedPrimitives[${index}].sourceItemId is required`);
    if (primitive?.geometryStatus !== 'blocked') errors.push(`blockedPrimitives[${index}].geometryStatus must be blocked`);
    if (!primitive?.reason) errors.push(`blockedPrimitives[${index}].reason is required`);
  }

  for (const [index, primitive] of (model?.deferredPrimitives || []).entries()) {
    if (!primitive?.sourceItemId) errors.push(`deferredPrimitives[${index}].sourceItemId is required`);
    if (primitive?.geometryStatus !== 'deferred') errors.push(`deferredPrimitives[${index}].geometryStatus must be deferred`);
    if (!primitive?.reason) errors.push(`deferredPrimitives[${index}].reason is required`);
  }

  const forbiddenHits = collectForbiddenFieldHits(model);
  errors.push(...forbiddenHits.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));

  return {
    schema: 'ResolvedPrimitiveModelValidation.v1',
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    forbiddenFieldCount: forbiddenHits.length,
    forbiddenFields: forbiddenHits
  };
}

export function assertResolvedPrimitiveModelContract(model, options = {}) {
  const result = validateResolvedPrimitiveModelContract(model, options);
  if (!result.ok) throw new Error(`ResolvedPrimitiveModel contract invalid: ${result.errors.join('; ')}`);
  return result;
}

export function collectResolvedPrimitiveForbiddenFieldHits(value, path = '$', hits = []) {
  return collectForbiddenFieldHits(value, path, hits);
}

function collectForbiddenFieldHits(value, path = '$', hits = []) {
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

function isBbox6(value) {
  return Array.isArray(value) && value.length === 6 && value.every((entry) => Number.isFinite(Number(entry)))
    && Number(value[0]) <= Number(value[3])
    && Number(value[1]) <= Number(value[4])
    && Number(value[2]) <= Number(value[5]);
}

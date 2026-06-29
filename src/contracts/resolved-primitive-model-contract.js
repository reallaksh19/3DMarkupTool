import { RESOLVED_PRIMITIVE_MODEL_SCHEMA } from './platform-contract-schemas.js';

export function validateResolvedPrimitiveModelContract(model) {
  const errors = [];
  if (!model || typeof model !== 'object') errors.push('model must be an object');
  if (model?.schema !== RESOLVED_PRIMITIVE_MODEL_SCHEMA) errors.push(`schema must be ${RESOLVED_PRIMITIVE_MODEL_SCHEMA}`);
  if (!model?.sourceGraphId) errors.push('sourceGraphId is required');
  if (!Array.isArray(model?.items)) errors.push('items array is required');
  if (!Array.isArray(model?.primitives)) errors.push('primitives array is required');

  const itemIds = new Set();
  for (const [index, item] of (model?.items || []).entries()) {
    if (!item?.id) errors.push(`items[${index}].id is required`);
    if (item?.id) itemIds.add(String(item.id));
    if (!['catalogue', 'procedural', 'fallback', 'unresolved'].includes(String(item?.resolutionMode || ''))) {
      errors.push(`items[${index}].resolutionMode must be catalogue/procedural/fallback/unresolved`);
    }
  }

  for (const [index, primitive] of (model?.primitives || []).entries()) {
    if (!primitive?.id) errors.push(`primitives[${index}].id is required`);
    if (!itemIds.has(String(primitive?.sourceItemId))) errors.push(`primitives[${index}].sourceItemId must reference an item`);
    if (!primitive?.kind) errors.push(`primitives[${index}].kind is required`);
    if (!Number.isInteger(Number(primitive?.rvmCode))) errors.push(`primitives[${index}].rvmCode must be integer-like`);
    if (!isPoint3(primitive?.center)) errors.push(`primitives[${index}].center must be [x,y,z]`);
    if (!isPoint3(primitive?.axis)) errors.push(`primitives[${index}].axis must be [x,y,z]`);
    if (!isBbox6(primitive?.bbox)) errors.push(`primitives[${index}].bbox must be [minX,minY,minZ,maxX,maxY,maxZ]`);
  }

  return { schema: 'ResolvedPrimitiveModelValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

export function assertResolvedPrimitiveModelContract(model) {
  const result = validateResolvedPrimitiveModelContract(model);
  if (!result.ok) throw new Error(`ResolvedPrimitiveModel contract invalid: ${result.errors.join('; ')}`);
  return result;
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

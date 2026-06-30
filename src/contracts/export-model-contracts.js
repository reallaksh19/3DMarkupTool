import {
  ATT_EXPORT_MODEL_SCHEMA,
  GLB_VISUAL_MODEL_SCHEMA,
  RVM_EXPORT_MODEL_SCHEMA
} from './platform-contract-schemas.js';

const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const PLACEHOLDER_TRANSFORM_POLICY = 'phase7-authoring-to-navis-review.identity-placeholder.v1';
const AXIS_EPSILON = 1e-6;
const FORBIDDEN_FIELDS = Object.freeze([
  'binary',
  'bytes',
  'buffer',
  'arrayBuffer',
  'chunk',
  'cntb',
  'primBody',
  'fileBlob',
  'downloadUrl',
  'attText',
  'glbBytes',
  'gltfJson',
  'threeObject',
  'threeGeometry',
  'meshGeometry',
  'materialId',
  'writerPayload'
]);

export function validateRvmExportModelContract(model) {
  const errors = baseModelErrors(model, RVM_EXPORT_MODEL_SCHEMA);
  if (!model?.sourceAxisBasis || typeof model.sourceAxisBasis !== 'object') errors.push('sourceAxisBasis object is required');
  if (!model?.exportAxisBasis || typeof model.exportAxisBasis !== 'object') errors.push('exportAxisBasis object is required');
  if (!model?.transformPolicy) errors.push('transformPolicy is required');
  if (typeof model?.transformApplied !== 'boolean') errors.push('transformApplied must be boolean');
  if (model?.transformApplied === true && model?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('transformApplied true requires final-review-transform.v1');
  if (model?.transformApplied === false && model?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY) errors.push('final-review-transform.v1 requires transformApplied true');
  if (model?.transformApplied === true && model?.transformPolicy === PLACEHOLDER_TRANSFORM_POLICY) errors.push('placeholder transform policy cannot be marked applied');
  if (!Array.isArray(model?.primitives)) errors.push('primitives array is required');
  if (!Array.isArray(model?.blockedExports)) errors.push('blockedExports array is required');
  if (!Array.isArray(model?.deferredExports)) errors.push('deferredExports array is required');
  if (!Array.isArray(model?.sourceRefs)) errors.push('sourceRefs array is required');
  for (const [index, primitive] of (model?.primitives || []).entries()) {
    if (!primitive?.exportPrimitiveId) errors.push(`primitives[${index}].exportPrimitiveId is required`);
    if (!primitive?.sourceItemId) errors.push(`primitives[${index}].sourceItemId is required`);
    if (!primitive?.primitiveKind) errors.push(`primitives[${index}].primitiveKind is required`);
    if (!Number.isInteger(Number(primitive?.primitiveCode))) errors.push(`primitives[${index}].primitiveCode must be integer-like`);
    if (!isPoint3(primitive?.center)) errors.push(`primitives[${index}].center must be finite [x,y,z]`);
    if (!isPoint3(primitive?.axis)) errors.push(`primitives[${index}].axis must be finite [x,y,z]`);
    if (isPoint3(primitive?.axis) && !isUnitVector(primitive.axis)) errors.push(`primitives[${index}].axis must be normalized`);
    if (!Number.isFinite(Number(primitive?.lengthMm))) errors.push(`primitives[${index}].lengthMm must be numeric`);
    if (!Number.isFinite(Number(primitive?.radiusMm))) errors.push(`primitives[${index}].radiusMm must be numeric`);
    if (!primitive?.basis) errors.push(`primitives[${index}].basis is required`);
    if (model?.transformApplied === true && primitive?.basis !== 'navis-review') errors.push(`primitives[${index}].basis must be navis-review when transform is applied`);
    if (!primitive?.transformPolicy) errors.push(`primitives[${index}].transformPolicy is required`);
    if (model?.transformApplied === true && primitive?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push(`primitives[${index}].transformPolicy must be final-review-transform.v1`);
  }
  validateStatusArray(model?.blockedExports, 'blockedExports', 'blocked', errors);
  validateStatusArray(model?.deferredExports, 'deferredExports', 'deferred', errors);
  return validationResult('RvmExportModelValidation.v1', model, errors);
}

export function validateAttExportModelContract(model) {
  const errors = baseModelErrors(model, ATT_EXPORT_MODEL_SCHEMA);
  if (!Array.isArray(model?.records)) errors.push('records array is required');
  if (!Array.isArray(model?.blockedRecords)) errors.push('blockedRecords array is required');
  if (!Array.isArray(model?.deferredRecords)) errors.push('deferredRecords array is required');
  if (!Array.isArray(model?.sourceRefs)) errors.push('sourceRefs array is required');
  for (const [index, record] of (model?.records || []).entries()) {
    if (!record?.recordId) errors.push(`records[${index}].recordId is required`);
    if (!record?.sourceItemId) errors.push(`records[${index}].sourceItemId is required`);
    if (!record?.resolutionMode) errors.push(`records[${index}].resolutionMode is required`);
    if (record?.exportStatus !== 'recordPlanned') errors.push(`records[${index}].exportStatus must be recordPlanned`);
  }
  validateStatusArray(model?.blockedRecords, 'blockedRecords', 'blocked', errors);
  validateStatusArray(model?.deferredRecords, 'deferredRecords', 'deferred', errors);
  return validationResult('AttExportModelValidation.v1', model, errors);
}

export function validateGlbVisualModelContract(model) {
  const errors = baseModelErrors(model, GLB_VISUAL_MODEL_SCHEMA);
  if (!model?.sourceAxisBasis || typeof model.sourceAxisBasis !== 'object') errors.push('sourceAxisBasis object is required');
  if (!Array.isArray(model?.visualItems)) errors.push('visualItems array is required');
  if (!Array.isArray(model?.blockedVisuals)) errors.push('blockedVisuals array is required');
  if (!Array.isArray(model?.deferredVisuals)) errors.push('deferredVisuals array is required');
  if (!Array.isArray(model?.sourceRefs)) errors.push('sourceRefs array is required');
  for (const [index, item] of (model?.visualItems || []).entries()) {
    if (!item?.visualItemId) errors.push(`visualItems[${index}].visualItemId is required`);
    if (!item?.sourceItemId) errors.push(`visualItems[${index}].sourceItemId is required`);
    if (!item?.visualKind) errors.push(`visualItems[${index}].visualKind is required`);
    if (!isPoint3(item?.center)) errors.push(`visualItems[${index}].center must be [x,y,z]`);
    if (!isPoint3(item?.axis)) errors.push(`visualItems[${index}].axis must be [x,y,z]`);
    if (!Number.isFinite(Number(item?.lengthMm))) errors.push(`visualItems[${index}].lengthMm must be numeric`);
    if (!Number.isFinite(Number(item?.radiusMm))) errors.push(`visualItems[${index}].radiusMm must be numeric`);
    if (item?.basis !== 'authoring') errors.push(`visualItems[${index}].basis must be authoring`);
    if (item?.visualStatus !== 'visualPlanned') errors.push(`visualItems[${index}].visualStatus must be visualPlanned`);
  }
  validateStatusArray(model?.blockedVisuals, 'blockedVisuals', 'blocked', errors);
  validateStatusArray(model?.deferredVisuals, 'deferredVisuals', 'deferred', errors);
  return validationResult('GlbVisualModelValidation.v1', model, errors);
}

export function assertRvmExportModelContract(model) {
  return assertValid(validateRvmExportModelContract(model), 'RvmExportModel');
}

export function assertAttExportModelContract(model) {
  return assertValid(validateAttExportModelContract(model), 'AttExportModel');
}

export function assertGlbVisualModelContract(model) {
  return assertValid(validateGlbVisualModelContract(model), 'GlbVisualModel');
}

export function collectExportModelForbiddenFieldHits(value, path = '$', hits = []) {
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectExportModelForbiddenFieldHits(entry, `${path}[${index}]`, hits));
    return hits;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.includes(key)) hits.push({ path: `${path}.${key}`, field: key });
    collectExportModelForbiddenFieldHits(entry, `${path}.${key}`, hits);
  }
  return hits;
}

function baseModelErrors(model, schema) {
  const errors = [];
  if (!model || typeof model !== 'object') errors.push('model must be an object');
  if (model?.schema !== schema) errors.push(`schema must be ${schema}`);
  if (!model?.graphId) errors.push('graphId is required');
  if (!model?.units) errors.push('units is required');
  return errors;
}

function validateStatusArray(entries, label, expectedStatus, errors) {
  for (const [index, entry] of (entries || []).entries()) {
    if (!entry?.sourceItemId) errors.push(`${label}[${index}].sourceItemId is required`);
    if (entry?.exportStatus && entry.exportStatus !== expectedStatus) errors.push(`${label}[${index}].exportStatus must be ${expectedStatus}`);
    if (entry?.visualStatus && entry.visualStatus !== expectedStatus) errors.push(`${label}[${index}].visualStatus must be ${expectedStatus}`);
    if (entry?.recordStatus && entry.recordStatus !== expectedStatus) errors.push(`${label}[${index}].recordStatus must be ${expectedStatus}`);
    if (entry?.geometryStatus && entry.geometryStatus !== expectedStatus) errors.push(`${label}[${index}].geometryStatus must be ${expectedStatus}`);
    if (!entry?.reason) errors.push(`${label}[${index}].reason is required`);
  }
}

function validationResult(schema, model, errors) {
  const forbiddenHits = collectExportModelForbiddenFieldHits(model);
  errors.push(...forbiddenHits.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));
  return {
    schema,
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    forbiddenFieldCount: forbiddenHits.length,
    forbiddenFields: forbiddenHits
  };
}

function assertValid(result, label) {
  if (!result.ok) throw new Error(`${label} contract invalid: ${result.errors.join('; ')}`);
  return result;
}

function isPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

function isUnitVector(value) {
  const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2]));
  return Number.isFinite(length) && Math.abs(length - 1) <= AXIS_EPSILON;
}

import { ATT_EXPORT_MODEL_SCHEMA, GLB_VISUAL_MODEL_SCHEMA, RVM_EXPORT_MODEL_SCHEMA } from './platform-contract-schemas.js';

const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const PLACEHOLDER_TRANSFORM_POLICY = 'phase7-authoring-to-navis-review.identity-placeholder.v1';
const AXIS_EPSILON = 1e-6;
const FORBIDDEN_FIELDS = Object.freeze(['binary', 'bytes', 'buffer', 'arrayBuffer', 'chunk', 'cntb', 'primBody', 'fileBlob', 'downloadUrl', 'attText', 'glbBytes', 'gltfJson', 'threeObject', 'threeGeometry', 'meshGeometry', 'materialId', 'writerPayload']);

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
  if ('testByteEligiblePrimitives' in (model || {}) && !Array.isArray(model.testByteEligiblePrimitives)) errors.push('testByteEligiblePrimitives must be an array when present');
  if ('flangeTestByteEligiblePrimitives' in (model || {}) && !Array.isArray(model.flangeTestByteEligiblePrimitives)) errors.push('flangeTestByteEligiblePrimitives must be an array when present');
  if (!Array.isArray(model?.blockedExports)) errors.push('blockedExports array is required');
  if (!Array.isArray(model?.deferredExports)) errors.push('deferredExports array is required');
  if (!Array.isArray(model?.sourceRefs)) errors.push('sourceRefs array is required');
  for (const [index, primitive] of (model?.primitives || []).entries()) validateCylinderExportPrimitive(primitive, `primitives[${index}]`, model, errors);
  for (const [index, primitive] of (model?.testByteEligiblePrimitives || []).entries()) validateTorusTestExportPrimitive(primitive, `testByteEligiblePrimitives[${index}]`, model, errors);
  for (const [index, primitive] of (model?.flangeTestByteEligiblePrimitives || []).entries()) validateFlangeTestExportPrimitive(primitive, `flangeTestByteEligiblePrimitives[${index}]`, model, errors);
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

export function assertRvmExportModelContract(model) { return assertValid(validateRvmExportModelContract(model), 'RvmExportModel'); }
export function assertAttExportModelContract(model) { return assertValid(validateAttExportModelContract(model), 'AttExportModel'); }
export function assertGlbVisualModelContract(model) { return assertValid(validateGlbVisualModelContract(model), 'GlbVisualModel'); }

export function collectExportModelForbiddenFieldHits(value, path = '$', hits = []) {
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) { value.forEach((entry, index) => collectExportModelForbiddenFieldHits(entry, `${path}[${index}]`, hits)); return hits; }
  for (const [key, entry] of Object.entries(value)) { if (FORBIDDEN_FIELDS.includes(key)) hits.push({ path: `${path}.${key}`, field: key }); collectExportModelForbiddenFieldHits(entry, `${path}.${key}`, hits); }
  return hits;
}
function validateCylinderExportPrimitive(primitive, label, model, errors) { commonPrimitiveChecks(primitive, label, model, errors); if (primitive?.primitiveKind !== 'CYLINDER') errors.push(`${label}.primitiveKind must be CYLINDER`); if (Number(primitive?.primitiveCode) !== 8) errors.push(`${label}.primitiveCode must be 8`); if (!isPoint3(primitive?.axis)) errors.push(`${label}.axis must be finite [x,y,z]`); if (isPoint3(primitive?.axis) && !isUnitVector(primitive.axis)) errors.push(`${label}.axis must be normalized`); if (!Number.isFinite(Number(primitive?.lengthMm))) errors.push(`${label}.lengthMm must be numeric`); if (!Number.isFinite(Number(primitive?.radiusMm))) errors.push(`${label}.radiusMm must be numeric`); if (primitive?.diameterMm !== undefined && !Number.isFinite(Number(primitive.diameterMm))) errors.push(`${label}.diameterMm must be numeric when present`); if (primitive?.wallMm !== undefined && !Number.isFinite(Number(primitive.wallMm))) errors.push(`${label}.wallMm must be numeric when present`); }
function validateTorusTestExportPrimitive(primitive, label, model, errors) { commonPrimitiveChecks(primitive, label, model, errors); if (primitive?.primitiveKind !== 'TORUS') errors.push(`${label}.primitiveKind must be TORUS`); if (Number(primitive?.primitiveCode) !== 4) errors.push(`${label}.primitiveCode must be 4`); for (const key of ['normal', 'startTangent', 'endTangent']) { if (!isPoint3(primitive?.[key])) errors.push(`${label}.${key} must be finite [x,y,z]`); if (isPoint3(primitive?.[key]) && !isUnitVector(primitive[key])) errors.push(`${label}.${key} must be normalized`); } for (const key of ['majorRadiusMm', 'tubeRadiusMm', 'bendAngleDeg', 'sweepAngleDeg']) if (!Number.isFinite(Number(primitive?.[key])) || Number(primitive[key]) <= 0) errors.push(`${label}.${key} must be positive numeric`); if (primitive?.writerReady !== false) errors.push(`${label}.writerReady must be false`); if (primitive?.testByteEligible !== true) errors.push(`${label}.testByteEligible must be true`); if (primitive?.byteBridge !== 'test-only') errors.push(`${label}.byteBridge must be test-only`); if (primitive?.resolver !== 'bendArcTorusPrimitive.v1') errors.push(`${label}.resolver must be bendArcTorusPrimitive.v1`); if (primitive?.evidence?.centerSource === 'inputxml-chord-midpoint-not-arc-center') errors.push(`${label} must not use chord midpoint as torus center`); }
function validateFlangeTestExportPrimitive(primitive, label, model, errors) { commonPrimitiveChecks(primitive, label, model, errors); if (primitive?.primitiveKind !== 'FLANGE_CYLINDER') errors.push(`${label}.primitiveKind must be FLANGE_CYLINDER`); if (Number(primitive?.primitiveCode) !== 8) errors.push(`${label}.primitiveCode must be 8`); if (primitive?.family !== 'flange') errors.push(`${label}.family must be flange`); if (primitive?.resolver !== 'flangeCylinderPrimitive.v1') errors.push(`${label}.resolver must be flangeCylinderPrimitive.v1`); if (primitive?.geometryStatus !== 'primitiveResolved') errors.push(`${label}.geometryStatus must be primitiveResolved`); if (!isPoint3(primitive?.axis)) errors.push(`${label}.axis must be finite [x,y,z]`); if (isPoint3(primitive?.axis) && !isUnitVector(primitive.axis)) errors.push(`${label}.axis must be normalized`); for (const key of ['lengthMm', 'outerRadiusMm', 'boreRadiusMm']) if (!Number.isFinite(Number(primitive?.[key])) || Number(primitive[key]) <= 0) errors.push(`${label}.${key} must be positive numeric`); if (Number(primitive?.outerRadiusMm) <= Number(primitive?.boreRadiusMm)) errors.push(`${label}.outerRadiusMm must be greater than boreRadiusMm`); if (primitive?.writerReady !== false) errors.push(`${label}.writerReady must be false`); if (primitive?.testByteEligible !== true) errors.push(`${label}.testByteEligible must be true`); if (primitive?.byteBridge !== 'test-only-phase-11c-b') errors.push(`${label}.byteBridge must be test-only-phase-11c-b`); if (!primitive?.catalogueItemId) errors.push(`${label}.catalogueItemId is required`); if (!primitive?.catalogueRef) errors.push(`${label}.catalogueRef is required`); if (primitive?.evidence?.fallbackUsed === true) errors.push(`${label} must not use fallback flange evidence`); }
function commonPrimitiveChecks(primitive, label, model, errors) { if (!primitive?.exportPrimitiveId) errors.push(`${label}.exportPrimitiveId is required`); if (!primitive?.sourceItemId) errors.push(`${label}.sourceItemId is required`); if (!primitive?.primitiveKind) errors.push(`${label}.primitiveKind is required`); if (!Number.isInteger(Number(primitive?.primitiveCode))) errors.push(`${label}.primitiveCode must be integer-like`); if (!isPoint3(primitive?.center)) errors.push(`${label}.center must be finite [x,y,z]`); if (!primitive?.basis) errors.push(`${label}.basis is required`); if (model?.transformApplied === true && primitive?.basis !== 'navis-review') errors.push(`${label}.basis must be navis-review when transform is applied`); if (!primitive?.transformPolicy) errors.push(`${label}.transformPolicy is required`); if (model?.transformApplied === true && primitive?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push(`${label}.transformPolicy must be final-review-transform.v1`); if (model?.transformApplied === true && primitive?.transformApplied !== true) errors.push(`${label}.transformApplied must be true when transform is applied`); }
function baseModelErrors(model, schema) { const errors = []; if (!model || typeof model !== 'object') errors.push('model must be an object'); if (model?.schema !== schema) errors.push(`schema must be ${schema}`); if (!model?.graphId) errors.push('graphId is required'); if (!model?.units) errors.push('units is required'); return errors; }
function validateStatusArray(entries, label, expectedStatus, errors) { for (const [index, entry] of (entries || []).entries()) { if (!entry?.sourceItemId) errors.push(`${label}[${index}].sourceItemId is required`); if (entry?.exportStatus && entry.exportStatus !== expectedStatus) errors.push(`${label}[${index}].exportStatus must be ${expectedStatus}`); if (entry?.visualStatus && entry.visualStatus !== expectedStatus) errors.push(`${label}[${index}].visualStatus must be ${expectedStatus}`); if (entry?.recordStatus && entry.recordStatus !== expectedStatus) errors.push(`${label}[${index}].recordStatus must be ${expectedStatus}`); if (entry?.geometryStatus && entry.geometryStatus !== expectedStatus) errors.push(`${label}[${index}].geometryStatus must be ${expectedStatus}`); if (!entry?.reason) errors.push(`${label}[${index}].reason is required`); } }
function validationResult(schema, model, errors) { const forbiddenHits = collectExportModelForbiddenFieldHits(model); errors.push(...forbiddenHits.map((hit) => `forbidden field ${hit.field} at ${hit.path}`)); return { schema, ok: errors.length === 0, errorCount: errors.length, errors, forbiddenFieldCount: forbiddenHits.length, forbiddenFields: forbiddenHits }; }
function assertValid(result, label) { if (!result.ok) throw new Error(`${label} contract invalid: ${result.errors.join('; ')}`); return result; }
function isPoint3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function isUnitVector(value) { const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2])); return Number.isFinite(length) && Math.abs(length - 1) <= AXIS_EPSILON; }

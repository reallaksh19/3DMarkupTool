export const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';

const VECTOR_EPSILON = 1e-9;
const REVIEW_TRANSFORM_MATRIX = Object.freeze([
  Object.freeze([0, 0, -1]),
  Object.freeze([-1, 0, 0]),
  Object.freeze([0, 1, 0])
]);

export function describeFinalReviewTransformPolicy() {
  return {
    schema: 'FinalReviewTransformPolicy.v1',
    policy: FINAL_REVIEW_TRANSFORM_POLICY,
    sourceAxisBasis: { authoring: 'authoring' },
    exportAxisBasis: { review: 'navis-review' },
    pointMapping: 'canvasEngineeringToNavis [xPrime,yPrime,zPrime]=[-z,-x,y]',
    vectorMapping: 'canvasEngineeringToNavis direction mapping, normalized',
    matrix: REVIEW_TRANSFORM_MATRIX.map((row) => [...row]),
    coordinateUnit: 'millimetres',
    writerMatrixScale: 0.001,
    writerMatrixScaleUnit: 'metres',
    scalarDimensionsPreserved: ['lengthMm', 'radiusMm', 'diameterMm', 'wallMm'],
    transformApplied: true,
    failClosed: true
  };
}

export function transformAuthoringPointToReview(point, options = {}) {
  return applyMatrix(cleanPoint3(point, options.fieldName || 'point'));
}

export function transformAuthoringVectorToReview(vector, options = {}) {
  return normalizeVector(applyMatrix(cleanPoint3(vector, options.fieldName || 'vector')));
}

export function normalizeVector(vector) {
  const clean = cleanPoint3(vector, 'vector');
  const length = Math.hypot(clean[0], clean[1], clean[2]);
  if (!Number.isFinite(length) || length <= VECTOR_EPSILON) {
    throw new Error('Invalid final review transform vector: expected non-zero finite vector');
  }
  return clean.map((entry) => cleanNumber(entry / length));
}

export function applyFinalReviewTransformToRvmPrimitive(primitive, options = {}) {
  if (!primitive || typeof primitive !== 'object') throw new Error('Invalid RVM primitive transform input: primitive object is required');
  const center = transformAuthoringPointToReview(primitive.center, { fieldName: 'center' });
  const axis = transformAuthoringVectorToReview(primitive.axis, { fieldName: 'axis' });
  return copyDefined({
    ...primitive,
    center,
    axis,
    lengthMm: scalar(primitive.lengthMm, 'lengthMm'),
    radiusMm: scalar(primitive.radiusMm, 'radiusMm'),
    diameterMm: primitive.diameterMm === undefined ? undefined : scalar(primitive.diameterMm, 'diameterMm'),
    wallMm: primitive.wallMm === undefined ? undefined : scalar(primitive.wallMm, 'wallMm'),
    basis: options.basis || 'navis-review',
    transformPolicy: FINAL_REVIEW_TRANSFORM_POLICY
  });
}

export function finalReviewTransformMetadata() {
  const policy = describeFinalReviewTransformPolicy();
  return {
    sourceAxisBasis: policy.sourceAxisBasis,
    exportAxisBasis: policy.exportAxisBasis,
    transformPolicy: FINAL_REVIEW_TRANSFORM_POLICY,
    transformApplied: true,
    transformWarnings: []
  };
}

function applyMatrix(point) {
  return REVIEW_TRANSFORM_MATRIX.map((row) => cleanNumber(
    row[0] * point[0] + row[1] * point[1] + row[2] * point[2]
  ));
}

function cleanPoint3(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Invalid final review transform ${fieldName}: expected [x,y,z]`);
  }
  return value.map((entry, index) => cleanNumber(Number(entry), `${fieldName}[${index}]`));
}

function cleanNumber(value, fieldName = 'value') {
  if (!Number.isFinite(value)) throw new Error(`Invalid final review transform ${fieldName}: contains non-finite value`);
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function scalar(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid final review transform scalar ${fieldName}: contains non-finite value`);
  return number;
}

function copyDefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

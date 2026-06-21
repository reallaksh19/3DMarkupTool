export const RVM_AXIS_BASIS_POLICY_SCHEMA = 'RvmAxisBasisPolicy.v1';
export const RVM_PRIMITIVE_TRANSFORM_SCALE = 0.001;

const VECTOR_EPSILON = 1e-9;
const BASIS_EPSILON = 1e-6;

export function describeRvmAxisBasisPolicy() {
  return {
    schema: RVM_AXIS_BASIS_POLICY_SCHEMA,
    transformScale: RVM_PRIMITIVE_TRANSFORM_SCALE,
    transformUnit: 'metres',
    localDimensionUnit: 'millimetres',
    matrixOrder: 'basisX,basisY,basisZ,translation',
    basisHandedness: 'right-handed',
    failClosed: true,
    zeroLengthDirectionsAllowed: false,
    explicitPrimitiveBasisAllowed: true
  };
}

export function buildRvmPrimitiveTransform(primitive) {
  const basis = primitive?.basis
    ? normalizeRvmAxisBasis(primitive.basis)
    : buildRvmAxisBasis(primitive?.direction || [0, 0, 1]);
  const center = vector3(primitive?.center, 'center');
  return [
    ...scaleRvmTransformVector(basis.x),
    ...scaleRvmTransformVector(basis.y),
    ...scaleRvmTransformVector(basis.z),
    ...scaleRvmTransformVector(center)
  ];
}

export function buildRvmAxisBasis(direction) {
  const z = normalizeStrict(vector3(direction, 'direction'), 'direction');
  const reference = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = normalizeStrict(cross(reference, z), 'basis x');
  const y = normalizeStrict(cross(z, x), 'basis y');
  assertRvmAxisBasis({ x, y, z });
  return { x, y, z };
}

export function normalizeRvmAxisBasis(basis) {
  const normalized = {
    x: normalizeStrict(vector3(basis?.x, 'basis x'), 'basis x'),
    y: normalizeStrict(vector3(basis?.y, 'basis y'), 'basis y'),
    z: normalizeStrict(vector3(basis?.z, 'basis z'), 'basis z')
  };
  assertRvmAxisBasis(normalized);
  return normalized;
}

export function assertRvmAxisBasis(basis) {
  const x = vector3(basis?.x, 'basis x');
  const y = vector3(basis?.y, 'basis y');
  const z = vector3(basis?.z, 'basis z');
  assertUnitVector(x, 'basis x');
  assertUnitVector(y, 'basis y');
  assertUnitVector(z, 'basis z');
  assertNearZero(dot(x, y), 'basis x/y dot product');
  assertNearZero(dot(x, z), 'basis x/z dot product');
  assertNearZero(dot(y, z), 'basis y/z dot product');
  const handedness = dot(cross(x, y), z);
  if (!Number.isFinite(handedness) || handedness < 1 - BASIS_EPSILON) {
    throw new Error('Invalid RVM primitive basis: expected right-handed orthonormal basis');
  }
  return true;
}

function scaleRvmTransformVector(vector) {
  return vector.map((entry) => cleanRvmTransformValue(entry * RVM_PRIMITIVE_TRANSFORM_SCALE));
}

function cleanRvmTransformValue(value) {
  if (!Number.isFinite(value)) throw new Error('Invalid RVM primitive transform: contains non-finite value');
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function vector3(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Invalid RVM ${fieldName}: expected [x, y, z]`);
  }
  const vector = value.map((entry) => Number(entry));
  if (vector.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`Invalid RVM ${fieldName}: contains non-finite value`);
  }
  return vector;
}

function normalizeStrict(vector, fieldName) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!Number.isFinite(length) || length <= VECTOR_EPSILON) {
    throw new Error(`Invalid RVM ${fieldName}: expected non-zero vector`);
  }
  return vector.map((entry) => entry / length);
}

function assertUnitVector(vector, fieldName) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!Number.isFinite(length) || Math.abs(length - 1) > BASIS_EPSILON) {
    throw new Error(`Invalid RVM primitive basis: ${fieldName} must be unit length`);
  }
}

function assertNearZero(value, fieldName) {
  if (!Number.isFinite(value) || Math.abs(value) > BASIS_EPSILON) {
    throw new Error(`Invalid RVM primitive basis: ${fieldName} must be near zero`);
  }
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

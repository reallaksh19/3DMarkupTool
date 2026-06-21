const EPS_MM = 1e-6;

export function buildEndpointLockedCylinderPrimitive(options = {}) {
  const start = vector3(options.startMm, 'startMm');
  const end = vector3(options.endMm, 'endMm');
  const radius = positiveNumber(options.radiusMm ?? options.radius, 'radiusMm');
  const delta = vsub(end, start);
  const length = Math.hypot(delta[0], delta[1], delta[2]);
  if (!Number.isFinite(length) || length <= EPS_MM) {
    throw new Error(`Endpoint-locked cylinder requires non-zero span: ${options.name || 'UNNAMED_CYLINDER'}`);
  }
  const direction = delta.map((entry) => entry / length);
  const name = String(options.name || `${options.sourceContractName || 'CYLINDER'}_${options.localName || 'body'}`);
  const localName = String(options.localName || 'body');
  return {
    kind: 'cylinder',
    name,
    localName,
    center: midpoint(start, end),
    direction,
    radius,
    length,
    material: options.material,
    endpointLocked: true,
    startMm: start,
    endMm: end,
    sourceContractName: options.sourceContractName || '',
    sourceElementId: options.sourceElementId || '',
    primitiveRole: options.primitiveRole || localName,
    parentStartMm: vector3OrNull(options.parentStartMm),
    parentEndMm: vector3OrNull(options.parentEndMm),
    startOffsetMm: finiteNumberOrNull(options.startOffsetMm),
    endOffsetMm: finiteNumberOrNull(options.endOffsetMm),
    localBbox: [-radius, -radius, -length / 2, radius, radius, length / 2]
  };
}

export function buildContractCylinderPrimitive(contract, options = {}) {
  assertLineLikeContract(contract);
  const startOffsetMm = nonNegativeNumber(options.startOffsetMm ?? 0, 'startOffsetMm');
  const endOffsetMm = nonNegativeNumber(options.endOffsetMm ?? 0, 'endOffsetMm');
  if (startOffsetMm + endOffsetMm >= contract.lengthMm - EPS_MM) {
    throw new Error(`Cylinder offsets consume contract span for ${contract.name || 'UNNAMED_CONTRACT'}`);
  }
  const start = pointAlong(contract.startMm, contract.axis, startOffsetMm);
  const end = pointAlong(contract.endMm, contract.axis, -endOffsetMm);
  const localName = String(options.localName || 'body');
  return buildEndpointLockedCylinderPrimitive({
    name: options.name || `${contract.name}_${localName}`,
    localName,
    startMm: start,
    endMm: end,
    radiusMm: options.radiusMm ?? contract.radiusMm,
    material: options.material,
    sourceContractName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    primitiveRole: options.primitiveRole || localName,
    parentStartMm: contract.startMm,
    parentEndMm: contract.endMm,
    startOffsetMm,
    endOffsetMm
  });
}

export function assertEndpointLockedCylinderPrimitive(primitive, expectations = {}) {
  if (!primitive || primitive.kind !== 'cylinder') throw new Error('Expected cylinder primitive');
  if (primitive.endpointLocked !== true) throw new Error(`Cylinder is not endpoint locked: ${primitive.name || 'UNNAMED_CYLINDER'}`);
  const start = vector3(primitive.startMm, 'primitive.startMm');
  const end = vector3(primitive.endMm, 'primitive.endMm');
  const expected = buildEndpointLockedCylinderPrimitive({
    name: primitive.name,
    localName: primitive.localName,
    startMm: start,
    endMm: end,
    radiusMm: primitive.radius,
    material: primitive.material
  });
  assertVectorClose(primitive.center, expected.center, 'center');
  assertVectorClose(primitive.direction, expected.direction, 'direction');
  assertNear(primitive.length, expected.length, 'length');
  assertNear(primitive.radius, expected.radius, 'radius');
  if (expectations.contract) {
    const contract = expectations.contract;
    if (expectations.fullSpan !== false) {
      assertVectorClose(start, contract.startMm, 'contract start');
      assertVectorClose(end, contract.endMm, 'contract end');
    }
    if (primitive.sourceContractName && primitive.sourceContractName !== contract.name) {
      throw new Error(`Cylinder source contract mismatch: expected ${contract.name}, got ${primitive.sourceContractName}`);
    }
  }
  return true;
}

function assertLineLikeContract(contract) {
  if (!contract || contract.schema !== 'ManagedStageGeometryContract.v1') {
    throw new Error('Expected ManagedStageGeometryContract.v1');
  }
  if (contract.endpointLocked !== true) throw new Error(`Contract is not endpoint locked: ${contract.name}`);
  if (!['line', 'arc'].includes(contract.centerlineKind)) throw new Error(`Unsupported contract centerline kind: ${contract.centerlineKind}`);
  positiveNumber(contract.lengthMm, 'contract.lengthMm');
  vector3(contract.startMm, 'contract.startMm');
  vector3(contract.endMm, 'contract.endMm');
  vector3(contract.axis, 'contract.axis');
}

function pointAlong(start, axis, distanceMm) {
  return [
    start[0] + axis[0] * distanceMm,
    start[1] + axis[1] * distanceMm,
    start[2] + axis[2] * distanceMm
  ];
}

function vector3(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`Invalid ${fieldName}: expected [x, y, z]`);
  const vector = value.map((entry) => Number(entry));
  if (vector.some((entry) => !Number.isFinite(entry))) throw new Error(`Invalid ${fieldName}: contains non-finite value`);
  return vector;
}

function vector3OrNull(value) {
  return value === undefined || value === null ? null : vector3(value, 'vector3');
}

function positiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid ${fieldName}: expected positive number`);
  return number;
}

function nonNegativeNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid ${fieldName}: expected non-negative number`);
  return number;
}

function finiteNumberOrNull(value) {
  if (value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Expected finite number');
  return number;
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function vsub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function assertVectorClose(actual, expected, label) {
  const vector = vector3(actual, label);
  for (let index = 0; index < 3; index += 1) assertNear(vector[index], expected[index], `${label}[${index}]`);
}

function assertNear(actual, expected, label) {
  if (Math.abs(Number(actual) - Number(expected)) > EPS_MM) {
    throw new Error(`Endpoint cylinder ${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

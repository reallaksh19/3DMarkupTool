import { assertRvmAxisBasis } from './rvm-axis-basis-policy.js';

const VECTOR_EPSILON = 1e-9;
const FIT_EPSILON_MM = 1e-6;

export function solveCode4ElbowGeometry(contract = {}, options = {}) {
  if (contract.schema !== 'ManagedStageGeometryContract.v1') {
    throw new Error('Code-4 elbow solver expects a managed-stage geometry contract');
  }
  if (contract.centerlineKind !== 'arc' || contract.dtxr !== 'BEND') {
    throw new Error(`Code-4 elbow solver only supports BEND arc contracts: ${contract.name || 'UNNAMED'}`);
  }

  const start = vector3(contract.startMm, `${contract.name}.startMm`);
  const end = vector3(contract.endMm, `${contract.name}.endMm`);
  const chord = vsub(end, start);
  const chordLengthMm = length(chord);
  if (!(chordLengthMm > 0)) throw new Error(`Invalid zero-length bend chord for ${contract.name}`);

  const chordDirection = normalize(chord, `${contract.name}.bendChordDirection`);
  const declaredBendRadiusMm = positiveNumber(contract.arc?.bendRadiusMm, `${contract.name}.arc.bendRadiusMm`);
  const tubeRadiusMm = positiveNumber(contract.arc?.tubeRadiusMm ?? contract.radiusMm, `${contract.name}.arc.tubeRadiusMm`);
  const declaredSweepAngleRad = positiveNumber(contract.arc?.sweepAngleRad, `${contract.name}.arc.sweepAngleRad`);

  if (!(declaredSweepAngleRad < Math.PI)) {
    throw new Error(`Invalid bend sweep for ${contract.name}: managed-stage code-4 solver expects sweep < PI`);
  }

  const minRadiusForChordMm = chordLengthMm / (2 * Math.sin(declaredSweepAngleRad / 2));
  let bendRadiusMm = declaredBendRadiusMm;
  if (options.preserveDeclaredRadius !== true) {
    bendRadiusMm = Math.max(declaredBendRadiusMm, minRadiusForChordMm);
  } else if (chordLengthMm > declaredBendRadiusMm * 2 + FIT_EPSILON_MM) {
    throw new Error(`Declared bend radius cannot span staged endpoints for ${contract.name}`);
  }

  const sweepAngleRad = declaredSweepAngleRad;
  const startTangent = optionalUnitVector(options.startTangent || contract.arc?.startTangent, 'code4 startTangent');
  const endTangent = optionalUnitVector(options.endTangent || contract.arc?.endTangent, 'code4 endTangent');
  let planeNormal = resolvePlaneNormal(chordDirection, options.planeNormal || contract.arc?.planeNormal);
  if (startTangent || endTangent) {
    planeNormal = orientPlaneNormalForTangents(planeNormal, chordDirection, sweepAngleRad, startTangent, endTangent);
  }

  const radialMid = normalize(cross(chordDirection, planeNormal), `${contract.name}.bendRadialMid`);
  const halfSweep = sweepAngleRad / 2;
  const sinHalf = Math.sin(halfSweep);
  const cosHalf = Math.cos(halfSweep);

  const arcCenterMm = vsub(midpoint(start, end), scale(radialMid, bendRadiusMm * cosHalf));
  const xAxis = normalize(vsub(scale(radialMid, cosHalf), scale(chordDirection, sinHalf)), `${contract.name}.bendXAxis`);
  const yAxis = normalize(cross(planeNormal, xAxis), `${contract.name}.bendYAxis`);
  const basis = { x: xAxis, y: yAxis, z: planeNormal };
  assertRvmAxisBasis(basis);

  const solvedStart = vadd(arcCenterMm, scale(xAxis, bendRadiusMm));
  const solvedEnd = vadd(arcCenterMm, scale(vadd(scale(xAxis, Math.cos(sweepAngleRad)), scale(yAxis, Math.sin(sweepAngleRad))), bendRadiusMm));
  const startFitErrorMm = distance(start, solvedStart);
  const endFitErrorMm = distance(end, solvedEnd);
  const endpointFitErrorMm = Math.max(startFitErrorMm, endFitErrorMm);

  const outer = bendRadiusMm + tubeRadiusMm;
  const tangentHintState = contract.arc?.tangentHintState || '';
  const tangentHintsUsed = Boolean(startTangent || endTangent || tangentHintState);
  return {
    schema: 'RvmCode4ElbowGeometrySolver.v1',
    solverState: 'endpoint-fit-v1',
    name: contract.name,
    startMm: roundVector(start),
    endMm: roundVector(end),
    chordLengthMm: round(chordLengthMm),
    chordDirection: roundVector(chordDirection),
    centerMm: roundVector(arcCenterMm),
    direction: roundVector(planeNormal),
    basis: roundBasis(basis),
    bendRadiusMm: round(bendRadiusMm),
    tubeRadiusMm: round(tubeRadiusMm),
    sweepAngleRad: round(sweepAngleRad),
    declaredBendRadiusMm: round(declaredBendRadiusMm),
    declaredSweepAngleRad: round(declaredSweepAngleRad),
    minRadiusForChordMm: round(minRadiusForChordMm),
    radiusInflatedMm: round(Math.max(0, bendRadiusMm - declaredBendRadiusMm)),
    endpointFitErrorMm: round(endpointFitErrorMm),
    localBbox: [0, 0, -tubeRadiusMm, outer, outer, tubeRadiusMm].map(round),
    endpointLocked: endpointFitErrorMm <= FIT_EPSILON_MM,
    startTangent: startTangent ? roundVector(startTangent) : null,
    endTangent: endTangent ? roundVector(endTangent) : null,
    tangentHintState,
    tangentHintSources: contract.arc?.tangentHintSources || null,
    orientationAssumption: tangentHintsUsed
      ? 'managed-stage code4 endpoint-fit solver v1 with adjacent tangent hints'
      : 'managed-stage code4 endpoint-fit solver v1'
  };
}

function resolvePlaneNormal(chordDirection, explicitPlaneNormal) {
  if (explicitPlaneNormal !== undefined && explicitPlaneNormal !== null) {
    const normal = normalize(vector3(explicitPlaneNormal, 'code4 planeNormal'), 'code4 planeNormal');
    const dot = Math.abs(vdot(normal, chordDirection));
    if (dot > 1 - 1e-6) throw new Error('Invalid code4 planeNormal: cannot be parallel to bend chord');
    return normalize(vsub(normal, scale(chordDirection, vdot(normal, chordDirection))), 'projected code4 planeNormal');
  }
  const reference = leastParallelReference(chordDirection);
  return normalize(cross(chordDirection, reference), 'derived code4 planeNormal');
}

function orientPlaneNormalForTangents(planeNormal, chordDirection, sweepAngleRad, startTangent, endTangent) {
  const plusScore = tangentAlignmentScore(planeNormal, chordDirection, sweepAngleRad, startTangent, endTangent);
  const flipped = scale(planeNormal, -1);
  const minusScore = tangentAlignmentScore(flipped, chordDirection, sweepAngleRad, startTangent, endTangent);
  return minusScore > plusScore + 1e-9 ? flipped : planeNormal;
}

function tangentAlignmentScore(planeNormal, chordDirection, sweepAngleRad, startTangent, endTangent) {
  const radialMid = normalize(cross(chordDirection, planeNormal), 'tangent score radialMid');
  const halfSweep = sweepAngleRad / 2;
  const xAxis = normalize(vsub(scale(radialMid, Math.cos(halfSweep)), scale(chordDirection, Math.sin(halfSweep))), 'tangent score xAxis');
  const yAxis = normalize(cross(planeNormal, xAxis), 'tangent score yAxis');
  const solvedEndTangent = normalize(vadd(scale(xAxis, -Math.sin(sweepAngleRad)), scale(yAxis, Math.cos(sweepAngleRad))), 'tangent score endTangent');
  let score = 0;
  if (startTangent) score += vdot(yAxis, startTangent);
  if (endTangent) score += vdot(solvedEndTangent, endTangent);
  return score;
}

function optionalUnitVector(value, fieldName) {
  if (value === undefined || value === null) return null;
  return normalize(vector3(value, fieldName), fieldName);
}

function leastParallelReference(direction) {
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return axes.reduce((best, axis) => Math.abs(vdot(direction, axis)) < Math.abs(vdot(direction, best)) ? axis : best, axes[0]);
}

function vector3(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`Invalid ${fieldName}: expected [x, y, z]`);
  const out = value.map(Number);
  if (out.some((entry) => !Number.isFinite(entry))) throw new Error(`Invalid ${fieldName}: contains non-finite value`);
  return out;
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${fieldName}: expected positive number`);
  return parsed;
}

function normalize(vector, fieldName) {
  const len = length(vector);
  if (!Number.isFinite(len) || len <= VECTOR_EPSILON) throw new Error(`Invalid ${fieldName}: expected non-zero vector`);
  return vector.map((entry) => entry / len);
}

function length(vector) { return Math.hypot(vector[0], vector[1], vector[2]); }
function distance(a, b) { return length(vsub(a, b)); }
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(v, factor) { return [v[0] * factor, v[1] * factor, v[2] * factor]; }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function round(value) { return Number(Number(value).toFixed(9)); }
function roundVector(vector) { return vector.map(round); }
function roundBasis(basis) { return { x: roundVector(basis.x), y: roundVector(basis.y), z: roundVector(basis.z) }; }

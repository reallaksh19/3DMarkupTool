import { RVM_PRIMITIVE_KIND_CODES } from './rvm-primitive-kind-contract.js?v=bust-cache-4';
import { RVM_PRIMITIVE_PAYLOAD_LAYOUTS } from './rvm-primitive-payload-decoder.js?v=bust-cache-4';

export const RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY_SCHEMA = 'RvmCode4ElbowEmissionCandidatePolicy.v1';
export const RVM_CODE4_ELBOW_PRIMITIVE_CODE = 4;
export const RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN = 'code4-elbow';

const CODE4_BODY_BYTES = 92;
const SEMANTIC_TOLERANCE = 1e-3;
const TWO_PI = Math.PI * 2;

export const RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY = Object.freeze({
  schema: RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY_SCHEMA,
  primitiveCode: RVM_CODE4_ELBOW_PRIMITIVE_CODE,
  candidateEmissionKind: 'elbow',
  referenceProfiles: Object.freeze(['RMSS', 'RHBG']),
  productionEmissionAllowed: false,
  defaultDirectEmissionAllowed: false,
  experimentalToken: RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN,
  safeFallbackStrategy: 'continue using existing writer-safe approximations until external RVM viewer interpretation is verified',
  requiredVerification: Object.freeze([
    'transform-basis-handedness',
    'bend-plane-orientation',
    'sweep-angle-direction',
    'local-bbox-convention',
    'external-viewer-roundtrip'
  ]),
  reason: 'RMSS/RHBG code 4 decodes as elbow/bend-like, but direct writer emission remains blocked until orientation and external viewer behavior are verified.'
});

export function evaluateRvmCode4ElbowEmissionCandidate(decodedPrimitive = {}, options = {}) {
  const code = Number(decodedPrimitive?.code);
  const bodyLength = Number(decodedPrimitive?.bodyLength);
  const payload = Array.isArray(decodedPrimitive?.payload) ? decodedPrimitive.payload : [];
  const semantics = decodedPrimitive?.payloadSemantics || {};
  const bendRadius = Number(semantics.bendRadius ?? payload[0]);
  const tubeRadius = Number(semantics.tubeRadius ?? payload[1]);
  const sweepAngleRad = Number(semantics.sweepAngleRad ?? payload[2]);
  const bbox = Array.isArray(decodedPrimitive?.bbox) ? decodedPrimitive.bbox : [];

  const codeMatches = code === RVM_CODE4_ELBOW_PRIMITIVE_CODE;
  const bodyLengthMatches = bodyLength === CODE4_BODY_BYTES;
  const payloadWordCount = Number.isFinite(Number(decodedPrimitive?.payloadWordCount)) ? Number(decodedPrimitive.payloadWordCount) : payload.length;
  const payloadWordCountMatches = payloadWordCount === 3;
  const radiiArePositive = finitePositive(bendRadius) && finitePositive(tubeRadius);
  const sweepAngleIsPlausible = Number.isFinite(sweepAngleRad) && sweepAngleRad > 0 && sweepAngleRad <= TWO_PI + SEMANTIC_TOLERANCE;
  const bendCanContainTube = radiiArePositive && bendRadius + SEMANTIC_TOLERANCE >= tubeRadius;
  const bboxCheck = evaluateCode4BboxPlausibility(bbox, tubeRadius);
  const semanticConfidence = String(decodedPrimitive?.semanticConfidence || 'unknown');
  const decoderClassifiesAsElbow = String(decodedPrimitive?.candidateEmissionKind || '') === 'elbow';

  const candidateValid = Boolean(
    codeMatches &&
      bodyLengthMatches &&
      payloadWordCountMatches &&
      radiiArePositive &&
      sweepAngleIsPlausible &&
      bendCanContainTube &&
      bboxCheck.plausible &&
      decoderClassifiesAsElbow
  );

  const experimentalRequested = hasExperimentalCode4Token(options);
  const hardOptIn = options.allowExperimentalCode4ElbowEmission === true;
  const experimentalEmissionCandidateAllowed = Boolean(candidateValid && experimentalRequested && hardOptIn);

  return {
    schema: RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY_SCHEMA,
    primitiveCode: RVM_CODE4_ELBOW_PRIMITIVE_CODE,
    candidateEmissionKind: 'elbow',
    productionEmissionAllowed: false,
    defaultDirectEmissionAllowed: false,
    directWriterEmissionAllowed: false,
    experimentalToken: RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN,
    experimentalRequested,
    experimentalHardOptIn: hardOptIn,
    experimentalEmissionCandidateAllowed,
    candidateStatus: candidateStatus({
      codeMatches,
      bodyLengthMatches,
      payloadWordCountMatches,
      radiiArePositive,
      sweepAngleIsPlausible,
      bendCanContainTube,
      bboxPlausible: bboxCheck.plausible,
      decoderClassifiesAsElbow,
      candidateValid
    }),
    candidateValid,
    decoderClassifiesAsElbow,
    semanticConfidence,
    checks: {
      codeMatches,
      bodyLengthMatches,
      payloadWordCountMatches,
      radiiArePositive,
      sweepAngleIsPlausible,
      bendCanContainTube,
      bboxPlausible: bboxCheck.plausible,
      bboxReason: bboxCheck.reason,
      elbowKindStillNotWriterSupported: !Object.prototype.hasOwnProperty.call(RVM_PRIMITIVE_KIND_CODES, 'elbow')
    },
    payloadSemantics: { bendRadius, tubeRadius, sweepAngleRad },
    requiredVerification: [...RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.requiredVerification],
    safeFallbackStrategy: RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.safeFallbackStrategy,
    reason: RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.reason
  };
}

export function isRvmCode4ElbowEmissionCandidate(decodedPrimitive, options = {}) {
  return evaluateRvmCode4ElbowEmissionCandidate(decodedPrimitive, options).candidateValid;
}

export function assertNoRvmCode4ElbowProductionEmission(decodedPrimitive, context = 'RVM primitive') {
  if (Number(decodedPrimitive?.code) === RVM_CODE4_ELBOW_PRIMITIVE_CODE) {
    throw new Error(`${context} attempted production emission of blocked RMSS/RHBG code 4 elbow primitive. Use the default writer-safe approximation path until the experimental gate is explicitly implemented and externally verified.`);
  }
  return decodedPrimitive;
}

export function rvmCode4ElbowEmissionCandidateCompatibilityReport() {
  const layout = RVM_PRIMITIVE_PAYLOAD_LAYOUTS[RVM_CODE4_ELBOW_PRIMITIVE_CODE];
  return {
    ...RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY,
    requiredVerification: [...RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.requiredVerification],
    referenceProfiles: [...RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.referenceProfiles],
    decoderLayout: layout
      ? {
          bodyLength: layout.bodyLength,
          payloadWordCount: layout.payloadWordCount,
          payloadFields: [...layout.payloadFields],
          semanticType: layout.semanticType,
          emissionStatus: layout.emissionStatus
        }
      : null
  };
}

function hasExperimentalCode4Token(options = {}) {
  const values = [
    options.experimentalRvmPrimitiveCode,
    options.experimentalRvmPrimitiveKind,
    ...(Array.isArray(options.experimentalRvmPrimitiveCodes) ? options.experimentalRvmPrimitiveCodes : []),
    ...(Array.isArray(options.experimentalRvmPrimitiveKinds) ? options.experimentalRvmPrimitiveKinds : [])
  ];
  return values.some((value) => {
    const token = String(value || '').trim().toLowerCase();
    return token === RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN || token === 'elbow' || token === '4' || token === 'code4';
  });
}

function evaluateCode4BboxPlausibility(bbox, tubeRadius) {
  if (!Array.isArray(bbox) || bbox.length !== 6) {
    return { plausible: false, reason: 'missing-local-bbox' };
  }
  if (!bbox.every(Number.isFinite)) {
    return { plausible: false, reason: 'non-finite-local-bbox' };
  }
  const [minX, minY, minZ, maxX, maxY, maxZ] = bbox;
  const extents = [maxX - minX, maxY - minY, maxZ - minZ];
  if (!extents.every((value) => value > SEMANTIC_TOLERANCE)) {
    return { plausible: false, reason: 'empty-or-inverted-local-bbox' };
  }
  if (finitePositive(tubeRadius)) {
    const minTubeDiameter = tubeRadius * 2 - SEMANTIC_TOLERANCE;
    if (extents.some((value) => value + SEMANTIC_TOLERANCE < minTubeDiameter)) {
      return { plausible: false, reason: 'bbox-smaller-than-tube-diameter' };
    }
  }
  return { plausible: true, reason: 'bbox-finite-and-large-enough-for-tube-radius' };
}

function candidateStatus(checks) {
  if (checks.candidateValid) return 'valid-code4-elbow-candidate';
  if (!checks.codeMatches) return 'not-code4';
  if (!checks.bodyLengthMatches) return 'unexpected-code4-body-length';
  if (!checks.payloadWordCountMatches) return 'unexpected-code4-payload-word-count';
  if (!checks.radiiArePositive) return 'invalid-code4-radii';
  if (!checks.sweepAngleIsPlausible) return 'invalid-code4-sweep-angle';
  if (!checks.bendCanContainTube) return 'invalid-code4-radius-ratio';
  if (!checks.bboxPlausible) return 'invalid-code4-local-bbox';
  if (!checks.decoderClassifiesAsElbow) return 'decoder-did-not-classify-code4-as-elbow';
  return 'invalid-code4-elbow-candidate';
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

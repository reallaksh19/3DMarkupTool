import {
  RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN,
  RVM_CODE4_ELBOW_PRIMITIVE_CODE,
  evaluateRvmCode4ElbowEmissionCandidate
} from './rvm-code4-elbow-emission-candidate-policy.js?v=bust-cache-4';

export { RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN, RVM_CODE4_ELBOW_PRIMITIVE_CODE };

export const RVM_EXPERIMENTAL_CODE4_ELBOW_WRITER_POLICY_SCHEMA = 'RvmExperimentalCode4ElbowWriterPolicy.v1';
export const RVM_CODE4_ELBOW_BODY_BYTES = 92;

export function describeRvmExperimentalCode4ElbowWriterPolicy() {
  return {
    schema: RVM_EXPERIMENTAL_CODE4_ELBOW_WRITER_POLICY_SCHEMA,
    primitiveCode: RVM_CODE4_ELBOW_PRIMITIVE_CODE,
    candidateEmissionKind: 'elbow',
    defaultEnabled: false,
    productionEmissionAllowed: false,
    experimentalToken: RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN,
    requiredOptions: ['experimentalRvmPrimitiveCodes includes code4-elbow', 'allowExperimentalCode4ElbowEmission === true'],
    bodyLength: RVM_CODE4_ELBOW_BODY_BYTES,
    payloadLayout: ['bendRadius', 'tubeRadius', 'sweepAngleRad'],
    note: 'This policy only authorizes explicit experimental writer trials; the production primitive-kind contract remains unchanged.'
  };
}

export function isExperimentalRvmCode4ElbowWriterEnabled(options = {}) {
  return hasExperimentalCode4Token(options) && options.allowExperimentalCode4ElbowEmission === true;
}

export function assertExperimentalRvmCode4ElbowWriterCandidate(primitive = {}, bbox = buildRvmCode4ElbowLocalBbox(primitive), options = {}) {
  const payload = rvmCode4ElbowPayloadValues(primitive);
  const [bendRadius, tubeRadius, sweepAngleRad] = payload;
  const decodedCandidate = {
    code: RVM_CODE4_ELBOW_PRIMITIVE_CODE,
    bodyLength: RVM_CODE4_ELBOW_BODY_BYTES,
    payload,
    payloadWordCount: payload.length,
    bbox,
    payloadSemantics: { bendRadius, tubeRadius, sweepAngleRad },
    candidateEmissionKind: 'elbow',
    semanticConfidence: 'experimental-writer-candidate'
  };
  const gate = evaluateRvmCode4ElbowEmissionCandidate(decodedCandidate, options);

  if (!gate.experimentalEmissionCandidateAllowed) {
    throw new Error(
      `Experimental RVM code 4 elbow writer emission is disabled or invalid: ${gate.candidateStatus}. ` +
        `Provide experimentalRvmPrimitiveCodes: ['${RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN}'] and ` +
        'allowExperimentalCode4ElbowEmission: true only for explicit RMSS/RHBG viewer trials.'
    );
  }

  return {
    schema: RVM_EXPERIMENTAL_CODE4_ELBOW_WRITER_POLICY_SCHEMA,
    primitiveCode: RVM_CODE4_ELBOW_PRIMITIVE_CODE,
    bodyLength: RVM_CODE4_ELBOW_BODY_BYTES,
    payload,
    bbox,
    gate
  };
}

export function rvmCode4ElbowPayloadValues(primitive = {}) {
  return [
    positiveNumber(
      primitive.bendRadius ?? primitive.elbowRadius ?? primitive.centerlineRadius ?? primitive.radius,
      'code 4 elbow bendRadius'
    ),
    positiveNumber(
      primitive.tubeRadius ?? primitive.pipeRadius ?? primitive.crossSectionRadius ?? primitive.minorRadius,
      'code 4 elbow tubeRadius'
    ),
    positiveNumber(
      primitive.sweepAngleRad ?? primitive.angleRad ?? primitive.sweepRadians ?? primitive.angleRadians,
      'code 4 elbow sweepAngleRad'
    )
  ];
}

export function buildRvmCode4ElbowLocalBbox(primitive = {}) {
  const explicit = primitive.localBbox ?? primitive.bbox;
  if (explicit !== undefined && explicit !== null) {
    return bbox6(explicit, 'code 4 elbow localBbox');
  }

  const [bendRadius, tubeRadius] = rvmCode4ElbowPayloadValues(primitive);
  const outer = bendRadius + tubeRadius;
  return [-outer, -outer, -tubeRadius, outer, outer, tubeRadius];
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

function bbox6(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 6) {
    throw new Error(`Invalid RVM ${fieldName}: expected [minX, minY, minZ, maxX, maxY, maxZ]`);
  }
  const bbox = value.map((entry) => Number(entry));
  if (bbox.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`Invalid RVM ${fieldName}: contains non-finite value`);
  }
  const [minX, minY, minZ, maxX, maxY, maxZ] = bbox;
  if (!(maxX > minX && maxY > minY && maxZ > minZ)) {
    throw new Error(`Invalid RVM ${fieldName}: extents must be positive`);
  }
  return bbox;
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid RVM ${fieldName}: expected positive number`);
  }
  return parsed;
}

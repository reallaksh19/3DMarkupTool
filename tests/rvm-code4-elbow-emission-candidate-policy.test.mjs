import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { RVM_PRIMITIVE_KIND_CODES } from '../src/rvm-primitive-kind-contract.js';
import { decodeRvmPrimitivePayload, RVM_PRIMITIVE_PAYLOAD_LAYOUTS } from '../src/rvm-primitive-payload-decoder.js';
import {
  RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY,
  RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY_SCHEMA,
  RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN,
  assertNoRvmCode4ElbowProductionEmission,
  evaluateRvmCode4ElbowEmissionCandidate,
  isRvmCode4ElbowEmissionCandidate,
  rvmCode4ElbowEmissionCandidateCompatibilityReport
} from '../src/rvm-code4-elbow-emission-candidate-policy.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const writerSource = readFileSync(new URL('../src/rvm-writer.js', import.meta.url), 'utf8');
const kindContractSource = readFileSync(new URL('../src/rvm-primitive-kind-contract.js', import.meta.url), 'utf8');

assert.equal(RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY_SCHEMA, 'RvmCode4ElbowEmissionCandidatePolicy.v1');
assert.equal(RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.primitiveCode, 4);
assert.equal(RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.candidateEmissionKind, 'elbow');
assert.equal(RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.productionEmissionAllowed, false);
assert.equal(RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.defaultDirectEmissionAllowed, false);
assert.equal(RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN, 'code4-elbow');
assert.ok(RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY.requiredVerification.includes('external-viewer-roundtrip'));

assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[4].candidateEmissionKind, 'elbow');
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[4].payloadWordCount, 3);
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[4].payloadFields, ['bendRadius', 'tubeRadius', 'sweepAngleRad']);
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[4].emissionStatus, 'reference-observed-blocked');

const elbowBody = makePrimitiveBody({
  code: 4,
  bodyLength: 92,
  bbox: [-414.55, -414.55, -109.55, 414.55, 414.55, 109.55],
  payload: [305, 109.55, Math.PI / 2]
});
const elbow = decodeRvmPrimitivePayload(elbowBody);
const defaultGate = evaluateRvmCode4ElbowEmissionCandidate(elbow);

assert.equal(defaultGate.schema, RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY_SCHEMA);
assert.equal(defaultGate.candidateStatus, 'valid-code4-elbow-candidate');
assert.equal(defaultGate.candidateValid, true);
assert.equal(defaultGate.productionEmissionAllowed, false);
assert.equal(defaultGate.defaultDirectEmissionAllowed, false);
assert.equal(defaultGate.directWriterEmissionAllowed, false);
assert.equal(defaultGate.experimentalRequested, false);
assert.equal(defaultGate.experimentalEmissionCandidateAllowed, false, 'default code 4 elbow gate must not authorize emission');
assert.equal(defaultGate.checks.elbowKindStillNotWriterSupported, true);
assert.equal(defaultGate.checks.bboxPlausible, true);
assert.deepEqual(defaultGate.payloadSemantics, {
  bendRadius: elbow.payloadSemantics.bendRadius,
  tubeRadius: elbow.payloadSemantics.tubeRadius,
  sweepAngleRad: elbow.payloadSemantics.sweepAngleRad
});
assert.equal(isRvmCode4ElbowEmissionCandidate(elbow), true);

const experimentalRequestedButNotHardEnabled = evaluateRvmCode4ElbowEmissionCandidate(elbow, {
  experimentalRvmPrimitiveCodes: [RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN]
});
assert.equal(experimentalRequestedButNotHardEnabled.experimentalRequested, true);
assert.equal(experimentalRequestedButNotHardEnabled.experimentalHardOptIn, false);
assert.equal(experimentalRequestedButNotHardEnabled.experimentalEmissionCandidateAllowed, false, 'experimental token alone is not enough');

const explicitExperimentalGate = evaluateRvmCode4ElbowEmissionCandidate(elbow, {
  experimentalRvmPrimitiveCodes: [RVM_CODE4_ELBOW_EXPERIMENTAL_TOKEN],
  allowExperimentalCode4ElbowEmission: true
});
assert.equal(explicitExperimentalGate.experimentalRequested, true);
assert.equal(explicitExperimentalGate.experimentalHardOptIn, true);
assert.equal(explicitExperimentalGate.experimentalEmissionCandidateAllowed, true, 'candidate gate may be explicitly enabled for a future experimental writer path');
assert.equal(explicitExperimentalGate.directWriterEmissionAllowed, false, 'policy module alone must not change writer support');
assert.equal(explicitExperimentalGate.productionEmissionAllowed, false);

assert.throws(
  () => assertNoRvmCode4ElbowProductionEmission(elbow, 'unit test'),
  /blocked RMSS\/RHBG code 4 elbow primitive/,
  'production code 4 elbow emission must fail closed'
);
assert.doesNotThrow(() => assertNoRvmCode4ElbowProductionEmission({ code: 8 }, 'unit test'));

const invalidSweepBody = makePrimitiveBody({
  code: 4,
  bodyLength: 92,
  bbox: [-100, -100, -25, 100, 100, 25],
  payload: [80, 25, 0]
});
const invalidSweep = evaluateRvmCode4ElbowEmissionCandidate(decodeRvmPrimitivePayload(invalidSweepBody));
assert.equal(invalidSweep.candidateValid, false);
assert.equal(invalidSweep.candidateStatus, 'invalid-code4-sweep-angle');
assert.equal(invalidSweep.experimentalEmissionCandidateAllowed, false);

const invalidRatioBody = makePrimitiveBody({
  code: 4,
  bodyLength: 92,
  bbox: [-100, -100, -100, 100, 100, 100],
  payload: [25, 50, Math.PI / 2]
});
const invalidRatio = evaluateRvmCode4ElbowEmissionCandidate(decodeRvmPrimitivePayload(invalidRatioBody));
assert.equal(invalidRatio.candidateValid, false);
assert.equal(invalidRatio.candidateStatus, 'invalid-code4-radius-ratio');

const cylinderBody = makePrimitiveBody({
  code: 8,
  bodyLength: 88,
  bbox: [-25, -25, -50, 25, 25, 50],
  payload: [25, 100]
});
const nonCode4 = evaluateRvmCode4ElbowEmissionCandidate(decodeRvmPrimitivePayload(cylinderBody));
assert.equal(nonCode4.candidateValid, false);
assert.equal(nonCode4.candidateStatus, 'not-code4');

const report = rvmCode4ElbowEmissionCandidateCompatibilityReport();
assert.equal(report.schema, RVM_CODE4_ELBOW_EMISSION_CANDIDATE_POLICY_SCHEMA);
assert.equal(report.primitiveCode, 4);
assert.equal(report.productionEmissionAllowed, false);
assert.equal(report.defaultDirectEmissionAllowed, false);
assert.equal(report.decoderLayout.bodyLength, 92);
assert.deepEqual(report.decoderLayout.payloadFields, ['bendRadius', 'tubeRadius', 'sweepAngleRad']);
assert.ok(report.requiredVerification.includes('bend-plane-orientation'));

assert.equal(Object.prototype.hasOwnProperty.call(RVM_PRIMITIVE_KIND_CODES, 'elbow'), false, 'writer primitive kind contract must not add elbow in this PR');
assert.doesNotMatch(kindContractSource, /elbow\s*:/, 'primitive-kind contract must not expose elbow as a production writer kind');
assert.match(writerSource, /rvmPrimitiveCodeForKind/, 'writer must continue resolving production primitive codes from the central safe kind contract');
assert.match(writerSource, /assertExperimentalRvmCode4ElbowWriterCandidate/, 'writer may only reach code 4 through the explicit experimental candidate gate');
assert.match(pkg.scripts.test, /rvm-code4-elbow-emission-candidate-policy\.test\.mjs/, 'npm test must include the code 4 elbow candidate gate');

console.log('RVM code 4 elbow emission candidate policy gate passed');

function makePrimitiveBody({ code, bodyLength, bbox = [0, 0, 0, 0, 0, 0], payload = [] }) {
  const buffer = new ArrayBuffer(bodyLength);
  const view = new DataView(buffer);
  view.setUint32(0, 1, false);
  view.setUint32(4, code, false);
  let offset = 8;
  for (let i = 0; i < 12; i += 1) {
    view.setFloat32(offset, i % 5 === 0 ? 0.001 : 0, false);
    offset += 4;
  }
  for (const value of bbox) {
    view.setFloat32(offset, value, false);
    offset += 4;
  }
  for (const value of payload) {
    view.setFloat32(offset, value, false);
    offset += 4;
  }
  return buffer;
}

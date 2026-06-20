import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { writeRvm } from '../src/rvm-writer.js';
import { RVM_PRIMITIVE_KIND_CODES } from '../src/rvm-primitive-kind-contract.js';
import { scanRvmPrimitivePayloads } from '../src/rvm-primitive-payload-decoder.js';
import {
  RVM_CODE4_ELBOW_BODY_BYTES,
  RVM_EXPERIMENTAL_CODE4_ELBOW_WRITER_POLICY_SCHEMA,
  assertExperimentalRvmCode4ElbowWriterCandidate,
  describeRvmExperimentalCode4ElbowWriterPolicy,
  isExperimentalRvmCode4ElbowWriterEnabled
} from '../src/rvm-experimental-code4-elbow-writer-policy.js';
import { evaluateRvmCode4ElbowEmissionCandidate } from '../src/rvm-code4-elbow-emission-candidate-policy.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const kindContractSource = readFileSync(new URL('../src/rvm-primitive-kind-contract.js', import.meta.url), 'utf8');

const policy = describeRvmExperimentalCode4ElbowWriterPolicy();
assert.equal(policy.schema, RVM_EXPERIMENTAL_CODE4_ELBOW_WRITER_POLICY_SCHEMA);
assert.equal(policy.primitiveCode, 4);
assert.equal(policy.defaultEnabled, false);
assert.equal(policy.productionEmissionAllowed, false);
assert.equal(policy.bodyLength, RVM_CODE4_ELBOW_BODY_BYTES);
assert.deepEqual(policy.payloadLayout, ['bendRadius', 'tubeRadius', 'sweepAngleRad']);

assert.equal(isExperimentalRvmCode4ElbowWriterEnabled(), false);
assert.equal(isExperimentalRvmCode4ElbowWriterEnabled({ experimentalRvmPrimitiveCodes: ['code4-elbow'] }), false);
assert.equal(isExperimentalRvmCode4ElbowWriterEnabled({ allowExperimentalCode4ElbowEmission: true }), false);
assert.equal(isExperimentalRvmCode4ElbowWriterEnabled({
  experimentalRvmPrimitiveCodes: ['code4-elbow'],
  allowExperimentalCode4ElbowEmission: true
}), true);

assert.equal(Object.prototype.hasOwnProperty.call(RVM_PRIMITIVE_KIND_CODES, 'elbow'), false);
assert.doesNotMatch(kindContractSource, /elbow\s*:/, 'primitive-kind contract must not expose elbow as a production writer kind');

const elbowPrimitive = {
  kind: 'elbow',
  name: 'EXPERIMENTAL_CODE4_ELBOW',
  center: [1000, 2000, 3000],
  direction: [0, 0, 1],
  bendRadius: 305,
  tubeRadius: 109.55,
  sweepAngleRad: Math.PI / 2,
  material: 4
};

const model = exportModelWithPrimitive(elbowPrimitive);

assert.throws(
  () => writeRvm(model),
  /Experimental RVM code 4 elbow writer emission is disabled or invalid/,
  'default writeRvm() must not emit code 4 elbows'
);

assert.throws(
  () => writeRvm(model, { experimentalRvmPrimitiveCodes: ['code4-elbow'] }),
  /allowExperimentalCode4ElbowEmission: true/,
  'experimental token alone must not emit code 4 elbows'
);

assert.throws(
  () => writeRvm(model, { allowExperimentalCode4ElbowEmission: true }),
  /experimentalRvmPrimitiveCodes/,
  'hard opt-in without token must not emit code 4 elbows'
);

const enabledOptions = {
  experimentalRvmPrimitiveCodes: ['code4-elbow'],
  allowExperimentalCode4ElbowEmission: true
};

const candidate = assertExperimentalRvmCode4ElbowWriterCandidate(elbowPrimitive, undefined, enabledOptions);
assert.equal(candidate.schema, RVM_EXPERIMENTAL_CODE4_ELBOW_WRITER_POLICY_SCHEMA);
assert.equal(candidate.primitiveCode, 4);
assert.equal(candidate.bodyLength, 92);
assert.deepEqual(candidate.payload, [305, 109.55, Math.PI / 2]);
assert.equal(candidate.gate.experimentalEmissionCandidateAllowed, true);

const rvm = writeRvm(model, enabledOptions);
const primitives = scanRvmPrimitivePayloads(rvm);
assert.equal(primitives.length, 1);

const decoded = primitives[0];
assert.equal(decoded.code, 4);
assert.equal(decoded.bodyLength, 92);
assert.equal(decoded.payloadWordCount, 3);
assert.equal(decoded.supportedForEmission, false, 'code 4 stays outside the production primitive-kind contract');
assert.equal(decoded.referenceObservedButBlocked, true);
assert.equal(decoded.compatibilityStatus, 'reference-observed-layout-blocked');
assert.equal(decoded.candidateEmissionKind, 'elbow');
assert.equal(decoded.semanticType, 'rmss-rhbg-elbow-bend-like');
assert.ok(approx(decoded.payloadSemantics.bendRadius, 305));
assert.ok(approx(decoded.payloadSemantics.tubeRadius, 109.55));
assert.ok(approx(decoded.payloadSemantics.sweepAngleRad, Math.PI / 2));

const decodedGate = evaluateRvmCode4ElbowEmissionCandidate(decoded, enabledOptions);
assert.equal(decodedGate.candidateStatus, 'valid-code4-elbow-candidate');
assert.equal(decodedGate.experimentalEmissionCandidateAllowed, true);

const cylinderRvm = writeRvm(exportModelWithPrimitive({
  kind: 'cylinder',
  name: 'SAFE_CYLINDER',
  center: [0, 0, 0],
  direction: [0, 0, 1],
  radius: 50,
  length: 100,
  material: 4
}));
const [cylinder] = scanRvmPrimitivePayloads(cylinderRvm);
assert.equal(cylinder.code, 8);
assert.equal(cylinder.supportedForEmission, true);

assert.match(pkg.scripts.test, /rvm-experimental-code4-elbow-writer-policy\.test\.mjs/, 'npm test must include the experimental code 4 writer gate');

console.log('RVM experimental code 4 elbow writer policy gate passed');

function exportModelWithPrimitive(primitive) {
  return {
    root: {
      name: 'ROOT',
      reviewName: '/INPUTXML',
      material: 1,
      children: [],
      primitives: [primitive]
    },
    rvmMaterialColors: {
      1: '0x82828200',
      4: '0xffff0000'
    }
  };
}

function approx(actual, expected, tolerance = 1e-3) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

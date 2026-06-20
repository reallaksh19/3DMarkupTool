import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALLOWED_RVM_PRIMITIVE_KINDS,
  UNEMITTED_RHBG_PRIMITIVE_CODES,
  isRvmPrimitiveKindSupported
} from '../src/rvm-primitive-kind-contract.js';
import { RVM_PRIMITIVE_PAYLOAD_LAYOUTS } from '../src/rvm-primitive-payload-decoder.js';
import {
  BLOCKED_DIRECT_RHBG_APPROXIMATION_CODES,
  RVM_SAFE_PRIMITIVE_APPROXIMATION_POLICY_SCHEMA,
  assertNoBlockedDirectRhbgApproximationCode,
  assertSafeApproximationPrimitives,
  isBlockedDirectRhbgApproximationCode,
  rvmSafeApproximationCompatibilityReport,
  safeApproximationPolicyForIntent
} from '../src/rvm-safe-primitive-approximation-policy.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const translatorSource = readFileSync(new URL('../src/rvm-catalogue-primitive-translator.js', import.meta.url), 'utf8');
const writerSource = readFileSync(new URL('../src/rvm-writer.js', import.meta.url), 'utf8');

assert.equal(RVM_SAFE_PRIMITIVE_APPROXIMATION_POLICY_SCHEMA, 'RvmSafePrimitiveApproximationPolicy.v1');
assert.deepEqual(BLOCKED_DIRECT_RHBG_APPROXIMATION_CODES, [5, 7], 'Only decoded cone/frustum RHBG candidates are part of the current direct-emission block list.');

for (const code of BLOCKED_DIRECT_RHBG_APPROXIMATION_CODES) {
  assert.ok(UNEMITTED_RHBG_PRIMITIVE_CODES.includes(code), `RHBG code ${code} must remain blocked in the primitive-kind contract.`);
  assert.ok(isBlockedDirectRhbgApproximationCode(code), `RHBG code ${code} must be blocked by the safe approximation policy.`);
  assert.throws(
    () => assertNoBlockedDirectRhbgApproximationCode(code, 'unit test'),
    /blocked RHBG primitive code/,
    `Direct emission of RHBG code ${code} must fail closed.`
  );
}

assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[5].candidateEmissionKind, 'cone');
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].candidateEmissionKind, 'frustum');
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[5].emissionStatus, 'rhbg-observed-blocked');
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].emissionStatus, 'rhbg-observed-blocked');

const conePolicy = safeApproximationPolicyForIntent('cone');
assert.ok(conePolicy, 'Cone intent must have an explicit safe approximation policy.');
assert.equal(conePolicy.rhbgPrimitiveCode, 5);
assert.equal(conePolicy.directEmissionAllowed, false);
assert.ok(conePolicy.safeOutputKinds.every(isRvmPrimitiveKindSupported), 'Cone approximation output kinds must all be writer-supported.');
assert.doesNotMatch(conePolicy.safeOutputKinds.join(','), /cone|frustum/, 'Cone approximation must not expose adapter-only kinds.');

const frustumPolicy = safeApproximationPolicyForIntent('frustum');
assert.ok(frustumPolicy, 'Frustum intent must have an explicit safe approximation policy.');
assert.equal(frustumPolicy.rhbgPrimitiveCode, 7);
assert.equal(frustumPolicy.directEmissionAllowed, false);
assert.deepEqual(frustumPolicy.safeOutputKinds, ['cylinder'], 'Frustum/reducer intent must remain a stepped-cylinder approximation for now.');

const reducerPolicy = safeApproximationPolicyForIntent('reducer');
assert.equal(reducerPolicy.rhbgPrimitiveCode, 7, 'Reducer intent must share the blocked frustum-like RHBG code until verified.');

assertSafeApproximationPrimitives([
  { kind: 'cylinder', catalogueExportKind: 'frustum' },
  { kind: 'cylinder', sourceIntent: 'reducer' },
  { kind: 'pyramid', sourceIntent: 'cone' },
  { kind: 'sphere', catalogueExportKind: 'bolt-pattern' }
]);

assert.throws(
  () => assertSafeApproximationPrimitives([{ kind: 'frustum', catalogueExportKind: 'frustum' }]),
  /unsupported RVM primitive kind/,
  'Adapter-only frustum kind must not pass a safe approximation gate.'
);
assert.throws(
  () => assertSafeApproximationPrimitives([{ kind: 'cylinder', rvmPrimitiveCode: 7 }]),
  /direct blocked RHBG primitive code 7/,
  'Direct RHBG code 7 emission must not pass a safe approximation gate.'
);
assert.throws(
  () => assertSafeApproximationPrimitives([{ kind: 'sphere', catalogueExportKind: 'frustum' }]),
  /approximated frustum with unsafe output kind sphere/,
  'Frustum intent must be approximated with stepped cylinders only.'
);

const report = rvmSafeApproximationCompatibilityReport();
assert.equal(report.schema, RVM_SAFE_PRIMITIVE_APPROXIMATION_POLICY_SCHEMA);
assert.equal(report.policy, 'fail-closed-safe-approximation');
assert.deepEqual(report.writerSafeOutputKinds, ALLOWED_RVM_PRIMITIVE_KINDS);
assert.deepEqual(report.blockedDirectRhbgApproximationCodes, [5, 7]);
assert.ok(report.approximationPolicies.frustum.reason.includes('external viewer interpretation'), 'Policy report must explain why code 7 remains blocked.');

assert.match(translatorSource, /safeApproximationPolicyForIntent/, 'RVM catalogue translator must resolve central safe approximation policies.');
assert.match(translatorSource, /assertSafeApproximationPrimitives/, 'RVM catalogue translator must enforce the central safe approximation policy before returning writer output.');
assert.match(translatorSource, /safeApproximationPolicyApplied:\s*true/, 'RVM catalogue export must expose that safe approximation policy was applied.');
assert.match(translatorSource, /steppedFrustum/, 'RVM catalogue translator must keep frustum intent approximated through stepped cylinders.');
assert.match(translatorSource, /sourceIntent:\s*'frustum'/, 'Stepped frustum outputs must preserve frustum intent for fail-closed policy checks.');
assert.match(translatorSource, /blockedRhbgPrimitiveCode:\s*policy\.rhbgPrimitiveCode/, 'Stepped frustum outputs must record the blocked RHBG code rather than emitting it.');
assert.match(translatorSource, /kind:\s*'cylinder'/, 'RVM catalogue translator must emit writer-safe cylinders for frustum approximations.');
assert.doesNotMatch(translatorSource, /rvmPrimitiveCode\s*:\s*[57]/, 'RVM catalogue translator must not request direct RHBG code 5 or 7 emission.');
assert.match(writerSource, /rvmPrimitiveCodeForKind/, 'RVM writer must continue using named writer-safe kinds instead of raw RHBG codes.');
assert.match(pkg.scripts.test, /rvm-safe-primitive-approximation-policy\.test\.mjs/, 'npm test must include the safe approximation policy gate.');

console.log('RVM safe primitive approximation policy gate passed');

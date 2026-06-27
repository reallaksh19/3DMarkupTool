import {
  ALLOWED_RVM_PRIMITIVE_KINDS,
  UNEMITTED_RHBG_PRIMITIVE_CODES,
  isRvmPrimitiveKindSupported
} from './rvm-primitive-kind-contract.js?v=bust-cache-4';

export const RVM_SAFE_PRIMITIVE_APPROXIMATION_POLICY_SCHEMA = 'RvmSafePrimitiveApproximationPolicy.v1';
export const BLOCKED_DIRECT_RHBG_APPROXIMATION_CODES = Object.freeze([5, 7]);

const WRITER_SAFE_KIND_SET = new Set(ALLOWED_RVM_PRIMITIVE_KINDS);
const BLOCKED_DIRECT_CODE_SET = new Set(BLOCKED_DIRECT_RHBG_APPROXIMATION_CODES);

export const RVM_SAFE_APPROXIMATION_POLICIES = Object.freeze({
  cone: Object.freeze({
    sourceIntent: 'cone',
    rhbgPrimitiveCode: 5,
    directEmissionAllowed: false,
    directEmissionStatus: 'blocked-until-viewer-verified',
    safeStrategy: 'approximate-with-existing-pyramid-or-cylinder-primitives',
    safeOutputKinds: Object.freeze(['pyramid', 'cylinder']),
    reason: 'RHBG code 5 decodes as cone-like, but taper orientation and external viewer interpretation are not yet verified.'
  }),
  frustum: Object.freeze({
    sourceIntent: 'frustum',
    rhbgPrimitiveCode: 7,
    directEmissionAllowed: false,
    directEmissionStatus: 'blocked-until-viewer-verified',
    safeStrategy: 'approximate-with-stepped-cylinder-stack',
    safeOutputKinds: Object.freeze(['cylinder']),
    reason: 'RHBG code 7 decodes as frustum/reducer-like, but taper direction, offsets, and external viewer interpretation are not yet verified.'
  }),
  reducer: Object.freeze({
    sourceIntent: 'reducer',
    rhbgPrimitiveCode: 7,
    directEmissionAllowed: false,
    directEmissionStatus: 'blocked-until-viewer-verified',
    safeStrategy: 'approximate-with-stepped-cylinder-stack',
    safeOutputKinds: Object.freeze(['cylinder']),
    reason: 'Reducer intent uses the same blocked RHBG frustum-like code path as frustum until verified.'
  })
});

export function safeApproximationPolicyForIntent(intent) {
  const key = String(intent || '').trim().toLowerCase();
  return RVM_SAFE_APPROXIMATION_POLICIES[key] || null;
}

export function isBlockedDirectRhbgApproximationCode(code) {
  return BLOCKED_DIRECT_CODE_SET.has(Number(code));
}

export function assertNoBlockedDirectRhbgApproximationCode(code, context = 'RVM primitive') {
  const normalizedCode = Number(code);
  if (isBlockedDirectRhbgApproximationCode(normalizedCode)) {
    throw new Error(`${context} attempted direct emission of blocked RHBG primitive code ${normalizedCode}. Use the safe approximation policy instead.`);
  }
  return normalizedCode;
}

export function assertSafeApproximationPrimitives(primitives = [], context = 'RVM approximation output') {
  for (const primitive of primitives) {
    const kind = String(primitive?.kind || '');
    if (!isRvmPrimitiveKindSupported(kind)) {
      throw new Error(`${context} emitted unsupported RVM primitive kind: ${kind || 'unknown'}`);
    }
    if (isBlockedDirectRhbgApproximationCode(primitive?.rvmPrimitiveCode)) {
      throw new Error(`${context} attempted direct blocked RHBG primitive code ${primitive.rvmPrimitiveCode}`);
    }
    const sourceIntent = String(primitive?.sourceIntent || primitive?.catalogueExportKind || primitive?.exportKind || '').toLowerCase();
    const policy = safeApproximationPolicyForIntent(sourceIntent);
    if (policy && !policy.safeOutputKinds.includes(kind)) {
      throw new Error(`${context} approximated ${sourceIntent} with unsafe output kind ${kind}`);
    }
  }
  return primitives;
}

export function rvmSafeApproximationCompatibilityReport() {
  return {
    schema: RVM_SAFE_PRIMITIVE_APPROXIMATION_POLICY_SCHEMA,
    policy: 'fail-closed-safe-approximation',
    writerSafeOutputKinds: [...ALLOWED_RVM_PRIMITIVE_KINDS],
    blockedDirectRhbgApproximationCodes: [...BLOCKED_DIRECT_RHBG_APPROXIMATION_CODES],
    rhbgObservedCodesStillBlocked: [...UNEMITTED_RHBG_PRIMITIVE_CODES],
    approximationPolicies: Object.fromEntries(
      Object.entries(RVM_SAFE_APPROXIMATION_POLICIES).map(([key, policy]) => [key, { ...policy, safeOutputKinds: [...policy.safeOutputKinds] }])
    )
  };
}

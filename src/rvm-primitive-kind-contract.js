/**
 * Central RVM primitive-kind compatibility contract.
 *
 * Every writer/preview RVM primitive dispatch must stay tied to this registry.
 * Additional AVEVA Review primitive codes remain blocked until each payload
 * layout is implemented and verified end-to-end.
 */

export const RVM_PRIMITIVE_KIND_CODES = Object.freeze({
  pyramid: 1,
  box: 2,
  elbow: 4,
  snout: 7,
  cylinder: 8,
  sphere: 9
});

export const ALLOWED_RVM_PRIMITIVE_KINDS = Object.freeze(Object.keys(RVM_PRIMITIVE_KIND_CODES));

export const RMSS_OBSERVED_PRIMITIVE_CODES = Object.freeze([1, 2, 4, 5, 6, 7, 8, 11]);
export const RHBG_OBSERVED_PRIMITIVE_CODES = Object.freeze([2, 3, 4, 5, 7, 8, 11]);
export const REFERENCE_OBSERVED_PRIMITIVE_CODES = Object.freeze(
  Array.from(new Set([...RMSS_OBSERVED_PRIMITIVE_CODES, ...RHBG_OBSERVED_PRIMITIVE_CODES])).sort((a, b) => a - b)
);

const EMITTED_CODE_SET = new Set(Object.values(RVM_PRIMITIVE_KIND_CODES));

export const UNEMITTED_RMSS_PRIMITIVE_CODES = Object.freeze(
  RMSS_OBSERVED_PRIMITIVE_CODES.filter((code) => !EMITTED_CODE_SET.has(code))
);
export const UNEMITTED_RHBG_PRIMITIVE_CODES = Object.freeze(
  RHBG_OBSERVED_PRIMITIVE_CODES.filter((code) => !EMITTED_CODE_SET.has(code))
);
export const UNEMITTED_REFERENCE_PRIMITIVE_CODES = Object.freeze(
  REFERENCE_OBSERVED_PRIMITIVE_CODES.filter((code) => !EMITTED_CODE_SET.has(code))
);

const ALLOWED_KIND_SET = new Set(ALLOWED_RVM_PRIMITIVE_KINDS);

export function isRvmPrimitiveKindSupported(kind) {
  return ALLOWED_KIND_SET.has(String(kind || ''));
}

export function assertRvmPrimitiveKindSupported(kind, context = 'RVM primitive') {
  if (!isRvmPrimitiveKindSupported(kind)) {
    throw new Error(`${context} uses unsupported RVM primitive kind: ${String(kind)}`);
  }
  return String(kind);
}

export function rvmPrimitiveCodeForKind(kind) {
  const supportedKind = assertRvmPrimitiveKindSupported(kind);
  return RVM_PRIMITIVE_KIND_CODES[supportedKind];
}

export function rvmPrimitiveKindCompatibilityReport() {
  return {
    policy: 'fail-closed',
    emittedKinds: ALLOWED_RVM_PRIMITIVE_KINDS.map((kind) => ({ kind, code: RVM_PRIMITIVE_KIND_CODES[kind] })),
    rmssObservedPrimitiveCodes: [...RMSS_OBSERVED_PRIMITIVE_CODES],
    rhbgObservedPrimitiveCodes: [...RHBG_OBSERVED_PRIMITIVE_CODES],
    referenceObservedPrimitiveCodes: [...REFERENCE_OBSERVED_PRIMITIVE_CODES],
    rmssObservedCodesNotEmitted: [...UNEMITTED_RMSS_PRIMITIVE_CODES],
    rhbgObservedCodesNotEmitted: [...UNEMITTED_RHBG_PRIMITIVE_CODES],
    referenceObservedCodesNotEmitted: [...UNEMITTED_REFERENCE_PRIMITIVE_CODES],
    note: 'Observed RMSS/RHBG primitive codes are emitted only after the matching writer, preview, decoder, and verification paths are implemented.'
  };
}

/**
 * Central RVM primitive-kind compatibility contract.
 *
 * The writer intentionally emits only the primitive kinds that are already mapped
 * through the current export model contract. RHBG.RVM reference inspection shows
 * additional Review primitive codes, but those remain blocked until each payload
 * layout is implemented and externally verified.
 */

export const RVM_PRIMITIVE_KIND_CODES = Object.freeze({
  pyramid: 1,
  box: 2,
  cylinder: 8,
  sphere: 9
});

export const ALLOWED_RVM_PRIMITIVE_KINDS = Object.freeze(Object.keys(RVM_PRIMITIVE_KIND_CODES));

export const RHBG_OBSERVED_PRIMITIVE_CODES = Object.freeze([2, 3, 4, 5, 7, 8, 11]);

export const UNEMITTED_RHBG_PRIMITIVE_CODES = Object.freeze(
  RHBG_OBSERVED_PRIMITIVE_CODES.filter((code) => !Object.values(RVM_PRIMITIVE_KIND_CODES).includes(code))
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
    rhbgObservedPrimitiveCodes: [...RHBG_OBSERVED_PRIMITIVE_CODES],
    rhbgObservedCodesNotEmitted: [...UNEMITTED_RHBG_PRIMITIVE_CODES],
    note: 'Observed RHBG primitive codes are not emitted until the payload layout is implemented and verified.'
  };
}

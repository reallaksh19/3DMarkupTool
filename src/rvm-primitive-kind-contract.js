/**
 * Central RVM primitive-kind compatibility contract.
 *
 * This registry is the single source of truth for primitive kinds that may exist in
 * the export model consumed by both writeRvm() and createRvmPreviewScene(). Writer
 * and preview dispatch tables must mirror this contract exactly so the canvas stays
 * an honest preview of the bytes written to the .rvm file.
 *
 * RVM PRIM transform matrices are stored in metres, but local bounding boxes and
 * kind parameters are stored in millimetres. Axial primitives in this export model
 * use local Z as their length/height axis unless a legacy preview helper documents
 * otherwise. Code 7 Snout must therefore keep radius in local X/Y and height on
 * local Z across emitters, writer bbox/params, and preview geometry.
 */
export const RVM_PRIMITIVE_KIND_CONTRACT = Object.freeze({
  pyramid: Object.freeze({
    code: 1,
    paramCount: 7,
    params: Object.freeze(['bottomX', 'bottomY', 'topX', 'topY', 'offsetX', 'offsetY', 'height'])
  }),
  box: Object.freeze({
    code: 2,
    paramCount: 3,
    params: Object.freeze(['lengthX', 'lengthY', 'lengthZ'])
  }),
  elbow: Object.freeze({
    code: 4,
    paramCount: 3,
    params: Object.freeze(['bendRadius', 'tubeRadius', 'sweepAngleRad']),
    note: 'CircularTorus elbow/bend primitive. Emission remains explicitly gated by the experimental code-4 writer policy.'
  }),
  snout: Object.freeze({
    code: 7,
    paramCount: 9,
    params: Object.freeze(['radiusBottom', 'radiusTop', 'height', 'offsetX', 'offsetY', 'botShearX', 'botShearY', 'topShearX', 'topShearY']),
    note: 'Snout/frustum primitive. Height is on local Z; radii are in local X/Y. A cone is represented with radiusTop = 0.'
  }),
  cylinder: Object.freeze({
    code: 8,
    paramCount: 2,
    params: Object.freeze(['radius', 'length'])
  }),
  sphere: Object.freeze({
    code: 9,
    paramCount: 1,
    params: Object.freeze(['diameter'])
  })
});

export const RVM_PRIMITIVE_KIND_CODES = Object.freeze(
  Object.fromEntries(Object.entries(RVM_PRIMITIVE_KIND_CONTRACT).map(([kind, contract]) => [kind, contract.code]))
);

export const ALLOWED_RVM_PRIMITIVE_KINDS = Object.freeze(Object.keys(RVM_PRIMITIVE_KIND_CONTRACT));

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

export function rvmPrimitiveParamCountForKind(kind) {
  const supportedKind = assertRvmPrimitiveKindSupported(kind);
  return RVM_PRIMITIVE_KIND_CONTRACT[supportedKind].paramCount;
}

export function rvmPrimitiveKindCompatibilityReport() {
  return {
    policy: 'fail-closed',
    emittedKinds: ALLOWED_RVM_PRIMITIVE_KINDS.map((kind) => ({
      kind,
      code: RVM_PRIMITIVE_KIND_CODES[kind],
      paramCount: RVM_PRIMITIVE_KIND_CONTRACT[kind].paramCount,
      params: [...RVM_PRIMITIVE_KIND_CONTRACT[kind].params]
    })),
    rmssObservedPrimitiveCodes: [...RMSS_OBSERVED_PRIMITIVE_CODES],
    rhbgObservedPrimitiveCodes: [...RHBG_OBSERVED_PRIMITIVE_CODES],
    referenceObservedPrimitiveCodes: [...REFERENCE_OBSERVED_PRIMITIVE_CODES],
    rmssObservedCodesNotEmitted: [...UNEMITTED_RMSS_PRIMITIVE_CODES],
    rhbgObservedCodesNotEmitted: [...UNEMITTED_RHBG_PRIMITIVE_CODES],
    referenceObservedCodesNotEmitted: [...UNEMITTED_REFERENCE_PRIMITIVE_CODES],
    note: 'Observed RMSS/RHBG primitive codes are not emitted until each payload layout is implemented and verified; code 4 elbow is contract-supported but remains gated by explicit writer options, and code 7 snout is writer/preview-supported for controlled synthetic validation.'
  };
}

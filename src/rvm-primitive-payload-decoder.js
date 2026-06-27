import {
  RVM_PRIMITIVE_KIND_CODES,
  RMSS_OBSERVED_PRIMITIVE_CODES,
  RHBG_OBSERVED_PRIMITIVE_CODES,
  REFERENCE_OBSERVED_PRIMITIVE_CODES,
  UNEMITTED_RMSS_PRIMITIVE_CODES,
  UNEMITTED_RHBG_PRIMITIVE_CODES,
  UNEMITTED_REFERENCE_PRIMITIVE_CODES
} from './rvm-primitive-kind-contract.js?v=bust-cache-4';

const COMMON_PRIMITIVE_BODY_BYTES = 80;
const MATRIX_FLOAT_COUNT = 12;
const BBOX_FLOAT_COUNT = 6;
const SEMANTIC_TOLERANCE = 1e-3;

export const RVM_PRIMITIVE_PAYLOAD_LAYOUTS = Object.freeze({
  1: Object.freeze({
    code: 1,
    emittedKind: 'pyramid',
    bodyLength: 108,
    payloadWordCount: 7,
    payloadFields: Object.freeze(['bottomX', 'bottomY', 'topX', 'topY', 'offsetX', 'offsetY', 'height']),
    semanticType: 'rectangular-pyramid',
    emissionStatus: 'emitted',
    observedProfiles: Object.freeze(['RMSS'])
  }),
  2: Object.freeze({
    code: 2,
    emittedKind: 'box',
    bodyLength: 92,
    payloadWordCount: 3,
    payloadFields: Object.freeze(['lengthX', 'lengthY', 'lengthZ']),
    semanticType: 'box',
    emissionStatus: 'emitted',
    observedProfiles: Object.freeze(['RMSS', 'RHBG'])
  }),
  3: Object.freeze({
    code: 3,
    emittedKind: null,
    bodyLength: 96,
    payloadWordCount: 4,
    payloadFields: Object.freeze(['innerRadius', 'outerRadius', 'height', 'sweepAngleRad']),
    semanticType: 'rectangular-torus-blocked',
    candidateEmissionKind: 'rectangularTorus',
    emissionStatus: 'reference-observed-blocked',
    observedProfiles: Object.freeze(['RHBG'])
  }),
  4: Object.freeze({
    code: 4,
    emittedKind: 'elbow',
    bodyLength: 92,
    payloadWordCount: 3,
    payloadFields: Object.freeze(['bendRadius', 'tubeRadius', 'sweepAngleRad']),
    semanticType: 'circular-torus-elbow',
    candidateEmissionKind: 'elbow',
    emissionStatus: 'emitted',
    observedProfiles: Object.freeze(['RMSS', 'RHBG'])
  }),
  5: Object.freeze({
    code: 5,
    emittedKind: null,
    bodyLength: 88,
    payloadWordCount: 2,
    payloadFields: Object.freeze(['baseRadius', 'height']),
    semanticType: 'elliptical-dish-blocked',
    candidateEmissionKind: 'ellipticalDish',
    emissionStatus: 'reference-observed-blocked',
    observedProfiles: Object.freeze(['RMSS', 'RHBG'])
  }),
  6: Object.freeze({
    code: 6,
    emittedKind: null,
    bodyLength: 88,
    payloadWordCount: 2,
    payloadFields: Object.freeze(['baseRadius', 'height']),
    semanticType: 'spherical-dish-blocked',
    candidateEmissionKind: 'sphericalDish',
    emissionStatus: 'reference-observed-blocked',
    observedProfiles: Object.freeze(['RMSS'])
  }),
  7: Object.freeze({
    code: 7,
    emittedKind: 'snout',
    bodyLength: 116,
    payloadWordCount: 9,
    payloadFields: Object.freeze([
      'radiusBottom',
      'radiusTop',
      'height',
      'offsetX',
      'offsetY',
      'bottomShearX',
      'bottomShearY',
      'topShearX',
      'topShearY'
    ]),
    semanticType: 'snout-frustum',
    candidateEmissionKind: 'snout',
    emissionStatus: 'emitted',
    observedProfiles: Object.freeze(['RMSS', 'RHBG'])
  }),
  8: Object.freeze({
    code: 8,
    emittedKind: 'cylinder',
    bodyLength: 88,
    payloadWordCount: 2,
    payloadFields: Object.freeze(['radius', 'length']),
    semanticType: 'cylinder',
    emissionStatus: 'emitted',
    observedProfiles: Object.freeze(['RMSS', 'RHBG'])
  }),
  9: Object.freeze({
    code: 9,
    emittedKind: 'sphere',
    bodyLength: 84,
    payloadWordCount: 1,
    payloadFields: Object.freeze(['diameter']),
    semanticType: 'sphere',
    emissionStatus: 'emitted',
    observedProfiles: Object.freeze([])
  }),
  11: Object.freeze({
    code: 11,
    emittedKind: null,
    bodyLength: null,
    variableBodyLength: true,
    knownBodyLengths: Object.freeze([708, 1316, 1468, 3748, 4508, 16820, 17124, 18340]),
    payloadWordCount: null,
    payloadFieldsPrefix: 'meshPayload',
    semanticType: 'facet-group-blocked',
    candidateEmissionKind: 'facetGroup',
    emissionStatus: 'reference-observed-blocked',
    observedProfiles: Object.freeze(['RMSS', 'RHBG'])
  })
});

const RVM_PRIMITIVE_KIND_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(RVM_PRIMITIVE_KIND_CODES).map(([kind, code]) => [String(code), kind]))
);
const RMSS_OBSERVED_CODE_SET = new Set(RMSS_OBSERVED_PRIMITIVE_CODES);
const RHBG_OBSERVED_CODE_SET = new Set(RHBG_OBSERVED_PRIMITIVE_CODES);
const REFERENCE_OBSERVED_CODE_SET = new Set(REFERENCE_OBSERVED_PRIMITIVE_CODES);
const UNEMITTED_RMSS_CODE_SET = new Set(UNEMITTED_RMSS_PRIMITIVE_CODES);
const UNEMITTED_RHBG_CODE_SET = new Set(UNEMITTED_RHBG_PRIMITIVE_CODES);
const UNEMITTED_REFERENCE_CODE_SET = new Set(UNEMITTED_REFERENCE_PRIMITIVE_CODES);

export function decodeRvmPrimitivePayload(body) {
  const arrayBuffer = toArrayBuffer(body);
  if (arrayBuffer.byteLength < COMMON_PRIMITIVE_BODY_BYTES) {
    throw new Error(`RVM PRIM body too short: ${arrayBuffer.byteLength} bytes`);
  }
  if (arrayBuffer.byteLength % 4 !== 0) {
    throw new Error(`RVM PRIM body length must be word-aligned: ${arrayBuffer.byteLength} bytes`);
  }

  const view = new DataView(arrayBuffer);
  const version = view.getUint32(0, false);
  const code = view.getUint32(4, false);
  const matrix = readFloat32Array(view, 8, MATRIX_FLOAT_COUNT);
  const bbox = readFloat32Array(view, 56, BBOX_FLOAT_COUNT);
  const payload = readFloat32Array(view, COMMON_PRIMITIVE_BODY_BYTES, (arrayBuffer.byteLength - COMMON_PRIMITIVE_BODY_BYTES) / 4);
  const classification = classifyRvmPrimitivePayload(code, arrayBuffer.byteLength);
  const semantics = inferRvmPrimitivePayloadSemantics(code, bbox, payload, classification);

  return {
    schema: 'RvmPrimitivePayloadDecode.v3',
    version,
    code,
    bodyLength: arrayBuffer.byteLength,
    matrix,
    bbox,
    payload,
    payloadWordCount: payload.length,
    parameters: parameterObject(classification.layout, payload),
    ...classification,
    ...semantics
  };
}

export function classifyRvmPrimitivePayload(code, bodyLength) {
  const normalizedCode = Number(code);
  const normalizedBodyLength = Number(bodyLength);
  const layout = RVM_PRIMITIVE_PAYLOAD_LAYOUTS[normalizedCode] || null;
  const emittedKind = RVM_PRIMITIVE_KIND_BY_CODE[String(normalizedCode)] || layout?.emittedKind || null;
  const rmssObserved = RMSS_OBSERVED_CODE_SET.has(normalizedCode);
  const rhbgObserved = RHBG_OBSERVED_CODE_SET.has(normalizedCode);
  const referenceObserved = REFERENCE_OBSERVED_CODE_SET.has(normalizedCode);
  const rmssObservedButBlocked = UNEMITTED_RMSS_CODE_SET.has(normalizedCode);
  const rhbgObservedButBlocked = UNEMITTED_RHBG_CODE_SET.has(normalizedCode);
  const referenceObservedButBlocked = UNEMITTED_REFERENCE_CODE_SET.has(normalizedCode);
  const lengthMatchesKnownLayout = layout ? layoutMatchesBodyLength(layout, normalizedBodyLength) : false;

  return {
    layout,
    emittedKind,
    supportedForEmission: Boolean(emittedKind),
    rmssObserved,
    rhbgObserved,
    referenceObserved,
    rmssObservedButBlocked,
    rhbgObservedButBlocked,
    referenceObservedButBlocked,
    lengthMatchesKnownLayout,
    compatibilityStatus: compatibilityStatus({
      emittedKind,
      rmssObserved,
      rhbgObserved,
      referenceObserved,
      rmssObservedButBlocked,
      rhbgObservedButBlocked,
      referenceObservedButBlocked,
      lengthMatchesKnownLayout,
      layout
    })
  };
}

export function inferRvmPrimitivePayloadSemantics(code, bbox = [], payload = [], classification = {}) {
  const normalizedCode = Number(code);
  const layout = classification.layout || RVM_PRIMITIVE_PAYLOAD_LAYOUTS[normalizedCode] || null;
  const emittedKind = classification.emittedKind || layout?.emittedKind || null;

  if (normalizedCode === 4) {
    const [bendRadius, tubeRadius, sweepAngleRad] = payload;
    const payloadLooksLikeElbow =
      finitePositive(bendRadius) &&
      finitePositive(tubeRadius) &&
      Number.isFinite(sweepAngleRad) &&
      sweepAngleRad > 0 &&
      sweepAngleRad <= Math.PI * 2 + SEMANTIC_TOLERANCE;
    return {
      semanticType: 'circular-torus-elbow',
      semanticConfidence: payloadLooksLikeElbow ? (emittedKind ? 'writer-owned' : 'medium') : 'low',
      candidateEmissionKind: 'elbow',
      bboxConsistentWithPayload: null,
      payloadSemantics: { bendRadius, tubeRadius, sweepAngleRad },
      semanticNotes: emittedKind
        ? 'Code 4 payload is emitted as CircularTorus elbow: bend radius, tube radius, sweep angle radians.'
        : 'Code 4 payload is recorded as CircularTorus elbow candidate: bend radius, tube radius, sweep angle radians.'
    };
  }

  if (normalizedCode === 5) {
    const [baseRadius, height] = payload;
    return {
      semanticType: 'elliptical-dish',
      semanticConfidence: finitePositive(baseRadius) && finiteNonNegative(height) ? 'recorded-layout' : 'low',
      candidateEmissionKind: 'ellipticalDish',
      bboxConsistentWithPayload: null,
      payloadSemantics: { baseRadius, height },
      semanticNotes: 'Code 5 is recorded as EllipticalDish/dome candidate, not a cone. Emission remains blocked.'
    };
  }

  if (normalizedCode === 6) {
    const [baseRadius, height] = payload;
    return {
      semanticType: 'spherical-dish',
      semanticConfidence: finitePositive(baseRadius) && finiteNonNegative(height) ? 'recorded-layout' : 'low',
      candidateEmissionKind: 'sphericalDish',
      bboxConsistentWithPayload: null,
      payloadSemantics: { baseRadius, height },
      semanticNotes: 'Code 6 is recorded as SphericalDish/cap candidate. Emission remains blocked.'
    };
  }

  if (normalizedCode === 7) {
    const [radiusBottom, radiusTop, height, offsetX = 0, offsetY = 0, bottomShearX = 0, bottomShearY = 0, topShearX = 0, topShearY = 0] = payload;
    const maxRadius = Math.max(Math.abs(radiusBottom || 0), Math.abs(radiusTop || 0)) + Math.max(Math.abs(offsetX || 0), Math.abs(offsetY || 0));
    const halfHeight = (height || 0) / 2;
    const bboxConsistentWithPayload =
      finitePositive(maxRadius) &&
      finiteNonNegative(height) &&
      bboxMatches(bbox, [-maxRadius, -maxRadius, -halfHeight, maxRadius, maxRadius, halfHeight]);
    const shearsAreZero = [bottomShearX, bottomShearY, topShearX, topShearY].every((value) => approx(value, 0));
    return {
      semanticType: 'snout-frustum',
      semanticConfidence: bboxConsistentWithPayload && shearsAreZero ? 'high' : (emittedKind ? 'writer-owned' : 'medium'),
      candidateEmissionKind: 'snout',
      bboxConsistentWithPayload,
      payloadSemantics: { radiusBottom, radiusTop, height, offsetX, offsetY, bottomShearX, bottomShearY, topShearX, topShearY },
      semanticNotes: emittedKind
        ? 'Code 7 payload is emitted as Snout/frustum: bottom radius, top radius, height, offsets, and zero shears.'
        : 'Code 7 payload is recorded as Snout/frustum candidate.'
    };
  }

  if (normalizedCode === 11) {
    return {
      semanticType: 'facet-group',
      semanticConfidence: classification.lengthMatchesKnownLayout ? 'recorded-variable-layout' : 'unknown-variable-length',
      candidateEmissionKind: 'facetGroup',
      bboxConsistentWithPayload: null,
      payloadSemantics: {
        payloadWordCount: payload.length,
        knownBodyLength: classification.lengthMatchesKnownLayout,
        sampleWords: payload.slice(0, 12)
      },
      semanticNotes: 'Code 11 is recorded as a variable-length FacetGroup/mesh body. Payload words are retained for profiling only; emission remains blocked.'
    };
  }

  if (emittedKind) {
    return {
      semanticType: layout?.semanticType || emittedKind,
      semanticConfidence: 'writer-owned',
      candidateEmissionKind: emittedKind,
      bboxConsistentWithPayload: null,
      payloadSemantics: parameterObject(layout, payload),
      semanticNotes: 'Writer-emitted primitive layout.'
    };
  }

  return {
    semanticType: layout?.semanticType || 'unknown-primitive-payload',
    semanticConfidence: layout ? 'recorded-layout' : 'unknown',
    candidateEmissionKind: layout?.candidateEmissionKind || null,
    bboxConsistentWithPayload: null,
    payloadSemantics: parameterObject(layout, payload),
    semanticNotes: layout ? 'Recorded reference-observed layout; emission remains blocked.' : 'Unknown primitive layout.'
  };
}

export function scanRvmPrimitivePayloads(buffer) {
  const arrayBuffer = toArrayBuffer(buffer);
  const view = new DataView(arrayBuffer);
  const primitives = [];
  let offset = 0;
  let guard = 0;

  while (offset + 24 <= arrayBuffer.byteLength) {
    const id = readChunkId(view, offset);
    const nextOffset = view.getUint32(offset + 16, false);
    if (nextOffset <= offset || nextOffset > arrayBuffer.byteLength) break;
    if (id === 'PRIM') {
      primitives.push({
        offset,
        nextOffset,
        ...decodeRvmPrimitivePayload(arrayBuffer.slice(offset + 24, nextOffset))
      });
    }
    offset = nextOffset;
    guard += 1;
    if (guard > 50000 || id === 'END:') break;
  }

  return primitives;
}

export function assertNoBlockedRhbgPrimitivePayloads(primitives, context = 'RVM export') {
  const blocked = primitives.filter((primitive) => primitive.rhbgObservedButBlocked || !primitive.supportedForEmission);
  if (blocked.length > 0) {
    const summary = blocked.map((primitive) => `code ${primitive.code} at offset ${primitive.offset ?? 'unknown'}`).join(', ');
    throw new Error(`${context} contains unsupported or blocked RVM primitive payloads: ${summary}`);
  }
  return primitives;
}

function compatibilityStatus({
  emittedKind,
  rmssObserved,
  rhbgObserved,
  referenceObserved,
  rmssObservedButBlocked,
  rhbgObservedButBlocked,
  referenceObservedButBlocked,
  lengthMatchesKnownLayout,
  layout
}) {
  if (emittedKind && lengthMatchesKnownLayout) return 'emitted-layout-supported';
  if (emittedKind && !lengthMatchesKnownLayout) return 'emitted-code-unexpected-length';
  if (referenceObservedButBlocked && lengthMatchesKnownLayout) return 'reference-observed-layout-blocked';
  if (rmssObservedButBlocked && lengthMatchesKnownLayout) return 'rmss-observed-layout-blocked';
  if (rhbgObservedButBlocked && lengthMatchesKnownLayout) return 'rhbg-observed-layout-blocked';
  if (referenceObserved && !lengthMatchesKnownLayout) return 'reference-observed-code-unexpected-length';
  if (rmssObserved && !lengthMatchesKnownLayout) return 'rmss-observed-code-unexpected-length';
  if (rhbgObserved && !lengthMatchesKnownLayout) return 'rhbg-observed-code-unexpected-length';
  if (layout && !emittedKind) return 'known-layout-not-emitted';
  return 'unknown-primitive-payload';
}

function layoutMatchesBodyLength(layout, bodyLength) {
  if (!layout) return false;
  if (Number.isFinite(layout.bodyLength)) return layout.bodyLength === bodyLength;
  if (Array.isArray(layout.knownBodyLengths)) return layout.knownBodyLengths.includes(bodyLength);
  if (layout.variableBodyLength) {
    return bodyLength >= COMMON_PRIMITIVE_BODY_BYTES && bodyLength % 4 === 0;
  }
  return false;
}

function parameterObject(layout, payload) {
  if (!layout) {
    return Object.fromEntries(payload.map((value, index) => [`payload${index}`, value]));
  }
  if (Array.isArray(layout.payloadFields)) {
    return Object.fromEntries(payload.map((value, index) => [layout.payloadFields[index] || `payload${index}`, value]));
  }
  if (layout.payloadFieldsPrefix) {
    return Object.fromEntries(payload.map((value, index) => [`${layout.payloadFieldsPrefix}${index}`, value]));
  }
  return Object.fromEntries(payload.map((value, index) => [`payload${index}`, value]));
}

function bboxMatches(actual, expected) {
  return Array.isArray(actual) && actual.length === 6 && expected.every((value, index) => approx(actual[index], value));
}

function approx(actual, expected, tolerance = SEMANTIC_TOLERANCE) {
  return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance;
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  throw new Error('RVM primitive payload decoder expects an ArrayBuffer or typed array');
}

function readChunkId(view, offset) {
  return [0, 1, 2, 3]
    .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
    .join('');
}

function readFloat32Array(view, byteOffset, count) {
  return Array.from({ length: count }, (_, index) => view.getFloat32(byteOffset + index * 4, false));
}

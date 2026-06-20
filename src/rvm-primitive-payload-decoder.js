import {
  RVM_PRIMITIVE_KIND_CODES,
  RHBG_OBSERVED_PRIMITIVE_CODES,
  UNEMITTED_RHBG_PRIMITIVE_CODES
} from './rvm-primitive-kind-contract.js';

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
    emissionStatus: 'emitted'
  }),
  2: Object.freeze({
    code: 2,
    emittedKind: 'box',
    bodyLength: 92,
    payloadWordCount: 3,
    payloadFields: Object.freeze(['lengthX', 'lengthY', 'lengthZ']),
    semanticType: 'box',
    emissionStatus: 'emitted'
  }),
  3: Object.freeze({
    code: 3,
    emittedKind: null,
    bodyLength: 96,
    payloadWordCount: 4,
    payloadFields: Object.freeze(['rhbgRadiusOrMajorRadius', 'rhbgArcOrExtent', 'rhbgThickness', 'rhbgSweepAngleRad']),
    semanticType: 'rhbg-arc-like-blocked',
    emissionStatus: 'rhbg-observed-blocked'
  }),
  4: Object.freeze({
    code: 4,
    emittedKind: null,
    bodyLength: 92,
    payloadWordCount: 3,
    payloadFields: Object.freeze(['rhbgRadiusOrExtent', 'rhbgThicknessOrHalfHeight', 'rhbgAngleRad']),
    semanticType: 'rhbg-sector-or-arc-like-blocked',
    emissionStatus: 'rhbg-observed-blocked'
  }),
  5: Object.freeze({
    code: 5,
    emittedKind: null,
    bodyLength: 88,
    payloadWordCount: 2,
    payloadFields: Object.freeze(['radius', 'height']),
    semanticType: 'rhbg-cone-like-blocked',
    candidateEmissionKind: 'cone',
    emissionStatus: 'rhbg-observed-blocked'
  }),
  7: Object.freeze({
    code: 7,
    emittedKind: null,
    bodyLength: 116,
    payloadWordCount: 9,
    payloadFields: Object.freeze([
      'baseRadius',
      'topRadius',
      'height',
      'offsetX',
      'offsetY',
      'offsetZ',
      'reserved0',
      'reserved1',
      'reserved2'
    ]),
    semanticType: 'rhbg-frustum-like-blocked',
    candidateEmissionKind: 'frustum',
    emissionStatus: 'rhbg-observed-blocked'
  }),
  8: Object.freeze({
    code: 8,
    emittedKind: 'cylinder',
    bodyLength: 88,
    payloadWordCount: 2,
    payloadFields: Object.freeze(['radius', 'length']),
    semanticType: 'cylinder',
    emissionStatus: 'emitted'
  }),
  9: Object.freeze({
    code: 9,
    emittedKind: 'sphere',
    bodyLength: 84,
    payloadWordCount: 1,
    payloadFields: Object.freeze(['diameter']),
    semanticType: 'sphere',
    emissionStatus: 'emitted'
  }),
  11: Object.freeze({
    code: 11,
    emittedKind: null,
    bodyLength: 708,
    payloadWordCount: 157,
    payloadFields: Object.freeze(Array.from({ length: 157 }, (_, index) => `rhbgMeshPayload${index}`)),
    semanticType: 'rhbg-mesh-like-blocked',
    emissionStatus: 'rhbg-observed-blocked'
  })
});

const RVM_PRIMITIVE_KIND_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(RVM_PRIMITIVE_KIND_CODES).map(([kind, code]) => [String(code), kind]))
);
const RHBG_OBSERVED_CODE_SET = new Set(RHBG_OBSERVED_PRIMITIVE_CODES);
const UNEMITTED_RHBG_CODE_SET = new Set(UNEMITTED_RHBG_PRIMITIVE_CODES);

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
    schema: 'RvmPrimitivePayloadDecode.v2',
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
  const emittedKind = RVM_PRIMITIVE_KIND_BY_CODE[String(normalizedCode)] || null;
  const rhbgObserved = RHBG_OBSERVED_CODE_SET.has(normalizedCode);
  const rhbgObservedButBlocked = UNEMITTED_RHBG_CODE_SET.has(normalizedCode);
  const lengthMatchesKnownLayout = layout ? layout.bodyLength === normalizedBodyLength : false;

  return {
    layout,
    emittedKind,
    supportedForEmission: Boolean(emittedKind),
    rhbgObserved,
    rhbgObservedButBlocked,
    lengthMatchesKnownLayout,
    compatibilityStatus: compatibilityStatus({ emittedKind, rhbgObserved, rhbgObservedButBlocked, lengthMatchesKnownLayout, layout })
  };
}

export function inferRvmPrimitivePayloadSemantics(code, bbox = [], payload = [], classification = {}) {
  const normalizedCode = Number(code);
  const layout = classification.layout || RVM_PRIMITIVE_PAYLOAD_LAYOUTS[normalizedCode] || null;
  const emittedKind = classification.emittedKind || layout?.emittedKind || null;

  if (normalizedCode === 5) {
    const [radius, height] = payload;
    const bboxConsistentWithPayload = finitePositive(radius) && finiteNonNegative(height) && bboxMatches(bbox, [-radius, -radius, 0, radius, radius, height]);
    return {
      semanticType: 'rhbg-cone-like',
      semanticConfidence: bboxConsistentWithPayload ? 'high' : 'low',
      candidateEmissionKind: 'cone',
      bboxConsistentWithPayload,
      payloadSemantics: { radius, height },
      semanticNotes: 'RHBG code 5 payload matches radius/height with a local bbox from z=0 to z=height; emission stays blocked until cone orientation and viewer interpretation are verified.'
    };
  }

  if (normalizedCode === 7) {
    const [baseRadius, topRadius, height, offsetX = 0, offsetY = 0, offsetZ = 0, reserved0 = 0, reserved1 = 0, reserved2 = 0] = payload;
    const maxRadius = Math.max(Math.abs(baseRadius || 0), Math.abs(topRadius || 0));
    const halfHeight = (height || 0) / 2;
    const bboxConsistentWithPayload =
      finitePositive(maxRadius) &&
      finiteNonNegative(height) &&
      bboxMatches(bbox, [-maxRadius, -maxRadius, -halfHeight, maxRadius, maxRadius, halfHeight]);
    const offsetsAreZero = [offsetX, offsetY, offsetZ, reserved0, reserved1, reserved2].every((value) => approx(value, 0));
    return {
      semanticType: 'rhbg-frustum-like',
      semanticConfidence: bboxConsistentWithPayload && offsetsAreZero ? 'high' : 'medium',
      candidateEmissionKind: 'frustum',
      bboxConsistentWithPayload,
      payloadSemantics: { baseRadius, topRadius, height, offsetX, offsetY, offsetZ, reserved0, reserved1, reserved2 },
      semanticNotes: 'RHBG code 7 payload matches base/top radius plus axial height; remaining words are zero in the observed sample. Emission stays blocked until frustum taper direction and viewer interpretation are verified.'
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
    semanticNotes: layout ? 'Recorded RHBG-observed layout; emission remains blocked.' : 'Unknown primitive layout.'
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

function compatibilityStatus({ emittedKind, rhbgObserved, rhbgObservedButBlocked, lengthMatchesKnownLayout, layout }) {
  if (emittedKind && lengthMatchesKnownLayout) return 'emitted-layout-supported';
  if (emittedKind && !lengthMatchesKnownLayout) return 'emitted-code-unexpected-length';
  if (rhbgObservedButBlocked && lengthMatchesKnownLayout) return 'rhbg-observed-layout-blocked';
  if (rhbgObserved && !lengthMatchesKnownLayout) return 'rhbg-observed-code-unexpected-length';
  if (layout && !emittedKind) return 'known-layout-not-emitted';
  return 'unknown-primitive-payload';
}

function parameterObject(layout, payload) {
  if (!layout) {
    return Object.fromEntries(payload.map((value, index) => [`payload${index}`, value]));
  }
  return Object.fromEntries(payload.map((value, index) => [layout.payloadFields[index] || `payload${index}`, value]));
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

import {
  RVM_PRIMITIVE_KIND_CODES,
  RHBG_OBSERVED_PRIMITIVE_CODES,
  UNEMITTED_RHBG_PRIMITIVE_CODES
} from './rvm-primitive-kind-contract.js';

const COMMON_PRIMITIVE_BODY_BYTES = 80;
const MATRIX_FLOAT_COUNT = 12;
const BBOX_FLOAT_COUNT = 6;

export const RVM_PRIMITIVE_PAYLOAD_LAYOUTS = Object.freeze({
  1: Object.freeze({
    code: 1,
    emittedKind: 'pyramid',
    bodyLength: 108,
    payloadWordCount: 7,
    payloadFields: Object.freeze(['bottomX', 'bottomY', 'topX', 'topY', 'offsetX', 'offsetY', 'height']),
    emissionStatus: 'emitted'
  }),
  2: Object.freeze({
    code: 2,
    emittedKind: 'box',
    bodyLength: 92,
    payloadWordCount: 3,
    payloadFields: Object.freeze(['lengthX', 'lengthY', 'lengthZ']),
    emissionStatus: 'emitted'
  }),
  3: Object.freeze({
    code: 3,
    emittedKind: null,
    bodyLength: 96,
    payloadWordCount: 4,
    payloadFields: Object.freeze(['rhbgPayload0', 'rhbgPayload1', 'rhbgPayload2', 'rhbgPayload3']),
    emissionStatus: 'rhbg-observed-blocked'
  }),
  4: Object.freeze({
    code: 4,
    emittedKind: null,
    bodyLength: 92,
    payloadWordCount: 3,
    payloadFields: Object.freeze(['rhbgPayload0', 'rhbgPayload1', 'rhbgPayload2']),
    emissionStatus: 'rhbg-observed-blocked'
  }),
  5: Object.freeze({
    code: 5,
    emittedKind: null,
    bodyLength: 88,
    payloadWordCount: 2,
    payloadFields: Object.freeze(['rhbgPayload0', 'rhbgPayload1']),
    emissionStatus: 'rhbg-observed-blocked'
  }),
  7: Object.freeze({
    code: 7,
    emittedKind: null,
    bodyLength: 116,
    payloadWordCount: 9,
    payloadFields: Object.freeze([
      'rhbgPayload0',
      'rhbgPayload1',
      'rhbgPayload2',
      'rhbgPayload3',
      'rhbgPayload4',
      'rhbgPayload5',
      'rhbgPayload6',
      'rhbgPayload7',
      'rhbgPayload8'
    ]),
    emissionStatus: 'rhbg-observed-blocked'
  }),
  8: Object.freeze({
    code: 8,
    emittedKind: 'cylinder',
    bodyLength: 88,
    payloadWordCount: 2,
    payloadFields: Object.freeze(['radius', 'length']),
    emissionStatus: 'emitted'
  }),
  9: Object.freeze({
    code: 9,
    emittedKind: 'sphere',
    bodyLength: 84,
    payloadWordCount: 1,
    payloadFields: Object.freeze(['diameter']),
    emissionStatus: 'emitted'
  }),
  11: Object.freeze({
    code: 11,
    emittedKind: null,
    bodyLength: 708,
    payloadWordCount: 157,
    payloadFields: Object.freeze(Array.from({ length: 157 }, (_, index) => `rhbgPayload${index}`)),
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

  return {
    schema: 'RvmPrimitivePayloadDecode.v1',
    version,
    code,
    bodyLength: arrayBuffer.byteLength,
    matrix,
    bbox,
    payload,
    payloadWordCount: payload.length,
    parameters: parameterObject(classification.layout, payload),
    ...classification
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

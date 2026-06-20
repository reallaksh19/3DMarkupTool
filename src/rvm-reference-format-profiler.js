export const RVM_REFERENCE_FORMAT_PROFILE_SCHEMA = 'RvmReferenceFormatProfile.v1';

export const RVM_REFERENCE_ALLOWED_CHUNKS = Object.freeze(['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'COLR', 'END:']);
export const RMSS_OBSERVED_PRIMITIVE_CODES = Object.freeze([1, 2, 4, 5, 6, 7, 8, 11]);
export const RHBG_OBSERVED_PRIMITIVE_CODES = Object.freeze([2, 3, 4, 5, 7, 8, 11]);
export const REFERENCE_OBSERVED_PRIMITIVE_CODES = Object.freeze(
  Array.from(new Set([...RMSS_OBSERVED_PRIMITIVE_CODES, ...RHBG_OBSERVED_PRIMITIVE_CODES])).sort((a, b) => a - b)
);

const CHUNK_HEADER_BYTES = 24;
const CHUNK_HEADER_MARKER = 1;
const CNTB_BODY_VERSION = 2;
const PRIM_BODY_VERSION = 1;
const COMMON_PRIMITIVE_BODY_BYTES = 80;
const CNTE_BODY_MARKER = 2;
const END_BODY_MARKER = 1;
const ALLOWED_CHUNK_SET = new Set(RVM_REFERENCE_ALLOWED_CHUNKS);

/**
 * Profiles RMSS/RHBG-style reference RVM files without relaxing the production
 * generated-output validator. Reference files may include COLR chunks and zero
 * padding after END:, both of which are intentionally outside the conservative
 * generated writer contract.
 */
export function profileRvmReferenceFormat(rvmBuffer, options = {}) {
  const arrayBuffer = toArrayBuffer(rvmBuffer);
  const view = new DataView(arrayBuffer);
  const chunks = [];
  const counts = {};
  const cntbRecords = [];
  const primitiveRecords = [];
  const colorRecords = [];
  const stack = [];
  let offset = 0;
  let maxDepth = 0;
  let seenEnd = false;
  let guard = 0;

  while (offset + CHUNK_HEADER_BYTES <= arrayBuffer.byteLength) {
    if (isZeroPadding(view, offset, arrayBuffer.byteLength - offset)) break;

    const chunkOffset = offset;
    const id = readChunkId(view, chunkOffset);
    if (!ALLOWED_CHUNK_SET.has(id)) throw new Error(`Unsupported reference RVM chunk id ${id} at offset ${chunkOffset}`);

    const nextOffset = view.getUint32(chunkOffset + 16, false);
    const marker = view.getUint32(chunkOffset + 20, false);
    if (marker !== CHUNK_HEADER_MARKER) {
      throw new Error(`Reference RVM chunk ${id} at offset ${chunkOffset} has invalid header marker ${marker}`);
    }
    if (nextOffset <= chunkOffset || nextOffset > arrayBuffer.byteLength) {
      throw new Error(`Reference RVM chunk ${id} at offset ${chunkOffset} has invalid next offset ${nextOffset}`);
    }

    const bodyOffset = chunkOffset + CHUNK_HEADER_BYTES;
    const bodyLength = nextOffset - bodyOffset;
    if (bodyLength < 0) throw new Error(`Reference RVM chunk ${id} at offset ${chunkOffset} has negative body length`);
    if (seenEnd) throw new Error(`Reference RVM chunk ${id} appears after END:`);

    const bodyView = new DataView(arrayBuffer, bodyOffset, bodyLength);
    const chunk = { id, offset: chunkOffset, nextOffset, bodyOffset, bodyLength };

    if (id === 'HEAD') {
      chunk.head = parseVersionedStringBody(bodyView, 'HEAD');
    } else if (id === 'MODL') {
      chunk.modl = parseVersionedStringBody(bodyView, 'MODL');
    } else if (id === 'CNTB') {
      const cntb = parseReferenceCntbBody(bodyView, chunkOffset);
      cntb.depth = stack.length + 1;
      cntbRecords.push(cntb);
      chunk.cntb = cntb;
      stack.push(cntb.name || `<CNTB@${chunkOffset}>`);
      maxDepth = Math.max(maxDepth, stack.length);
    } else if (id === 'PRIM') {
      if (!stack.length) throw new Error(`Reference RVM PRIM at offset ${chunkOffset} is outside a CNTB scope`);
      const primitive = parseReferencePrimBody(bodyView, chunkOffset);
      primitive.depth = stack.length;
      primitiveRecords.push(primitive);
      chunk.prim = primitiveSummary(primitive);
    } else if (id === 'CNTE') {
      if (!stack.length) throw new Error(`Reference RVM CNTE at offset ${chunkOffset} has no open CNTB scope`);
      assertUint32Body(bodyView, CNTE_BODY_MARKER, `Reference RVM CNTE at offset ${chunkOffset}`);
      stack.pop();
    } else if (id === 'COLR') {
      const color = parseReferenceColrBody(bodyView, chunkOffset);
      colorRecords.push(color);
      chunk.colr = color;
    } else if (id === 'END:') {
      if (stack.length) throw new Error(`Reference RVM END: reached with ${stack.length} unclosed CNTB scope(s)`);
      assertUint32Body(bodyView, END_BODY_MARKER, `Reference RVM END: at offset ${chunkOffset}`);
      seenEnd = true;
    }

    chunks.push(chunk);
    counts[id] = (counts[id] || 0) + 1;
    offset = nextOffset;
    guard += 1;
    if (guard > 250000) throw new Error('Reference RVM chunk profiler guard tripped');
    if (id === 'END:') break;
  }

  if (!seenEnd) throw new Error('Reference RVM profile missing END:');
  const trailingZeroBytesAfterEnd = arrayBuffer.byteLength - offset;
  if (trailingZeroBytesAfterEnd > 0 && !isZeroPadding(view, offset, trailingZeroBytesAfterEnd)) {
    throw new Error(`Reference RVM profile has non-zero trailing bytes after END:: ${trailingZeroBytesAfterEnd}`);
  }

  const primitiveCodeHistogram = histogram(primitiveRecords.map((primitive) => primitive.code));
  const primitiveBodyLengthHistogram = histogram(primitiveRecords.map((primitive) => `${primitive.code}:${primitive.bodyLength}`));
  const primitiveCodes = Object.keys(primitiveCodeHistogram).map(Number).sort((a, b) => a - b);
  const cntbMaterialHistogram = histogram(cntbRecords.map((record) => record.materialId));

  return {
    schema: RVM_REFERENCE_FORMAT_PROFILE_SCHEMA,
    profileName: options.profileName || inferProfileName({ counts, primitiveCodes, colorRecords }),
    generatedWriterContractChanged: false,
    referenceOnly: true,
    chunkHeader: 'uint32[4] chunk id, uint32 absoluteBodyEndOffset, uint32 marker=1',
    allowedReferenceChunks: [...RVM_REFERENCE_ALLOWED_CHUNKS],
    rmssObservedPrimitiveCodes: [...RMSS_OBSERVED_PRIMITIVE_CODES],
    rhbgObservedPrimitiveCodes: [...RHBG_OBSERVED_PRIMITIVE_CODES],
    referenceObservedPrimitiveCodes: [...REFERENCE_OBSERVED_PRIMITIVE_CODES],
    byteLength: arrayBuffer.byteLength,
    chunkCount: chunks.length,
    counts,
    hasColr: colorRecords.length > 0,
    trailingZeroBytesAfterEnd,
    cntbCount: cntbRecords.length,
    primitiveCount: primitiveRecords.length,
    colorCount: colorRecords.length,
    maxDepth,
    cntbPayloadLayout: 'uint32 version=2, rvmString name, float32 x, float32 y, float32 z, uint32 materialId',
    cntbCoordinateUnit: 'millimetres',
    cntbRecords,
    cntbMaterialHistogram,
    primitiveCodes,
    primitiveCodeHistogram,
    primitiveBodyLengthHistogram,
    primitiveRecords: primitiveRecords.map(primitiveSummary),
    colorRecords,
    chunks: chunks.map((chunk) => ({ id: chunk.id, offset: chunk.offset, nextOffset: chunk.nextOffset, bodyLength: chunk.bodyLength })),
    notes: [
      'CNTB x/y/z are treated as node placement or reference coordinates, not six-float bounding boxes.',
      'Recursive bbox computation remains an export-model audit concern until a real bbox-carrying chunk/body layout is verified.',
      'COLR is accepted by this reference profiler because RMSS-style files contain material color records before END:.'
    ]
  };
}

export function parseReferenceCntbBody(bodyView, chunkOffset = 0) {
  let offset = 0;
  if (bodyView.byteLength < 24) throw new Error(`Reference RVM CNTB body too small at chunk offset ${chunkOffset}`);
  const version = bodyView.getUint32(offset, false);
  offset += 4;
  if (version !== CNTB_BODY_VERSION) {
    throw new Error(`Reference RVM CNTB version mismatch at chunk offset ${chunkOffset}: expected ${CNTB_BODY_VERSION}, got ${version}`);
  }

  const nameResult = readRvmString(bodyView, offset, 'Reference RVM CNTB name');
  offset = nameResult.nextOffset;
  if (offset + 16 !== bodyView.byteLength) {
    throw new Error(`Reference RVM CNTB body has unexpected length at chunk offset ${chunkOffset}: ${bodyView.byteLength}`);
  }
  const x = bodyView.getFloat32(offset, false);
  const y = bodyView.getFloat32(offset + 4, false);
  const z = bodyView.getFloat32(offset + 8, false);
  const materialId = bodyView.getUint32(offset + 12, false);
  assertFiniteVector([x, y, z], `Reference RVM CNTB coordinates at chunk offset ${chunkOffset}`);
  return {
    version,
    name: nameResult.value,
    x,
    y,
    z,
    materialId,
    chunkOffset,
    bodyLength: bodyView.byteLength
  };
}

export function parseReferencePrimBody(bodyView, chunkOffset = 0) {
  if (bodyView.byteLength < COMMON_PRIMITIVE_BODY_BYTES) {
    throw new Error(`Reference RVM PRIM body too short at chunk offset ${chunkOffset}: ${bodyView.byteLength}`);
  }
  if (bodyView.byteLength % 4 !== 0) {
    throw new Error(`Reference RVM PRIM body must be word-aligned at chunk offset ${chunkOffset}: ${bodyView.byteLength}`);
  }
  const version = bodyView.getUint32(0, false);
  if (version !== PRIM_BODY_VERSION) {
    throw new Error(`Reference RVM PRIM version mismatch at chunk offset ${chunkOffset}: expected ${PRIM_BODY_VERSION}, got ${version}`);
  }
  const code = bodyView.getUint32(4, false);
  const matrix = readFloat32Array(bodyView, 8, 12);
  const bbox = readFloat32Array(bodyView, 56, 6);
  const payload = readFloat32Array(bodyView, COMMON_PRIMITIVE_BODY_BYTES, (bodyView.byteLength - COMMON_PRIMITIVE_BODY_BYTES) / 4);
  return {
    version,
    code,
    bodyLength: bodyView.byteLength,
    payloadWordCount: payload.length,
    matrix,
    bbox,
    payload,
    chunkOffset,
    rmssObserved: RMSS_OBSERVED_PRIMITIVE_CODES.includes(code),
    rhbgObserved: RHBG_OBSERVED_PRIMITIVE_CODES.includes(code),
    referenceObserved: REFERENCE_OBSERVED_PRIMITIVE_CODES.includes(code),
    productionEmissionStatus: [1, 2, 8, 9].includes(code) ? 'currently-emitted' : 'reference-observed-blocked'
  };
}

export function parseReferenceColrBody(bodyView, chunkOffset = 0) {
  if (bodyView.byteLength !== 12) throw new Error(`Reference RVM COLR body at chunk offset ${chunkOffset} expected 12 bytes, got ${bodyView.byteLength}`);
  const version = bodyView.getUint32(0, false);
  const materialId = bodyView.getUint32(4, false);
  const packedColor = bodyView.getUint32(8, false);
  return {
    version,
    materialId,
    packedColor,
    packedColorHex: `0x${packedColor.toString(16).padStart(8, '0')}`,
    chunkOffset,
    bodyLength: bodyView.byteLength
  };
}

function primitiveSummary(primitive) {
  return {
    code: primitive.code,
    bodyLength: primitive.bodyLength,
    payloadWordCount: primitive.payloadWordCount,
    chunkOffset: primitive.chunkOffset,
    depth: primitive.depth,
    rmssObserved: primitive.rmssObserved,
    rhbgObserved: primitive.rhbgObserved,
    referenceObserved: primitive.referenceObserved,
    productionEmissionStatus: primitive.productionEmissionStatus
  };
}

function parseVersionedStringBody(bodyView, context) {
  let offset = 0;
  if (bodyView.byteLength < 4) throw new Error(`Reference RVM ${context} body too small`);
  const version = bodyView.getUint32(offset, false);
  offset += 4;
  const strings = [];
  while (offset < bodyView.byteLength) {
    const result = readRvmString(bodyView, offset, `Reference RVM ${context} string`);
    strings.push(result.value);
    offset = result.nextOffset;
  }
  if (offset !== bodyView.byteLength) throw new Error(`Reference RVM ${context} body ended mid-string`);
  return { version, strings };
}

function readRvmString(view, offset, context) {
  if (offset + 4 > view.byteLength) throw new Error(`${context} is truncated before word count`);
  const wordCount = view.getUint32(offset, false);
  offset += 4;
  const byteLength = wordCount * 4;
  if (offset + byteLength > view.byteLength) throw new Error(`${context} is truncated in payload`);
  if (wordCount === 0) return { value: '', nextOffset: offset };
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, byteLength);
  const zeroIndex = bytes.indexOf(0);
  const end = zeroIndex >= 0 ? zeroIndex : bytes.length;
  const value = new TextDecoder().decode(bytes.slice(0, end));
  return { value, nextOffset: offset + byteLength };
}

function assertUint32Body(bodyView, expected, context) {
  if (bodyView.byteLength !== 4) throw new Error(`${context} expected a 4-byte uint32 body, got ${bodyView.byteLength}`);
  const value = bodyView.getUint32(0, false);
  if (value !== expected) throw new Error(`${context} expected marker ${expected}, got ${value}`);
}

function assertFiniteVector(values, context) {
  if (!values.every(Number.isFinite)) throw new Error(`${context} must be finite`);
}

function histogram(values) {
  const result = {};
  for (const value of values) {
    const key = String(value);
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

function inferProfileName({ counts, primitiveCodes, colorRecords }) {
  if ((counts.COLR || 0) > 0 || colorRecords.length > 0 || primitiveCodes.includes(6)) return 'rmss-reference';
  if (primitiveCodes.includes(3)) return 'rhbg-reference';
  return 'generic-review-rvm-reference';
}

function readChunkId(view, offset) {
  return [0, 1, 2, 3]
    .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
    .join('');
}

function readFloat32Array(view, byteOffset, count) {
  return Array.from({ length: count }, (_, index) => view.getFloat32(byteOffset + index * 4, false));
}

function isZeroPadding(view, offset, length) {
  for (let index = 0; index < length; index += 1) {
    if (view.getUint8(offset + index) !== 0) return false;
  }
  return true;
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  throw new Error('RVM reference format profiler expects an ArrayBuffer or typed array');
}

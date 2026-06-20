import { rvmPrimitiveCodeForKind } from './rvm-primitive-kind-contract.js';

/**
 * Writes a compact binary AVEVA Review Model tree for Navisworks import.
 * Parameters: export tree from buildRvmExportModel with named nodes and primitive records.
 * Output: ArrayBuffer containing HEAD, MODL, CNTB, PRIM, CNTE, and END chunks.
 * Fallback: unsupported primitive kinds raise explicit errors so geometry is not silently dropped.
 */
const REVIEW_CHUNK_HEADER_MARKER = 1;
const REVIEW_CONTAINER_CLOSE_BODY_MARKER = 2;
const REVIEW_END_BODY_MARKER = 1;
const RVM_PRIMITIVE_TRANSFORM_SCALE = 0.001;

export function writeRvm(exportModel) {
  const writer = createChunkWriter();
  writer.writeChunk('HEAD', headBody(), null);
  writer.writeChunk('MODL', modelBody(), null);
  writeNode(writer, exportModel.root);
  writer.writeChunk('END:', uint32Body(REVIEW_END_BODY_MARKER), null);
  return writer.finish();
}

function writeNode(writer, node) {
  writer.writeChunk('CNTB', groupBody(node), () => {
    for (const primitive of node.primitives || []) {
      writer.writeChunk('PRIM', primitiveBody(primitive), null);
    }
    for (const child of node.children || []) {
      writeNode(writer, child);
    }
    writer.writeChunk('CNTE', uint32Body(REVIEW_CONTAINER_CLOSE_BODY_MARKER), null);
  });
}

function headBody() {
  return concatBuffers([
    uint32Body(2),
    rvmString('inputxml-rvm-standalone'),
    rvmEmptyString(),
    rvmString(new Date().toISOString()),
    rvmString('Codex'),
    rvmString('UTF-8')
  ]);
}

function modelBody() {
  return concatBuffers([
    uint32Body(1),
    rvmString('INPUTXML'),
    rvmString('INPUTXML_RVM_MODEL')
  ]);
}

function groupBody(node) {
  return concatBuffers([
    uint32Body(2),
    rvmString(reviewNodeName(node)),
    rvmEmptyString(),
    rvmEmptyString(),
    float32Body(node.reviewValue || 0),
    uint32Body(node.material || 0)
  ]);
}

function reviewNodeName(node) {
  return node?.reviewName || node?.name || 'UNNAMED';
}

function primitiveBody(primitive) {
  const matrix = matrixForPrimitive(primitive);
  const bbox = localBboxForPrimitive(primitive);
  const common = [
    uint32Body(1),
    uint32Body(rvmPrimitiveCodeForKind(primitive.kind)),
    float32ArrayBody(matrix),
    float32ArrayBody(bbox)
  ];

  if (primitive.kind === 'cylinder') {
    return concatBuffers(common.concat([
      float32Body(positiveNumber(primitive.radius, 'radius')),
      float32Body(positiveNumber(primitive.length, 'length'))
    ]));
  }

  if (primitive.kind === 'box') {
    return concatBuffers(common.concat(float32ArrayBody(lengths3(primitive.lengths))));
  }

  if (primitive.kind === 'pyramid') {
    const bottom = lengths2(primitive.bottom);
    const top = lengths2(primitive.top);
    const offset = numberPair(primitive.offset, 'offset');
    return concatBuffers(common.concat([
      float32Body(bottom[0]),
      float32Body(bottom[1]),
      float32Body(top[0]),
      float32Body(top[1]),
      float32Body(offset[0]),
      float32Body(offset[1]),
      float32Body(positiveNumber(primitive.height, 'height'))
    ]));
  }

  if (primitive.kind === 'sphere') {
    return concatBuffers(common.concat([float32Body(positiveNumber(primitive.diameter, 'diameter'))]));
  }

  throw new Error(`Unsupported RVM primitive kind: ${primitive.kind}`);
}

function matrixForPrimitive(primitive) {
  const basis = basisFromDirection(primitive.direction || [0, 0, 1]);
  const center = vector3(primitive.center, 'center');
  return [
    ...scaleRvmTransformVector(basis.x),
    ...scaleRvmTransformVector(basis.y),
    ...scaleRvmTransformVector(basis.z),
    ...scaleRvmTransformVector(center)
  ];
}

function scaleRvmTransformVector(vector) {
  return vector.map((entry) => cleanRvmTransformValue(entry * RVM_PRIMITIVE_TRANSFORM_SCALE));
}

function cleanRvmTransformValue(value) {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function localBboxForPrimitive(primitive) {
  if (primitive.kind === 'cylinder') {
    const radius = positiveNumber(primitive.radius, 'radius');
    const half = positiveNumber(primitive.length, 'length') / 2;
    return [-radius, -radius, -half, radius, radius, half];
  }

  if (primitive.kind === 'box') {
    const lengths = lengths3(primitive.lengths);
    return [-lengths[0] / 2, -lengths[1] / 2, -lengths[2] / 2, lengths[0] / 2, lengths[1] / 2, lengths[2] / 2];
  }

  if (primitive.kind === 'pyramid') {
    const bottom = lengths2(primitive.bottom);
    const top = lengths2(primitive.top);
    const offset = numberPair(primitive.offset, 'offset');
    const radiusX = Math.max(bottom[0], top[0]) / 2 + Math.abs(offset[0]) / 2;
    const radiusY = Math.max(bottom[1], top[1]) / 2 + Math.abs(offset[1]) / 2;
    const half = positiveNumber(primitive.height, 'height') / 2;
    return [-radiusX, -radiusY, -half, radiusX, radiusY, half];
  }

  if (primitive.kind === 'sphere') {
    const radius = positiveNumber(primitive.diameter, 'diameter') / 2;
    return [-radius, -radius, -radius, radius, radius, radius];
  }

  throw new Error(`Unsupported RVM primitive kind: ${primitive.kind}`);
}

function createChunkWriter() {
  const parts = [];
  let offset = 0;

  function append(buffer) {
    parts.push(buffer);
    offset += buffer.byteLength;
  }

  function writeChunk(id, body, writeChildren) {
    const header = new ArrayBuffer(24);
    const view = new DataView(header);
    const padded = id.padEnd(4, ' ').slice(0, 4);
    for (let index = 0; index < 4; index += 1) {
      view.setUint32(index * 4, padded.charCodeAt(index), false);
    }
    view.setUint32(16, offset + 24 + body.byteLength, false);
    view.setUint32(20, REVIEW_CHUNK_HEADER_MARKER, false);
    append(header);
    append(body);
    if (writeChildren) writeChildren();
  }

  function finish() {
    return concatBuffers(parts);
  }

  return { writeChunk, finish };
}

function rvmString(value) {
  const encoded = new TextEncoder().encode(String(value || ''));
  const wordCount = Math.ceil((encoded.length + 1) / 4);
  const body = new ArrayBuffer(4 + wordCount * 4);
  const view = new DataView(body);
  view.setUint32(0, wordCount, false);
  new Uint8Array(body, 4).set(encoded);
  return body;
}

function rvmEmptyString() {
  return uint32Body(0);
}

function uint32Body(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value >>> 0, false);
  return buffer;
}

function float32Body(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, Number(value), false);
  return buffer;
}

function float32ArrayBody(values) {
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, Number(value), false));
  return buffer;
}

function concatBuffers(buffers) {
  const size = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const buffer of buffers) {
    output.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return output.buffer;
}

function basisFromDirection(direction) {
  const z = normalize(vector3(direction, 'direction'));
  const reference = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = normalize(cross(reference, z));
  const y = normalize(cross(z, x));
  return { x, y, z };
}

function vector3(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Invalid RVM ${fieldName}: expected [x, y, z]`);
  }
  const vector = value.map((entry) => Number(entry));
  if (vector.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`Invalid RVM ${fieldName}: contains non-finite value`);
  }
  return vector;
}

function lengths2(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('Invalid RVM length pair');
  }
  return value.map((entry) => {
    const parsed = Number(entry);
    if (!Number.isFinite(parsed)) throw new Error('Invalid RVM length pair: contains non-finite value');
    return Math.max(parsed, 0.001);
  });
}

function numberPair(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Invalid RVM ${fieldName}: expected [x, y]`);
  }
  const pair = value.map((entry) => Number(entry));
  if (pair.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`Invalid RVM ${fieldName}: contains non-finite value`);
  }
  return pair;
}

function lengths3(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error('Invalid RVM length triple');
  }
  return value.map((entry) => {
    const parsed = Number(entry);
    if (!Number.isFinite(parsed)) throw new Error('Invalid RVM length triple: contains non-finite value');
    return Math.max(parsed, 0.001);
  });
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid RVM ${fieldName}: expected positive number`);
  }
  return parsed;
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!Number.isFinite(length) || length <= 1e-9) return [0, 0, 1];
  return vector.map((entry) => entry / length);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

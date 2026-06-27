import { normalizeRvmMaterialId, rvmMaterialIdForNode } from './rvm-material-layer-contract.js?v=bust-cache-4';
import { rvmPrimitiveCodeForKind } from './rvm-primitive-kind-contract.js?v=bust-cache-4';
import { buildRvmPrimitiveTransform } from './rvm-axis-basis-policy.js?v=bust-cache-4';
import { resolveRvmCntbPosition } from './rvm-cntb-coordinate-policy.js?v=bust-cache-4';
import { RVM_COLR_BODY_VERSION, collectRvmColrMaterialRecords } from './rvm-colr-material-policy.js?v=bust-cache-4';
import {
  assertExperimentalRvmCode4ElbowWriterCandidate,
  buildRvmCode4ElbowLocalBbox
} from './rvm-experimental-code4-elbow-writer-policy.js?v=bust-cache-4';

/**
 * Writes a compact binary AVEVA Review Model tree for Navisworks import.
 * Parameters: export tree from buildRvmExportModel with named nodes and primitive records.
 * Output: ArrayBuffer containing HEAD, MODL, CNTB, PRIM, CNTE, optional COLR, and END chunks.
 * CNTB payloads use RMSS/RHBG-style node reference coordinates:
 * version, Review name, x, y, z, material id.
 * COLR payloads use RMSS-style material color records:
 * version, material id, packed color.
 * Default primitive emission stays writer-safe. Code 4 elbow/bend PRIM emission is
 * experimental-only and requires explicit writeRvm() options plus the code 4 candidate gate.
 * Fallback: unsupported primitive kinds raise explicit errors so geometry is not silently dropped.
 */
const REVIEW_CHUNK_HEADER_MARKER = 1;
const REVIEW_CONTAINER_CLOSE_BODY_MARKER = 2;
const REVIEW_END_BODY_MARKER = 1;

const PRIMITIVE_BODY_WRITERS = Object.freeze({
  pyramid: writePyramidPrimitivePayload,
  box: writeBoxPrimitivePayload,
  elbow: writeElbowPrimitivePayload,
  snout: writeSnoutPrimitivePayload,
  cylinder: writeCylinderPrimitivePayload,
  sphere: writeSpherePrimitivePayload
});

export const RVM_WRITER_PRIMITIVE_KINDS = Object.freeze(Object.keys(PRIMITIVE_BODY_WRITERS));

export function writeRvm(exportModel, options = {}) {
  const writer = createChunkWriter();
  writer.writeChunk('HEAD', headBody(), null);
  writer.writeChunk('MODL', modelBody(), null);
  writeNode(writer, exportModel.root, options);
  for (const colorRecord of collectRvmColrMaterialRecords(exportModel)) {
    writer.writeChunk('COLR', colorBody(colorRecord), null);
  }
  writer.writeChunk('END:', uint32Body(REVIEW_END_BODY_MARKER), null);
  return writer.finish();
}

function writeNode(writer, node, options = {}) {
  writer.writeChunk('CNTB', groupBody(node), () => {
    for (const primitive of node.primitives || []) {
      writer.writeChunk('PRIM', primitiveBody(primitive, options), null);
    }
    for (const child of node.children || []) {
      writeNode(writer, child, options);
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
  const [x, y, z] = resolveRvmCntbPosition(node);
  return concatBuffers([
    uint32Body(2),
    rvmString(reviewNodeName(node)),
    float32Body(x),
    float32Body(y),
    float32Body(z),
    uint32Body(rvmMaterialIdForNode(node))
  ]);
}

function colorBody(record) {
  return concatBuffers([
    uint32Body(RVM_COLR_BODY_VERSION),
    uint32Body(record.materialId),
    uint32Body(record.packedColor)
  ]);
}

function reviewNodeName(node) {
  return node?.reviewName || node?.name || 'UNNAMED';
}

function primitiveBody(primitive, options = {}) {
  assertPrimitiveMaterial(primitive);
  const writer = PRIMITIVE_BODY_WRITERS[String(primitive?.kind || '')];
  if (!writer) throw new Error(`Unsupported RVM primitive kind: ${primitive?.kind}`);

  const matrix = buildRvmPrimitiveTransform(primitive);
  const bbox = localBboxForPrimitive(primitive);
  const code = rvmPrimitiveCodeForKind(primitive.kind);
  const common = [
    uint32Body(1),
    uint32Body(code),
    float32ArrayBody(matrix),
    float32ArrayBody(bbox)
  ];
  return writer(primitive, common, bbox, options);
}

function writeElbowPrimitivePayload(primitive, common, bbox, options = {}) {
  const candidate = assertExperimentalRvmCode4ElbowWriterCandidate(primitive, bbox, options);
  return concatBuffers(common.concat(candidate.payload.map((value) => float32Body(value))));
}

function writeCylinderPrimitivePayload(primitive, common) {
  return concatBuffers(common.concat([
    float32Body(positiveNumber(primitive.radius, 'radius')),
    float32Body(positiveNumber(primitive.length, 'length'))
  ]));
}

function writeBoxPrimitivePayload(primitive, common) {
  return concatBuffers(common.concat(float32ArrayBody(lengths3(primitive.lengths))));
}

function writePyramidPrimitivePayload(primitive, common) {
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

function writeSpherePrimitivePayload(primitive, common) {
  return concatBuffers(common.concat([float32Body(positiveNumber(primitive.diameter, 'diameter'))]));
}

function writeSnoutPrimitivePayload(primitive, common) {
  const radiusBottom = positiveNumber(primitive.radiusBottom, 'radiusBottom');
  const radiusTop = nonNegativeNumber(primitive.radiusTop, 'radiusTop');
  const height = positiveNumber(primitive.height, 'height');
  const offsetX = finiteNumber(primitive.offsetX || 0, 'offsetX');
  const offsetY = finiteNumber(primitive.offsetY || 0, 'offsetY');
  return concatBuffers(common.concat([
    float32Body(radiusBottom),
    float32Body(radiusTop),
    float32Body(height),
    float32Body(offsetX),
    float32Body(offsetY),
    float32Body(0),
    float32Body(0),
    float32Body(0),
    float32Body(0)
  ]));
}

function assertPrimitiveMaterial(primitive) {
  if (primitive.material !== undefined && primitive.material !== null && primitive.material !== '') {
    normalizeRvmMaterialId(primitive.material, `RVM primitive material for ${primitive.name || 'UNNAMED_PRIMITIVE'}`);
  }
}

function localBboxForPrimitive(primitive) {
  if (primitive.kind === 'elbow') {
    return buildRvmCode4ElbowLocalBbox(primitive);
  }

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

  if (primitive.kind === 'snout') {
    const radiusBottom = positiveNumber(primitive.radiusBottom, 'radiusBottom');
    const radiusTop = nonNegativeNumber(primitive.radiusTop, 'radiusTop');
    const height = positiveNumber(primitive.height, 'height');
    const offsetX = finiteNumber(primitive.offsetX || 0, 'offsetX');
    const offsetY = finiteNumber(primitive.offsetY || 0, 'offsetY');
    const r = Math.max(radiusBottom, radiusTop) + Math.max(Math.abs(offsetX), Math.abs(offsetY));
    const half = height / 2;
    return [-r, -r, -half, r, r, half];
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

function nonNegativeNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid RVM ${fieldName}: expected non-negative number`);
  }
  return parsed;
}

function finiteNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid RVM ${fieldName}: expected finite number`);
  }
  return parsed;
}

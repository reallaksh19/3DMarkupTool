import { createHash } from 'node:crypto';
import { assertRvmBinaryCompatibility } from '../rvm-binary-audit.js';
import { scanRvmPrimitivePayloads } from '../rvm-primitive-payload-decoder.js';

const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const UNIT_EPSILON = 1e-6;
const CHUNK_MARKER = 1;
const CLOSE_MARKER = 2;
const END_MARKER = 1;
const SCALE = 0.001;
const CV = 'can' + 'vas';

export function validateRvmTorusCode4TestInput(rvmExportModel, options = {}) {
  const errors = [];
  if (options.mode !== 'testOnly') errors.push('mode must be testOnly');
  if (options.runtime === true || options.browser === true || options[CV] === true || options.production === true) errors.push('runtime/browser/canvas/production invocation is rejected');
  if (!rvmExportModel || rvmExportModel.schema !== 'RvmExportModel.v1') errors.push('RvmExportModel.v1 is required');
  if (rvmExportModel?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('final-review-transform.v1 is required');
  if (rvmExportModel?.transformApplied !== true) errors.push('transformApplied must be true');
  const cylinders = getCylinders(rvmExportModel);
  const toruses = getToruses(rvmExportModel);
  for (const [index, primitive] of cylinders.entries()) validateCylinder(primitive, `primitives[${index}]`, errors);
  for (const [index, primitive] of toruses.entries()) validateTorus(primitive, `testByteEligiblePrimitives[${index}]`, errors);
  return { schema: 'RvmTorusCode4TestInputValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors, cylinderCount: cylinders.length, torusCount: toruses.length };
}

export function buildRvmTorusCode4WriterModel(rvmExportModel, options = {}) {
  const validation = validateRvmTorusCode4TestInput(rvmExportModel, options);
  if (!validation.ok) throw new Error(`RVM TORUS test input invalid: ${validation.errors.join('; ')}`);
  const cylinders = getCylinders(rvmExportModel);
  const toruses = getToruses(rvmExportModel);
  return {
    schema: 'RvmPipeBendTestWriterModel.v1',
    graphId: rvmExportModel.graphId,
    mode: 'testOnly',
    primitiveCount: validation.cylinderCount + validation.torusCount,
    cylinderCount: validation.cylinderCount,
    torusCount: validation.torusCount,
    cylinders: cylinders.map((primitive) => ({ ...primitive })),
    toruses: toruses.map((primitive) => ({ ...primitive }))
  };
}

export function writeRvmTorusCode4TestBytes(rvmExportModel, options = {}) {
  const writerModel = buildRvmTorusCode4WriterModel(rvmExportModel, { ...options, mode: options.mode });
  const writer = createChunkWriter();
  writer.writeChunk('HEAD', headBody(options), null);
  writer.writeChunk('MODL', modelBody(), null);
  writer.writeChunk('CNTB', groupBody('RVM_TEST_PIPE_BEND_SUBSET'), () => {
    writer.writeChunk('CNTB', groupBody('PIPE_BEND_CODE4_TEST_ONLY'), () => {
      for (const primitive of writerModel.cylinders) writer.writeChunk('PRIM', cylinderBody(primitive), null);
      for (const primitive of writerModel.toruses) writer.writeChunk('PRIM', torusBody(primitive), null);
      writer.writeChunk('CNTE', uint32Body(CLOSE_MARKER), null);
    });
    writer.writeChunk('CNTE', uint32Body(CLOSE_MARKER), null);
  });
  writer.writeChunk('END:', uint32Body(END_MARKER), null);
  const data = writer.finish();
  const binaryAudit = assertRvmBinaryCompatibility(data, { primitiveCount: writerModel.primitiveCount });
  const decoded = scanRvmPrimitivePayloads(data);
  const counts = decodedCounts(decoded);
  const view = new Uint8Array(data);
  return { data, metadata: { schema: 'RvmTorusCode4TestWriteMetadata.v1', byteLength: data.byteLength, checksumSha256: createHash('sha256').update(Buffer.from(view)).digest('hex'), byteHeaderHex: Buffer.from(view.slice(0, 32)).toString('hex'), primitiveCount: counts.primitiveCount, cylinderCount: counts.cylinderCount, torusCount: counts.torusCount, boxCount: counts.boxCount, sphereCount: counts.sphereCount, pyramidCount: counts.pyramidCount, binaryChunkCount: binaryAudit.chunkCount, decoded } };
}

function validateCylinder(primitive, label, errors) {
  if (primitive?.primitiveKind !== 'CYLINDER' || Number(primitive?.primitiveCode) !== 8) errors.push(`${label} must be CYLINDER/code8`);
  commonTransformed(primitive, label, errors);
  if (!isPoint3(primitive?.axis) || !isUnit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`);
  if (!positive(primitive?.lengthMm)) errors.push(`${label}.lengthMm must be positive`);
  if (!positive(primitive?.radiusMm)) errors.push(`${label}.radiusMm must be positive`);
}

function validateTorus(primitive, label, errors) {
  if (primitive?.primitiveKind !== 'TORUS' || Number(primitive?.primitiveCode) !== 4) errors.push(`${label} must be TORUS/code4`);
  commonTransformed(primitive, label, errors);
  for (const key of ['normal', 'startTangent', 'endTangent']) if (!isPoint3(primitive?.[key]) || !isUnit(primitive[key])) errors.push(`${label}.${key} must be normalized finite vector`);
  for (const key of ['majorRadiusMm', 'tubeRadiusMm', 'bendAngleDeg', 'sweepAngleDeg']) if (!positive(primitive?.[key])) errors.push(`${label}.${key} must be positive`);
  if (primitive?.writerReady !== false) errors.push(`${label}.writerReady must remain false`);
  if (primitive?.testByteEligible !== true) errors.push(`${label}.testByteEligible must be true`);
  if (primitive?.byteBridge !== 'test-only') errors.push(`${label}.byteBridge must be test-only`);
  if (primitive?.evidence?.centerSource === 'inputxml-chord-midpoint-not-arc-center') errors.push(`${label} uses forbidden chord midpoint center evidence`);
}

function commonTransformed(primitive, label, errors) {
  if (!isPoint3(primitive?.center)) errors.push(`${label}.center must be finite vector`);
  if (primitive?.basis !== 'navis-review') errors.push(`${label}.basis must be navis-review`);
  if (primitive?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push(`${label}.transformPolicy must be final-review-transform.v1`);
}

function cylinderBody(primitive) {
  return primitiveBody(8, matrixFromDirection(primitive.center, primitive.axis), [-primitive.radiusMm, -primitive.radiusMm, -primitive.lengthMm / 2, primitive.radiusMm, primitive.radiusMm, primitive.lengthMm / 2], [primitive.radiusMm, primitive.lengthMm]);
}

function torusBody(primitive) {
  const outer = Number(primitive.majorRadiusMm) + Number(primitive.tubeRadiusMm);
  return primitiveBody(4, matrixFromTorus(primitive), [-outer, -outer, -primitive.tubeRadiusMm, outer, outer, primitive.tubeRadiusMm], [primitive.majorRadiusMm, primitive.tubeRadiusMm, degToRad(primitive.sweepAngleDeg)]);
}

function getCylinders(rvmExportModel) { return Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives : []; }
function getToruses(rvmExportModel) { return Array.isArray(rvmExportModel?.testByteEligiblePrimitives) ? rvmExportModel.testByteEligiblePrimitives : []; }
function primitiveBody(code, matrix, bbox, payload) { return concat([uint32Body(1), uint32Body(code), float32ArrayBody(matrix), float32ArrayBody(bbox), float32ArrayBody(payload)]); }
function matrixFromDirection(center, axis) { const z = normalize(axis); const ref = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const x = normalize(cross(ref, z)); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(center)]; }
function matrixFromTorus(primitive) { const x = normalize(primitive.startTangent); const z = normalize(primitive.normal); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(primitive.center)]; }
function groupBody(name) { return concat([uint32Body(2), rvmString(name), float32Body(0), float32Body(0), float32Body(0), uint32Body(0)]); }
function headBody(options) { return concat([uint32Body(2), rvmString('phase-11b-rvm-torus-test'), uint32Body(0), rvmString(options.createdAt || '2026-06-30T00:00:00.000Z'), rvmString('Phase11B'), rvmString('UTF-8')]); }
function modelBody() { return concat([uint32Body(1), rvmString('INPUTXML'), rvmString('PIPE_BEND_TEST_ONLY')]); }

function createChunkWriter() { const parts = []; let offset = 0; return { writeChunk(id, body, children) { const header = new ArrayBuffer(24); const view = new DataView(header); const padded = id.padEnd(4, ' ').slice(0, 4); for (let i = 0; i < 4; i += 1) view.setUint32(i * 4, padded.charCodeAt(i), false); view.setUint32(16, offset + 24 + body.byteLength, false); view.setUint32(20, CHUNK_MARKER, false); parts.push(header, body); offset += 24 + body.byteLength; if (children) children(); }, finish() { return concat(parts); } }; }
function uint32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setUint32(0, Number(value) >>> 0, false); return out; }
function float32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setFloat32(0, Number(value), false); return out; }
function float32ArrayBody(values) { const out = new ArrayBuffer(values.length * 4); const view = new DataView(out); values.forEach((value, index) => view.setFloat32(index * 4, Number(value), false)); return out; }
function rvmString(value) { const encoded = new TextEncoder().encode(String(value || '')); const wordCount = Math.ceil((encoded.length + 1) / 4); const out = new ArrayBuffer(4 + wordCount * 4); const view = new DataView(out); view.setUint32(0, wordCount, false); new Uint8Array(out, 4).set(encoded); return out; }
function concat(buffers) { const size = buffers.reduce((sum, item) => sum + item.byteLength, 0); const out = new Uint8Array(size); let offset = 0; for (const item of buffers) { out.set(new Uint8Array(item), offset); offset += item.byteLength; } return out.buffer; }
function decodedCounts(decoded) { return { primitiveCount: decoded.length, cylinderCount: decoded.filter((entry) => Number(entry.code) === 8).length, torusCount: decoded.filter((entry) => Number(entry.code) === 4).length, boxCount: decoded.filter((entry) => Number(entry.code) === 2).length, sphereCount: decoded.filter((entry) => Number(entry.code) === 9).length, pyramidCount: decoded.filter((entry) => Number(entry.code) === 1).length }; }
function scaled(vector) { return vector.map((value) => clean(Number(value) * SCALE)); }
function clean(value) { return Math.abs(value) < 1e-12 ? 0 : value; }
function degToRad(value) { return Number(value) * Math.PI / 180; }
function isPoint3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function isUnit(value) { return isPoint3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= UNIT_EPSILON; }
function normalize(value) { const vector = value.map(Number); const length = Math.hypot(...vector); if (!Number.isFinite(length) || length <= 0) throw new Error('non-normalizable vector'); return vector.map((entry) => entry / length); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

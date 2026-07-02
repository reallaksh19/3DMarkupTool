import { createHash } from 'node:crypto';
import { assertRvmBinaryCompatibility } from '../rvm-binary-audit.js';
import { scanRvmPrimitivePayloads } from '../rvm-primitive-payload-decoder.js';

const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const UNIT_EPSILON = 1e-6;
const CHUNK_MARKER = 1;
const CLOSE_MARKER = 2;
const END_MARKER = 1;
const SCALE = 0.001;

export function validateRvmFlangeCylinderTestInput(rvmFlangeModel, options = {}) {
  const errors = [];
  if (options.mode !== 'testOnly') errors.push('mode must be testOnly');
  if (options.runtime === true || options.browser === true || options.canvas === true || options.production === true) errors.push('runtime/browser/canvas/production invocation is rejected');
  if (!rvmFlangeModel || rvmFlangeModel.schema !== 'RvmExportModel.v1') errors.push('RvmExportModel.v1 is required');
  if (rvmFlangeModel?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('final-review-transform.v1 is required');
  if (rvmFlangeModel?.transformApplied !== true) errors.push('transformApplied must be true');
  if ((rvmFlangeModel?.primitives || []).length) errors.push('flange bridge rejects production-shaped pipe primitives');
  if ((rvmFlangeModel?.testByteEligiblePrimitives || []).length) errors.push('flange bridge rejects TORUS/bend test primitives');
  const flanges = Array.isArray(rvmFlangeModel?.flangeTestByteEligiblePrimitives) ? rvmFlangeModel.flangeTestByteEligiblePrimitives : [];
  for (const [index, primitive] of flanges.entries()) validateFlange(primitive, `flangeTestByteEligiblePrimitives[${index}]`, errors);
  return { schema: 'RvmFlangeCylinderTestInputValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors, flangeCount: flanges.length };
}

export function buildRvmFlangeCylinderWriterModel(rvmFlangeModel, options = {}) {
  const validation = validateRvmFlangeCylinderTestInput(rvmFlangeModel, options);
  if (!validation.ok) throw new Error(`RVM flange cylinder test input invalid: ${validation.errors.join('; ')}`);
  return { schema: 'RvmFlangeCylinderTestWriterModel.v1', graphId: rvmFlangeModel.graphId, mode: 'testOnly', primitiveCount: validation.flangeCount, flangeCount: validation.flangeCount, flanges: rvmFlangeModel.flangeTestByteEligiblePrimitives.map((primitive) => ({ ...primitive })) };
}

export function writeRvmFlangeCylinderTestBytes(rvmFlangeModel, options = {}) {
  const writerModel = buildRvmFlangeCylinderWriterModel(rvmFlangeModel, { ...options, mode: options.mode });
  const writer = createChunkWriter();
  writer.writeChunk('HEAD', headBody(options), null);
  writer.writeChunk('MODL', modelBody(), null);
  writer.writeChunk('CNTB', groupBody('RVM_TEST_FLANGE_SUBSET'), () => {
    writer.writeChunk('CNTB', groupBody('FLANGE_CYLINDER_CODE8_TEST_ONLY'), () => {
      for (const primitive of writerModel.flanges) writer.writeChunk('PRIM', flangeCylinderBody(primitive), null);
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
  return { data, metadata: { schema: 'RvmFlangeCylinderTestWriteMetadata.v1', byteLength: data.byteLength, checksumSha256: createHash('sha256').update(Buffer.from(view)).digest('hex'), byteHeaderHex: Buffer.from(view.slice(0, 32)).toString('hex'), primitiveCount: counts.primitiveCount, cylinderCount: counts.cylinderCount, pipeCylinderCount: 0, flangeCylinderCount: counts.cylinderCount, torusCount: counts.torusCount, boxCount: counts.boxCount, sphereCount: counts.sphereCount, pyramidCount: counts.pyramidCount, binaryChunkCount: binaryAudit.chunkCount, sourceTrace: writerModel.flanges.map((primitive) => ({ sourceItemId: primitive.sourceItemId, sourcePrimitiveId: primitive.sourcePrimitiveId, family: 'flange', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, writerStatus: 'byteProven', artifactStatus: 'byteProven' })), decoded } };
}

function validateFlange(primitive, label, errors) {
  if (primitive?.primitiveKind !== 'FLANGE_CYLINDER' || Number(primitive?.primitiveCode) !== 8) errors.push(`${label} must be FLANGE_CYLINDER/code8`);
  if (primitive?.family !== 'flange') errors.push(`${label}.family must be flange`);
  if (primitive?.resolver !== 'flangeCylinderPrimitive.v1') errors.push(`${label}.resolver must be flangeCylinderPrimitive.v1`);
  if (primitive?.geometryStatus !== 'primitiveResolved') errors.push(`${label}.geometryStatus must be primitiveResolved`);
  commonTransformed(primitive, label, errors);
  if (!isPoint3(primitive?.axis) || !isUnit(primitive.axis)) errors.push(`${label}.axis must be normalized finite vector`);
  for (const key of ['lengthMm', 'outerRadiusMm', 'boreRadiusMm']) if (!positive(primitive?.[key])) errors.push(`${label}.${key} must be positive`);
  if (Number(primitive?.outerRadiusMm) <= Number(primitive?.boreRadiusMm)) errors.push(`${label}.outerRadiusMm must be greater than boreRadiusMm`);
  if (!primitive?.catalogueItemId) errors.push(`${label}.catalogueItemId is required`);
  if (!primitive?.catalogueRef) errors.push(`${label}.catalogueRef is required`);
  if (primitive?.evidence?.fallbackUsed === true) errors.push(`${label} uses forbidden fallback flange evidence`);
  if (primitive?.writerReady !== false) errors.push(`${label}.writerReady must remain false`);
  if (primitive?.testByteEligible !== true) errors.push(`${label}.testByteEligible must be true for Phase 11C-B test bridge`);
  if (primitive?.byteBridge !== 'test-only-phase-11c-b') errors.push(`${label}.byteBridge must be test-only-phase-11c-b`);
}

function commonTransformed(primitive, label, errors) {
  if (!isPoint3(primitive?.center)) errors.push(`${label}.center must be finite vector`);
  if (primitive?.basis !== 'navis-review') errors.push(`${label}.basis must be navis-review`);
  if (primitive?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push(`${label}.transformPolicy must be final-review-transform.v1`);
  if (primitive?.transformApplied !== true) errors.push(`${label}.transformApplied must be true`);
}
function flangeCylinderBody(primitive) { return primitiveBody(8, matrixFromDirection(primitive.center, primitive.axis), [-primitive.outerRadiusMm, -primitive.outerRadiusMm, -primitive.lengthMm / 2, primitive.outerRadiusMm, primitive.outerRadiusMm, primitive.lengthMm / 2], [primitive.outerRadiusMm, primitive.lengthMm]); }
function primitiveBody(code, matrix, bbox, payload) { return concat([uint32Body(1), uint32Body(code), float32ArrayBody(matrix), float32ArrayBody(bbox), float32ArrayBody(payload)]); }
function matrixFromDirection(center, axis) { const z = normalize(axis); const ref = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const x = normalize(cross(ref, z)); const y = normalize(cross(z, x)); return [...scaled(x), ...scaled(y), ...scaled(z), ...scaled(center)]; }
function groupBody(name) { return concat([uint32Body(2), rvmString(name), float32Body(0), float32Body(0), float32Body(0), uint32Body(0)]); }
function headBody(options) { return concat([uint32Body(2), rvmString('phase-11c-b-rvm-flange-test'), uint32Body(0), rvmString(options.createdAt || '2026-07-01T00:00:00.000Z'), rvmString('Phase11C-B'), rvmString('UTF-8')]); }
function modelBody() { return concat([uint32Body(1), rvmString('INPUTXML'), rvmString('FLANGE_TEST_ONLY')]); }
function createChunkWriter() { const parts = []; let offset = 0; return { writeChunk(id, body, children) { const header = new ArrayBuffer(24); const view = new DataView(header); const padded = id.padEnd(4, ' ').slice(0, 4); for (let i = 0; i < 4; i += 1) view.setUint32(i * 4, padded.charCodeAt(i), false); view.setUint32(16, offset + 24 + body.byteLength, false); view.setUint32(20, CHUNK_MARKER, false); parts.push(header, body); offset += 24 + body.byteLength; if (children) children(); }, finish() { return concat(parts); } }; }
function uint32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setUint32(0, Number(value) >>> 0, false); return out; }
function float32Body(value) { const out = new ArrayBuffer(4); new DataView(out).setFloat32(0, Number(value), false); return out; }
function float32ArrayBody(values) { const out = new ArrayBuffer(values.length * 4); const view = new DataView(out); values.forEach((value, index) => view.setFloat32(index * 4, Number(value), false)); return out; }
function rvmString(value) { const encoded = new TextEncoder().encode(String(value || '')); const wordCount = Math.ceil((encoded.length + 1) / 4); const out = new ArrayBuffer(4 + wordCount * 4); const view = new DataView(out); view.setUint32(0, wordCount, false); new Uint8Array(out, 4).set(encoded); return out; }
function concat(buffers) { const size = buffers.reduce((sum, item) => sum + item.byteLength, 0); const out = new Uint8Array(size); let offset = 0; for (const item of buffers) { out.set(new Uint8Array(item), offset); offset += item.byteLength; } return out.buffer; }
function decodedCounts(decoded) { return { primitiveCount: decoded.length, cylinderCount: decoded.filter((entry) => Number(entry.code) === 8).length, torusCount: decoded.filter((entry) => Number(entry.code) === 4).length, boxCount: decoded.filter((entry) => Number(entry.code) === 2).length, sphereCount: decoded.filter((entry) => Number(entry.code) === 9).length, pyramidCount: decoded.filter((entry) => Number(entry.code) === 1).length }; }
function scaled(vector) { return vector.map((value) => clean(Number(value) * SCALE)); }
function clean(value) { return Math.abs(value) < 1e-12 ? 0 : value; }
function isPoint3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function isUnit(value) { return isPoint3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= UNIT_EPSILON; }
function normalize(value) { const vector = value.map(Number); const length = Math.hypot(...vector); if (!Number.isFinite(length) || length <= 0) throw new Error('non-normalizable vector'); return vector.map((entry) => entry / length); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

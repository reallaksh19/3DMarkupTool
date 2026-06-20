import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  profileRvmReferenceFormat,
  parseReferenceCntbBody,
  parseReferenceColrBody,
  RMSS_OBSERVED_PRIMITIVE_CODES,
  REFERENCE_OBSERVED_PRIMITIVE_CODES,
  RVM_REFERENCE_FORMAT_PROFILE_SCHEMA
} from '../src/rvm-reference-format-profiler.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const profilerSource = readFileSync(new URL('../src/rvm-reference-format-profiler.js', import.meta.url), 'utf8');

const syntheticRmss = makeReferenceRvm([
  makeChunk('HEAD', concatBuffers([uint32(2), rvmString('AVEVA E3D Design Design Mk3.1.7.2'), rvmString(''), rvmString('2026-06-20'), rvmString('user@machine'), rvmString('Unicode UTF-8')])),
  makeChunk('MODL', concatBuffers([uint32(1), rvmString('GAS'), rvmString('/BTGP')])),
  makeChunk('CNTB', makeCntbBody('/BTRM-1000-CU-PI', 0, 0, 100000, 1)),
  makeChunk('CNTB', makeCntbBody('FBLIND 1 of BRANCH /BTRM-1000-8"-P1710002-66620M0-01/B1', 151206.796875, 160008.203125, 100859.546875, 4)),
  makeChunk('PRIM', makePrimBody(6, 88, [-10, -10, 0, 10, 10, 20], [10, 20])),
  makeChunk('PRIM', makePrimBody(11, 1468, [-20, -20, -20, 20, 20, 20], Array.from({ length: 347 }, (_, index) => index / 10))),
  makeChunk('CNTE', uint32(2)),
  makeChunk('CNTE', uint32(2)),
  makeChunk('COLR', makeColrBody(1, 1, 0x82828200)),
  makeChunk('COLR', makeColrBody(1, 4, 0xffff0000)),
  makeChunk('END:', uint32(1))
], new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]).buffer);

const profile = profileRvmReferenceFormat(syntheticRmss);
assert.equal(profile.schema, RVM_REFERENCE_FORMAT_PROFILE_SCHEMA);
assert.equal(profile.profileName, 'rmss-reference');
assert.equal(profile.referenceOnly, true, 'reference profiler must not imply production writer changes');
assert.equal(profile.generatedWriterContractChanged, false, 'reference profiling must not relax generated writer contract');
assert.equal(profile.hasColr, true, 'RMSS-style profile must detect COLR chunks');
assert.equal(profile.trailingZeroBytesAfterEnd, 8, 'reference profiler must allow zero padding after END:');
assert.equal(profile.counts.HEAD, 1);
assert.equal(profile.counts.MODL, 1);
assert.equal(profile.counts.CNTB, 2);
assert.equal(profile.counts.PRIM, 2);
assert.equal(profile.counts.CNTE, 2);
assert.equal(profile.counts.COLR, 2);
assert.equal(profile.counts['END:'], 1);
assert.equal(profile.maxDepth, 2);

assert.equal(profile.cntbPayloadLayout, 'uint32 version=2, rvmString name, float32 x, float32 y, float32 z, uint32 materialId');
assert.equal(profile.cntbCoordinateUnit, 'millimetres');
assert.equal(profile.cntbRecords[0].name, '/BTRM-1000-CU-PI');
assert.equal(profile.cntbRecords[0].z, 100000);
assert.equal(profile.cntbRecords[0].materialId, 1);
assert.equal(profile.cntbRecords[1].name, 'FBLIND 1 of BRANCH /BTRM-1000-8"-P1710002-66620M0-01/B1');
assert.equal(profile.cntbRecords[1].materialId, 4);
assert.ok(Math.abs(profile.cntbRecords[1].x - 151206.796875) < 1e-6);
assert.deepEqual(profile.cntbMaterialHistogram, { 1: 1, 4: 1 });

assert.deepEqual(RMSS_OBSERVED_PRIMITIVE_CODES, [1, 2, 4, 5, 6, 7, 8, 11]);
assert.deepEqual(REFERENCE_OBSERVED_PRIMITIVE_CODES, [1, 2, 3, 4, 5, 6, 7, 8, 11]);
assert.deepEqual(profile.primitiveCodes, [6, 11]);
assert.equal(profile.primitiveCodeHistogram['6'], 1);
assert.equal(profile.primitiveCodeHistogram['11'], 1);
assert.equal(profile.primitiveBodyLengthHistogram['6:88'], 1);
assert.equal(profile.primitiveBodyLengthHistogram['11:1468'], 1);
assert.equal(profile.primitiveRecords[0].rmssObserved, true, 'RMSS code 6 must be recorded as reference-observed');
assert.equal(profile.primitiveRecords[0].rhbgObserved, false, 'RMSS code 6 must not be overclaimed as RHBG-observed');
assert.equal(profile.primitiveRecords[0].productionEmissionStatus, 'reference-observed-blocked');
assert.equal(profile.primitiveRecords[1].bodyLength, 1468, 'code 11 variable mesh/facet body length must be reported');

assert.equal(profile.colorRecords.length, 2);
assert.equal(profile.colorRecords[0].version, 1);
assert.equal(profile.colorRecords[0].materialId, 1);
assert.equal(profile.colorRecords[0].packedColorHex, '0x82828200');
assert.equal(profile.colorRecords[1].materialId, 4);
assert.equal(profile.colorRecords[1].packedColorHex, '0xffff0000');

const cntb = parseReferenceCntbBody(new DataView(makeCntbBody('NODE', 1, 2, 3, 4)));
assert.deepEqual({ name: cntb.name, x: cntb.x, y: cntb.y, z: cntb.z, materialId: cntb.materialId }, { name: 'NODE', x: 1, y: 2, z: 3, materialId: 4 });
const colr = parseReferenceColrBody(new DataView(makeColrBody(1, 9, 0x11223344)));
assert.equal(colr.packedColorHex, '0x11223344');

const nonZeroTail = makeReferenceRvm([makeChunk('HEAD', concatBuffers([uint32(2)])), makeChunk('MODL', concatBuffers([uint32(1)])), makeChunk('END:', uint32(1))], new Uint8Array([0, 1, 0, 0]).buffer);
assert.throws(() => profileRvmReferenceFormat(nonZeroTail), /non-zero trailing bytes after END:/);
assert.throws(() => profileRvmReferenceFormat(makeChunk('XXXX', uint32(1))), /Unsupported reference RVM chunk id/);

assert.match(profilerSource, /CNTB x\/y\/z are treated as node placement/, 'profiler must document CNTB coordinate semantics, not bbox semantics');
assert.match(profilerSource, /COLR is accepted by this reference profiler/, 'profiler must document RMSS COLR reference support');
assert.match(profilerSource, /generatedWriterContractChanged:\s*false/, 'profiler must not claim production writer format changed');
assert.match(pkg.scripts.test, /rvm-reference-format-profiler\.test\.mjs/, 'npm test must include the RVM reference format profiler test');

console.log('RVM reference format profiler test passed');

function makeReferenceRvm(chunks, tail = new ArrayBuffer(0)) {
  let offset = 0;
  for (const chunk of chunks) {
    new DataView(chunk).setUint32(16, offset + chunk.byteLength, false);
    offset += chunk.byteLength;
  }
  return concatBuffers([...chunks, tail]);
}

function makeCntbBody(name, x, y, z, materialId) {
  return concatBuffers([uint32(2), rvmString(name), float32(x), float32(y), float32(z), uint32(materialId)]);
}

function makeColrBody(version, materialId, packedColor) {
  return concatBuffers([uint32(version), uint32(materialId), uint32(packedColor)]);
}

function makePrimBody(code, bodyLength, bbox, payload) {
  const body = new ArrayBuffer(bodyLength);
  const view = new DataView(body);
  view.setUint32(0, 1, false);
  view.setUint32(4, code, false);
  for (let index = 0; index < 12; index += 1) view.setFloat32(8 + index * 4, index % 5 === 0 ? 0.001 : 0, false);
  for (let index = 0; index < 6; index += 1) view.setFloat32(56 + index * 4, bbox[index] ?? 0, false);
  for (let index = 0; index < payload.length; index += 1) view.setFloat32(80 + index * 4, payload[index], false);
  return body;
}

function makeChunk(id, body) {
  assert.equal(id.length, 4, 'RVM chunk id must be four characters');
  const bodyBuffer = toArrayBuffer(body);
  const chunk = new ArrayBuffer(24 + bodyBuffer.byteLength);
  const view = new DataView(chunk);
  for (let index = 0; index < 4; index += 1) view.setUint32(index * 4, id.charCodeAt(index), false);
  view.setUint32(16, 24 + bodyBuffer.byteLength, false);
  view.setUint32(20, 1, false);
  new Uint8Array(chunk, 24).set(new Uint8Array(bodyBuffer));
  return chunk;
}

function rvmString(value) {
  const bytes = new TextEncoder().encode(`${value}\0`);
  const wordCount = Math.ceil(bytes.length / 4);
  const buffer = new ArrayBuffer(4 + wordCount * 4);
  const view = new DataView(buffer);
  view.setUint32(0, wordCount, false);
  new Uint8Array(buffer, 4).set(bytes);
  return buffer;
}

function uint32(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, false);
  return buffer;
}

function float32(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, value, false);
  return buffer;
}

function concatBuffers(buffers) {
  const normalized = buffers.map(toArrayBuffer);
  const total = normalized.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const buffer of normalized) {
    output.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return output.buffer;
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  throw new Error('expected ArrayBuffer or typed array');
}

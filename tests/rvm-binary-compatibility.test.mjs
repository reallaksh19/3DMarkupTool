import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { writeRvm } from '../src/rvm-writer.js';
import { auditRvmBinary, assertRvmBinaryCompatibility } from '../src/rvm-binary-audit.js';
import './rvm-reference-format-profiler.test.mjs';

const writerSource = readFileSync(new URL('../src/rvm-writer.js', import.meta.url), 'utf8');
const axisBasisSource = readFileSync(new URL('../src/rvm-axis-basis-policy.js', import.meta.url), 'utf8');
const auditSource = readFileSync(new URL('../src/rvm-binary-audit.js', import.meta.url), 'utf8');
const artifactScript = readFileSync(new URL('../scripts/generate-rvm-catalogue-sample-artifact.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    material: 0,
    attributes: { TYPE: 'ROOT' },
    primitives: [],
    children: [
      {
        name: 'PLANT_GEOMETRY',
        material: 0,
        attributes: { TYPE: 'GROUP' },
        primitives: [],
        children: [
          {
            name: 'PE_001_PIPE_10_TO_20',
            material: 1,
            attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: 'PIPE' },
            primitives: [
              {
                name: 'PE_001_PIPE_10_TO_20_BODY',
                kind: 'cylinder',
                center: [500, 0, 0],
                direction: [1, 0, 0],
                radius: 50,
                length: 1000
              }
            ],
            children: []
          }
        ]
      }
    ]
  },
  audit: { primitiveCount: 1 }
};

const rvm = writeRvm(exportModel);
assert.ok(rvm instanceof ArrayBuffer, 'RVM writer must return ArrayBuffer');

const audit = assertRvmBinaryCompatibility(rvm, { primitiveCount: 1 });
assert.equal(audit.schema, 'RvmBinaryAudit.v1');
assert.equal(audit.firstChunk, 'HEAD', 'HEAD must be the first RVM chunk');
assert.equal(audit.secondChunk, 'MODL', 'MODL must be the second RVM chunk');
assert.equal(audit.terminalChunk, 'END:', 'END: must terminate the RVM chunk stream');
assert.equal(audit.endBodyLength, 4, 'END: must include a small marker body matching RHBG-style Review output');
assert.equal(audit.allChunkMarkersOne, true, 'all chunk headers must use Review-style marker value 1');
assert.equal(audit.balancedCntbCnte, true, 'CNTB/CNTE chunks must be balanced');
assert.equal(audit.contiguousUntilEnd, true, 'generated RVM must not include trailing bytes after END:');
assert.equal(audit.primitiveChunkCount, 1, 'PRIM chunk count must equal exported primitive count');
assert.deepEqual(
  audit.chunks.map((chunk) => chunk.id),
  ['HEAD', 'MODL', 'CNTB', 'CNTB', 'CNTB', 'PRIM', 'CNTE', 'CNTE', 'CNTE', 'END:'],
  'synthetic hierarchy must scan as the expected Review chunk sequence'
);

const rawAudit = auditRvmBinary(rvm);
assert.equal(rawAudit.ok, true, 'raw audit must pass with no issues');
assert.deepEqual(rawAudit.issues, [], 'binary audit must not report issues for generated writer output');

const primitive = firstPrimitiveBody(rvm);
assert.equal(primitive.version, 1, 'PRIM body must start with primitive record version 1');
assert.equal(primitive.kind, 8, 'synthetic primitive must be written as Review cylinder kind 8');
assert.deepEqual(
  primitive.matrix.map((value) => round(value, 6)),
  [0, 0, -0.001, 0, 0.001, 0, 0.001, 0, 0, 0.5, 0, 0],
  'RVM primitive matrix must use RHBG-style 0.001 basis scale and meter translation while local dimensions remain in mm'
);
assert.deepEqual(
  primitive.bbox.map((value) => round(value, 6)),
  [-50, -50, -500, 50, 50, 500],
  'RVM local primitive bounding box must remain in source millimetres'
);
assert.equal(round(primitive.trailing[0], 6), 50, 'cylinder radius payload must remain in source millimetres');
assert.equal(round(primitive.trailing[1], 6), 1000, 'cylinder length payload must remain in source millimetres');

assert.match(writerSource, /const REVIEW_CHUNK_HEADER_MARKER = 1/, 'writer must use explicit Review chunk header marker value 1');
assert.match(writerSource, /const REVIEW_CONTAINER_CLOSE_BODY_MARKER = 2/, 'writer must use RHBG-style CNTE body marker value 2');
assert.match(writerSource, /const REVIEW_END_BODY_MARKER = 1/, 'writer must use RHBG-style END: body marker value 1');
assert.match(writerSource, /buildRvmPrimitiveTransform\(primitive\)/, 'writer must delegate primitive matrices to the central axis/basis policy');
assert.doesNotMatch(writerSource, /function basisFromDirection/, 'writer must not keep ad-hoc primitive basis construction');
assert.match(axisBasisSource, /export const RVM_PRIMITIVE_TRANSFORM_SCALE = 0\.001/, 'axis/basis policy must own RHBG-style 0.001 primitive transform scale');
assert.match(axisBasisSource, /scaleRvmTransformVector\(basis\.x\)/, 'axis/basis policy must scale primitive basis vectors before writing PRIM matrices');
assert.match(axisBasisSource, /scaleRvmTransformVector\(center\)/, 'axis/basis policy must scale primitive translations before writing PRIM matrices');
assert.match(writerSource, /writer\.writeChunk\('CNTE', uint32Body\(REVIEW_CONTAINER_CLOSE_BODY_MARKER\)/, 'writer must emit CNTE body marker 2');
assert.match(writerSource, /writer\.writeChunk\('END:', uint32Body\(REVIEW_END_BODY_MARKER\)/, 'writer must emit END: body marker 1');
assert.match(writerSource, /view\.setUint32\(20, REVIEW_CHUNK_HEADER_MARKER, false\)/, 'writer chunk headers must carry marker value 1');
assert.match(auditSource, /REQUIRED_REVIEW_CHUNKS/, 'binary audit helper must maintain the required chunk contract');
assert.match(auditSource, /allChunkMarkersOne/, 'binary audit must check Review-style marker values');
assert.match(auditSource, /balancedCntbCnte/, 'binary audit must check CNTB/CNTE balance');
assert.match(auditSource, /endBodyLength !== 4/, 'binary compatibility assertion must require END: marker body length');
assert.match(artifactScript, /assertRvmBinaryCompatibility/, 'CI artifact generator must run binary compatibility audit');
assert.match(artifactScript, /rvmBinaryAudit/, 'CI artifact audit JSON must include binary audit summary');
assert.match(pkg.scripts.test, /rvm-binary-compatibility\.test\.mjs/, 'npm test must include the C6 RVM binary compatibility gate');
assert.match(pkg.scripts.test, /rvm-axis-basis-policy\.test\.mjs/, 'npm test must include the RVM axis/basis policy gate');

console.log('RVM binary compatibility gate passed');

function firstPrimitiveBody(buffer) {
  const view = new DataView(buffer);
  let offset = 0;
  while (offset + 24 <= buffer.byteLength) {
    const id = [0, 1, 2, 3]
      .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
      .join('');
    const nextOffset = view.getUint32(offset + 16, false);
    if (id === 'PRIM') {
      const bodyView = new DataView(buffer, offset + 24, nextOffset - offset - 24);
      return {
        version: bodyView.getUint32(0, false),
        kind: bodyView.getUint32(4, false),
        matrix: readFloat32Array(bodyView, 8, 12),
        bbox: readFloat32Array(bodyView, 56, 6),
        trailing: readFloat32Array(bodyView, 80, 2)
      };
    }
    offset = nextOffset;
  }
  throw new Error('No PRIM chunk found in synthetic RVM output');
}

function readFloat32Array(view, byteOffset, count) {
  return Array.from({ length: count }, (_, index) => view.getFloat32(byteOffset + index * 4, false));
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

import assert from 'node:assert/strict';

import { writeRvm } from '../src/rvm-writer.js';
import { writeAtt } from '../src/att-writer.js';
import {
  assertRvmChunkHierarchy,
  parseAttHierarchy,
  scanRvmChunkHierarchy
} from '../src/rvm-chunk-hierarchy-validator.js';

const exportModel = {
  root: {
    name: 'INPUTXML',
    reviewName: '/INPUTXML',
    material: 1,
    reviewValue: 0,
    primitives: [],
    attributes: { TYPE: 'ROOT' },
    children: [
      {
        name: 'INPUTXML-PI',
        reviewName: '/INPUTXML-PI',
        material: 10,
        reviewValue: 0,
        primitives: [
          {
            kind: 'cylinder',
            name: 'PIPE-1',
            center: [50, 0, 0],
            direction: [1, 0, 0],
            radius: 10,
            length: 100
          }
        ],
        attributes: { TYPE: 'PIPE_ZONE' },
        children: [
          {
            name: 'PIPE-LEAF',
            reviewName: 'PIPE 1 of ZONE /INPUTXML-PI',
            material: 10,
            reviewValue: 0,
            primitives: [
              {
                kind: 'box',
                name: 'BOX-1',
                center: [120, 0, 0],
                direction: [0, 0, 1],
                lengths: [20, 30, 40]
              }
            ],
            attributes: { TYPE: 'PIPE' },
            children: []
          }
        ]
      }
    ]
  }
};

const rvm = writeRvm(exportModel);
const att = writeAtt(exportModel);

const result = assertRvmChunkHierarchy(rvm, att, exportModel);
assert.equal(result.schema, 'RvmChunkHierarchyValidator.v2');
assert.equal(result.failClosed, true);
assert.equal(result.headCount, 1);
assert.equal(result.modlCount, 1);
assert.equal(result.endCount, 1);
assert.equal(result.cntbCount, 3);
assert.equal(result.cnteCount, 3);
assert.equal(result.primCount, 2);
assert.equal(result.colrCount, 2);
assert.equal(result.cntbCnteBalanced, true);
assert.equal(result.primInsideCntbOnly, true);
assert.equal(result.colrAfterHierarchyOnly, true);
assert.equal(result.rvmAttNamesMatch, true);
assert.equal(result.maxRvmDepth, 3);
assert.equal(result.maxAttDepth, 3);

const attHierarchy = parseAttHierarchy(att);
assert.deepEqual(attHierarchy.names, ['/INPUTXML', '/INPUTXML-PI', 'PIPE 1 of ZONE /INPUTXML-PI']);

const scanned = scanRvmChunkHierarchy(rvm);
assert.deepEqual(scanned.sequence.slice(0, 3), ['HEAD', 'MODL', 'CNTB']);
assert.deepEqual(scanned.sequence.slice(-3), ['COLR', 'COLR', 'END:']);
assert.equal(scanned.sequence.at(-1), 'END:');

const badAtt = att.replace('PIPE 1 of ZONE /INPUTXML-PI', 'PIPE 1 MISMATCH');
assert.throws(
  () => assertRvmChunkHierarchy(rvm, badAtt, exportModel),
  /ATT hierarchy name mismatch/
);

const badChunkId = cloneBuffer(rvm);
writeChunkId(badChunkId, findChunkOffset(badChunkId, 'PRIM'), 'ZBAD');
assert.throws(
  () => scanRvmChunkHierarchy(badChunkId),
  /Unsupported RVM chunk id ZBAD/
);

const badCloseMarker = cloneBuffer(rvm);
const cnteOffset = findChunkOffset(badCloseMarker, 'CNTE');
new DataView(badCloseMarker).setUint32(cnteOffset + 24, 1, false);
assert.throws(
  () => scanRvmChunkHierarchy(badCloseMarker),
  /expected marker 2, got 1/
);

const colrInsideCntb = moveFirstColrBeforeFirstCnte(rvm);
assert.throws(
  () => scanRvmChunkHierarchy(colrInsideCntb),
  /cannot appear inside CNTB scope/,
  'COLR must remain after the generated CNTB/CNTE hierarchy'
);

assert.throws(
  () => parseAttHierarchy("CADC_Attributes_File v1.0 , start: NEW , end: END , name_end: := , sep: &end&\r\nNEW ROOT\r\n"),
  /unclosed NEW/
);

console.log('rvm-chunk-hierarchy-validator tests passed');

function cloneBuffer(buffer) {
  return buffer.slice(0);
}

function findChunkOffset(buffer, targetId) {
  const view = new DataView(buffer);
  let offset = 0;
  let guard = 0;
  while (offset + 24 <= buffer.byteLength) {
    const id = readChunkId(view, offset);
    if (id === targetId) return offset;
    const nextOffset = view.getUint32(offset + 16, false);
    if (nextOffset <= offset || nextOffset > buffer.byteLength) throw new Error(`Invalid chunk pointer while searching ${targetId}`);
    offset = nextOffset;
    guard += 1;
    if (guard > 1000) throw new Error(`Chunk search guard tripped for ${targetId}`);
  }
  throw new Error(`Chunk ${targetId} not found`);
}

function readChunkId(view, offset) {
  return [0, 1, 2, 3]
    .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
    .join('');
}

function writeChunkId(buffer, offset, id) {
  const view = new DataView(buffer);
  for (let index = 0; index < 4; index += 1) {
    view.setUint32(offset + index * 4, id.charCodeAt(index), false);
  }
}

function moveFirstColrBeforeFirstCnte(buffer) {
  const view = new DataView(buffer);
  const chunks = [];
  let offset = 0;
  while (offset + 24 <= buffer.byteLength) {
    const id = readChunkId(view, offset);
    const nextOffset = view.getUint32(offset + 16, false);
    chunks.push({ id, bytes: new Uint8Array(buffer.slice(offset, nextOffset)) });
    offset = nextOffset;
    if (id === 'END:') break;
  }
  const colrIndex = chunks.findIndex((chunk) => chunk.id === 'COLR');
  const cnteIndex = chunks.findIndex((chunk) => chunk.id === 'CNTE');
  assert.ok(colrIndex > cnteIndex, 'test setup requires COLR after CNTE');
  const [colr] = chunks.splice(colrIndex, 1);
  chunks.splice(cnteIndex, 0, colr);
  return rebuildChunks(chunks);
}

function rebuildChunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk.bytes, offset);
    const view = new DataView(output.buffer);
    view.setUint32(offset + 16, offset + chunk.bytes.byteLength, false);
    offset += chunk.bytes.byteLength;
  }
  return output.buffer;
}

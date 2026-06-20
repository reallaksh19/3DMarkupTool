import assert from 'node:assert/strict';

import { writeRvm } from '../src/rvm-writer.js';
import { assertRvmMaterialLayerContract } from '../src/rvm-material-layer-contract.js';
import {
  RVM_BLOCKED_MATERIAL_TABLE_CHUNKS,
  RVM_MATERIAL_TABLE_CONTRACT_SCHEMA,
  assertRvmMaterialTableContract,
  scanColrRecords
} from '../src/rvm-material-table-contract.js';
import {
  RVM_COLR_BODY_VERSION,
  RVM_COLR_CHUNK_ID,
  RVM_COLR_PAYLOAD_LAYOUT,
  assertRvmColrMaterialPolicy
} from '../src/rvm-colr-material-policy.js';

function minimalExportModel() {
  return {
    root: {
      name: 'ROOT',
      reviewName: '/INPUTXML',
      material: 12,
      attributes: { TYPE: 'MODEL_ROOT', ROLE: 'ROOT' },
      primitives: [],
      children: [
        {
          name: 'PIPE_NODE',
          reviewName: 'PIPE 1 of ZONE /INPUTXML-PI',
          material: 7,
          attributes: { TYPE: 'COMPONENT', ROLE: 'PLANT_GEOMETRY', RVM_COLOR: '0xffff0000' },
          primitives: [
            {
              name: 'PIPE_PRIM',
              kind: 'cylinder',
              center: [1000, 0, 0],
              direction: [1, 0, 0],
              radius: 50,
              length: 1000
            }
          ],
          children: []
        }
      ]
    }
  };
}

function fakeChunk(id, bodyLength = 4, bodyWriter = null) {
  const padded = id.padEnd(4, ' ').slice(0, 4);
  const buffer = new ArrayBuffer(24 + bodyLength);
  const view = new DataView(buffer);
  for (let index = 0; index < 4; index += 1) {
    view.setUint32(index * 4, padded.charCodeAt(index), false);
  }
  view.setUint32(16, 24 + bodyLength, false);
  view.setUint32(20, 1, false);
  if (bodyWriter) bodyWriter(view, 24);
  return buffer;
}

function assertIncludesAll(actual, expected) {
  const set = new Set(actual);
  for (const value of expected) assert.equal(set.has(value), true, `expected ${value} in ${actual.join(', ')}`);
}

const exportModel = minimalExportModel();
const materialLayer = assertRvmMaterialLayerContract(exportModel);
const colrPolicy = assertRvmColrMaterialPolicy(exportModel, materialLayer);
const rvm = writeRvm(exportModel);
const materialTable = assertRvmMaterialTableContract(rvm, materialLayer);
const colrRecords = scanColrRecords(rvm);

assert.equal(colrPolicy.schema, 'RvmColrMaterialPolicy.v1');
assert.equal(colrPolicy.bodyVersion, RVM_COLR_BODY_VERSION);
assert.equal(colrPolicy.payloadLayout, RVM_COLR_PAYLOAD_LAYOUT);
assert.deepEqual(colrPolicy.materialIds, [7, 12]);

assert.equal(materialTable.schema, RVM_MATERIAL_TABLE_CONTRACT_SCHEMA);
assert.equal(materialTable.failClosed, true);
assert.equal(materialTable.materialTableChunksEmitted, false);
assert.equal(materialTable.colorTableChunksEmitted, true);
assert.equal(materialTable.colorTableChunkName, RVM_COLR_CHUNK_ID);
assert.equal(materialTable.colorTablePayloadLayout, RVM_COLR_PAYLOAD_LAYOUT);
assert.equal(materialTable.colorTableChunkCount, 2);
assert.equal(materialTable.layerTableChunksEmitted, false);
assert.equal(materialTable.groupMaterialEncodedInCntb, true);
assert.equal(materialTable.primitiveMaterialEncodedInPrim, false);
assert.deepEqual(materialTable.materialIds, [7, 12]);
assert.deepEqual(colrRecords.map((record) => record.materialId), [7, 12]);
assert.equal(colrRecords[0].packedColor, 0xffff0000, 'explicit RMSS-style packed color should be preserved for material 7');
assert.equal(colrRecords[1].packedColor, 0xffff0000, 'second generated material uses deterministic fallback palette entry');
assertIncludesAll(materialTable.emittedChunkTypes, ['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'COLR', 'END:']);
assert.deepEqual(materialTable.blockedMaterialTableChunks, RVM_BLOCKED_MATERIAL_TABLE_CHUNKS);
assert.equal(RVM_BLOCKED_MATERIAL_TABLE_CHUNKS.includes('COLR'), false, 'COLR must no longer be blocked after RMSS decode support');

for (const blocked of RVM_BLOCKED_MATERIAL_TABLE_CHUNKS) {
  assert.throws(
    () => assertRvmMaterialTableContract(fakeChunk(blocked), materialLayer),
    /unsupported material\/color table chunks/,
    `${blocked} must fail closed until its payload layout is supported`
  );
}

assert.throws(
  () => assertRvmMaterialTableContract(fakeChunk('ZBAD'), materialLayer),
  /unsupported non-core chunks/,
  'unknown valid-format RVM chunks must fail closed before writer support is defined'
);

assert.throws(
  () => assertRvmMaterialTableContract(fakeChunk('COLR', 8, (view, offset) => {
    view.setUint32(offset, RVM_COLR_BODY_VERSION, false);
    view.setUint32(offset + 4, 7, false);
  }), materialLayer),
  /expected 12 bytes/,
  'malformed COLR bodies must fail closed'
);

assert.throws(
  () => assertRvmMaterialTableContract(fakeChunk('COLR', 12, (view, offset) => {
    view.setUint32(offset, 99, false);
    view.setUint32(offset + 4, 7, false);
    view.setUint32(offset + 8, 0x82828200, false);
  }), materialLayer),
  /COLR body version mismatch/,
  'unsupported COLR body versions must fail closed'
);

console.log('RVM material table/color contract checks passed');

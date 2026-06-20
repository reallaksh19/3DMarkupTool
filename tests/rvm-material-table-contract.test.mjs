import assert from 'node:assert/strict';

import { writeRvm } from '../src/rvm-writer.js';
import { assertRvmMaterialLayerContract } from '../src/rvm-material-layer-contract.js';
import {
  RVM_BLOCKED_MATERIAL_TABLE_CHUNKS,
  RVM_MATERIAL_TABLE_CONTRACT_SCHEMA,
  assertRvmMaterialTableContract
} from '../src/rvm-material-table-contract.js';

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
          attributes: { TYPE: 'COMPONENT', ROLE: 'PLANT_GEOMETRY' },
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

function fakeChunk(id, bodyLength = 4) {
  const padded = id.padEnd(4, ' ').slice(0, 4);
  const buffer = new ArrayBuffer(24 + bodyLength);
  const view = new DataView(buffer);
  for (let index = 0; index < 4; index += 1) {
    view.setUint32(index * 4, padded.charCodeAt(index), false);
  }
  view.setUint32(16, 24 + bodyLength, false);
  view.setUint32(20, 1, false);
  return buffer;
}

function assertIncludesAll(actual, expected) {
  const set = new Set(actual);
  for (const value of expected) assert.equal(set.has(value), true, `expected ${value} in ${actual.join(', ')}`);
}

const exportModel = minimalExportModel();
const materialLayer = assertRvmMaterialLayerContract(exportModel);
const rvm = writeRvm(exportModel);
const materialTable = assertRvmMaterialTableContract(rvm, materialLayer);

assert.equal(materialTable.schema, RVM_MATERIAL_TABLE_CONTRACT_SCHEMA);
assert.equal(materialTable.failClosed, true);
assert.equal(materialTable.materialTableChunksEmitted, false);
assert.equal(materialTable.colorTableChunksEmitted, false);
assert.equal(materialTable.layerTableChunksEmitted, false);
assert.equal(materialTable.groupMaterialEncodedInCntb, true);
assert.equal(materialTable.primitiveMaterialEncodedInPrim, false);
assert.deepEqual(materialTable.materialIds, [7, 12]);
assertIncludesAll(materialTable.emittedChunkTypes, ['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'END:']);
assert.deepEqual(materialTable.blockedMaterialTableChunks, RVM_BLOCKED_MATERIAL_TABLE_CHUNKS);

for (const blocked of RVM_BLOCKED_MATERIAL_TABLE_CHUNKS) {
  assert.throws(
    () => assertRvmMaterialTableContract(fakeChunk(blocked), materialLayer),
    /unsupported material\/color table chunks/,
    `${blocked} must fail closed until its payload layout is supported`
  );
}

assert.throws(
  () => assertRvmMaterialTableContract(fakeChunk('FOO!'), materialLayer),
  /unsupported non-core chunks/,
  'unknown RVM chunks must fail closed before writer support is defined'
);

console.log('RVM material table/color contract checks passed');

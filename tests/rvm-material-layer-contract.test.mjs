import assert from 'node:assert/strict';
import {
  RVM_MATERIAL_LAYER_CONTRACT_SCHEMA,
  assertRvmMaterialLayerContract,
  normalizeRvmLayerName,
  normalizeRvmMaterialId
} from '../src/rvm-material-layer-contract.js';
import { writeRvm } from '../src/rvm-writer.js';

const exportModel = {
  root: {
    name: 'ROOT',
    reviewName: '/INPUTXML',
    material: 12,
    attributes: { TYPE: 'MODEL_ROOT', ROLE: 'ROOT' },
    primitives: [{
      kind: 'sphere',
      name: 'ROOT_MARKER',
      center: [0, 0, 0],
      diameter: 10,
      material: 12
    }],
    children: [{
      name: 'PLANT_GEOMETRY',
      reviewName: '/INPUTXML-PI',
      material: 6,
      attributes: { TYPE: 'GROUP', ROLE: 'PLANT_GEOMETRY' },
      primitives: [{
        kind: 'cylinder',
        name: 'PIPE_BODY',
        center: [1000, 0, 0],
        direction: [1, 0, 0],
        radius: 50,
        length: 2000,
        material: 6
      }],
      children: []
    }]
  }
};

const contract = assertRvmMaterialLayerContract(exportModel);
assert.equal(contract.schema, RVM_MATERIAL_LAYER_CONTRACT_SCHEMA);
assert.equal(contract.failClosed, true);
assert.equal(contract.groupMaterialEncodedInCntb, true);
assert.equal(contract.primitiveMaterialEncodedInPrim, false);
assert.deepEqual(contract.materialIds, [6, 12]);
assert(contract.layerNames.includes('PLANT_GEOMETRY'));

const rvm = writeRvm(exportModel);
assert(rvm.byteLength > 0, 'writer should still emit a binary RVM with material contract validation');

assert.equal(normalizeRvmMaterialId(undefined), 0);
assert.equal(normalizeRvmMaterialId(31), 31);
assert.throws(() => normalizeRvmMaterialId(-1), /integer material id/);
assert.throws(() => normalizeRvmMaterialId(1.5), /integer material id/);
assert.throws(() => normalizeRvmMaterialId(70000), /integer material id/);

assert.equal(normalizeRvmLayerName('PLANT_GEOMETRY'), 'PLANT_GEOMETRY');
assert.throws(() => normalizeRvmLayerName('BAD|LAYER'), /unsupported Review layer/);
assert.throws(() => writeRvm({ root: { name: 'BAD', material: -1, primitives: [], children: [] } }), /integer material id/);

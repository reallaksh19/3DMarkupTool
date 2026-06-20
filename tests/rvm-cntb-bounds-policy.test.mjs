import assert from 'node:assert/strict';

import { writeRvm } from '../src/rvm-writer.js';
import { assertRvmCntbBoundsPolicy, scanCntbRecords } from '../src/rvm-cntb-bounds-policy.js';

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    reviewName: '/INPUTXML',
    material: 12,
    attributes: { TYPE: 'MODEL_ROOT' },
    primitives: [],
    children: [
      {
        name: 'PLANT_GEOMETRY',
        reviewName: '/INPUTXML-PI',
        material: 12,
        attributes: { TYPE: 'GROUP', ROLE: 'PLANT_GEOMETRY' },
        primitives: [],
        children: [
          {
            name: 'PE_001_PIPE_10_TO_20',
            reviewName: 'PIPE 1 of ZONE /INPUTXML-PI',
            material: 12,
            attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: 'PIPE' },
            primitives: [
              {
                name: 'PE_001_PIPE_10_TO_20_BODY',
                kind: 'cylinder',
                center: [500, 0, 0],
                direction: [1, 0, 0],
                radius: 50,
                length: 1000,
                material: 12
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
const records = scanCntbRecords(rvm);
assert.equal(records.length, 3, 'synthetic RVM must contain one CNTB per export node');
assert.deepEqual(
  records.map((record) => record.name),
  ['/INPUTXML', '/INPUTXML-PI', 'PIPE 1 of ZONE /INPUTXML-PI'],
  'CNTB review names must follow the writer pre-order hierarchy'
);
assert.deepEqual(
  records.map((record) => record.materialId),
  [12, 12, 12],
  'CNTB material ids must decode from the explicit group payload field'
);

const policy = assertRvmCntbBoundsPolicy(rvm, exportModel);
assert.equal(policy.schema, 'RvmCntbBoundsPolicy.v1');
assert.equal(policy.failClosed, true);
assert.equal(policy.cntbPayloadVersion, 2, 'generated CNTB payload must keep Review-style version 2');
assert.equal(policy.cntbPayloadLayout.includes('reviewName'), true, 'policy must document the generated CNTB body layout');
assert.equal(policy.cntbBboxFieldsWritten, false, 'writer must not invent unsupported CNTB bbox payload fields');
assert.equal(policy.bboxSource, 'recursive-export-model-primitives');
assert.equal(policy.bboxUnit, 'millimetres');
assert.equal(policy.rootBboxNonEmpty, true, 'root bbox must be non-empty when primitives are present');
assert.deepEqual(policy.rootBbox, [0, -50, -50, 1000, 50, 50], 'recursive bounds must preserve source millimetres');
assert.equal(policy.nodeCount, 3);
assert.equal(policy.cntbCount, 3);
assert.equal(policy.primitiveCount, 1);
assert.equal(policy.nodesWithBounds, 3, 'root, group, and component all inherit primitive extents');
assert.equal(policy.emptyLeafNodeCount, 0);
assert.deepEqual(policy.materialIds, [12]);
assert.equal(policy.reviewNamesMatchCntb, true);
assert.equal(policy.groupMaterialIdsMatchCntb, true);

assert.throws(
  () => assertRvmCntbBoundsPolicy(rvm, {
    ...exportModel,
    root: {
      ...exportModel.root,
      reviewName: '/WRONG_ROOT_NAME'
    }
  }),
  /CNTB review-name mismatch/,
  'policy must fail closed when binary CNTB names no longer match export-model review names'
);

assert.throws(
  () => assertRvmCntbBoundsPolicy(rvm, {
    root: {
      name: 'EMPTY_ROOT',
      reviewName: '/EMPTY',
      material: 0,
      primitives: [
        {
          name: 'BAD_BOX',
          kind: 'box',
          center: [0, 0, 0],
          direction: [0, 0, 1],
          lengths: [0, 10, 10]
        }
      ],
      children: []
    }
  }),
  /entries must be positive|count mismatch/,
  'policy must fail closed on malformed primitive dimensions before trusting node extents'
);

console.log('RVM CNTB bounds policy tests passed');

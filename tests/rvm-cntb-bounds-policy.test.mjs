import assert from 'node:assert/strict';

import { writeRvm } from '../src/rvm-writer.js';
import { assertRvmCntbBoundsPolicy, scanCntbRecords } from '../src/rvm-cntb-bounds-policy.js';

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    reviewName: '/INPUTXML',
    cntbPosition: [0, 0, 100000],
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
assert.deepEqual(
  records.map((record) => record.position),
  [
    [0, 0, 100000],
    [0, 0, 0],
    [500, 0, 0]
  ],
  'CNTB payload must decode as explicit x/y/z coordinates, not reserved strings or bbox fields'
);
assert.equal(records[0].bodyLength, 44, 'CNTB body length must stay RMSS-compatible for /INPUTXML name');

const policy = assertRvmCntbBoundsPolicy(rvm, exportModel);
assert.equal(policy.schema, 'RvmCntbBoundsPolicy.v2');
assert.equal(policy.failClosed, true);
assert.equal(policy.cntbPayloadVersion, 2, 'generated CNTB payload must keep Review-style version 2');
assert.equal(policy.cntbPayloadLayout, 'uint32 version, reviewName, float32 x, float32 y, float32 z, uint32 materialId');
assert.equal(policy.cntbCoordinateSchema, 'RvmCntbCoordinatePolicy.v1');
assert.equal(policy.cntbCoordinateFieldsWritten, true, 'writer must emit explicit CNTB x/y/z reference coordinates');
assert.equal(policy.cntbCoordinateUnit, 'millimetres');
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
assert.equal(policy.cntbCoordinatesMatchExportModel, true);

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
    ...exportModel,
    root: {
      ...exportModel.root,
      cntbPosition: [1, 2, 3]
    }
  }),
  /CNTB coordinate mismatch/,
  'policy must fail closed when binary CNTB coordinates no longer match export-model node coordinates'
);

assert.throws(
  () => writeRvm({
    root: {
      name: 'BAD_COORDINATE_ROOT',
      reviewName: '/BAD',
      cntbPosition: [0, Number.NaN, 0],
      material: 12,
      primitives: [],
      children: []
    }
  }),
  /CNTB explicit node position contains non-finite coordinate/,
  'writer must fail closed when explicit CNTB coordinates are malformed'
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

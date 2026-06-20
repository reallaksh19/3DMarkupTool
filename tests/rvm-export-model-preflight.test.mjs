import assert from 'node:assert/strict';
import { assertRvmExportModelPreflight } from '../src/rvm-export-model-preflight.js';

function validExportModel(overrides = {}) {
  const root = {
    name: 'ROOT',
    reviewName: '/INPUTXML',
    material: 12,
    attributes: { TYPE: 'MODEL_ROOT' },
    primitives: [],
    children: [{
      name: 'PIPE_1',
      reviewName: 'PIPE 1 of ZONE /INPUTXML-PI',
      material: 12,
      attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: 'PIPE' },
      primitives: [{
        kind: 'cylinder',
        name: 'PIPE_1_BODY',
        center: [100, 0, 0],
        direction: [1, 0, 0],
        radius: 50,
        length: 200,
        material: 12
      }, {
        kind: 'sphere',
        name: 'PIPE_1_MARKER',
        center: [0, 0, 0],
        diameter: 20,
        material: 12
      }],
      children: []
    }]
  };
  return { root: deepMerge(root, overrides.root || {}) };
}

function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return patch === undefined ? base : patch;
  if (!base || typeof base !== 'object' || !patch || typeof patch !== 'object') return patch === undefined ? base : patch;
  const output = { ...base };
  for (const [key, value] of Object.entries(patch)) output[key] = deepMerge(base[key], value);
  return output;
}

{
  const report = assertRvmExportModelPreflight(validExportModel());
  assert.equal(report.schema, 'RvmExportModelPreflight.v1');
  assert.equal(report.failClosed, true);
  assert.equal(report.writerReady, true);
  assert.equal(report.directRvmPrimitiveCodeAllowed, false);
  assert.equal(report.nodeCount, 2);
  assert.equal(report.primitiveCount, 2);
  assert.equal(report.reviewNameCount, 2);
  assert.equal(report.implicitSphereDirectionCount, 1);
  assert.deepEqual(report.kindCounts, { cylinder: 1, sphere: 1 });
  assert.deepEqual(report.materialIds, [12]);
}

assert.throws(
  () => assertRvmExportModelPreflight(validExportModel({ root: { children: [{ reviewName: '' }] } })),
  /node\.reviewName/
);

assert.throws(
  () => assertRvmExportModelPreflight(validExportModel({
    root: {
      children: [{
        primitives: [{
          kind: 'frustum',
          name: 'BAD_FRUSTUM',
          center: [0, 0, 0],
          direction: [0, 0, 1],
          radius: 1,
          length: 10
        }]
      }]
    }
  })),
  /unsupported RVM primitive kind: frustum/
);

assert.throws(
  () => assertRvmExportModelPreflight(validExportModel({
    root: {
      children: [{
        primitives: [{
          kind: 'cylinder',
          name: 'BAD_DIRECT_CODE',
          center: [0, 0, 0],
          direction: [0, 0, 1],
          radius: 1,
          length: 10,
          rvmPrimitiveCode: 7
        }]
      }]
    }
  })),
  /direct primitive-code emission/
);

assert.throws(
  () => assertRvmExportModelPreflight(validExportModel({
    root: {
      children: [{
        primitives: [{
          kind: 'cylinder',
          name: 'BAD_ZERO_DIRECTION',
          center: [0, 0, 0],
          direction: [0, 0, 0],
          radius: 1,
          length: 10
        }]
      }]
    }
  })),
  /direction must be a non-zero vector/
);

assert.throws(
  () => assertRvmExportModelPreflight(validExportModel({
    root: {
      children: [{
        primitives: [{
          kind: 'box',
          name: 'BAD_BOX',
          center: [0, 0, 0],
          direction: [0, 0, 1],
          lengths: [10, 0, 10]
        }]
      }]
    }
  })),
  /lengths entries must be positive/
);

assert.throws(
  () => assertRvmExportModelPreflight(validExportModel({ root: { material: 999999 } })),
  /integer material id from 0 to 65535/
);

console.log('rvm-export-model-preflight ok');

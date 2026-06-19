import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { assertNavisExportModel } from '../src/navis-export-contract.js';
import {
  isNavisSafeName,
  normalizeNavisExportModelNames,
  toNavisSafeName
} from '../src/navis-safe-export-model.js';

const startedAt = performance.now();

phase('01 axis signs are expanded to safe tokens', () => {
  assert.equal(toNavisSafeName('ACTUAL_35_AXIS_RESTRAINT_+Y_STEM'), 'ACTUAL_35_AXIS_RESTRAINT_PLUS_Y_STEM');
  assert.equal(toNavisSafeName('ACTUAL_35_AXIS_RESTRAINT_-Z_HEAD'), 'ACTUAL_35_AXIS_RESTRAINT_MINUS_Z_HEAD');
  assert.equal(isNavisSafeName('ACTUAL_35_AXIS_RESTRAINT_PLUS_Y_STEM'), true);
});

phase('02 unsafe directional primitive names are normalized before contract validation', () => {
  const model = directionalSupportModel();
  assert.equal(model.root.children[1].children[0].primitives[0].name.includes('+'), true);

  const normalized = normalizeNavisExportModelNames(model);
  const primitiveNames = normalized.root.children[1].children[0].primitives.map((primitive) => primitive.name);

  assert.deepEqual(primitiveNames, [
    'ACTUAL_35_AXIS_RESTRAINT_PLUS_Y_STEM',
    'ACTUAL_35_AXIS_RESTRAINT_PLUS_Y_HEAD'
  ]);
  assert.doesNotThrow(() => assertNavisExportModel(normalized, { sourceKind: 'InputXML' }));
});

phase('03 collisions after sanitizing become unique safe names', () => {
  const model = directionalSupportModel();
  model.root.children[1].children[0].primitives.push({
    ...model.root.children[1].children[0].primitives[0],
    name: 'ACTUAL_35_AXIS_RESTRAINT_PLUS_Y_STEM'
  });

  const normalized = normalizeNavisExportModelNames(model);
  const primitiveNames = normalized.root.children[1].children[0].primitives.map((primitive) => primitive.name);

  assert.equal(new Set(primitiveNames).size, primitiveNames.length);
  assert.ok(primitiveNames.every(isNavisSafeName));
  assert.doesNotThrow(() => assertNavisExportModel(normalized, { sourceKind: 'InputXML' }));
});

console.log(`[navis-safe-export-model] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[navis-safe-export-model] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[navis-safe-export-model] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

function directionalSupportModel() {
  return {
    root: {
      name: 'INPUTXML_RVM_ROOT',
      material: 12,
      attributes: {
        TYPE: 'MODEL_ROOT',
        SOURCE: 'InputXML',
        EXPORT_FORMAT: 'RVM_ATT',
        TARGET_VIEWER: 'Navisworks'
      },
      primitives: [],
      children: [
        {
          name: 'PLANT_GEOMETRY',
          material: 12,
          attributes: { TYPE: 'GROUP', ROLE: 'PLANT_GEOMETRY' },
          primitives: [],
          children: []
        },
        {
          name: 'SUPPORTS_RESTRAINTS',
          material: 11,
          attributes: { TYPE: 'GROUP', ROLE: 'SUPPORTS_RESTRAINTS' },
          primitives: [],
          children: [
            {
              name: 'ACTUAL_35_AXIS_RESTRAINT_1',
              material: 19,
              attributes: {
                TYPE: 'SUPPORT_RESTRAINT',
                ID: 'ACTUAL_35_AXIS_RESTRAINT_1',
                NODE: '35',
                FAMILY: 'AXIS_RESTRAINT',
                AXIS: '+Y',
                TARGET_VIEWER: 'Navisworks'
              },
              primitives: [
                {
                  kind: 'cylinder',
                  name: 'ACTUAL_35_AXIS_RESTRAINT_+Y_STEM',
                  center: [0, 0, 0],
                  direction: [0, 1, 0],
                  radius: 5,
                  length: 60,
                  material: 19
                },
                {
                  kind: 'pyramid',
                  name: 'ACTUAL_35_AXIS_RESTRAINT_+Y_HEAD',
                  center: [0, 40, 0],
                  direction: [0, 1, 0],
                  bottom: [12, 12],
                  top: [1, 1],
                  offset: [0, 0],
                  height: 20,
                  material: 19
                }
              ],
              children: []
            }
          ]
        },
        {
          name: 'ANNOTATIONS',
          material: 11,
          attributes: { TYPE: 'GROUP', ROLE: 'ANNOTATIONS' },
          primitives: [],
          children: []
        }
      ]
    },
    audit: {
      primitiveCount: 2,
      targetViewer: 'Navisworks'
    }
  };
}

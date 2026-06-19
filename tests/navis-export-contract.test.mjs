import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  assertNavisExportModel,
  validateNavisExportModel,
  NavisExportContractError
} from '../src/navis-export-contract.js';

const startedAt = performance.now();

phase('01 valid Navis contract passes', () => {
  const report = assertNavisExportModel(validExportModel(), { sourceKind: 'InputXML' });
  assert.equal(report.ok, true);
  assert.equal(report.schema, 'navis-rvm-att-contract/v1');
  assert.equal(report.targetViewer, 'Navisworks Simulate');
  assert.equal(report.counts.nodes, 5);
  assert.equal(report.counts.primitives, 1);
  assert.equal(report.counts.byPrimitiveKind.cylinder, 1);
  assert.equal(report.att.sameBaseNameRequired, true);
  assert.equal(report.rvm.allTransformsFinite, true);
  assert.equal(report.rvm.allDimensionsPositive, true);
});

phase('02 duplicate ATT node names fail', () => {
  const model = validExportModel();
  model.root.children[0].children.push({
    ...clone(model.root.children[0].children[0]),
    primitives: []
  });
  const report = validateNavisExportModel(model);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((issue) => issue.message.includes('duplicate node name')));
});

phase('03 unsupported primitive kind fails before writer', () => {
  const model = validExportModel();
  model.root.children[0].children[0].primitives[0].kind = 'mesh';
  assert.throws(() => assertNavisExportModel(model), NavisExportContractError);
});

phase('04 invalid primitive dimensions fail before writer', () => {
  const model = validExportModel();
  model.root.children[0].children[0].primitives[0].length = 0;
  const report = validateNavisExportModel(model);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((issue) => issue.path.endsWith('.length')));
  assert.equal(report.rvm.allDimensionsPositive, false);
});

phase('05 audit mismatch fails', () => {
  const model = validExportModel();
  model.audit.primitiveCount = 99;
  const report = validateNavisExportModel(model);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((issue) => issue.path === '$.audit.primitiveCount'));
});

console.log(`[navis-contract] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[navis-contract] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[navis-contract] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

function validExportModel() {
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
          children: [
            {
              name: 'PIPE_10_TO_20',
              material: 12,
              attributes: {
                TYPE: 'COMPONENT',
                ID: 'PIPE_10_TO_20',
                FROM_NODE: '10',
                TO_NODE: '20',
                TARGET_VIEWER: 'Navisworks'
              },
              primitives: [
                {
                  kind: 'cylinder',
                  name: 'PIPE_10_TO_20_BODY',
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
        },
        {
          name: 'SUPPORTS_RESTRAINTS',
          material: 11,
          attributes: { TYPE: 'GROUP', ROLE: 'SUPPORTS_RESTRAINTS' },
          primitives: [],
          children: []
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
      primitiveCount: 1,
      targetViewer: 'Navisworks'
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { applyReviewStyleNodeNames } from '../src/rvm-review-node-names.js';
import { writeAtt } from '../src/att-writer.js';
import { writeRvm } from '../src/rvm-writer.js';

const startedAt = performance.now();

phase('01 stamps RHBG-style review names without changing internal node names', () => {
  const model = sampleExportModel();
  const stamped = applyReviewStyleNodeNames(model);

  assert.equal(stamped.root.name, 'INPUTXML_RVM_ROOT');
  assert.equal(stamped.root.reviewName, '/INPUTXML');
  assert.equal(stamped.root.children[0].name, 'PLANT_GEOMETRY');
  assert.equal(stamped.root.children[0].reviewName, '/INPUTXML-PI');
  assert.match(stamped.root.children[0].children[0].reviewName, /^PIPE 1 of ZONE \/INPUTXML-PI$/);
  assert.match(stamped.root.children[1].children[0].reviewName, /^GUIDE SUPPORT 1 of ZONE \/INPUTXML-SU$/);
  assert.equal(stamped.audit.reviewStyleNodeNames, true);
});

phase('02 ATT NEW blocks use the same review names as RVM CNTB chunks', () => {
  const stamped = applyReviewStyleNodeNames(sampleExportModel());
  const att = writeAtt(stamped);
  const rvmText = new TextDecoder('utf-8', { fatal: false }).decode(writeRvm(stamped));

  for (const reviewName of collectReviewNames(stamped.root)) {
    assert.ok(att.includes(`NEW ${reviewName}`), `ATT must contain NEW block for ${reviewName}`);
    assert.ok(rvmText.includes(reviewName), `RVM string table must contain CNTB name ${reviewName}`);
  }
});

console.log(`[rvm-review-node-names] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[rvm-review-node-names] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[rvm-review-node-names] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

function collectReviewNames(node) {
  const names = [node.reviewName || node.name];
  for (const child of node.children || []) names.push(...collectReviewNames(child));
  return names;
}

function sampleExportModel() {
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
              name: 'PE_001_PIPE_10_TO_20',
              material: 12,
              attributes: {
                TYPE: 'COMPONENT',
                ENGINEERING_TYPE: 'PIPE',
                ID: 'PE-001'
              },
              primitives: [{
                kind: 'cylinder',
                name: 'PE_001_BODY',
                center: [0, 0, 0],
                direction: [1, 0, 0],
                radius: 10,
                length: 100,
                material: 12
              }],
              children: []
            }
          ]
        },
        {
          name: 'SUPPORTS_RESTRAINTS',
          material: 11,
          attributes: { TYPE: 'GROUP', ROLE: 'SUPPORTS_RESTRAINTS' },
          primitives: [],
          children: [
            {
              name: 'EXPECTED_20_GUIDE_1',
              material: 17,
              attributes: {
                TYPE: 'SUPPORT_RESTRAINT',
                FAMILY: 'GUIDE',
                NODE: '20'
              },
              primitives: [{
                kind: 'box',
                name: 'EXPECTED_20_GUIDE_BOX',
                center: [0, 0, 0],
                direction: [0, 0, 1],
                lengths: [10, 10, 10],
                material: 17
              }],
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
    audit: { primitiveCount: 2, targetViewer: 'Navisworks' }
  };
}

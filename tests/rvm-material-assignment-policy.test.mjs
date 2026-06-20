import assert from 'node:assert/strict';

import {
  RVM_MATERIAL_ASSIGNMENT_POLICY_SCHEMA,
  RVM_STABLE_MATERIAL_IDS,
  assertRvmMaterialAssignmentPolicy,
  classifyRvmNodeMaterial,
  supportFamilyMaterialId
} from '../src/rvm-material-assignment-policy.js';

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    material: RVM_STABLE_MATERIAL_IDS.PIPE,
    attributes: { TYPE: 'MODEL_ROOT' },
    primitives: [],
    children: [
      {
        name: 'PLANT_GEOMETRY',
        material: RVM_STABLE_MATERIAL_IDS.PIPE,
        attributes: { TYPE: 'GROUP', ROLE: 'PLANT_GEOMETRY' },
        primitives: [],
        children: [
          component('PIPE_A', 'PIPE', RVM_STABLE_MATERIAL_IDS.PIPE),
          component('BEND_A', 'BEND', RVM_STABLE_MATERIAL_IDS.BEND),
          component('VALVE_A', 'VALVE_FLANGED', RVM_STABLE_MATERIAL_IDS.RIGID_COMPONENT)
        ]
      },
      {
        name: 'SUPPORTS_RESTRAINTS',
        material: RVM_STABLE_MATERIAL_IDS.WARNING,
        attributes: { TYPE: 'GROUP', ROLE: 'SUPPORTS_RESTRAINTS' },
        primitives: [],
        children: [
          support('GUIDE_A', 'GUIDE', RVM_STABLE_MATERIAL_IDS.GUIDE),
          support('REST_A', 'REST', RVM_STABLE_MATERIAL_IDS.REST),
          support('STOP_A', 'LINE_STOP', RVM_STABLE_MATERIAL_IDS.LINE_STOP),
          support('UNKNOWN_A', 'UNKNOWN_RESTRAINT', RVM_STABLE_MATERIAL_IDS.WARNING)
        ]
      },
      {
        name: 'ANNOTATIONS',
        material: RVM_STABLE_MATERIAL_IDS.WARNING,
        attributes: { TYPE: 'GROUP', ROLE: 'ANNOTATIONS' },
        primitives: [],
        children: [
          {
            name: 'NODE_LABEL_10',
            material: RVM_STABLE_MATERIAL_IDS.WARNING,
            attributes: { TYPE: 'NODE' },
            primitives: [{ kind: 'sphere', material: RVM_STABLE_MATERIAL_IDS.WARNING }],
            children: []
          }
        ]
      }
    ]
  }
};

const audit = assertRvmMaterialAssignmentPolicy(exportModel);
assert.equal(audit.schema, RVM_MATERIAL_ASSIGNMENT_POLICY_SCHEMA);
assert.equal(audit.failClosed, true);
assert.equal(audit.cntbMaterialIdsStableByFamily, true);
assert.equal(audit.defaultMaterialFallbackAllowedForNodes, false);
assert.deepEqual(audit.materialIds, [
  RVM_STABLE_MATERIAL_IDS.BEND,
  RVM_STABLE_MATERIAL_IDS.WARNING,
  RVM_STABLE_MATERIAL_IDS.PIPE,
  RVM_STABLE_MATERIAL_IDS.GUIDE,
  RVM_STABLE_MATERIAL_IDS.LINE_STOP,
  RVM_STABLE_MATERIAL_IDS.RIGID_COMPONENT
].sort((a, b) => a - b));
assert.equal(audit.familyCounts.PIPE, 1);
assert.equal(audit.familyCounts.BEND, 1);
assert.equal(audit.familyCounts.RIGID_COMPONENT, 1);
assert.equal(audit.familyCounts.SUPPORT_GUIDE, 1);
assert.equal(audit.familyCounts.SUPPORT_UNKNOWN_RESTRAINT, 1);

assert.equal(classifyRvmNodeMaterial(component('CHECK_VALVE', 'VALVE_CHECK', RVM_STABLE_MATERIAL_IDS.RIGID_COMPONENT)).expectedMaterialId, RVM_STABLE_MATERIAL_IDS.RIGID_COMPONENT);
assert.equal(classifyRvmNodeMaterial(component('PIPE', 'PIPE', RVM_STABLE_MATERIAL_IDS.PIPE)).expectedMaterialId, RVM_STABLE_MATERIAL_IDS.PIPE);
assert.equal(supportFamilyMaterialId('LIMIT_STOP'), RVM_STABLE_MATERIAL_IDS.LINE_STOP);
assert.equal(supportFamilyMaterialId('BOGUS'), RVM_STABLE_MATERIAL_IDS.WARNING);

assert.throws(
  () => assertRvmMaterialAssignmentPolicy({ root: { name: 'ROOT', attributes: { TYPE: 'MODEL_ROOT' }, primitives: [], children: [] } }),
  /requires explicit CNTB material ids/
);

assert.throws(
  () => assertRvmMaterialAssignmentPolicy({ root: support('BAD_GUIDE', 'GUIDE', RVM_STABLE_MATERIAL_IDS.PIPE) }),
  /RVM material assignment mismatch/
);

console.log('rvm-material-assignment-policy: ok');

function component(name, engineeringType, material) {
  return {
    name,
    material,
    attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: engineeringType },
    primitives: [{ kind: 'cylinder', material }],
    children: []
  };
}

function support(name, family, material) {
  return {
    name,
    material,
    attributes: { TYPE: 'SUPPORT_RESTRAINT', FAMILY: family },
    primitives: [{ kind: 'box', material }],
    children: []
  };
}

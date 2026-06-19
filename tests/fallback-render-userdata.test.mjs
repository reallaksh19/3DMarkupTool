import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  createLegacyFallbackUserData,
  isContractStampedFallback,
  stampLegacyFallbackSceneUserData,
  stampLegacyFallbackUserData
} from '../src/fallback-render-userdata.js';

const startedAt = performance.now();

phase('01 creates stable fallback metadata required by RenderInstruction userData', () => {
  const userData = createLegacyFallbackUserData(
    {
      componentId: 'PE 001 PIPE',
      componentClass: 'PIPE',
      sourceType: 'InputXML',
      sourceId: 'RAW-001',
      fallbackReason: 'legacy InputXML direct element renderer retained as fallback'
    },
    { TYPE: 'COMPONENT', meshRole: 'PIPE' }
  );

  assert.equal(userData.objectRole, 'component-render');
  assert.equal(userData.componentId, 'PE_001_PIPE');
  assert.equal(userData.componentClass, 'PIPE');
  assert.deepEqual(userData.sourceRef, { sourceType: 'INPUTXML', sourceId: 'RAW-001' });
  assert.equal(userData.geometryContractId, 'GC_FALLBACK_LEGACY_PE_001_PIPE');
  assert.equal(userData.renderRecipeId, 'fallback-legacy.v1');
  assert.equal(userData.fallbackRendered, true);
  assert.match(userData.fallbackReason, /legacy InputXML/i);
  assert.equal(userData.TYPE, 'COMPONENT');
  assert.equal(userData.meshRole, 'PIPE');
});

phase('02 unknown remains UNKNOWN in fallback metadata', () => {
  const userData = createLegacyFallbackUserData({ componentId: 'X-01', rawType: 'unknown raw source' });
  assert.equal(userData.componentClass, 'UNKNOWN');
  assert.equal(userData.fallbackRendered, true);
});

phase('03 recursively stamps group and child meshes without changing visual fields', () => {
  const childA = { name: 'child-a', userData: { meshRole: 'GUIDE_ARROW' } };
  const childB = { name: 'child-b', userData: {} };
  const group = {
    name: 'guide-group',
    userData: { TYPE: 'SUPPORT_RESTRAINT', family: 'GUIDE' },
    traverse(callback) {
      callback(this);
      callback(childA);
      callback(childB);
    }
  };

  stampLegacyFallbackUserData(group, {
    componentId: 'SUPPORT_NODE_30_GUIDE',
    componentClass: 'RESTRAINT',
    sourceType: 'InputXML',
    sourceId: 'SUPPORT-30-GUIDE'
  });

  for (const object of [group, childA, childB]) {
    assert.equal(isContractStampedFallback(object), true, `${object.name} should be stamped as explicit fallback`);
    assert.equal(object.userData.componentId, 'SUPPORT_NODE_30_GUIDE');
    assert.equal(object.userData.componentClass, 'RESTRAINT');
    assert.equal(object.userData.geometryContractId, 'GC_FALLBACK_LEGACY_SUPPORT_NODE_30_GUIDE');
  }
  assert.equal(group.userData.family, 'GUIDE');
  assert.equal(childA.userData.meshRole, 'GUIDE_ARROW');
});

phase('04 stamps scene children while preserving component and support identities', () => {
  const pipeMesh = {
    type: 'Mesh',
    isMesh: true,
    name: 'PIPE_MESH',
    userData: { TYPE: 'COMPONENT', ID: 'PIPE-10', engineeringType: 'PIPE', meshRole: 'PIPE' },
    children: []
  };
  const supportArrow = {
    type: 'Mesh',
    isMesh: true,
    name: 'guide-arrow',
    userData: { meshRole: 'GUIDE_ARROW' },
    children: []
  };
  const supportGroup = {
    type: 'Group',
    isGroup: true,
    name: 'ACTUAL_20_GUIDE',
    userData: { TYPE: 'SUPPORT_RESTRAINT', node: '20', family: 'GUIDE', source: 'InputXML' },
    children: [supportArrow]
  };
  const scene = {
    type: 'Scene',
    name: 'legacy-scene',
    userData: { app: 'inputxml-glb-standalone' },
    children: [pipeMesh, supportGroup]
  };

  stampLegacyFallbackSceneUserData(scene, { sourceType: 'InputXML' });

  assert.equal(scene.userData.fallbackRendered, undefined, 'scene root is not a rendered mesh/group by default');
  assert.equal(isContractStampedFallback(pipeMesh), true);
  assert.equal(pipeMesh.userData.componentId, 'PIPE-10');
  assert.equal(pipeMesh.userData.componentClass, 'PIPE');
  assert.equal(pipeMesh.userData.meshRole, 'PIPE');

  assert.equal(isContractStampedFallback(supportGroup), true);
  assert.equal(supportGroup.userData.componentId, 'SUPPORT_20_GUIDE');
  assert.equal(supportGroup.userData.componentClass, 'RESTRAINT');
  assert.equal(supportGroup.userData.family, 'GUIDE');

  assert.equal(isContractStampedFallback(supportArrow), true);
  assert.equal(supportArrow.userData.componentId, 'SUPPORT_20_GUIDE');
  assert.equal(supportArrow.userData.componentClass, 'RESTRAINT');
  assert.equal(supportArrow.userData.meshRole, 'GUIDE_ARROW');
});

console.log(`[fallback-userdata] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[fallback-userdata] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[fallback-userdata] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

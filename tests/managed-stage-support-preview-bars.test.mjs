import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createManagedStageSupportPreviewObject,
  MANAGED_STAGE_SUPPORT_VISUAL_POLICY
} from '../src/managed-stage-support-visual-resolver.js';

function record(name, type, attrs, source) {
  return {
    name,
    rawName: name,
    type,
    dtxr: attrs.DTXR || type,
    attrs,
    fromNode: attrs.FROM_NODE || attrs.NODE || '',
    toNode: attrs.TO_NODE || attrs.NODE || '',
    source
  };
}

const pipe = record('PIPE_10_20', 'PIPE', {
  FROM_NODE: '10',
  TO_NODE: '20',
  DIAMETER: '114.3mm'
}, {
  apos: { x: 0, y: 0, z: 0 },
  lpos: { x: 0, y: 0, z: 1000 }
});

const rest = record('INPUTXML-10-REST', 'ATTA', {
  NODE: '10',
  SUPPORT_KIND: 'REST',
  DIAMETER: '114.3mm'
}, {
  supportCoord: { x: 0, y: 0, z: 0 }
});

const lineStop = record('INPUTXML-10-LINESTOP', 'ATTA', {
  NODE: '10',
  SUPPORT_KIND: 'LINESTOP',
  DIAMETER: '114.3mm'
}, {
  supportCoord: { x: 0, y: 0, z: 0 }
});

function collectMeshes(object) {
  const meshes = [];
  object.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  return meshes;
}

function assertNoConeGeometry(object) {
  for (const mesh of collectMeshes(object)) {
    assert.notEqual(mesh.geometry?.type, 'ConeGeometry', `${mesh.name} must not use ConeGeometry`);
    assert.notEqual(mesh.userData?.supportDirectionalCone, true, `${mesh.name} must not be stamped as a cone`);
  }
}

function assertCompact(object, maxDimensionMm) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(size.x <= maxDimensionMm, `x extent ${size.x} should be compact`);
  assert.ok(size.y <= maxDimensionMm, `y extent ${size.y} should be compact`);
  assert.ok(size.z <= maxDimensionMm, `z extent ${size.z} should be compact`);
}

assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.previewGeometry, 'compact-code8-equivalent-cylinder-bars-no-cones');
assert.ok(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.blockedPreviewGeometry.includes('ConeGeometry'));

const restPreview = createManagedStageSupportPreviewObject(rest, { records: [pipe, rest], pointRadius: 10 });
assert.ok(restPreview?.object, 'REST support preview should create an object');
assert.equal(restPreview.object.userData.supportPreviewNoCone, true);
assert.equal(restPreview.object.userData.supportVisualGeometry, 'compact-cylinder-bars-no-cones');
assertNoConeGeometry(restPreview.object);
assert.ok(collectMeshes(restPreview.object).some((mesh) => mesh.geometry?.type === 'CylinderGeometry'), 'REST preview should use cylinder bars');
assertCompact(restPreview.object, 80);

const lineStopPreview = createManagedStageSupportPreviewObject(lineStop, { records: [pipe, lineStop], pointRadius: 10 });
assert.ok(lineStopPreview?.object, 'LINESTOP support preview should create an object');
assertNoConeGeometry(lineStopPreview.object);
assert.ok(collectMeshes(lineStopPreview.object).length >= 4, 'LINESTOP pair should produce compact stem/tick bar meshes');
assertCompact(lineStopPreview.object, 120);

console.log('managed-stage support preview bars: ok');

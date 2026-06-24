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

function coneMeshes(object) {
  return collectMeshes(object).filter((mesh) => mesh.geometry?.type === 'ConeGeometry');
}

assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.previewGeometry, 'cone-and-can-support-glyphs');
assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.supportConeCatalogue, true);
assert.ok(!MANAGED_STAGE_SUPPORT_VISUAL_POLICY.blockedPreviewGeometry.includes('ConeGeometry'));

const restPreview = createManagedStageSupportPreviewObject(rest, { records: [pipe, rest], pointRadius: 10 });
assert.ok(restPreview?.object, 'REST support preview should create an object');
assert.equal(restPreview.object.userData.supportPreviewNoCone, false);
assert.equal(restPreview.object.userData.supportPreviewUsesConeCatalogue, true);
assert.equal(restPreview.object.userData.supportVisualGeometry, 'cone-and-can-support-glyphs');
assert.equal(coneMeshes(restPreview.object).length, 1, 'REST preview should use one upward cone');
const restCone = coneMeshes(restPreview.object)[0];
assert.equal(restCone.userData.supportDirectionalCone, true);
assert.equal(restCone.userData.axis, '+Y');
assert.equal(restCone.userData.supportPrimitiveBudgetUnitCount, 1);
assert.ok(restCone.userData.tipMm.y < 0, 'REST cone tip should be shifted to pipe underside by OD/2');

const lineStopPreview = createManagedStageSupportPreviewObject(lineStop, { records: [pipe, lineStop], pointRadius: 10 });
assert.ok(lineStopPreview?.object, 'LINESTOP support preview should create an object');
assert.equal(coneMeshes(lineStopPreview.object).length, 2, 'LINESTOP pair should produce two axial cones');
assert.ok(coneMeshes(lineStopPreview.object).every((mesh) => mesh.userData.axialPipeParallel === true));
assert.ok(coneMeshes(lineStopPreview.object).every((mesh) => mesh.userData.odTwoThirdsResolverApplied === true));
assert.ok(coneMeshes(lineStopPreview.object).every((mesh) => Math.abs(mesh.userData.tipMm.x) <= 0.001), 'ungapped axial tips remain centered along pipe axis');

console.log('managed-stage support preview cone/can catalogue: ok');

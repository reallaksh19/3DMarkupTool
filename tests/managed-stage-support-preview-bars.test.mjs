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

const mappedZLineStop = record('INPUTXML-10-LINESTOP-Z', 'ATTA', {
  NODE: '10',
  SUPPORT_KIND: 'LINESTOP',
  SUPPORT_AXIS_SOURCE_ORIGINAL: 'Z',
  SUPPORT_AXIS_CANVAS: '+Z',
  SUPPORT_AXIS_CANVAS_APPLIED: 'TRUE',
  AXIS: '+Z',
  DIAMETER: '114.3mm'
}, {
  supportCoord: { x: 0, y: 0, z: 0 }
});

const mappedMinusXLineStop = record('INPUTXML-10-LINESTOP-MINUS-X', 'ATTA', {
  NODE: '10',
  SUPPORT_KIND: 'LINESTOP',
  SUPPORT_AXIS_SOURCE_ORIGINAL: '-X',
  SUPPORT_AXIS_CANVAS: '-X',
  SUPPORT_AXIS_CANVAS_APPLIED: 'TRUE',
  AXIS: '-X',
  DIAMETER: '114.3mm'
}, {
  supportCoord: { x: 0, y: 0, z: 0 }
});

const guideWithMappedX = record('INPUTXML-10-GUIDE-X', 'ATTA', {
  NODE: '10',
  SUPPORT_KIND: 'GUIDE',
  SUPPORT_AXIS_SOURCE_ORIGINAL: 'X',
  SUPPORT_AXIS_CANVAS: '+X',
  SUPPORT_AXIS_CANVAS_APPLIED: 'TRUE',
  AXIS: '+X',
  DIAMETER: '114.3mm'
}, {
  supportCoord: { x: 0, y: 0, z: 0 }
});

const springCan = record('INPUTXML-10-SPRING-CAN', 'ATTA', {
  NODE: '10',
  SUPPORT_KIND: 'SPRING CAN',
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

function torusMeshes(object) {
  return collectMeshes(object).filter((mesh) => mesh.geometry?.type === 'TorusGeometry');
}

function assertSupportOverlayRaycastDisabled(object) {
  object.traverse((child) => {
    assert.equal(child.userData.supportPreviewRaycastDisabled, true, `${child.name || child.type} must be non-raycast support preview overlay`);
    const hits = [];
    child.raycast?.({}, hits);
    assert.equal(hits.length, 0, `${child.name || child.type} raycast must not add hits`);
  });
}

assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.previewGeometry, 'cone-and-can-support-glyphs');
assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.supportConeCatalogue, true);
assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.generalizedAxisTransform, true);
assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.discCapsRemoved, true);
assert.equal(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.supportPreviewRaycastDisabled, true);
assert.match(MANAGED_STAGE_SUPPORT_VISUAL_POLICY.ringArtifactPolicy, /torus geometry is allowed only for the five SPRING_CAN coils/i);
assert.ok(!MANAGED_STAGE_SUPPORT_VISUAL_POLICY.blockedPreviewGeometry.includes('ConeGeometry'));

const restPreview = createManagedStageSupportPreviewObject(rest, { records: [pipe, rest], pointRadius: 10 });
assert.ok(restPreview?.object, 'REST support preview should create an object');
assert.equal(restPreview.object.userData.supportPreviewNoCone, false);
assert.equal(restPreview.object.userData.supportPreviewUsesConeCatalogue, true);
assert.equal(restPreview.object.userData.supportVisualGeometry, 'cone-and-can-support-glyphs');
assert.equal(restPreview.object.userData.discCapsRemoved, true);
assert.equal(coneMeshes(restPreview.object).length, 1, 'REST preview should use one upward cone');
assert.equal(torusMeshes(restPreview.object).length, 0, 'REST preview must not use torus/ring geometry');
assertSupportOverlayRaycastDisabled(restPreview.object);
const restCone = coneMeshes(restPreview.object)[0];
assert.equal(restCone.geometry.parameters.openEnded, true, 'REST cone must be open-ended with no cap disc');
assert.equal(restCone.geometry.parameters.radialSegments, 8, 'REST cone must avoid high-segment annular rim artifacts');
assert.equal(restCone.userData.supportDirectionalCone, true);
assert.equal(restCone.userData.axis, '+Y');
assert.equal(restCone.userData.supportPrimitiveBudgetUnitCount, 1);
assert.equal(restCone.userData.supportConeDiscCapsRemoved, true);
assert.ok(restCone.userData.tipMm.y < 0, 'REST cone tip should be shifted to pipe underside by OD/2');

const lineStopPreview = createManagedStageSupportPreviewObject(lineStop, { records: [pipe, lineStop], pointRadius: 10 });
assert.ok(lineStopPreview?.object, 'LINESTOP support preview should create an object');
assert.equal(coneMeshes(lineStopPreview.object).length, 2, 'LINESTOP without an explicit axis should produce an unsigned axial cone pair');
assert.equal(torusMeshes(lineStopPreview.object).length, 0, 'LINESTOP preview must not use torus/ring geometry');
assert.ok(coneMeshes(lineStopPreview.object).every((mesh) => mesh.geometry.parameters.openEnded === true));
assert.ok(coneMeshes(lineStopPreview.object).every((mesh) => mesh.userData.axialPipeParallel === true));
assert.ok(coneMeshes(lineStopPreview.object).every((mesh) => mesh.userData.odTwoThirdsResolverApplied === true));
assert.ok(coneMeshes(lineStopPreview.object).every((mesh) => Math.abs(mesh.userData.tipMm.x) <= 0.001), 'ungapped axial tips remain centered along pipe axis');

const zPreview = createManagedStageSupportPreviewObject(mappedZLineStop, { records: [pipe, mappedZLineStop], pointRadius: 10 });
assert.equal(zPreview.supportVisual.family, 'LINE_STOP');
assert.equal(zPreview.supportVisual.canvasAxis, '+Z');
assert.equal(zPreview.supportVisual.axisTransformApplied, true);
assert.equal(coneMeshes(zPreview.object).length, 1, 'mapped +Z LINESTOP should render one transformed-axis cone, not GUIDE pair');
assert.equal(coneMeshes(zPreview.object)[0].userData.axis, '+Z');
assert.equal(coneMeshes(zPreview.object)[0].userData.axisTransformApplied, true);

const minusXPreview = createManagedStageSupportPreviewObject(mappedMinusXLineStop, { records: [pipe, mappedMinusXLineStop], pointRadius: 10 });
assert.equal(coneMeshes(minusXPreview.object).length, 1, 'mapped -X LINESTOP should render one transformed-axis cone');
assert.equal(coneMeshes(minusXPreview.object)[0].userData.axis, '-X');

const guidePreview = createManagedStageSupportPreviewObject(guideWithMappedX, { records: [pipe, guideWithMappedX], pointRadius: 10 });
assert.equal(guidePreview.supportVisual.family, 'GUIDE');
assert.equal(guidePreview.supportVisual.canvasAxis, '+X');
assert.equal(coneMeshes(guidePreview.object).length, 1, 'GUIDE with an explicit transformed +X axis should render that axis, not a Z-only special case');
assert.equal(coneMeshes(guidePreview.object)[0].userData.axis, '+X');
assert.equal(torusMeshes(guidePreview.object).length, 0, 'GUIDE preview must not use torus/ring geometry');

const springPreview = createManagedStageSupportPreviewObject(springCan, { records: [pipe, springCan], pointRadius: 10 });
assert.equal(springPreview.supportVisual.previewGlyphGeometry, 'five-coil-spring-can');
assert.equal(springPreview.supportVisual.springCoilCount, 5);
assert.equal(torusMeshes(springPreview.object).length, 5, 'SPRING CAN should render as five stacked coils');
assertSupportOverlayRaycastDisabled(springPreview.object);

console.log('managed-stage support preview cone/can catalogue: ok');

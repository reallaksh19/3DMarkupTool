import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cleanupManagedStageSupportPreview, MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_CACHE_KEY } from '../src/managed-stage-support-ui-visual-cleanup.js';

const root = new THREE.Group();
root.name = 'SUPPORT_CLEANUP_TEST_ROOT';
root.userData = { managedStageSupportVisual: true };

const closedCone = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 24, 1, false), new THREE.MeshBasicMaterial());
closedCone.name = 'CLOSED_SUPPORT_CONE';
closedCone.userData = { managedStageSupportVisualPart: true, supportDirectionalCone: true, supportVisualGeometry: 'cone-and-can-support-glyphs' };
root.add(closedCone);

const closedCylinder = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 24, 1, false), new THREE.MeshBasicMaterial());
closedCylinder.name = 'CLOSED_SUPPORT_CAN_BODY';
closedCylinder.userData = { managedStageSupportVisualPart: true, supportCanCylinder: true, supportVisualGeometry: 'cone-and-can-support-glyphs' };
root.add(closedCylinder);

const springCoil = new THREE.Mesh(new THREE.TorusGeometry(2, 0.2, 8, 32), new THREE.MeshBasicMaterial());
springCoil.name = 'SPRING_COIL_ALLOWED_RING';
springCoil.userData = { managedStageSupportVisualPart: true, supportSpringCanCoil: true, supportVisualGeometry: 'cone-and-can-support-glyphs' };
root.add(springCoil);

assert.equal(closedCone.geometry.parameters.openEnded, false, 'test cone starts with a rendered base cap');
assert.equal(closedCylinder.geometry.type, 'CylinderGeometry', 'test cylinder starts as round geometry');

const result = cleanupManagedStageSupportPreview(root, { reason: 'unit-test' });

assert.equal(result.cacheKey, MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_CACHE_KEY);
assert.equal(result.status, 'applied');
assert.equal(result.supportRootCount, 1);
assert.equal(result.supportPartCount, 3);
assert.equal(result.coneFacetedOpenReplacedCount, 1, 'support cone circular base/rim must be removed');
assert.equal(result.cylinderBoxPrismReplacedCount, 1, 'support round cylinder rims must be replaced with a box prism');
assert.equal(result.ringArtifactRemovedCount, 2, 'all non-spring preview ring-artifact sources must be removed');

assert.equal(closedCone.geometry.parameters.openEnded, true, 'support cone must become open-ended');
assert.equal(closedCone.geometry.parameters.radialSegments, 6, 'support cone must become low-facet/ringless, not a circular rim');
assert.equal(closedCone.userData.supportConeAnnularRimRemoved, true);
assert.equal(closedCone.userData.supportRingArtifactRemoved, true);
assert.equal(closedCylinder.geometry.type, 'BoxGeometry', 'support round cylinder must be converted to non-circular prism geometry');
assert.equal(closedCylinder.userData.supportCylinderReplacedByBoxPrism, true);
assert.equal(closedCylinder.userData.supportRingArtifactRemoved, true);
assert.equal(springCoil.geometry.type, 'TorusGeometry', 'real Spring Can coils must remain visible rings/coils');
assert.equal(typeof closedCone.raycast, 'function');
assert.equal(closedCone.userData.supportPreviewPickingDisabled, true);
assert.equal(closedCylinder.userData.supportPreviewPickingDisabled, true);
assert.equal(springCoil.userData.supportPreviewPickingDisabled, true);

console.log('managed-stage support UI visual cleanup ringless regression passed');

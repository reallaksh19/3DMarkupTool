import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cleanupManagedStageSupportPreview, MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_CACHE_KEY } from '../src/managed-stage-support-ui-visual-cleanup.js';

const root = new THREE.Group();
root.name = 'SUPPORT_CLEANUP_TEST_ROOT';
root.userData = { managedStageSupportVisual: true };

const closedCone = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 24, 1, false), new THREE.MeshBasicMaterial());
closedCone.name = 'CLOSED_SUPPORT_CONE';
closedCone.userData = {
  managedStageSupportVisualPart: true,
  supportDirectionalCone: true,
  supportVisualGeometry: 'cone-and-can-support-glyphs'
};
root.add(closedCone);

const closedCylinder = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 24, 1, false), new THREE.MeshBasicMaterial());
closedCylinder.name = 'CLOSED_SUPPORT_CAN_BODY';
closedCylinder.userData = {
  managedStageSupportVisualPart: true,
  supportSpringCanCylinder: true,
  supportVisualGeometry: 'cone-and-can-support-glyphs'
};
root.add(closedCylinder);

assert.equal(closedCone.geometry.parameters.openEnded, false, 'test cone starts with a rendered base cap');
assert.equal(closedCylinder.geometry.parameters.openEnded, false, 'test cylinder starts with rendered end caps');

const result = cleanupManagedStageSupportPreview(root, { reason: 'unit-test' });

assert.equal(result.cacheKey, MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_CACHE_KEY);
assert.equal(result.status, 'applied');
assert.equal(result.supportRootCount, 1);
assert.equal(result.supportPartCount, 2);
assert.equal(result.coneOpenEndedReplacedCount, 1, 'support cone base cap must be removed');
assert.equal(result.cappedCylinderOpenEndedReplacedCount, 1, 'support cylinder end caps must be removed');
assert.equal(result.discCapRemovedCount, 2, 'all preview disc-cap sources must be removed');

assert.equal(closedCone.geometry.parameters.openEnded, true, 'support cone must become open-ended');
assert.equal(closedCone.userData.supportConeBaseCapRemoved, true);
assert.equal(closedCone.userData.supportWhiteDiscCapRemoved, true);
assert.equal(closedCylinder.geometry.parameters.openEnded, true, 'support cylinder must become open-ended');
assert.equal(closedCylinder.userData.supportCylinderCapRemoved, true);
assert.equal(closedCylinder.userData.supportWhiteDiscCapRemoved, true);
assert.equal(typeof closedCone.raycast, 'function');
assert.equal(closedCone.userData.supportPreviewPickingDisabled, true);
assert.equal(closedCylinder.userData.supportPreviewPickingDisabled, true);

console.log('managed-stage support UI visual cleanup regression passed');

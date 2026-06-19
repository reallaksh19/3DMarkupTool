import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hideCatalogReplacedBaseCylinders } from '../src/valve-flange-scene-postprocess.js';

function componentMesh(name, userData = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.5, 16), new THREE.MeshBasicMaterial());
  mesh.name = name;
  mesh.userData = userData;
  return mesh;
}

function visualMesh(role, position, geometry = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16)) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = `flanged_${role}`;
  mesh.position.copy(position);
  mesh.userData = {
    TYPE: 'COMPONENT',
    ID: 'PE_007_FLANGED_VALVE_83_TO_86',
    id: 'PE_007_FLANGED_VALVE_83_TO_86',
    meshRole: role,
    componentClass: 'VALVE',
    componentType: 'VALVE_FLANGED',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1',
    radius: 0.75,
    length: 0.8
  };
  return mesh;
}

function run() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  plant.name = 'plant.geometry';
  scene.add(plant);

  const adjacentPipe = componentMesh('PE_006_PIPE_80_TO_83', {
    TYPE: 'COMPONENT',
    ID: 'PE_006_PIPE_80_TO_83',
    id: 'PE_006_PIPE_80_TO_83',
    meshRole: 'PIPE'
  });
  const legacyBase = componentMesh('PE_007_FLANGED_VALVE_83_TO_86', {
    TYPE: 'COMPONENT',
    ID: 'PE_007_FLANGED_VALVE_83_TO_86',
    id: 'PE_007_FLANGED_VALVE_83_TO_86',
    meshRole: 'Flanged Valve',
    engineeringType: 'FLANGED_VALVE'
  });

  const visualGroup = new THREE.Group();
  visualGroup.name = 'PE_007_FLANGED_VALVE_83_TO_86_flanged-valve';
  visualGroup.userData = {
    TYPE: 'COMPONENT',
    ID: 'PE_007_FLANGED_VALVE_83_TO_86',
    id: 'PE_007_FLANGED_VALVE_83_TO_86',
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'VALVE',
    componentType: 'VALVE_FLANGED',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1'
  };
  const oldBody = visualMesh('VALVE_BODY', new THREE.Vector3(0, 0, 0));
  const collarA = visualMesh('END_COLLAR_A', new THREE.Vector3(-1.9, 0, 0));
  const collarB = visualMesh('END_COLLAR_B', new THREE.Vector3(1.9, 0, 0));
  const oldStem = visualMesh('BONNET_STEM', new THREE.Vector3(0, 0, 1.1));
  const oldWheel = visualMesh('HANDWHEEL', new THREE.Vector3(0, 0, 1.8), new THREE.TorusGeometry(0.35, 0.04, 8, 16));
  visualGroup.add(oldBody, collarA, collarB, oldStem, oldWheel);

  plant.add(adjacentPipe, legacyBase, visualGroup);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 1, 'same-component legacy base cylinder must be hidden');
  assert.equal(stats.uprightValveCorrections, 1, 'flanged valve must get an upright visual correction');
  assert.equal(legacyBase.visible, false);
  assert.equal(adjacentPipe.visible, true);
  assert.equal(oldBody.visible, false, 'horizontal barrel body should be replaced');
  assert.equal(oldStem.visible, false, 'sideways stem should be replaced');
  assert.equal(oldWheel.visible, false, 'sideways handwheel should be replaced');

  const uprightBody = visualGroup.children.find((child) => child.userData?.meshRole === 'VALVE_BODY' && child.userData?.uprightValveCorrection);
  const uprightStem = visualGroup.children.find((child) => child.userData?.meshRole === 'BONNET_STEM' && child.userData?.uprightValveCorrection);
  const uprightWheel = visualGroup.children.find((child) => child.userData?.meshRole === 'HANDWHEEL' && child.userData?.uprightValveCorrection);
  assert.ok(uprightBody, 'replacement round valve body should be present');
  assert.ok(uprightStem, 'upright bonnet stem should be present');
  assert.ok(uprightWheel, 'upright handwheel should be present');
  assert.ok(uprightStem.position.y > uprightBody.position.y, 'bonnet stem should rise in world-up direction, not lie sideways');
  assert.ok(uprightWheel.position.y > uprightStem.position.y, 'handwheel should sit above the bonnet stem');

  console.log('Flanged valve upright visual correction gate passed');
}

run();

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
  const catalogBody = visualMesh('VALVE_BODY', new THREE.Vector3(0, 0, 0));
  const collarA = visualMesh('END_COLLAR_A', new THREE.Vector3(-1.9, 0, 0));
  const collarB = visualMesh('END_COLLAR_B', new THREE.Vector3(1.9, 0, 0));
  const stem = visualMesh('BONNET_STEM', new THREE.Vector3(0, 0, 1.1));
  const wheel = visualMesh('HANDWHEEL', new THREE.Vector3(0, 0, 1.8), new THREE.TorusGeometry(0.35, 0.04, 8, 16));
  visualGroup.add(catalogBody, collarA, collarB, stem, wheel);
  const initialChildren = [...visualGroup.children];

  plant.add(adjacentPipe, legacyBase, visualGroup);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 1, 'same-component legacy base cylinder must be hidden');
  assert.equal(stats.uprightValveCorrections, 0, 'postprocess must not duplicate or replace catalogue valve geometry');
  assert.equal(stats.decorativeGeometryAdded, 0);
  assert.equal(legacyBase.visible, false);
  assert.equal(adjacentPipe.visible, true);

  for (const child of initialChildren) {
    assert.equal(child.visible, true, `${child.userData.meshRole} should remain catalogue-owned and visible`);
  }
  assert.equal(visualGroup.children.length, initialChildren.length, 'postprocess must not add replacement body/stem/handwheel meshes');
  assert.equal(visualGroup.children.some((child) => child.userData?.uprightValveCorrection), false, 'no postprocess correction meshes should be present');
  assert.equal(visualGroup.children.some((child) => /UPRIGHT/i.test(child.name)), false, 'no duplicate upright mesh names should be created');

  console.log('Flanged valve non-decorating postprocess gate passed');
}

run();

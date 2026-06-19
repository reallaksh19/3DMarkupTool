import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hideCatalogReplacedBaseCylinders } from '../src/valve-flange-scene-postprocess.js';

function componentMesh(id, meshRole = 'PIPE', engineeringType = 'PIPE') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 16), new THREE.MeshBasicMaterial());
  mesh.name = id;
  mesh.userData = { TYPE: 'COMPONENT', ID: id, id, meshRole, engineeringType };
  return mesh;
}

function visualMesh(id, role, componentClass, componentType, position, geometry = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 16)) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = `${id}_${role}`;
  mesh.position.copy(position);
  mesh.userData = {
    TYPE: 'COMPONENT',
    ID: id,
    id,
    meshRole: role,
    componentClass,
    componentType,
    visualCatalogSchema: 'valve-flange-visual-catalog/v1',
    radius: 0.7,
    length: 1.2
  };
  return mesh;
}

function valveGroup(id, componentType, collarA, collarB, oldOperatorRole = 'HANDWHEEL') {
  const group = new THREE.Group();
  group.name = `${id}_${componentType}`;
  group.userData = {
    TYPE: 'COMPONENT',
    ID: id,
    id,
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'VALVE',
    componentType,
    visualCatalogSchema: 'valve-flange-visual-catalog/v1'
  };
  group.add(
    visualMesh(id, 'VALVE_BODY', 'VALVE', componentType, new THREE.Vector3(0, 0, 0)),
    visualMesh(id, 'END_COLLAR_A', 'VALVE', componentType, collarA),
    visualMesh(id, 'END_COLLAR_B', 'VALVE', componentType, collarB),
    visualMesh(id, 'BONNET_STEM', 'VALVE', componentType, new THREE.Vector3(1, 0, 0)),
    visualMesh(id, oldOperatorRole, 'VALVE', componentType, new THREE.Vector3(1.4, 0, 0), oldOperatorRole === 'HANDWHEEL' ? new THREE.TorusGeometry(0.25, 0.035, 8, 16) : new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8))
  );
  return group;
}

function flangeGroup(id) {
  const group = new THREE.Group();
  group.name = `${id}_flange-pair`;
  group.userData = {
    TYPE: 'COMPONENT',
    ID: id,
    id,
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'FLANGE',
    componentType: 'FLANGE_GENERIC',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1'
  };
  group.add(
    visualMesh(id, 'FLANGE_DISC_A', 'FLANGE', 'FLANGE_GENERIC', new THREE.Vector3(-1.0, 0, 0)),
    visualMesh(id, 'FLANGE_DISC_B', 'FLANGE', 'FLANGE_GENERIC', new THREE.Vector3(1.0, 0, 0))
  );
  return group;
}

function runVerticalValveSnapTest() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  scene.add(plant);
  const id = 'VERTICAL_VALVE_10_TO_20';
  const adjacentPipe = componentMesh('PIPE_20_TO_30');
  const base = componentMesh(id, 'Gate Valve', 'GATE_VALVE');
  const visual = valveGroup(id, 'VALVE_GATE', new THREE.Vector3(0, -1.4, 0), new THREE.Vector3(0, 1.4, 0), 'HANDWHEEL');
  plant.add(adjacentPipe, base, visual);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 1, 'vertical valve base cylinder should be hidden');
  assert.equal(stats.uprightValveCorrections, 1, 'vertical valve should get a stable operator correction');
  assert.equal(adjacentPipe.visible, true, 'adjacent pipe must stay visible');
  assert.equal(base.visible, false, 'same-component valve base must be hidden');

  const correctedWheel = visual.children.find((child) => child.userData?.meshRole === 'HANDWHEEL' && child.userData?.catalogOrientationCorrection);
  assert.ok(correctedWheel, 'corrected handwheel should be created');
  assert.ok(correctedWheel.position.z > 0.1, 'vertical-pipe operator should snap to stable lateral Z, not disappear into pipe axis');
  assert.ok(Math.abs(correctedWheel.position.y) < 0.35, 'operator should not move along the vertical pipe axis');
}

function runLeverAndActuatorTest() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  scene.add(plant);
  const ball = valveGroup('BALL_VALVE_1', 'VALVE_BALL', new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(1.2, 0, 0), 'LEVER_HANDLE');
  const control = valveGroup('CONTROL_VALVE_1', 'VALVE_CONTROL', new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(1.2, 0, 0), 'ACTUATOR');
  plant.add(componentMesh('BALL_VALVE_1', 'Ball Valve', 'BALL_VALVE'), ball, componentMesh('CONTROL_VALVE_1', 'Control Valve', 'CONTROL_VALVE'), control);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 2, 'ball/control valve bases should be hidden');
  assert.equal(stats.uprightValveCorrections, 2, 'ball/control valve operators should be corrected');
  assert.ok(ball.children.find((child) => child.userData?.meshRole === 'LEVER_HANDLE' && child.userData?.catalogOrientationCorrection), 'ball valve should get corrected lever');
  assert.ok(control.children.find((child) => child.userData?.meshRole === 'ACTUATOR' && child.userData?.catalogOrientationCorrection), 'control valve should get corrected actuator');
}

function runFlangeCorrectionTest() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  scene.add(plant);
  const id = 'FLANGE_PAIR_1';
  const base = componentMesh(id, 'Flange Pair', 'FLANGE');
  const visual = flangeGroup(id);
  plant.add(base, visual, componentMesh('PIPE_NEIGHBOUR'));

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 1, 'flange base cylinder should be hidden');
  assert.equal(stats.flangeVisualCorrections, 1, 'flange should get a visible gasket/face correction');
  assert.equal(base.visible, false);
  assert.ok(visual.children.find((child) => child.userData?.meshRole === 'GASKET_CENTER'), 'flange pair should include visible gasket/center face marker');
}

runVerticalValveSnapTest();
runLeverAndActuatorTest();
runFlangeCorrectionTest();
console.log('Valve/flange catalog orientation gate passed');

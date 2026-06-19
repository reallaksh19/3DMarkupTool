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

function valveGroup(id, componentType, collarA, collarB, operatorRole = 'HANDWHEEL') {
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
    visualMesh(id, 'VALVE_NECK_A', 'VALVE', componentType, collarA.clone().multiplyScalar(0.45)),
    visualMesh(id, 'VALVE_NECK_B', 'VALVE', componentType, collarB.clone().multiplyScalar(0.45)),
    visualMesh(id, 'END_COLLAR_B', 'VALVE', componentType, collarB),
    visualMesh(id, 'BONNET_STEM', 'VALVE', componentType, new THREE.Vector3(1, 0, 0)),
    visualMesh(id, operatorRole, 'VALVE', componentType, new THREE.Vector3(1.4, 0, 0), operatorRole === 'HANDWHEEL' ? new THREE.TorusGeometry(0.25, 0.035, 8, 16) : new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8))
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
    visualMesh(id, 'WELD_NECK_A', 'FLANGE', 'FLANGE_GENERIC', new THREE.Vector3(-1.4, 0, 0)),
    visualMesh(id, 'FLANGE_DISC_A', 'FLANGE', 'FLANGE_GENERIC', new THREE.Vector3(-0.2, 0, 0)),
    visualMesh(id, 'FLANGE_CENTER_BORE_FILL', 'FLANGE', 'FLANGE_GENERIC', new THREE.Vector3(0, 0, 0)),
    visualMesh(id, 'FLANGE_DISC_B', 'FLANGE', 'FLANGE_GENERIC', new THREE.Vector3(0.2, 0, 0)),
    visualMesh(id, 'WELD_NECK_B', 'FLANGE', 'FLANGE_GENERIC', new THREE.Vector3(1.4, 0, 0))
  );
  return group;
}

function assertNoDecoration(stats, group) {
  assert.equal(stats.uprightValveCorrections, 0);
  assert.equal(stats.flangeVisualCorrections, 0);
  assert.equal(stats.decorativeGeometryAdded, 0);
  assert.equal(group.children.some((child) => child.userData?.catalogOrientationCorrection), false);
  assert.equal(group.children.some((child) => child.userData?.uprightValveCorrection), false);
}

function runVerticalValveSnapTest() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  scene.add(plant);
  const id = 'VERTICAL_VALVE_10_TO_20';
  const adjacentPipe = componentMesh('PIPE_20_TO_30');
  const base = componentMesh(id, 'Gate Valve', 'GATE_VALVE');
  const visual = valveGroup(id, 'VALVE_GATE', new THREE.Vector3(0, -1.4, 0), new THREE.Vector3(0, 1.4, 0), 'HANDWHEEL');
  const initialCount = visual.children.length;
  plant.add(adjacentPipe, base, visual);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 1, 'vertical valve base cylinder should be hidden');
  assert.equal(adjacentPipe.visible, true, 'adjacent pipe must stay visible');
  assert.equal(base.visible, false, 'same-component valve base must be hidden');
  assert.equal(visual.children.length, initialCount, 'postprocess must not add vertical valve decorations');
  assertNoDecoration(stats, visual);
}

function runLeverAndActuatorTest() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  scene.add(plant);
  const ball = valveGroup('BALL_VALVE_1', 'VALVE_BALL', new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(1.2, 0, 0), 'LEVER_HANDLE');
  const control = valveGroup('CONTROL_VALVE_1', 'VALVE_CONTROL', new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(1.2, 0, 0), 'ACTUATOR');
  const ballCount = ball.children.length;
  const controlCount = control.children.length;
  plant.add(componentMesh('BALL_VALVE_1', 'Ball Valve', 'BALL_VALVE'), ball, componentMesh('CONTROL_VALVE_1', 'Control Valve', 'CONTROL_VALVE'), control);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 2, 'ball/control valve bases should be hidden');
  assert.equal(ball.children.length, ballCount);
  assert.equal(control.children.length, controlCount);
  assertNoDecoration(stats, ball);
  assertNoDecoration(stats, control);
}

function runFlangeCorrectionTest() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  scene.add(plant);
  const id = 'FLANGE_PAIR_1';
  const base = componentMesh(id, 'Flange Pair', 'FLANGE');
  const visual = flangeGroup(id);
  const initialCount = visual.children.length;
  plant.add(base, visual, componentMesh('PIPE_NEIGHBOUR'));

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 1, 'flange base cylinder should be hidden');
  assert.equal(stats.flangeVisualCorrections, 0, 'flange gasket/face must come only from catalogue renderer');
  assert.equal(base.visible, false);
  assert.equal(visual.children.length, initialCount, 'postprocess must not inject gasket washers or bore fillers');
  assert.equal(visual.children.filter((child) => child.userData?.meshRole === 'GASKET_CENTER').length, 0, 'postprocess must not create full black gasket plates');
  assertNoDecoration(stats, visual);
}

function runValveContinuityTest() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  scene.add(plant);
  const id = 'PE_007_FLANGED_VALVE_83_TO_86';
  const base = componentMesh(id, 'Flanged Valve', 'FLANGED_VALVE');
  const visual = valveGroup(id, 'VALVE_FLANGED', new THREE.Vector3(-1.8, 0, 0), new THREE.Vector3(1.8, 0, 0), 'HANDWHEEL');
  const initialCount = visual.children.length;
  plant.add(componentMesh('PIPE_LEFT'), base, visual, componentMesh('PIPE_RIGHT'));

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.hiddenBaseCylinders, 1, 'flanged valve base cylinder should be hidden');
  assert.equal(base.visible, false, 'same-component base pipe through valve must be hidden');
  assert.ok(visual.children.find((child) => child.userData?.meshRole === 'VALVE_NECK_A'), 'left valve neck should be catalogue-owned');
  assert.ok(visual.children.find((child) => child.userData?.meshRole === 'VALVE_NECK_B'), 'right valve neck should be catalogue-owned');
  assert.equal(visual.children.length, initialCount, 'postprocess must not add duplicate necks');
  assert.equal(visual.userData.valveContinuityCorrectionApplied, undefined, 'postprocess must not mark catalogue-owned continuity as a correction');
  assertNoDecoration(stats, visual);
}

runVerticalValveSnapTest();
runLeverAndActuatorTest();
runFlangeCorrectionTest();
runValveContinuityTest();
console.log('Valve/flange catalog orientation gate passed');

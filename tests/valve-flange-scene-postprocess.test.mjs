import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  hideCatalogReplacedBaseCylinders,
  isCatalogVisualGroup,
  isLegacyBaseCylinderForComponent,
  hasLegacyBaseCylinderRole
} from '../src/valve-flange-scene-postprocess.js';

function object(name, userData = {}, children = []) {
  return { name, userData, visible: true, children };
}

function threeComponent(name, userData = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.5, 16), new THREE.MeshBasicMaterial());
  mesh.name = name;
  mesh.userData = { TYPE: 'COMPONENT', ...userData };
  return mesh;
}

function flangePrimitive(id, role, start, end, radius, extra = {}) {
  const length = Math.max(Math.abs(end - start), 0.0001);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), new THREE.MeshBasicMaterial());
  mesh.name = `${id}_${role}`;
  mesh.position.set((start + end) / 2, 0, 0);
  mesh.userData = {
    TYPE: 'COMPONENT',
    ID: id,
    id,
    meshRole: role,
    componentClass: 'FLANGE',
    componentType: 'FLANGE_GENERIC',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1',
    renderedLocalAxisStart: start,
    renderedLocalAxisEnd: end,
    renderedAxisLength: length,
    localAxisStart: start,
    localAxisEnd: end,
    radius,
    length,
    ...extra
  };
  return mesh;
}

function flangeVisualGroup(id, fromNode, toNode) {
  const group = new THREE.Group();
  group.name = `${id}_flange-pair`;
  group.userData = {
    TYPE: 'COMPONENT',
    ID: id,
    id,
    fromNode,
    toNode,
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'FLANGE',
    componentType: 'FLANGE_GENERIC',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1'
  };
  group.add(
    flangePrimitive(id, 'WELD_NECK_A', -1.25, -0.12, 0.62, { innerRadius: 0.45, outerRadius: 0.62, radiusStart: 0.45, radiusEnd: 0.62 }),
    flangePrimitive(id, 'FLANGE_DISC_A', -0.12, -0.04, 1.15),
    flangePrimitive(id, 'FLANGE_CENTER_BORE_FILL', -0.04, 0.04, 0.30),
    flangePrimitive(id, 'GASKET_CENTER', -0.04, 0.04, 0.55),
    flangePrimitive(id, 'FLANGE_DISC_B', 0.04, 0.12, 1.15),
    flangePrimitive(id, 'WELD_NECK_B', 0.12, 1.25, 0.62, { innerRadius: 0.45, outerRadius: 0.62, radiusStart: 0.62, radiusEnd: 0.45 }),
    flangePrimitive(id, 'RAISED_FACE_A', -0.06, -0.04, 0.74),
    flangePrimitive(id, 'RAISED_FACE_B', 0.04, 0.06, 0.74)
  );
  return group;
}

function runBasicHideOnlyGate() {
  const valveBaseCylinder = object('V-100', { TYPE: 'COMPONENT', ID: 'V-100', id: 'V-100' });
  const valveVisualGroup = object('V-100_gate-valve', {
    TYPE: 'COMPONENT',
    ID: 'V-100',
    id: 'V-100',
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'VALVE',
    componentType: 'VALVE_GATE',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1',
    visualRecipeId: 'valve-gate-symbol.v1'
  }, [
    object('V-100_VALVE_BODY', { meshRole: 'VALVE_BODY' }),
    object('V-100_HANDWHEEL', { meshRole: 'HANDWHEEL' })
  ]);
  const adjacentPipe = object('P-101', { TYPE: 'COMPONENT', ID: 'P-101', id: 'P-101', meshRole: 'PIPE' });
  const plantGroup = object('plant.geometry', {}, [adjacentPipe, valveBaseCylinder, valveVisualGroup]);
  const scene = object('scene', {}, [plantGroup]);
  const initialValveChildCount = valveVisualGroup.children.length;

  assert.equal(isCatalogVisualGroup(valveVisualGroup), true);
  assert.equal(isLegacyBaseCylinderForComponent(valveBaseCylinder, 'V-100'), true);
  assert.equal(isLegacyBaseCylinderForComponent(adjacentPipe, 'V-100'), false);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.catalogVisualGroups, 1);
  assert.equal(stats.hiddenBaseCylinders, 1);
  assert.equal(stats.uprightValveCorrections, 0, 'postprocess must not add or replace valve geometry');
  assert.equal(stats.flangeVisualCorrections, 0, 'no flange topology exists in this valve-only fixture');
  assert.equal(stats.decorativeGeometryAdded, 0, 'valve-only postprocess must stay non-decorating');
  assert.equal(stats.geometryDecorationDisabled, true);
  assert.deepEqual(stats.replacedComponentIds, ['V-100']);
  assert.equal(valveBaseCylinder.visible, false, 'same-component legacy base cylinder must be hidden');
  assert.equal(valveBaseCylinder.userData.meshRole, 'CATALOG_REPLACED_BASE_CYLINDER');
  assert.equal(valveBaseCylinder.userData.hiddenByVisualCatalog, true);
  assert.equal(adjacentPipe.visible, true, 'adjacent pipe component must remain visible');
  assert.equal(valveVisualGroup.children.length, initialValveChildCount, 'postprocess must not inject valve shells, stems, or wheels');
  assert.equal(valveVisualGroup.children.some((child) => child.userData?.uprightValveCorrection), false);
}

function runFlangedValveGate() {
  const flangedValveBaseCylinder = object('PE_007_FLANGED_VALVE_83_TO_86', {
    TYPE: 'COMPONENT',
    ID: 'PE_007_FLANGED_VALVE_83_TO_86',
    id: 'PE_007_FLANGED_VALVE_83_TO_86',
    meshRole: 'Flanged Valve',
    engineeringType: 'FLANGED_VALVE'
  });
  const flangedValveVisualGroup = object('PE_007_FLANGED_VALVE_83_TO_86_valve-flanged', {
    TYPE: 'COMPONENT',
    ID: 'PE_007_FLANGED_VALVE_83_TO_86',
    id: 'PE_007_FLANGED_VALVE_83_TO_86',
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'VALVE',
    componentType: 'FLANGED_VALVE',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1'
  });
  const flangedValveAdjacentPipe = object('PE_006_PIPE_80_TO_83', {
    TYPE: 'COMPONENT',
    ID: 'PE_006_PIPE_80_TO_83',
    id: 'PE_006_PIPE_80_TO_83',
    meshRole: 'PIPE'
  });
  const flangedValveScene = object('scene', {}, [
    object('plant.geometry', {}, [flangedValveAdjacentPipe, flangedValveBaseCylinder, flangedValveVisualGroup])
  ]);
  assert.equal(hasLegacyBaseCylinderRole(flangedValveBaseCylinder.userData), true, 'Flanged Valve meshRole must be treated as the replaceable legacy base cylinder');
  assert.equal(isLegacyBaseCylinderForComponent(flangedValveBaseCylinder, 'PE_007_FLANGED_VALVE_83_TO_86'), true);
  const flangedValveStats = hideCatalogReplacedBaseCylinders(flangedValveScene);
  assert.equal(flangedValveStats.hiddenBaseCylinders, 1);
  assert.equal(flangedValveStats.uprightValveCorrections, 0);
  assert.equal(flangedValveBaseCylinder.visible, false, 'selected flanged valve base cylinder must not remain visible through the catalogue body');
  assert.equal(flangedValveAdjacentPipe.visible, true, 'adjacent pipe before the flanged valve must remain visible');
}

function runUnresolvedFlangePairRemainsCatalogueOwned() {
  const flangeBaseCylinder = object('F-200', { TYPE: 'COMPONENT', ID: 'F-200', id: 'F-200', meshRole: 'Flange Pair' });
  const flangeVisualGroup = object('F-200_flange-pair', {
    TYPE: 'COMPONENT',
    ID: 'F-200',
    id: 'F-200',
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'FLANGE',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1'
  }, [
    object('F-200_FLANGE_DISC_A', { meshRole: 'FLANGE_DISC_A' }),
    object('F-200_FLANGE_DISC_B', { meshRole: 'FLANGE_DISC_B' })
  ]);
  const initialFlangeChildCount = flangeVisualGroup.children.length;
  const flangeScene = object('scene', {}, [object('plant.geometry', {}, [flangeBaseCylinder, flangeVisualGroup])]);
  const flangeStats = hideCatalogReplacedBaseCylinders(flangeScene);
  assert.equal(flangeStats.hiddenBaseCylinders, 1);
  assert.equal(flangeStats.flangeVisualCorrections, 0);
  assert.equal(flangeBaseCylinder.visible, false, 'flange pair should also replace its pipe-through base cylinder');
  assert.equal(flangeVisualGroup.children.length, initialFlangeChildCount, 'without pipe endpoint topology, postprocess must not guess flange orientation');
  assert.equal(flangeVisualGroup.children.some((child) => child.userData?.meshRole === 'GASKET_CENTER'), false);
}

function runFromPipeMeansRaisedFaceAtTo() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  plant.name = 'plant.geometry';
  scene.add(plant);
  const id = 'F-PIPE-FROM';
  const pipe = threeComponent('P-001', { ID: 'P-001', id: 'P-001', meshRole: 'PIPE', engineeringType: 'PIPE', fromNode: '1', toNode: '10' });
  const base = threeComponent(id, { ID: id, id, meshRole: 'Flange Pair', engineeringType: 'FLANGE', fromNode: '10', toNode: '20' });
  const visual = flangeVisualGroup(id, '10', '20');
  plant.add(pipe, base, visual);

  const stats = hideCatalogReplacedBaseCylinders(scene, { flangeTopologyBoltMarkers: false });
  assert.equal(stats.hiddenBaseCylinders, 1);
  assert.equal(stats.flangeTopologyCorrections, 1);
  assert.equal(stats.decorativeGeometryAdded, 3);
  assert.equal(visual.userData.pipeEndpoint, 'FROM');
  assert.equal(visual.userData.raisedFaceEndpoint, 'TO');
  assert.equal(visual.children.find((child) => child.userData?.meshRole === 'FLANGE_DISC_A').visible, false, 'old symmetric left disc must be hidden');

  const raisedFace = visual.children.find((child) => child.userData?.meshRole === 'RAISED_FACE' && child.userData?.singleFlangeTopologyOriented);
  const neck = visual.children.find((child) => child.userData?.meshRole === 'WELD_NECK_PIPE_SIDE' && child.userData?.singleFlangeTopologyOriented);
  assert.ok(raisedFace, 'topology rebuild must create one raised face');
  assert.ok(neck, 'topology rebuild must create one pipe-side weld neck');
  assert.ok(raisedFace.position.x > 1.15, 'when From is shared by pipe, raised face must be at To side');
  assert.ok(neck.userData.radiusStart < neck.userData.radiusEnd, 'From-pipe weld neck must expand away from the pipe');
}

function runToPipeMeansRaisedFaceAtFrom() {
  const scene = new THREE.Scene();
  const plant = new THREE.Group();
  plant.name = 'plant.geometry';
  scene.add(plant);
  const id = 'F-PIPE-TO';
  const pipe = threeComponent('P-002', { ID: 'P-002', id: 'P-002', meshRole: 'PIPE', engineeringType: 'PIPE', fromNode: '20', toNode: '30' });
  const base = threeComponent(id, { ID: id, id, meshRole: 'Flange Pair', engineeringType: 'FLANGE', fromNode: '10', toNode: '20' });
  const visual = flangeVisualGroup(id, '10', '20');
  plant.add(pipe, base, visual);

  const stats = hideCatalogReplacedBaseCylinders(scene, { flangeTopologyBoltMarkers: false });
  assert.equal(stats.hiddenBaseCylinders, 1);
  assert.equal(stats.flangeTopologyCorrections, 1);
  assert.equal(visual.userData.pipeEndpoint, 'TO');
  assert.equal(visual.userData.raisedFaceEndpoint, 'FROM');

  const raisedFace = visual.children.find((child) => child.userData?.meshRole === 'RAISED_FACE' && child.userData?.singleFlangeTopologyOriented);
  const neck = visual.children.find((child) => child.userData?.meshRole === 'WELD_NECK_PIPE_SIDE' && child.userData?.singleFlangeTopologyOriented);
  assert.ok(raisedFace.position.x < -1.15, 'when To is shared by pipe, raised face must be at From side');
  assert.ok(neck.userData.radiusStart > neck.userData.radiusEnd, 'To-pipe weld neck must contract toward the pipe');
}

function run() {
  runBasicHideOnlyGate();
  runFlangedValveGate();
  runUnresolvedFlangePairRemainsCatalogueOwned();
  runFromPipeMeansRaisedFaceAtTo();
  runToPipeMeansRaisedFaceAtFrom();
  console.log('Valve/flange scene postprocess gates passed');
}

run();
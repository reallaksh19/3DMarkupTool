import assert from 'node:assert/strict';
import {
  hideCatalogReplacedBaseCylinders,
  isCatalogVisualGroup,
  isLegacyBaseCylinderForComponent,
  hasLegacyBaseCylinderRole
} from '../src/valve-flange-scene-postprocess.js';

function object(name, userData = {}, children = []) {
  return { name, userData, visible: true, children };
}

function run() {
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
  });
  const adjacentPipe = object('P-101', { TYPE: 'COMPONENT', ID: 'P-101', id: 'P-101', meshRole: 'PIPE' });
  const plantGroup = object('plant.geometry', {}, [adjacentPipe, valveBaseCylinder, valveVisualGroup]);
  const scene = object('scene', {}, [plantGroup]);

  assert.equal(isCatalogVisualGroup(valveVisualGroup), true);
  assert.equal(isLegacyBaseCylinderForComponent(valveBaseCylinder, 'V-100'), true);
  assert.equal(isLegacyBaseCylinderForComponent(adjacentPipe, 'V-100'), false);

  const stats = hideCatalogReplacedBaseCylinders(scene);
  assert.equal(stats.catalogVisualGroups, 1);
  assert.equal(stats.hiddenBaseCylinders, 1);
  assert.deepEqual(stats.replacedComponentIds, ['V-100']);
  assert.equal(valveBaseCylinder.visible, false, 'same-component legacy base cylinder must be hidden');
  assert.equal(valveBaseCylinder.userData.meshRole, 'CATALOG_REPLACED_BASE_CYLINDER');
  assert.equal(valveBaseCylinder.userData.hiddenByVisualCatalog, true);
  assert.equal(adjacentPipe.visible, true, 'adjacent pipe component must remain visible');

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
  assert.equal(flangedValveBaseCylinder.visible, false, 'selected flanged valve base cylinder must not remain visible through the catalogue body');
  assert.equal(flangedValveAdjacentPipe.visible, true, 'adjacent pipe before the flanged valve must remain visible');

  const flangeBaseCylinder = object('F-200', { TYPE: 'COMPONENT', ID: 'F-200', id: 'F-200', meshRole: 'Flange Pair' });
  const flangeVisualGroup = object('F-200_flange-pair', {
    TYPE: 'COMPONENT',
    ID: 'F-200',
    id: 'F-200',
    meshRole: 'CATALOG_VISUAL_GROUP',
    componentClass: 'FLANGE',
    visualCatalogSchema: 'valve-flange-visual-catalog/v1'
  });
  const flangeScene = object('scene', {}, [object('plant.geometry', {}, [flangeBaseCylinder, flangeVisualGroup])]);
  const flangeStats = hideCatalogReplacedBaseCylinders(flangeScene);
  assert.equal(flangeStats.hiddenBaseCylinders, 1);
  assert.equal(flangeBaseCylinder.visible, false, 'flange pair should also replace its pipe-through base cylinder');

  console.log('Valve/flange scene postprocess gates passed');
}

run();

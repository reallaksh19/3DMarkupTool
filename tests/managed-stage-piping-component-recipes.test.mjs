import assert from 'node:assert/strict';

import { buildManagedStageGeometryContractSet } from '../src/managed-stage-geometry-contract.js';
import {
  assertManagedStagePipingComponentRecipe,
  planManagedStagePipingComponentRecipe
} from '../src/managed-stage-piping-component-recipes.js';
import { MANAGED_STAGE_RVM_MATERIALS, planManagedStagePrimitives } from '../src/managed-stage-rvm-primitive-planner.js';
import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const profile = parseManagedStageProfile(JSON.stringify(createBmCiiManagedStageFixture()));
const contractSet = buildManagedStageGeometryContractSet(profile);
const contracts = contractSet.contracts;

const cylinderContracts = contracts.filter((contract) => contract.dtxr !== 'BEND');
const recipes = cylinderContracts.map((contract) => planManagedStagePipingComponentRecipe(contract, {
  pipeRadiusMm: contract.radiusMm,
  materials: MANAGED_STAGE_RVM_MATERIALS
}));

assert.equal(recipes.length, 33);
assert.equal(recipes.reduce((total, recipe) => total + recipe.primitiveCount, 0), 65);
assert.equal(recipes.every((recipe) => recipe.continuous === true), true);
assert.equal(recipes.every((recipe) => Math.abs(recipe.coveredLengthMm - recipe.contractLengthMm) < 1e-6), true);

for (const recipe of recipes) assertManagedStagePipingComponentRecipe(recipe);

const weldNeckFlange = recipes.find((recipe) => recipe.componentName === 'PE_006_FLANGE_80_TO_83');
assertManagedStagePipingComponentRecipe(weldNeckFlange, { primitiveCount: 2, recipeName: 'weldneck-flange-contiguous-2part' });
assert.deepEqual(weldNeckFlange.primitives.map((primitive) => primitive.localName), ['weldNeckHub', 'raisedFaceDisk']);
assert.equal(pointsTouch(weldNeckFlange.primitives[0].endMm, weldNeckFlange.primitives[1].startMm), true);
assert.equal(weldNeckFlange.primitiveBudgetLimit, 2);

const flangePair = recipes.find((recipe) => recipe.componentName === 'PE_001_FLANGE_PAIR_10_TO_20');
assertManagedStagePipingComponentRecipe(flangePair, { primitiveCount: 2, recipeName: 'flange-pair-contiguous-split' });
assert.equal(flangePair.segments[0].localName, 'flangeA');
assert.equal(flangePair.segments[1].localName, 'flangeB');
assert.equal(flangePair.segments[0].endDistanceMm, flangePair.segments[1].startDistanceMm);
assert.equal(flangePair.segments[0].startDistanceMm, 0);
assert.equal(flangePair.segments[1].endDistanceMm, flangePair.contractLengthMm);
assert.deepEqual(flangePair.primitives.map((primitive) => primitive.localName), ['flangeA', 'flangeB']);
assert.equal(pointsTouch(flangePair.primitives[0].endMm, flangePair.primitives[1].startMm), true);

const flangedValve = recipes.find((recipe) => recipe.componentName === 'PE_007_FLANGED_VALVE_83_TO_86');
assertManagedStagePipingComponentRecipe(flangedValve, { primitiveCount: 5, recipeName: 'flanged-ball-valve-contiguous-5part' });
assert.deepEqual(flangedValve.primitives.map((primitive) => primitive.localName), ['leftEndFlange', 'leftSeat', 'centralBallBody', 'rightSeat', 'rightEndFlange']);
for (let index = 0; index < flangedValve.primitives.length - 1; index += 1) {
  assert.equal(pointsTouch(flangedValve.primitives[index].endMm, flangedValve.primitives[index + 1].startMm), true);
}
assert.equal(pointsTouch(flangedValve.primitives[0].startMm, flangedValve.primitives[0].parentStartMm), true);
assert.equal(pointsTouch(flangedValve.primitives.at(-1).endMm, flangedValve.primitives.at(-1).parentEndMm), true);
assert.equal(flangedValve.primitiveBudgetLimit, 6);

const standaloneValve = recipes.find((recipe) => recipe.componentName === 'PE_032_VALVE_260_TO_270');
assertManagedStagePipingComponentRecipe(standaloneValve, { primitiveCount: 5, recipeName: 'ball-valve-contiguous-5part' });
assert.equal(standaloneValve.primitives.every((primitive) => primitive.exportedRvmGeometry === true), true);
assert.equal(standaloneValve.primitives.every((primitive) => primitive.exportedManagedStageComponentSymbol === true), true);

const planned = contracts.flatMap((contract) => planManagedStagePrimitives(contract));
assert.equal(planned.filter((primitive) => primitive.kind === 'cylinder').length, 65);
assert.equal(planned.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.equal(planned.filter((primitive) => primitive.recipeName === 'weldneck-flange-contiguous-2part').length, 12);
assert.equal(planned.filter((primitive) => primitive.recipeName === 'flange-pair-contiguous-split').length, 4);
assert.equal(planned.filter((primitive) => primitive.recipeName === 'flanged-ball-valve-contiguous-5part').length, 15);
assert.equal(planned.filter((primitive) => primitive.recipeName === 'ball-valve-contiguous-5part').length, 15);
assert.equal(planned.filter((primitive) => primitive.recipeContinuous === true).length, 65);
assert.equal(planned.filter((primitive) => primitive.exportedManagedStageComponentSymbol === true).length, 42);

console.log('Managed-stage piping component recipes export flanges and valves as compact contiguous RVM primitives');

function pointsTouch(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;
}

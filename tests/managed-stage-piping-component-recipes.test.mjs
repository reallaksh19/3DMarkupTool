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
assert.equal(recipes.reduce((total, recipe) => total + recipe.primitiveCount, 0), 41);
assert.equal(recipes.every((recipe) => recipe.continuous === true), true);
assert.equal(recipes.every((recipe) => Math.abs(recipe.coveredLengthMm - recipe.contractLengthMm) < 1e-6), true);

for (const recipe of recipes) assertManagedStagePipingComponentRecipe(recipe);

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
assertManagedStagePipingComponentRecipe(flangedValve, { primitiveCount: 3, recipeName: 'flanged-valve-contiguous-3part' });
assert.deepEqual(flangedValve.primitives.map((primitive) => primitive.localName), ['flangeA', 'body', 'flangeB']);
assert.equal(pointsTouch(flangedValve.primitives[0].endMm, flangedValve.primitives[1].startMm), true);
assert.equal(pointsTouch(flangedValve.primitives[1].endMm, flangedValve.primitives[2].startMm), true);
assert.equal(pointsTouch(flangedValve.primitives[0].startMm, flangedValve.primitives[0].parentStartMm), true);
assert.equal(pointsTouch(flangedValve.primitives[2].endMm, flangedValve.primitives[2].parentEndMm), true);

const planned = contracts.flatMap((contract) => planManagedStagePrimitives(contract));
assert.equal(planned.filter((primitive) => primitive.kind === 'cylinder').length, 41);
assert.equal(planned.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.equal(planned.filter((primitive) => primitive.recipeName === 'flange-pair-contiguous-split').length, 4);
assert.equal(planned.filter((primitive) => primitive.recipeName === 'flanged-valve-contiguous-3part').length, 9);
assert.equal(planned.filter((primitive) => primitive.recipeContinuous === true).length, 41);

console.log('Managed-stage piping component recipes preserve counts and inline continuity');

function pointsTouch(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;
}

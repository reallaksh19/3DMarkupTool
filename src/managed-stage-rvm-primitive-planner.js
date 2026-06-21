import { createManagedStageGeometryContract } from './managed-stage-geometry-contract.js';
import { solveCode4ElbowGeometry } from './rvm-code4-elbow-geometry-solver.js';
import { planManagedStagePipingComponentRecipe } from './managed-stage-piping-component-recipes.js';

export const MANAGED_STAGE_RVM_MATERIALS = Object.freeze({
  ROOT: 1,
  PIPE: 4,
  FITTING: 5,
  FLANGE: 6,
  VALVE: 7,
  UNKNOWN_PIPELIKE: 8
});

export function planManagedStagePrimitives(recordOrContract, options = {}) {
  const contract = asGeometryContract(recordOrContract, options.elementIndex || 0);
  const pipeRadius = contract.radiusMm;
  if (!(pipeRadius > 0)) throw new Error(`Missing/invalid diameter for ${contract.name}`);

  if (contract.dtxr === 'BEND') return [planCode4Elbow(contract, pipeRadius, options)];

  const recipe = planManagedStagePipingComponentRecipe(contract, {
    pipeRadiusMm: pipeRadius,
    materials: MANAGED_STAGE_RVM_MATERIALS
  });
  return recipe.primitives;
}

export function managedStageComponentClass(recordOrContract) {
  const dtxr = recordOrContract?.dtxr || recordOrContract?.attributes?.DTXR || recordOrContract?.type || 'UNKNOWN';
  if (dtxr === 'PIPE') return 'PIPE';
  if (dtxr === 'UNSPECIFIED') return 'UNKNOWN_PIPELIKE';
  if (dtxr === 'BEND') return 'BEND';
  if (dtxr === 'FLANGE') return 'FLANGE';
  if (dtxr === 'FLANGE_PAIR') return 'FLANGE_PAIR';
  if (dtxr === 'VALVE') return 'VALVE';
  if (dtxr === 'FLANGED_VALVE') return 'FLANGED_VALVE';
  return 'UNKNOWN';
}

export function managedStageMaterialForClass(componentClass) {
  if (componentClass === 'PIPE') return MANAGED_STAGE_RVM_MATERIALS.PIPE;
  if (componentClass === 'BEND') return MANAGED_STAGE_RVM_MATERIALS.FITTING;
  if (componentClass.includes('FLANGE')) return MANAGED_STAGE_RVM_MATERIALS.FLANGE;
  if (componentClass.includes('VALVE')) return MANAGED_STAGE_RVM_MATERIALS.VALVE;
  if (componentClass === 'UNKNOWN_PIPELIKE') return MANAGED_STAGE_RVM_MATERIALS.UNKNOWN_PIPELIKE;
  return MANAGED_STAGE_RVM_MATERIALS.FITTING;
}

function planCode4Elbow(contract, pipeRadius, options = {}) {
  const solved = solveCode4ElbowGeometry(contract, options.code4ElbowSolver || {});
  return {
    kind: 'elbow',
    name: `${contract.name}_BEND`,
    localName: 'bend',
    center: solved.centerMm,
    direction: solved.direction,
    basis: solved.basis,
    bendRadius: solved.bendRadiusMm,
    tubeRadius: pipeRadius,
    sweepAngleRad: solved.sweepAngleRad,
    material: MANAGED_STAGE_RVM_MATERIALS.FITTING,
    localBbox: solved.localBbox,
    endpointLocked: solved.endpointLocked,
    startMm: solved.startMm,
    endMm: solved.endMm,
    chordLengthMm: solved.chordLengthMm,
    declaredBendRadiusMm: solved.declaredBendRadiusMm,
    declaredSweepAngleRad: solved.declaredSweepAngleRad,
    minRadiusForChordMm: solved.minRadiusForChordMm,
    radiusInflatedMm: solved.radiusInflatedMm,
    endpointFitErrorMm: solved.endpointFitErrorMm,
    solverState: solved.solverState,
    tangentHintState: solved.tangentHintState,
    tangentHintSources: solved.tangentHintSources,
    startTangent: solved.startTangent,
    endTangent: solved.endTangent,
    sourceContractName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    orientationAssumption: solved.orientationAssumption
  };
}

function asGeometryContract(recordOrContract, elementIndex) {
  if (recordOrContract?.schema === 'ManagedStageGeometryContract.v1') return recordOrContract;
  return createManagedStageGeometryContract(recordOrContract, elementIndex);
}

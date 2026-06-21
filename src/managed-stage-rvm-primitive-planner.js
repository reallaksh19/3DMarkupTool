import { createManagedStageGeometryContract } from './managed-stage-geometry-contract.js';
import { buildContractCylinderPrimitive } from './rvm-cylinder-primitive-builder.js';

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
  const dtxr = contract.dtxr;
  const pipeRadius = contract.radiusMm;
  if (!(pipeRadius > 0)) throw new Error(`Missing/invalid diameter for ${contract.name}`);

  if (dtxr === 'PIPE' || dtxr === 'UNSPECIFIED') {
    const material = dtxr === 'UNSPECIFIED' ? MANAGED_STAGE_RVM_MATERIALS.UNKNOWN_PIPELIKE : MANAGED_STAGE_RVM_MATERIALS.PIPE;
    return planInlineCylinder(contract, pipeRadius, material, 'body');
  }
  if (dtxr === 'FLANGE') return planInlineCylinder(contract, flangeRadius(pipeRadius), MANAGED_STAGE_RVM_MATERIALS.FLANGE, 'flange');
  if (dtxr === 'VALVE') return planInlineCylinder(contract, valveRadius(pipeRadius), MANAGED_STAGE_RVM_MATERIALS.VALVE, 'body');
  if (dtxr === 'FLANGE_PAIR') return planFlangePair(contract, pipeRadius);
  if (dtxr === 'FLANGED_VALVE') return planFlangedValve(contract, pipeRadius);
  if (dtxr === 'BEND') return [planCode4Elbow(contract, pipeRadius)];
  throw new Error(`Unsupported managed-stage DTXR: ${dtxr}`);
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

function planInlineCylinder(contract, radius, material, localName) {
  return [buildContractCylinderPrimitive(contract, { radiusMm: radius, material, localName })];
}

function planFlangePair(contract, pipeRadius) {
  const thick = Math.min(contract.lengthMm * 0.45, 90);
  const radius = flangeRadius(pipeRadius);
  return [
    buildContractCylinderPrimitive(contract, {
      localName: 'flangeA',
      radiusMm: radius,
      material: MANAGED_STAGE_RVM_MATERIALS.FLANGE,
      startOffsetMm: 0,
      endOffsetMm: contract.lengthMm - thick
    }),
    buildContractCylinderPrimitive(contract, {
      localName: 'flangeB',
      radiusMm: radius,
      material: MANAGED_STAGE_RVM_MATERIALS.FLANGE,
      startOffsetMm: contract.lengthMm - thick,
      endOffsetMm: 0
    })
  ];
}

function planFlangedValve(contract, pipeRadius) {
  const flangeLen = Math.min(contract.lengthMm * 0.18, 90);
  const bodyLen = contract.lengthMm - flangeLen * 2;
  if (!(bodyLen > 0)) throw new Error(`Invalid flanged valve body length for ${contract.name}`);
  return [
    buildContractCylinderPrimitive(contract, {
      localName: 'flangeA',
      radiusMm: flangeRadius(pipeRadius),
      material: MANAGED_STAGE_RVM_MATERIALS.FLANGE,
      startOffsetMm: 0,
      endOffsetMm: contract.lengthMm - flangeLen
    }),
    buildContractCylinderPrimitive(contract, {
      localName: 'body',
      radiusMm: valveRadius(pipeRadius),
      material: MANAGED_STAGE_RVM_MATERIALS.VALVE,
      startOffsetMm: flangeLen,
      endOffsetMm: flangeLen
    }),
    buildContractCylinderPrimitive(contract, {
      localName: 'flangeB',
      radiusMm: flangeRadius(pipeRadius),
      material: MANAGED_STAGE_RVM_MATERIALS.FLANGE,
      startOffsetMm: contract.lengthMm - flangeLen,
      endOffsetMm: 0
    })
  ];
}

function planCode4Elbow(contract, pipeRadius) {
  const bendRadius = Number(contract.arc?.bendRadiusMm);
  const sweepAngleRad = Number(contract.arc?.sweepAngleRad);
  if (!(bendRadius > 0) || !(sweepAngleRad > 0)) throw new Error(`Invalid bend payload for ${contract.name}`);
  const outer = bendRadius + pipeRadius;
  return {
    kind: 'elbow',
    name: `${contract.name}_BEND`,
    localName: 'bend',
    center: contract.centerMm,
    direction: contract.axis,
    bendRadius,
    tubeRadius: pipeRadius,
    sweepAngleRad,
    material: MANAGED_STAGE_RVM_MATERIALS.FITTING,
    localBbox: [0, 0, -pipeRadius, outer, outer, pipeRadius],
    endpointLocked: false,
    sourceContractName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    orientationAssumption: 'managed-stage midpoint/fallback code-4 torus orientation'
  };
}

function asGeometryContract(recordOrContract, elementIndex) {
  if (recordOrContract?.schema === 'ManagedStageGeometryContract.v1') return recordOrContract;
  return createManagedStageGeometryContract(recordOrContract, elementIndex);
}

function flangeRadius(pipeRadius) { return Math.max(pipeRadius * 1.55, pipeRadius + 35); }
function valveRadius(pipeRadius) { return Math.max(pipeRadius * 1.35, pipeRadius + 25); }

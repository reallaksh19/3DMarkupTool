import { createManagedStageGeometryContract, normalizeManagedStageGeometryDtxr } from './managed-stage-geometry-contract.js?v=bust-cache-4';
import { buildEndpointLockedCylinderPrimitive } from './rvm-cylinder-primitive-builder.js?v=bust-cache-4';
import { solveCode4ElbowGeometry } from './rvm-code4-elbow-geometry-solver.js?v=bust-cache-4';
import { planManagedStagePipingComponentRecipe } from './managed-stage-piping-component-recipes.js?v=bust-cache-4';

const CODE4_RADIUS_INFLATION_TOLERANCE_MM = 0.001;
const CODE4_PAYLOAD_TOLERANCE_MM = 0.001;

export const MANAGED_STAGE_RVM_MATERIALS = Object.freeze({
  ROOT: 1,
  PIPE: 4,
  FITTING: 5,
  FLANGE: 6,
  VALVE: 7,
  UNKNOWN_PIPELIKE: 8,
  SUPPORT: 9
});

export function planManagedStagePrimitives(recordOrContract, options = {}) {
  const contract = asGeometryContract(recordOrContract, options.elementIndex || 0);
  const pipeRadius = contract.radiusMm;
  if (!(pipeRadius > 0)) throw new Error(`Missing/invalid diameter for ${contract.name}`);

  if (contract.dtxr === 'BEND') {
    if (contract.managedStageCode4BendPlan) {
      const structuralCode4 = planManagedStageExplicitCode4Bend(contract, pipeRadius);
      const structuralCode4Degraded = structuralCode4.some((primitive) => primitive.code4BendPlanDegraded || primitive.code4BendExcluded);
      const preservedSourceRoute = structuralCode4Degraded
        ? []
        : planGenericInputXmlBendCylinders(contract, pipeRadius);
      return [
        ...structuralCode4,
        ...preservedSourceRoute
      ];
    }
    if (contract.excludeCode4Bend) {
      return [
        ...planGenericInputXmlBendCylinders(contract, pipeRadius),
        ...planGenericInputXmlNodeLocalElbows(contract, pipeRadius)
      ];
    }
    return planCode4ElbowOrSourceRoute(contract, pipeRadius, options);
  }

  const recipe = planManagedStagePipingComponentRecipe(contract, {
    pipeRadiusMm: pipeRadius,
    materials: MANAGED_STAGE_RVM_MATERIALS
  });
  return [
    ...recipe.primitives,
    ...planGenericInputXmlBranchFittingCylinders(contract),
    ...planGenericInputXmlNodeLocalElbows(contract, pipeRadius)
  ];
}

export function managedStageComponentClass(recordOrContract) {
  const dtxr = normalizeManagedStageGeometryDtxr(recordOrContract?.dtxr || recordOrContract?.attributes?.DTXR || recordOrContract?.attributes?.RAW_TYPE || recordOrContract?.type || 'UNKNOWN');
  if (dtxr === 'PIPE') return 'PIPE';
  if (dtxr === 'UNSPECIFIED') return 'UNKNOWN_PIPELIKE';
  if (dtxr === 'BEND') return 'BEND';
  if (dtxr === 'FLANGE') return 'FLANGE';
  if (dtxr === 'FLANGE_PAIR') return 'FLANGE_PAIR';
  if (dtxr === 'REDUCER') return 'REDUCER';
  if (dtxr === 'VALVE') return 'VALVE';
  if (dtxr === 'FLANGED_VALVE') return 'FLANGED_VALVE';
  return 'UNKNOWN';
}

export function managedStageMaterialForClass(componentClass) {
  if (componentClass === 'PIPE') return MANAGED_STAGE_RVM_MATERIALS.PIPE;
  if (componentClass === 'BEND') return MANAGED_STAGE_RVM_MATERIALS.FITTING;
  if (componentClass === 'REDUCER') return MANAGED_STAGE_RVM_MATERIALS.FITTING;
  if (componentClass.includes('FLANGE')) return MANAGED_STAGE_RVM_MATERIALS.FLANGE;
  if (componentClass.includes('VALVE')) return MANAGED_STAGE_RVM_MATERIALS.VALVE;
  if (componentClass === 'UNKNOWN_PIPELIKE') return MANAGED_STAGE_RVM_MATERIALS.UNKNOWN_PIPELIKE;
  return MANAGED_STAGE_RVM_MATERIALS.FITTING;
}

function planManagedStageExplicitCode4Bend(contract, pipeRadius) {
  const plan = contract.managedStageCode4BendPlan;
  if (!plan) return [];
  const synthetic = {
    ...contract,
    name: `${contract.name}_EXPLICIT_CODE4`,
    dtxr: 'BEND',
    centerlineKind: 'arc',
    excludeCode4Bend: false,
    startMm: plan.startMm,
    endMm: plan.endMm,
    lengthMm: distance(plan.startMm, plan.endMm),
    centerMm: midpoint(plan.startMm, plan.endMm),
    axis: unitVector(vsub(plan.endMm, plan.startMm)),
    arc: {
      bendRadiusMm: plan.bendRadiusMm,
      tubeRadiusMm: plan.pipeRadiusMm || pipeRadius,
      sweepAngleRad: plan.sweepAngleRad,
      bendAngleDeg: plan.turnAngleDeg,
      startTangent: plan.startTangent,
      endTangent: plan.endTangent,
      planeNormal: plan.planeNormal,
      tangentHintState: 'explicit-bend-contract-plan',
      tangentHintSources: [plan.bendName, plan.adjacentName].filter(Boolean)
    }
  };
  const solved = solveCode4ElbowGeometry(synthetic, { preserveDeclaredRadius: true });
  if (!isValidCode4PayloadGeometry(solved)) {
    const degraded = {
      ...contract,
      excludeCode4Bend: true,
      code4BendExclusionReason: `Recovered code-4 bend plan is not payload-safe: bendRadius=${solved.bendRadiusMm} mm, tubeRadius=${solved.tubeRadiusMm} mm`,
      genericInputXmlBend: contract.genericInputXmlBend || {
        mode: 'code8-source-route-cylinder',
        segments: [{ role: 'source-route', startMm: contract.startMm, endMm: contract.endMm }],
        originalBendRadiusMm: contract.arc?.bendRadiusMm || null
      }
    };
    return planGenericInputXmlBendCylinders(degraded, pipeRadius).map((primitive) => ({
      ...primitive,
      managedStageCode4BendPlan: true,
      code4BendPlanNode: plan.node,
      code4BendPlanAdjacentName: plan.adjacentName,
      code4BendPlanDegraded: true,
      code4BendPlanDegradationReason: degraded.code4BendExclusionReason
    }));
  }
  return [{
    ...code4ElbowPrimitiveFromSolved(synthetic, pipeRadius, solved),
    name: `${contract.name}_STRUCTURAL_CODE4_BEND`,
    localName: `explicit-code4-bend-${plan.node}`,
    primitiveRole: 'inputxml-explicit-bend-code4',
    primitiveRoleTag: 'bendCode4Elbow',
    recipeName: 'inputxml-explicit-bend-code4-contract-plan',
    managedStageCode4BendPlan: true,
    code4BendPlanNode: plan.node,
    code4BendPlanAdjacentName: plan.adjacentName,
    code4BendPlanTrimMm: plan.trimMm,
    radiusCappedByTrim: Boolean(plan.radiusCappedByTrim),
    orientationAssumption: 'explicit BEND emits one structural code-4 primitive from managedStageCode4BendPlan; source-route cylinder is trimmed and preserved as a separate code-8 primitive for pipe continuity'
  }];
}

function planGenericInputXmlBendCylinders(contract, pipeRadius) {
  const segments = contract.genericInputXmlBend?.segments?.length
    ? contract.genericInputXmlBend.segments
    : [{ role: 'source-route', startMm: contract.startMm, endMm: contract.endMm }];
  const sourceRouteMode = contract.genericInputXmlBend?.mode === 'code8-source-route-cylinder';
  const explicitCode4SourceRoute = Boolean(contract.managedStageCode4BendPlan && !contract.excludeCode4Bend);
  const code4BendExcluded = !explicitCode4SourceRoute;
  return segments.map((segment, index) => {
    const sourceRouteSegment = sourceRouteMode || segment.role === 'source-route';
    const primitive = buildEndpointLockedCylinderPrimitive({
      name: sourceRouteSegment
        ? `${contract.name}_SOURCE_ROUTE_BEND_${index + 1}`
        : `${contract.name}_GENERIC_1P5D_BEND_${index + 1}`,
      localName: sourceRouteSegment ? 'source-route-bend' : `generic-1p5d-bend-${segment.role || index + 1}`,
      startMm: segment.startMm,
      endMm: segment.endMm,
      radiusMm: pipeRadius,
      material: MANAGED_STAGE_RVM_MATERIALS.FITTING,
      sourceContractName: contract.name,
      sourceElementId: contract.sourceElementId || contract.elementId || '',
      primitiveRole: sourceRouteSegment
        ? 'inputxml-source-route-bend-cylinder'
        : `inputxml-generic-1p5d-bend-${segment.role || index + 1}`,
      primitiveRoleTag: sourceRouteSegment ? 'bendSourceRouteCylinder' : 'bendGenericArcCylinder',
      parentStartMm: contract.startMm,
      parentEndMm: contract.endMm,
      startOffsetMm: 0,
      endOffsetMm: 0
    });
    return {
      ...primitive,
      recipeName: sourceRouteSegment
        ? (explicitCode4SourceRoute ? 'inputxml-source-route-bend-cylinder-with-code4' : 'inputxml-source-route-bend-cylinder')
        : 'inputxml-generic-1p5d-bend-reconstructed-arc',
      genericInputXmlBend: true,
      inputXmlSourceRouteBend: sourceRouteSegment,
      code4BendExcluded,
      code4BendExclusionReason: code4BendExcluded ? (contract.code4BendExclusionReason || contract.bendArcDegradationReason || '') : '',
      genericInputXmlBendSegmentRole: segment.role || '',
      genericBendRadiusMm: contract.genericInputXmlBend?.genericBendRadiusMm || null,
      genericBendTrimLengthMm: contract.genericInputXmlBend?.trimLengthMm || null,
      originalBendRadiusMm: contract.genericInputXmlBend?.originalBendRadiusMm || contract.arc?.bendRadiusMm || null,
      sourceRouteTrimmedForCode4Bend: Boolean(segment.trimmedForCode4Bend || contract.managedStageCode4BendPlan),
      sourceRouteTrimmedForNodeLocalElbow: Boolean(segment.trimmedForNodeLocalElbow),
      sourceRouteStartTrimMm: segment.startTrimMm || 0,
      sourceRouteEndTrimMm: segment.endTrimMm || 0,
      orientationAssumption: sourceRouteSegment
        ? (explicitCode4SourceRoute
          ? 'InputXML-derived JSON BEND source route preserved as trimmed code-8 cylinder connecting into the explicit code-4 bend'
          : 'InputXML-derived JSON BEND APOS/LPOS preserved as trimmed source-route code-8 cylinder; explicit managedStageCode4BendPlan carries bend geometry')
        : 'InputXML-derived JSON bend excluded; emitted as reconstructed generic 1.5D code-8 arc cylinders'
    };
  });
}

function planGenericInputXmlBranchFittingCylinders(contract) {
  const fittings = contract.genericInputXmlBranchFittings || [];
  const primitives = [];
  for (const fitting of fittings) {
    for (const [index, segment] of (fitting.segments || []).entries()) {
      const primitive = buildEndpointLockedCylinderPrimitive({
        name: `${fitting.name}_SEG_${index + 1}`,
        localName: `${fitting.fittingClass.toLowerCase()}-generic-branch-leg-${index + 1}`,
        startMm: segment.startMm,
        endMm: segment.endMm,
        radiusMm: segment.radiusMm,
        material: MANAGED_STAGE_RVM_MATERIALS.FITTING,
        sourceContractName: contract.name,
        sourceElementId: contract.sourceElementId || contract.elementId || '',
        primitiveRole: `inputxml-generic-${fitting.fittingClass.toLowerCase()}-branch-fitting`,
        parentStartMm: contract.startMm,
        parentEndMm: contract.endMm,
        startOffsetMm: 0,
        endOffsetMm: 0
      });
      primitives.push({
        ...primitive,
        recipeName: `inputxml-generic-${fitting.fittingClass.toLowerCase()}-branch-fitting`,
        genericInputXmlBranchFitting: true,
        branchFittingClass: fitting.fittingClass,
        branchFittingNode: fitting.node,
        branchFittingHostContractName: fitting.hostContractName,
        branchFittingConnectionCount: fitting.connectionCount,
        orientationAssumption: 'InputXML-derived JSON has no explicit TEE/OLET record; generic branch fitting inferred from topology node'
      });
    }
  }
  return primitives;
}

function planGenericInputXmlNodeLocalElbows(contract, pipeRadius) {
  const elbows = contract.genericInputXmlNodeLocalElbows || [];
  const primitives = [];
  for (const elbow of elbows) {
    if (elbow.code4) {
      primitives.push(planNodeLocalCode4Elbow(contract, elbow, pipeRadius));
      continue;
    }
    for (const [index, segment] of (elbow.segments || []).entries()) {
      const primitive = buildEndpointLockedCylinderPrimitive({
        name: `${elbow.name}_SEG_${index + 1}`,
        localName: `node-local-elbow-${elbow.node}-${index + 1}`,
        startMm: segment.startMm,
        endMm: segment.endMm,
        radiusMm: segment.radiusMm,
        material: MANAGED_STAGE_RVM_MATERIALS.FITTING,
        sourceContractName: contract.name,
        sourceElementId: contract.sourceElementId || contract.elementId || '',
        primitiveRole: 'inputxml-node-local-1p5d-elbow',
        primitiveRoleTag: 'bendGenericArcCylinder',
        parentStartMm: contract.startMm,
        parentEndMm: contract.endMm,
        startOffsetMm: 0,
        endOffsetMm: 0
      });
      primitives.push({
        ...primitive,
        recipeName: 'inputxml-node-local-1p5d-elbow',
        genericInputXmlNodeLocalElbow: true,
        nodeLocalElbowNode: elbow.node,
        nodeLocalElbowSegmentIndex: index,
        nodeLocalElbowSegmentCount: elbow.segments.length,
        nodeLocalElbowParentSourceContractNames: elbow.parentSourceContractNames || [],
        orientationAssumption: 'InputXML source routes are preserved; this additive node-local elbow is endpoint-locked to the final trimmed source-route endpoints'
      });
    }
  }
  return primitives;
}

function planNodeLocalCode4Elbow(contract, elbow, pipeRadius) {
  const code4 = elbow.code4;
  const synthetic = {
    ...contract,
    name: `${elbow.name}_CODE4`,
    dtxr: 'BEND',
    centerlineKind: 'arc',
    excludeCode4Bend: false,
    startMm: code4.startMm,
    endMm: code4.endMm,
    lengthMm: distance(code4.startMm, code4.endMm),
    centerMm: midpoint(code4.startMm, code4.endMm),
    axis: unitVector(vsub(code4.endMm, code4.startMm)),
    arc: {
      bendRadiusMm: code4.bendRadiusMm,
      tubeRadiusMm: code4.tubeRadiusMm || pipeRadius,
      sweepAngleRad: code4.sweepAngleRad,
      bendAngleDeg: code4.bendAngleDeg,
      startTangent: code4.startTangent,
      endTangent: code4.endTangent,
      planeNormal: code4.planeNormal,
      tangentHintState: 'node-local-topology',
      tangentHintSources: elbow.parentSourceContractNames || []
    }
  };
  const solved = solveCode4ElbowGeometry(synthetic, { preserveDeclaredRadius: true });
  return {
    ...code4ElbowPrimitiveFromSolved(synthetic, pipeRadius, solved),
    name: `${elbow.name}_CODE4`,
    localName: `node-local-code4-elbow-${elbow.node}`,
    primitiveRole: 'inputxml-node-local-code4-elbow',
    primitiveRoleTag: 'bendCode4Elbow',
    recipeName: 'inputxml-node-local-code4-elbow',
    genericInputXmlNodeLocalElbow: true,
    nodeLocalElbowNode: elbow.node,
    nodeLocalElbowParentSourceContractNames: elbow.parentSourceContractNames || [],
    nodeLocalElbowSegmentCount: 1,
    orientationAssumption: 'InputXML source routes are trimmed at topology turn node; code-4 elbow uses node-local tangent endpoints and declared/topology radius'
  };
}

function planCode4ElbowOrSourceRoute(contract, pipeRadius, options = {}) {
  const solved = solveCode4ElbowGeometry(contract, options.code4ElbowSolver || {});
  const radiusInflationMm = Number(solved.radiusInflatedMm || 0);
  const toleranceMm = Number(options.maxCode4BendRadiusInflationMm ?? CODE4_RADIUS_INFLATION_TOLERANCE_MM);
  if (radiusInflationMm > toleranceMm && options.allowCode4BendRadiusInflation !== true) {
    const blocked = {
      ...contract,
      excludeCode4Bend: true,
      code4BendExclusionReason: `Code-4 bend blocked: APOS/LPOS chord requires radius inflation ${radiusInflationMm} mm from declared ${solved.declaredBendRadiusMm} mm to emitted ${solved.bendRadiusMm} mm`,
      genericInputXmlBend: {
        mode: 'code8-source-route-cylinder',
        segments: [{ role: 'source-route', startMm: contract.startMm, endMm: contract.endMm }],
        originalBendRadiusMm: contract.arc?.bendRadiusMm || null
      }
    };
    return planGenericInputXmlBendCylinders(blocked, pipeRadius);
  }
  return [code4ElbowPrimitiveFromSolved(contract, pipeRadius, solved)];
}

function code4ElbowPrimitiveFromSolved(contract, pipeRadius, solved) {
  const tubeRadius = Number(solved.tubeRadiusMm ?? pipeRadius);
  return {
    kind: 'elbow',
    name: `${contract.name}_BEND`,
    localName: 'bend',
    primitiveRole: 'inputxml-code4-bend-elbow',
    primitiveRoleTag: 'bendCode4Elbow',
    center: solved.centerMm,
    direction: solved.direction,
    basis: solved.basis,
    bendRadius: solved.bendRadiusMm,
    tubeRadius,
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

function isValidCode4PayloadGeometry(solved = {}) {
  const bendRadius = Number(solved.bendRadiusMm);
  const tubeRadius = Number(solved.tubeRadiusMm);
  const sweepAngle = Number(solved.sweepAngleRad);
  return Number.isFinite(bendRadius) && Number.isFinite(tubeRadius) && Number.isFinite(sweepAngle) && bendRadius + CODE4_PAYLOAD_TOLERANCE_MM >= tubeRadius && bendRadius > 0 && tubeRadius > 0 && sweepAngle > 0;
}

function asGeometryContract(recordOrContract, elementIndex) {
  if (recordOrContract?.schema === 'ManagedStageGeometryContract.v1') return recordOrContract;
  return createManagedStageGeometryContract(recordOrContract, elementIndex);
}

function distance(a, b) { return Math.hypot(Number(a?.[0]) - Number(b?.[0]), Number(a?.[1]) - Number(b?.[1]), Number(a?.[2]) - Number(b?.[2])); }
function midpoint(a, b) { return [(Number(a?.[0]) + Number(b?.[0])) / 2, (Number(a?.[1]) + Number(b?.[1])) / 2, (Number(a?.[2]) + Number(b?.[2])) / 2]; }
function vsub(a, b) { return [Number(a?.[0]) - Number(b?.[0]), Number(a?.[1]) - Number(b?.[1]), Number(a?.[2]) - Number(b?.[2])]; }
function unitVector(v) { const len = Math.hypot(v[0], v[1], v[2]); return len > 1e-9 ? v.map((entry) => entry / len) : [0, 0, 1]; }

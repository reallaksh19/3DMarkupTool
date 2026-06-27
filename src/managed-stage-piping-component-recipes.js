import { buildContractCylinderPrimitive } from './rvm-cylinder-primitive-builder.js?v=bust-cache-4';
import { buildRvmAxisBasis } from './rvm-axis-basis-policy.js?v=bust-cache-4';

export const MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA = 'ManagedStagePipingComponentRecipe.v1';

const EPS_MM = 1e-6;

export function planManagedStagePipingComponentRecipe(contract, options = {}) {
  assertContract(contract);
  const materials = options.materials || {};
  const pipeRadius = positiveNumber(options.pipeRadiusMm ?? contract.radiusMm, 'pipeRadiusMm');
  const dtxr = contract.dtxr;
  const span = effectiveRecipeSpan(contract);
  if (dtxr === 'PIPE') return buildRecipe(contract, span, 'pipe-full-span', [segment(0, span.lengthMm, 'body', pipeRadius, materials.PIPE)]);
  if (dtxr === 'UNSPECIFIED') return buildRecipe(contract, span, 'unknown-pipelike-full-span', [segment(0, span.lengthMm, 'body', pipeRadius, materials.UNKNOWN_PIPELIKE)]);
  if (dtxr === 'FLANGE') return buildWeldNeckFlangeRecipe(contract, span, pipeRadius, materials);
  if (dtxr === 'VALVE') return buildBallValveRecipe(contract, span, pipeRadius, materials, 'ball-valve-contiguous-5part');
  if (dtxr === 'FLANGE_PAIR') return buildFlangePairRecipe(contract, span, pipeRadius, materials);
  if (dtxr === 'FLANGED_VALVE') return buildBallValveRecipe(contract, span, pipeRadius, materials, 'flanged-ball-valve-contiguous-5part');
  throw new Error(`Unsupported cylinder recipe DTXR: ${dtxr}`);
}

export function assertManagedStagePipingComponentRecipe(recipe, expectations = {}) {
  if (!recipe || recipe.schema !== MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA) throw new Error('Expected managed-stage piping component recipe');
  if (!Array.isArray(recipe.primitives) || recipe.primitives.length !== recipe.primitiveCount) {
    throw new Error(`Recipe primitive count mismatch for ${recipe.componentName || 'UNNAMED_COMPONENT'}`);
  }
  if (recipe.continuous !== true) throw new Error(`Recipe is not continuous: ${recipe.componentName}`);
  const expectedCoverage = recipe.effectiveContractLengthMm ?? recipe.contractLengthMm;
  if (Math.abs(recipe.coveredLengthMm - expectedCoverage) > EPS_MM) {
    throw new Error(`Recipe coverage mismatch for ${recipe.componentName}: ${recipe.coveredLengthMm} != ${expectedCoverage}`);
  }
  if (expectations.primitiveCount !== undefined && recipe.primitiveCount !== expectations.primitiveCount) {
    throw new Error(`Recipe primitive count expected ${expectations.primitiveCount}, got ${recipe.primitiveCount}`);
  }
  if (expectations.recipeName && recipe.recipeName !== expectations.recipeName) {
    throw new Error(`Recipe name expected ${expectations.recipeName}, got ${recipe.recipeName}`);
  }
  return true;
}

export function flangeRadius(pipeRadius) { return Math.max(positiveNumber(pipeRadius, 'pipeRadius') * 1.55, pipeRadius + 35); }
export function valveRadius(pipeRadius) { return Math.max(positiveNumber(pipeRadius, 'pipeRadius') * 1.35, pipeRadius + 25); }

function buildWeldNeckFlangeRecipe(contract, span, pipeRadius, materials) {
  const split = span.lengthMm * 0.46;
  const hubRootRadius = Math.max(pipeRadius * 1.18, pipeRadius + 8);
  return buildRecipe(contract, span, 'weldneck-flange-contiguous-2part', [
    segment(0, split, 'weldNeckHub', hubRootRadius, materials.FLANGE, {
      kind: 'snout',
      radiusBottomMm: hubRootRadius,
      radiusTopMm: pipeRadius
    }),
    segment(split, span.lengthMm, 'raisedFaceDisk', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildFlangePairRecipe(contract, span, pipeRadius, materials) {
  const split = span.lengthMm / 2;
  return buildRecipe(contract, span, 'flange-pair-contiguous-split', [
    segment(0, split, 'flangeA', flangeRadius(pipeRadius), materials.FLANGE),
    segment(split, span.lengthMm, 'flangeB', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildBallValveRecipe(contract, span, pipeRadius, materials, recipeName) {
  const length = span.lengthMm;
  const cuts = proportionalCuts(length, [0.14, 0.16, 0.40, 0.16, 0.14]);
  const bodyRadius = valveRadius(pipeRadius);
  return buildRecipe(contract, span, recipeName, [
    segment(cuts[0], cuts[1], 'leftEndFlange', flangeRadius(pipeRadius), materials.FLANGE),
    segment(cuts[1], cuts[2], 'leftSeat', Math.max(pipeRadius * 1.04, pipeRadius + 2), materials.VALVE),
    segment(cuts[2], cuts[3], 'centralBallBody', bodyRadius, materials.VALVE, {
      kind: 'sphere',
      diameterMm: bodyRadius * 2
    }),
    segment(cuts[3], cuts[4], 'rightSeat', Math.max(pipeRadius * 1.04, pipeRadius + 2), materials.VALVE),
    segment(cuts[4], cuts[5], 'rightEndFlange', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function proportionalCuts(length, weights) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  const cuts = [0];
  let cursor = 0;
  for (const weight of weights) {
    cursor += length * (weight / total);
    cuts.push(cursor);
  }
  cuts[cuts.length - 1] = length;
  return cuts;
}

function buildRecipe(contract, span, recipeName, segments) {
  validateSegments(span, recipeName, segments);
  const primitives = segments.map((entry, index) => {
    const primitive = buildPrimitiveForRecipeSegment(contract, span, entry);
    return {
      ...primitive,
      recipeName,
      recipeSegmentIndex: index,
      recipeSegmentCount: segments.length,
      recipeSegmentStartDistanceMm: entry.startDistanceMm,
      recipeSegmentEndDistanceMm: entry.endDistanceMm,
      recipeTrimStartOffsetMm: span.startOffsetMm,
      recipeTrimEndOffsetMm: span.endOffsetMm,
      recipeContinuous: true,
      exportedRvmGeometry: true,
      exportedManagedStageComponentSymbol: isPrimitiveSymbolRecipe(recipeName),
      componentPrimitiveBudgetCounted: true,
      componentPrimitiveBudgetLimit: primitiveBudgetLimit(recipeName),
      geometryPrimitivePolicy: geometryPrimitivePolicy(recipeName)
    };
  });
  return {
    schema: MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA,
    componentName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    dtxr: contract.dtxr,
    recipeName,
    contractLengthMm: contract.lengthMm,
    effectiveContractLengthMm: span.lengthMm,
    trimStartOffsetMm: span.startOffsetMm,
    trimEndOffsetMm: span.endOffsetMm,
    primitiveCount: primitives.length,
    primitiveBudgetLimit: primitiveBudgetLimit(recipeName),
    exportedRvmGeometry: true,
    exportedManagedStageComponentSymbol: isPrimitiveSymbolRecipe(recipeName),
    geometryPrimitivePolicy: geometryPrimitivePolicy(recipeName),
    coveredLengthMm: coveredLength(segments),
    continuous: true,
    segments: segments.map((entry) => ({ ...entry, lengthMm: entry.endDistanceMm - entry.startDistanceMm })),
    primitives
  };
}

function buildPrimitiveForRecipeSegment(contract, span, entry) {
  const startOffsetMm = span.startOffsetMm + entry.startDistanceMm;
  const endOffsetMm = span.endOffsetMm + (span.lengthMm - entry.endDistanceMm);
  if (entry.kind === 'snout') {
    return buildContractSnoutPrimitive(contract, {
      localName: entry.localName,
      radiusBottomMm: entry.radiusBottomMm,
      radiusTopMm: entry.radiusTopMm,
      material: entry.material,
      primitiveRole: entry.localName,
      startOffsetMm,
      endOffsetMm
    });
  }
  if (entry.kind === 'sphere') {
    return buildContractSpherePrimitive(contract, {
      localName: entry.localName,
      diameterMm: entry.diameterMm,
      radiusMm: entry.radiusMm,
      material: entry.material,
      primitiveRole: entry.localName,
      startOffsetMm,
      endOffsetMm
    });
  }
  return buildContractCylinderPrimitive(contract, {
    localName: entry.localName,
    radiusMm: entry.radiusMm,
    material: entry.material,
    primitiveRole: entry.localName,
    startOffsetMm,
    endOffsetMm
  });
}

function buildContractSnoutPrimitive(contract, options = {}) {
  const base = contractPrimitiveBase(contract, options);
  const radiusBottom = positiveNumber(options.radiusBottomMm ?? options.radiusBottom ?? options.radiusMm, `${base.localName}.radiusBottomMm`);
  const radiusTop = nonNegativeNumber(options.radiusTopMm ?? options.radiusTop ?? options.radiusMm, `${base.localName}.radiusTopMm`);
  const height = base.length;
  const bboxRadius = Math.max(radiusBottom, radiusTop);
  return {
    ...base,
    kind: 'snout',
    radiusBottom,
    radiusTop,
    height,
    offsetX: 0,
    offsetY: 0,
    basis: buildRvmAxisBasis(base.direction),
    radius: bboxRadius,
    localBbox: [-bboxRadius, -bboxRadius, -height / 2, bboxRadius, bboxRadius, height / 2]
  };
}

function buildContractSpherePrimitive(contract, options = {}) {
  const base = contractPrimitiveBase(contract, options);
  const diameter = positiveNumber(options.diameterMm ?? (positiveNumber(options.radiusMm, `${base.localName}.radiusMm`) * 2), `${base.localName}.diameterMm`);
  const radius = diameter / 2;
  return {
    ...base,
    kind: 'sphere',
    diameter,
    radius,
    localBbox: [-radius, -radius, -radius, radius, radius, radius]
  };
}

function contractPrimitiveBase(contract, options = {}) {
  assertContract(contract);
  const startOffsetMm = nonNegativeNumber(options.startOffsetMm ?? 0, 'startOffsetMm');
  const endOffsetMm = nonNegativeNumber(options.endOffsetMm ?? 0, 'endOffsetMm');
  if (startOffsetMm + endOffsetMm >= contract.lengthMm - EPS_MM) {
    throw new Error(`Primitive offsets consume contract span for ${contract.name || 'UNNAMED_CONTRACT'}`);
  }
  const start = pointAlong(contract.startMm, contract.axis, startOffsetMm);
  const end = pointAlong(contract.endMm, contract.axis, -endOffsetMm);
  const delta = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  const length = Math.hypot(delta[0], delta[1], delta[2]);
  if (!(length > EPS_MM)) throw new Error(`Recipe primitive requires non-zero span: ${contract.name}`);
  const direction = delta.map((entry) => entry / length);
  const localName = String(options.localName || 'body');
  return {
    name: options.name || `${contract.name}_${localName}`,
    localName,
    center: midpoint(start, end),
    direction,
    length,
    material: options.material,
    endpointLocked: true,
    startMm: start,
    endMm: end,
    sourceContractName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    primitiveRole: options.primitiveRole || localName,
    parentStartMm: contract.startMm,
    parentEndMm: contract.endMm,
    startOffsetMm,
    endOffsetMm
  };
}

function isPrimitiveSymbolRecipe(recipeName) {
  return recipeName === 'weldneck-flange-contiguous-2part'
    || recipeName === 'ball-valve-contiguous-5part'
    || recipeName === 'flanged-ball-valve-contiguous-5part';
}

function primitiveBudgetLimit(recipeName) {
  if (recipeName === 'weldneck-flange-contiguous-2part') return 2;
  if (recipeName === 'ball-valve-contiguous-5part') return 5;
  if (recipeName === 'flanged-ball-valve-contiguous-5part') return 6;
  return null;
}

function geometryPrimitivePolicy(recipeName) {
  if (recipeName === 'weldneck-flange-contiguous-2part') {
    return 'RVM export emits WeldNeck flange as a native code-7 Snout weld-neck hub plus a code-8 raised-face disk, covering full APOS/LPOS span.';
  }
  if (recipeName === 'ball-valve-contiguous-5part' || recipeName === 'flanged-ball-valve-contiguous-5part') {
    return 'RVM export emits Ball valve as native primitives: end flanges and seats as code-8 cylinders plus central ball body as code-9 sphere, covering full APOS/LPOS span with no stem/handwheel/box substitute.';
  }
  return 'RVM export emits source APOS/LPOS span as contiguous code-8 cylinder recipe.';
}

function effectiveRecipeSpan(contract) {
  const startOffsetMm = nonNegativeNumber(contract.rvmTrimStartOffsetMm || 0, 'contract.rvmTrimStartOffsetMm');
  const endOffsetMm = nonNegativeNumber(contract.rvmTrimEndOffsetMm || 0, 'contract.rvmTrimEndOffsetMm');
  const lengthMm = contract.lengthMm - startOffsetMm - endOffsetMm;
  if (!(lengthMm > EPS_MM)) throw new Error(`InputXML bend trim consumes component span for ${contract.name}`);
  return { startOffsetMm, endOffsetMm, lengthMm };
}

function segment(startDistanceMm, endDistanceMm, localName, radiusMm, material, extra = {}) {
  return {
    startDistanceMm: Number(startDistanceMm),
    endDistanceMm: Number(endDistanceMm),
    localName: String(localName),
    radiusMm: positiveNumber(radiusMm, `${localName}.radiusMm`),
    kind: extra.kind || 'cylinder',
    material,
    ...extra
  };
}

function validateSegments(span, recipeName, segments) {
  if (!Array.isArray(segments) || segments.length === 0) throw new Error(`Recipe ${recipeName} has no segments`);
  let cursor = 0;
  for (const entry of segments) {
    if (!Number.isFinite(entry.startDistanceMm) || !Number.isFinite(entry.endDistanceMm)) throw new Error(`Recipe ${recipeName} contains non-finite span`);
    if (Math.abs(entry.startDistanceMm - cursor) > EPS_MM) {
      throw new Error(`Recipe ${recipeName} is not contiguous at ${entry.localName}: expected start ${cursor}, got ${entry.startDistanceMm}`);
    }
    if (!(entry.endDistanceMm > entry.startDistanceMm)) throw new Error(`Recipe ${recipeName} has zero/negative segment ${entry.localName}`);
    if (entry.endDistanceMm > span.lengthMm + EPS_MM) throw new Error(`Recipe ${recipeName} exceeds effective contract span`);
    cursor = entry.endDistanceMm;
  }
  if (Math.abs(cursor - span.lengthMm) > EPS_MM) {
    throw new Error(`Recipe ${recipeName} does not cover effective span: ${cursor} != ${span.lengthMm}`);
  }
}

function coveredLength(segments) {
  return segments.reduce((total, entry) => total + (entry.endDistanceMm - entry.startDistanceMm), 0);
}

function assertContract(contract) {
  if (!contract || contract.schema !== 'ManagedStageGeometryContract.v1') throw new Error('Expected ManagedStageGeometryContract.v1');
  if (contract.endpointLocked !== true) throw new Error(`Contract is not endpoint locked: ${contract.name}`);
  if (!['line', 'arc'].includes(contract.centerlineKind)) throw new Error(`Unsupported contract centerline kind: ${contract.centerlineKind}`);
  positiveNumber(contract.lengthMm, 'contract.lengthMm');
  positiveNumber(contract.radiusMm, 'contract.radiusMm');
  vector3(contract.startMm, 'contract.startMm');
  vector3(contract.endMm, 'contract.endMm');
  vector3(contract.axis, 'contract.axis');
}

function pointAlong(start, axis, distanceMm) {
  return [
    start[0] + axis[0] * distanceMm,
    start[1] + axis[1] * distanceMm,
    start[2] + axis[2] * distanceMm
  ];
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function vector3(value, fieldName) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`Invalid ${fieldName}: expected [x, y, z]`);
  const vector = value.map((entry) => Number(entry));
  if (vector.some((entry) => !Number.isFinite(entry))) throw new Error(`Invalid ${fieldName}: contains non-finite value`);
  return vector;
}

function positiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid ${fieldName}: expected positive number`);
  return number;
}

function nonNegativeNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid ${fieldName}: expected non-negative number`);
  return number;
}

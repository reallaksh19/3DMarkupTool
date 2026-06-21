import { buildContractCylinderPrimitive } from './rvm-cylinder-primitive-builder.js';

export const MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA = 'ManagedStagePipingComponentRecipe.v1';

export function planManagedStagePipingComponentRecipe(contract, options = {}) {
  assertContract(contract);
  const materials = options.materials || {};
  const pipeRadius = positiveNumber(options.pipeRadiusMm ?? contract.radiusMm, 'pipeRadiusMm');
  const dtxr = contract.dtxr;
  const span = effectiveRecipeSpan(contract);
  if (dtxr === 'PIPE') return buildRecipe(contract, span, 'pipe-full-span', [segment(0, span.lengthMm, 'body', pipeRadius, materials.PIPE)]);
  if (dtxr === 'UNSPECIFIED') return buildRecipe(contract, span, 'unknown-pipelike-full-span', [segment(0, span.lengthMm, 'body', pipeRadius, materials.UNKNOWN_PIPELIKE)]);
  if (dtxr === 'FLANGE') {
    return buildRecipe(contract, span, 'flange-full-span', [segment(0, span.lengthMm, 'flange', flangeRadius(pipeRadius), materials.FLANGE)]);
  }
  if (dtxr === 'VALVE') {
    return buildRecipe(contract, span, 'valve-full-span', [segment(0, span.lengthMm, 'body', valveRadius(pipeRadius), materials.VALVE)]);
  }
  if (dtxr === 'FLANGE_PAIR') return buildFlangePairRecipe(contract, span, pipeRadius, materials);
  if (dtxr === 'FLANGED_VALVE') return buildFlangedValveRecipe(contract, span, pipeRadius, materials);
  throw new Error(`Unsupported cylinder recipe DTXR: ${dtxr}`);
}

export function assertManagedStagePipingComponentRecipe(recipe, expectations = {}) {
  if (!recipe || recipe.schema !== MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA) throw new Error('Expected managed-stage piping component recipe');
  if (!Array.isArray(recipe.primitives) || recipe.primitives.length !== recipe.primitiveCount) {
    throw new Error(`Recipe primitive count mismatch for ${recipe.componentName || 'UNNAMED_COMPONENT'}`);
  }
  if (recipe.continuous !== true) throw new Error(`Recipe is not continuous: ${recipe.componentName}`);
  const expectedCoverage = recipe.effectiveContractLengthMm ?? recipe.contractLengthMm;
  if (Math.abs(recipe.coveredLengthMm - expectedCoverage) > 1e-6) {
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

function buildFlangePairRecipe(contract, span, pipeRadius, materials) {
  const split = span.lengthMm / 2;
  return buildRecipe(contract, span, 'flange-pair-contiguous-split', [
    segment(0, split, 'flangeA', flangeRadius(pipeRadius), materials.FLANGE),
    segment(split, span.lengthMm, 'flangeB', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildFlangedValveRecipe(contract, span, pipeRadius, materials) {
  const length = span.lengthMm;
  const maxFlangeLen = Math.min(90, length * 0.22);
  const minBodyLen = Math.max(1, length * 0.35);
  const flangeLen = Math.min(maxFlangeLen, (length - minBodyLen) / 2);
  if (!(flangeLen > 0)) throw new Error(`Invalid flanged valve recipe span for ${contract.name}`);
  return buildRecipe(contract, span, 'flanged-valve-contiguous-3part', [
    segment(0, flangeLen, 'flangeA', flangeRadius(pipeRadius), materials.FLANGE),
    segment(flangeLen, length - flangeLen, 'body', valveRadius(pipeRadius), materials.VALVE),
    segment(length - flangeLen, length, 'flangeB', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildRecipe(contract, span, recipeName, segments) {
  validateSegments(span, recipeName, segments);
  const primitives = segments.map((entry, index) => {
    const primitive = buildContractCylinderPrimitive(contract, {
      localName: entry.localName,
      radiusMm: entry.radiusMm,
      material: entry.material,
      primitiveRole: entry.localName,
      startOffsetMm: span.startOffsetMm + entry.startDistanceMm,
      endOffsetMm: span.endOffsetMm + (span.lengthMm - entry.endDistanceMm)
    });
    return {
      ...primitive,
      recipeName,
      recipeSegmentIndex: index,
      recipeSegmentCount: segments.length,
      recipeSegmentStartDistanceMm: entry.startDistanceMm,
      recipeSegmentEndDistanceMm: entry.endDistanceMm,
      recipeTrimStartOffsetMm: span.startOffsetMm,
      recipeTrimEndOffsetMm: span.endOffsetMm,
      recipeContinuous: true
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
    coveredLengthMm: coveredLength(segments),
    continuous: true,
    segments: segments.map((entry) => ({ ...entry, lengthMm: entry.endDistanceMm - entry.startDistanceMm })),
    primitives
  };
}

function effectiveRecipeSpan(contract) {
  const startOffsetMm = nonNegativeNumber(contract.rvmTrimStartOffsetMm || 0, 'contract.rvmTrimStartOffsetMm');
  const endOffsetMm = nonNegativeNumber(contract.rvmTrimEndOffsetMm || 0, 'contract.rvmTrimEndOffsetMm');
  const lengthMm = contract.lengthMm - startOffsetMm - endOffsetMm;
  if (!(lengthMm > 1e-6)) throw new Error(`InputXML bend trim consumes component span for ${contract.name}`);
  return { startOffsetMm, endOffsetMm, lengthMm };
}

function segment(startDistanceMm, endDistanceMm, localName, radiusMm, material) {
  return {
    startDistanceMm: Number(startDistanceMm),
    endDistanceMm: Number(endDistanceMm),
    localName: String(localName),
    radiusMm: positiveNumber(radiusMm, `${localName}.radiusMm`),
    material
  };
}

function validateSegments(span, recipeName, segments) {
  if (!Array.isArray(segments) || segments.length === 0) throw new Error(`Recipe ${recipeName} has no segments`);
  let cursor = 0;
  for (const entry of segments) {
    if (!Number.isFinite(entry.startDistanceMm) || !Number.isFinite(entry.endDistanceMm)) throw new Error(`Recipe ${recipeName} contains non-finite span`);
    if (Math.abs(entry.startDistanceMm - cursor) > 1e-6) {
      throw new Error(`Recipe ${recipeName} is not contiguous at ${entry.localName}: expected start ${cursor}, got ${entry.startDistanceMm}`);
    }
    if (!(entry.endDistanceMm > entry.startDistanceMm)) throw new Error(`Recipe ${recipeName} has zero/negative segment ${entry.localName}`);
    if (entry.endDistanceMm > span.lengthMm + 1e-6) throw new Error(`Recipe ${recipeName} exceeds effective contract span`);
    cursor = entry.endDistanceMm;
  }
  if (Math.abs(cursor - span.lengthMm) > 1e-6) {
    throw new Error(`Recipe ${recipeName} does not cover effective span: ${cursor} != ${span.lengthMm}`);
  }
}

function coveredLength(segments) {
  return segments.reduce((total, entry) => total + (entry.endDistanceMm - entry.startDistanceMm), 0);
}

function assertContract(contract) {
  if (!contract || contract.schema !== 'ManagedStageGeometryContract.v1') throw new Error('Expected ManagedStageGeometryContract.v1');
  positiveNumber(contract.lengthMm, 'contract.lengthMm');
  positiveNumber(contract.radiusMm, 'contract.radiusMm');
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

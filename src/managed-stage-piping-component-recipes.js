import { buildContractCylinderPrimitive } from './rvm-cylinder-primitive-builder.js';

export const MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA = 'ManagedStagePipingComponentRecipe.v1';

export function planManagedStagePipingComponentRecipe(contract, options = {}) {
  assertContract(contract);
  const materials = options.materials || {};
  const pipeRadius = positiveNumber(options.pipeRadiusMm ?? contract.radiusMm, 'pipeRadiusMm');
  const dtxr = contract.dtxr;
  if (dtxr === 'PIPE') return buildRecipe(contract, 'pipe-full-span', [segment(0, contract.lengthMm, 'body', pipeRadius, materials.PIPE)]);
  if (dtxr === 'UNSPECIFIED') return buildRecipe(contract, 'unknown-pipelike-full-span', [segment(0, contract.lengthMm, 'body', pipeRadius, materials.UNKNOWN_PIPELIKE)]);
  if (dtxr === 'FLANGE') {
    return buildRecipe(contract, 'flange-full-span', [segment(0, contract.lengthMm, 'flange', flangeRadius(pipeRadius), materials.FLANGE)]);
  }
  if (dtxr === 'VALVE') {
    return buildRecipe(contract, 'valve-full-span', [segment(0, contract.lengthMm, 'body', valveRadius(pipeRadius), materials.VALVE)]);
  }
  if (dtxr === 'FLANGE_PAIR') return buildFlangePairRecipe(contract, pipeRadius, materials);
  if (dtxr === 'FLANGED_VALVE') return buildFlangedValveRecipe(contract, pipeRadius, materials);
  throw new Error(`Unsupported cylinder recipe DTXR: ${dtxr}`);
}

export function assertManagedStagePipingComponentRecipe(recipe, expectations = {}) {
  if (!recipe || recipe.schema !== MANAGED_STAGE_COMPONENT_RECIPE_SCHEMA) throw new Error('Expected managed-stage piping component recipe');
  if (!Array.isArray(recipe.primitives) || recipe.primitives.length !== recipe.primitiveCount) {
    throw new Error(`Recipe primitive count mismatch for ${recipe.componentName || 'UNNAMED_COMPONENT'}`);
  }
  if (recipe.continuous !== true) throw new Error(`Recipe is not continuous: ${recipe.componentName}`);
  if (Math.abs(recipe.coveredLengthMm - recipe.contractLengthMm) > 1e-6) {
    throw new Error(`Recipe coverage mismatch for ${recipe.componentName}: ${recipe.coveredLengthMm} != ${recipe.contractLengthMm}`);
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

function buildFlangePairRecipe(contract, pipeRadius, materials) {
  const split = contract.lengthMm / 2;
  return buildRecipe(contract, 'flange-pair-contiguous-split', [
    segment(0, split, 'flangeA', flangeRadius(pipeRadius), materials.FLANGE),
    segment(split, contract.lengthMm, 'flangeB', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildFlangedValveRecipe(contract, pipeRadius, materials) {
  const length = contract.lengthMm;
  const maxFlangeLen = Math.min(90, length * 0.22);
  const minBodyLen = Math.max(1, length * 0.35);
  const flangeLen = Math.min(maxFlangeLen, (length - minBodyLen) / 2);
  if (!(flangeLen > 0)) throw new Error(`Invalid flanged valve recipe span for ${contract.name}`);
  return buildRecipe(contract, 'flanged-valve-contiguous-3part', [
    segment(0, flangeLen, 'flangeA', flangeRadius(pipeRadius), materials.FLANGE),
    segment(flangeLen, length - flangeLen, 'body', valveRadius(pipeRadius), materials.VALVE),
    segment(length - flangeLen, length, 'flangeB', flangeRadius(pipeRadius), materials.FLANGE)
  ]);
}

function buildRecipe(contract, recipeName, segments) {
  validateSegments(contract, recipeName, segments);
  const primitives = segments.map((entry, index) => {
    const primitive = buildContractCylinderPrimitive(contract, {
      localName: entry.localName,
      radiusMm: entry.radiusMm,
      material: entry.material,
      primitiveRole: entry.localName,
      startOffsetMm: entry.startDistanceMm,
      endOffsetMm: contract.lengthMm - entry.endDistanceMm
    });
    return {
      ...primitive,
      recipeName,
      recipeSegmentIndex: index,
      recipeSegmentCount: segments.length,
      recipeSegmentStartDistanceMm: entry.startDistanceMm,
      recipeSegmentEndDistanceMm: entry.endDistanceMm,
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
    primitiveCount: primitives.length,
    coveredLengthMm: coveredLength(segments),
    continuous: true,
    segments: segments.map((entry) => ({ ...entry, lengthMm: entry.endDistanceMm - entry.startDistanceMm })),
    primitives
  };
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

function validateSegments(contract, recipeName, segments) {
  if (!Array.isArray(segments) || segments.length === 0) throw new Error(`Recipe ${recipeName} has no segments`);
  let cursor = 0;
  for (const entry of segments) {
    if (!Number.isFinite(entry.startDistanceMm) || !Number.isFinite(entry.endDistanceMm)) throw new Error(`Recipe ${recipeName} contains non-finite span`);
    if (Math.abs(entry.startDistanceMm - cursor) > 1e-6) {
      throw new Error(`Recipe ${recipeName} is not contiguous at ${entry.localName}: expected start ${cursor}, got ${entry.startDistanceMm}`);
    }
    if (!(entry.endDistanceMm > entry.startDistanceMm)) throw new Error(`Recipe ${recipeName} has zero/negative segment ${entry.localName}`);
    if (entry.endDistanceMm > contract.lengthMm + 1e-6) throw new Error(`Recipe ${recipeName} exceeds contract span`);
    cursor = entry.endDistanceMm;
  }
  if (Math.abs(cursor - contract.lengthMm) > 1e-6) {
    throw new Error(`Recipe ${recipeName} does not cover full contract span: ${cursor} != ${contract.lengthMm}`);
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

import { assertRvmPrimitiveKindSupported } from './rvm-primitive-kind-contract.js';
import { buildRvmPrimitiveTransform } from './rvm-axis-basis-policy.js';
import { normalizeRvmMaterialId, rvmLayerNameForNode, rvmMaterialIdForNode } from './rvm-material-layer-contract.js';
import { assertSafeApproximationPrimitives } from './rvm-safe-primitive-approximation-policy.js';

export const RVM_EXPORT_MODEL_PREFLIGHT_SCHEMA = 'RvmExportModelPreflight.v1';

/**
 * Fail-closed preflight for the production RVM export model.
 *
 * This runs after naming/catalogue/material policies and before writeRvm(). It
 * validates the exact writer-ready records instead of relying on the writer to
 * discover malformed primitives while serialising binary chunks.
 */
export function assertRvmExportModelPreflight(exportModel = {}) {
  if (!exportModel || !exportModel.root) {
    throw new Error('RVM export-model preflight requires exportModel.root');
  }

  const summary = {
    schema: RVM_EXPORT_MODEL_PREFLIGHT_SCHEMA,
    failClosed: true,
    writerReady: true,
    directRvmPrimitiveCodeAllowed: false,
    sphereDirectionRequired: false,
    nodeCount: 0,
    primitiveCount: 0,
    reviewNameCount: 0,
    implicitSphereDirectionCount: 0,
    kindCounts: {},
    materialIds: new Set(),
    layerNames: new Set()
  };

  visitNode(exportModel.root, 'root', summary);

  return {
    ...summary,
    materialIds: Array.from(summary.materialIds).sort((a, b) => a - b),
    layerNames: Array.from(summary.layerNames).sort(),
    kindCounts: Object.fromEntries(Object.entries(summary.kindCounts).sort((a, b) => a[0].localeCompare(b[0])))
  };
}

function visitNode(node, path, summary) {
  if (!node || typeof node !== 'object') {
    throw new Error(`RVM export-model preflight found invalid node at ${path}`);
  }

  const name = nonEmptyString(node.name, `RVM node.name at ${path}`);
  const reviewName = nonEmptyString(node.reviewName, `RVM node.reviewName for ${name}`);
  if (reviewName) summary.reviewNameCount += 1;

  summary.nodeCount += 1;
  summary.materialIds.add(rvmMaterialIdForNode(node));
  summary.layerNames.add(rvmLayerNameForNode(node));

  if (!Array.isArray(node.primitives)) {
    throw new Error(`RVM node ${reviewName} must expose primitives as an array`);
  }
  if (!Array.isArray(node.children)) {
    throw new Error(`RVM node ${reviewName} must expose children as an array`);
  }

  node.primitives.forEach((primitive, index) => {
    validatePrimitive(primitive, `${reviewName}.primitives[${index}]`, summary);
  });

  node.children.forEach((child, index) => {
    visitNode(child, `${reviewName}.children[${index}]`, summary);
  });
}

function validatePrimitive(primitive, path, summary) {
  if (!primitive || typeof primitive !== 'object') {
    throw new Error(`RVM export-model preflight found invalid primitive at ${path}`);
  }

  const name = nonEmptyString(primitive.name, `RVM primitive.name at ${path}`);
  const kind = assertRvmPrimitiveKindSupported(primitive.kind, `RVM primitive ${name}`);

  if (primitive.rvmPrimitiveCode !== undefined && primitive.rvmPrimitiveCode !== null && primitive.rvmPrimitiveCode !== '') {
    throw new Error(`RVM primitive ${name} attempted direct primitive-code emission. Use writer-safe kind-based output only.`);
  }

  assertSafeApproximationPrimitives([primitive], `RVM export-model preflight primitive ${name}`);
  validateCenter(primitive.center, name);
  validateDirectionPolicy(primitive, name, summary);
  validatePrimitiveDimensions(primitive, name);

  if (primitive.material !== undefined && primitive.material !== null && primitive.material !== '') {
    summary.materialIds.add(normalizeRvmMaterialId(primitive.material, `RVM primitive material for ${name}`));
  }

  // Reuse the writer's axis/basis policy before binary serialization. This keeps
  // transform-scale and right-handed-basis failures in preflight rather than in
  // writeRvm().
  buildRvmPrimitiveTransform({
    ...primitive,
    direction: primitive.kind === 'sphere' && primitive.direction === undefined ? [0, 0, 1] : primitive.direction
  });

  summary.primitiveCount += 1;
  summary.kindCounts[kind] = (summary.kindCounts[kind] || 0) + 1;
}

function validateCenter(value, primitiveName) {
  vector3(value, `RVM primitive ${primitiveName} center`);
}

function validateDirectionPolicy(primitive, primitiveName, summary) {
  if (primitive.kind === 'sphere' && primitive.direction === undefined) {
    summary.implicitSphereDirectionCount += 1;
    return;
  }
  const direction = vector3(primitive.direction, `RVM primitive ${primitiveName} direction`);
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (!Number.isFinite(length) || length <= 1e-9) {
    throw new Error(`RVM primitive ${primitiveName} direction must be a non-zero vector`);
  }
}

function validatePrimitiveDimensions(primitive, primitiveName) {
  if (primitive.kind === 'cylinder') {
    positiveNumber(primitive.radius, `RVM primitive ${primitiveName} radius`);
    positiveNumber(primitive.length, `RVM primitive ${primitiveName} length`);
    return;
  }

  if (primitive.kind === 'box') {
    positiveArray(primitive.lengths, 3, `RVM primitive ${primitiveName} lengths`);
    return;
  }

  if (primitive.kind === 'pyramid') {
    positiveArray(primitive.bottom, 2, `RVM primitive ${primitiveName} bottom`);
    positiveArray(primitive.top, 2, `RVM primitive ${primitiveName} top`);
    finiteArray(primitive.offset, 2, `RVM primitive ${primitiveName} offset`);
    positiveNumber(primitive.height, `RVM primitive ${primitiveName} height`);
    return;
  }

  if (primitive.kind === 'sphere') {
    positiveNumber(primitive.diameter, `RVM primitive ${primitiveName} diameter`);
    return;
  }

  throw new Error(`RVM primitive ${primitiveName} has no dimension contract for kind ${primitive.kind}`);
}

function nonEmptyString(value, context) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${context} must be a non-empty string`);
  return text;
}

function vector3(value, context) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${context} must be [x, y, z]`);
  }
  const vector = value.map((entry) => Number(entry));
  if (vector.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`${context} contains non-finite value`);
  }
  return vector;
}

function finiteArray(value, length, context) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${context} must have ${length} entries`);
  }
  const numbers = value.map((entry) => Number(entry));
  if (numbers.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`${context} contains non-finite value`);
  }
  return numbers;
}

function positiveArray(value, length, context) {
  return finiteArray(value, length, context).map((entry) => {
    if (entry <= 0) throw new Error(`${context} entries must be positive`);
    return entry;
  });
}

function positiveNumber(value, context) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${context} must be a positive finite number`);
  }
  return parsed;
}

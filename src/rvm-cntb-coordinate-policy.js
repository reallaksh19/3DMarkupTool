export const RVM_CNTB_COORDINATE_SCHEMA = 'RvmCntbCoordinatePolicy.v1';
export const RVM_CNTB_COORDINATE_LAYOUT = 'uint32 version, reviewName, float32 x, float32 y, float32 z, uint32 materialId';
export const RVM_CNTB_COORDINATE_UNIT = 'millimetres';

/**
 * Resolves the generated CNTB node reference coordinate. RMSS/RHBG reference
 * files use three float32 coordinate fields after the Review name. These are
 * treated as node placement/reference coordinates, not bbox/extents fields.
 *
 * Resolution order is intentionally conservative:
 * 1. explicit node.rvmCntbPosition / node.cntbPosition / node.position / node.anchor / node.origin
 * 2. explicit attribute triplets such as RVM_CNTB_X/Y/Z or X/Y/Z
 * 3. centroid of this node's direct primitive centers
 * 4. [0, 0, 0] when no node-local coordinate source exists
 */
export function resolveRvmCntbPosition(node) {
  if (!node || typeof node !== 'object') {
    throw new Error('RVM CNTB coordinate policy requires a valid node object');
  }

  const direct = firstVector([
    node.rvmCntbPosition,
    node.cntbPosition,
    node.position,
    node.anchor,
    node.origin
  ]);
  if (direct) return direct;

  const attributePosition = positionFromAttributes(node.attributes || {});
  if (attributePosition) return attributePosition;

  const primitiveCenter = centroidOfDirectPrimitiveCenters(node.primitives || []);
  if (primitiveCenter) return primitiveCenter;

  return [0, 0, 0];
}

export function normalizeRvmCntbPosition(value, context = 'RVM CNTB position') {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${context} must be [x, y, z]`);
  }
  const position = value.map((entry) => Number(entry));
  if (position.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`${context} contains non-finite coordinate`);
  }
  return position;
}

function firstVector(values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    return normalizeRvmCntbPosition(value, 'RVM CNTB explicit node position');
  }
  return null;
}

function positionFromAttributes(attributes) {
  const triplets = [
    ['RVM_CNTB_X', 'RVM_CNTB_Y', 'RVM_CNTB_Z'],
    ['CNTB_X', 'CNTB_Y', 'CNTB_Z'],
    ['X', 'Y', 'Z']
  ];

  for (const [xKey, yKey, zKey] of triplets) {
    if (hasCoordinate(attributes[xKey]) && hasCoordinate(attributes[yKey]) && hasCoordinate(attributes[zKey])) {
      return normalizeRvmCntbPosition(
        [attributes[xKey], attributes[yKey], attributes[zKey]],
        `RVM CNTB attribute position ${xKey}/${yKey}/${zKey}`
      );
    }
  }

  return null;
}

function centroidOfDirectPrimitiveCenters(primitives) {
  if (!Array.isArray(primitives) || primitives.length === 0) return null;

  const centers = primitives
    .map((primitive) => primitive?.center)
    .filter((center) => center !== undefined && center !== null)
    .map((center, index) => normalizeRvmCntbPosition(center, `RVM primitive center ${index}`));

  if (centers.length === 0) return null;

  const sum = centers.reduce((acc, center) => [
    acc[0] + center[0],
    acc[1] + center[1],
    acc[2] + center[2]
  ], [0, 0, 0]);

  return sum.map((value) => value / centers.length);
}

function hasCoordinate(value) {
  return value !== undefined && value !== null && value !== '';
}

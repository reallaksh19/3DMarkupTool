import { buildRvmAxisBasis } from './rvm-axis-basis-policy.js?v=bust-cache-4';
import { normalizeRvmMaterialId, rvmMaterialIdForNode } from './rvm-material-layer-contract.js?v=bust-cache-4';
import {
  RVM_CNTB_COORDINATE_LAYOUT,
  RVM_CNTB_COORDINATE_SCHEMA,
  RVM_CNTB_COORDINATE_UNIT,
  normalizeRvmCntbPosition,
  resolveRvmCntbPosition
} from './rvm-cntb-coordinate-policy.js?v=bust-cache-4';

export const RVM_CNTB_BOUNDS_POLICY_SCHEMA = 'RvmCntbBoundsPolicy.v2';

const CNTB_BODY_VERSION = 2;
const BBOX_EPSILON = 1e-6;
const POSITION_EPSILON = 1e-4;

/**
 * Defines and validates the generated CNTB payload layout plus recursive export
 * extents. RMSS/RHBG reference files show the generated CNTB body should carry:
 * version, Review name, x/y/z node reference coordinates, material id.
 * Bounding boxes remain computed and audited from writer-ready primitives instead
 * of being written into unsupported CNTB bbox payload fields.
 */
export function assertRvmCntbBoundsPolicy(rvmBuffer, exportModel = {}) {
  if (!exportModel || !exportModel.root) {
    throw new Error('RVM CNTB bounds policy requires exportModel.root');
  }

  const expectedNodes = flattenNodes(exportModel.root);
  const cntbRecords = scanCntbRecords(rvmBuffer);
  if (cntbRecords.length !== expectedNodes.length) {
    throw new Error(`RVM CNTB count mismatch: expected ${expectedNodes.length}, got ${cntbRecords.length}`);
  }

  const materialIds = new Set();
  cntbRecords.forEach((record, index) => {
    const node = expectedNodes[index];
    const expectedName = reviewNodeName(node);
    const expectedMaterial = rvmMaterialIdForNode(node);
    const expectedPosition = resolveRvmCntbPosition(node);
    if (record.name !== expectedName) {
      throw new Error(`RVM CNTB review-name mismatch at index ${index}: expected ${expectedName}, got ${record.name}`);
    }
    if (record.materialId !== expectedMaterial) {
      throw new Error(`RVM CNTB material mismatch for ${expectedName}: expected ${expectedMaterial}, got ${record.materialId}`);
    }
    assertPositionClose(record.position, expectedPosition, `RVM CNTB coordinate mismatch for ${expectedName}`);
    materialIds.add(record.materialId);
  });

  const bounds = computeNodeBounds(exportModel.root, 'root');
  if (bounds.primitiveCount > 0 && !bounds.bbox) {
    throw new Error('RVM CNTB bounds policy expected a non-empty root bbox because primitives are present');
  }

  return {
    schema: RVM_CNTB_BOUNDS_POLICY_SCHEMA,
    failClosed: true,
    cntbPayloadVersion: CNTB_BODY_VERSION,
    cntbPayloadLayout: RVM_CNTB_COORDINATE_LAYOUT,
    cntbCoordinateSchema: RVM_CNTB_COORDINATE_SCHEMA,
    cntbCoordinateFieldsWritten: true,
    cntbCoordinateUnit: RVM_CNTB_COORDINATE_UNIT,
    cntbPositionSource: 'explicit-node-coordinate-or-direct-primitive-centroid-or-origin',
    cntbBboxFieldsWritten: false,
    bboxSource: 'recursive-export-model-primitives',
    bboxUnit: 'millimetres',
    rootBboxNonEmpty: Boolean(bounds.bbox),
    rootBbox: bounds.bbox ? cleanBbox(bounds.bbox) : null,
    rootDiagonalMm: bounds.bbox ? roundNumber(diagonal(bounds.bbox), 6) : 0,
    nodeCount: bounds.nodeCount,
    cntbCount: cntbRecords.length,
    primitiveCount: bounds.primitiveCount,
    nodesWithBounds: bounds.nodesWithBounds,
    emptyLeafNodeCount: bounds.emptyLeafNodeCount,
    materialIds: Array.from(materialIds).sort((a, b) => a - b),
    reviewNamesMatchCntb: true,
    groupMaterialIdsMatchCntb: true,
    cntbCoordinatesMatchExportModel: true
  };
}

export function scanCntbRecords(rvmBuffer) {
  const arrayBuffer = toArrayBuffer(rvmBuffer);
  const view = new DataView(arrayBuffer);
  const records = [];
  let offset = 0;
  let guard = 0;

  while (offset + 24 <= arrayBuffer.byteLength) {
    const id = readChunkId(view, offset);
    const nextOffset = view.getUint32(offset + 16, false);
    if (nextOffset <= offset || nextOffset > arrayBuffer.byteLength) {
      throw new Error(`Invalid RVM chunk pointer while scanning CNTB at offset ${offset}: ${nextOffset}`);
    }
    const bodyOffset = offset + 24;
    const bodyLength = nextOffset - bodyOffset;
    if (id === 'CNTB') {
      records.push(parseCntbBody(new DataView(arrayBuffer, bodyOffset, bodyLength), offset));
    }
    offset = nextOffset;
    guard += 1;
    if (guard > 50000) throw new Error('RVM CNTB scan guard tripped');
    if (id === 'END:') break;
  }

  return records;
}

function parseCntbBody(bodyView, chunkOffset) {
  let offset = 0;
  if (bodyView.byteLength < 4) throw new Error(`RVM CNTB body too small at chunk offset ${chunkOffset}`);
  const version = bodyView.getUint32(offset, false);
  offset += 4;
  if (version !== CNTB_BODY_VERSION) {
    throw new Error(`RVM CNTB body version mismatch at chunk offset ${chunkOffset}: expected ${CNTB_BODY_VERSION}, got ${version}`);
  }

  const nameResult = readRvmString(bodyView, offset, 'CNTB review name');
  offset = nameResult.nextOffset;
  if (offset + 16 !== bodyView.byteLength) {
    throw new Error(`RVM CNTB body must contain x/y/z/materialId after name at chunk offset ${chunkOffset}`);
  }

  const position = normalizeRvmCntbPosition([
    bodyView.getFloat32(offset, false),
    bodyView.getFloat32(offset + 4, false),
    bodyView.getFloat32(offset + 8, false)
  ], `RVM CNTB coordinate at chunk offset ${chunkOffset}`);
  offset += 12;
  const materialId = normalizeRvmMaterialId(bodyView.getUint32(offset, false), `RVM CNTB material at chunk offset ${chunkOffset}`);

  return {
    version,
    name: nameResult.value,
    x: position[0],
    y: position[1],
    z: position[2],
    position,
    materialId,
    chunkOffset,
    bodyLength: bodyView.byteLength
  };
}

function computeNodeBounds(node, path) {
  if (!node || typeof node !== 'object') throw new Error(`Invalid RVM bounds node at ${path}`);
  const childResults = (node.children || []).map((child, index) => computeNodeBounds(child, `${path}.children[${index}]`));
  const primitiveBoxes = (node.primitives || []).map((primitive, index) => primitiveWorldBbox(primitive, `${path}.primitives[${index}]`));
  const boxes = primitiveBoxes.concat(childResults.map((result) => result.bbox).filter(Boolean));
  const bbox = unionBboxes(boxes);
  if ((node.primitives || []).length > 0 && !bbox) {
    throw new Error(`RVM node ${reviewNodeName(node)} has primitives but no computed bbox`);
  }
  if (bbox) assertValidBbox(bbox, `RVM node ${reviewNodeName(node)} bbox`);

  return {
    bbox,
    nodeCount: 1 + childResults.reduce((sum, child) => sum + child.nodeCount, 0),
    primitiveCount: primitiveBoxes.length + childResults.reduce((sum, child) => sum + child.primitiveCount, 0),
    nodesWithBounds: (bbox ? 1 : 0) + childResults.reduce((sum, child) => sum + child.nodesWithBounds, 0),
    emptyLeafNodeCount: (!bbox && primitiveBoxes.length === 0 && childResults.length === 0 ? 1 : 0)
      + childResults.reduce((sum, child) => sum + child.emptyLeafNodeCount, 0)
  };
}

function primitiveWorldBbox(primitive, path) {
  if (!primitive || typeof primitive !== 'object') throw new Error(`Invalid RVM primitive at ${path}`);
  const center = vector3(primitive.center, `${path}.center`);
  const direction = primitive.kind === 'sphere' && primitive.direction === undefined ? [0, 0, 1] : primitive.direction;
  const basis = buildRvmAxisBasis(direction || [0, 0, 1]);
  const local = primitiveLocalBbox(primitive, path);
  const corners = bboxCorners(local).map(([x, y, z]) => [
    center[0] + basis.x[0] * x + basis.y[0] * y + basis.z[0] * z,
    center[1] + basis.x[1] * x + basis.y[1] * y + basis.z[1] * z,
    center[2] + basis.x[2] * x + basis.y[2] * y + basis.z[2] * z
  ]);
  return pointsBbox(corners, path);
}

function primitiveLocalBbox(primitive, path) {
  if (primitive.kind === 'cylinder') {
    const radius = positiveNumber(primitive.radius, `${path}.radius`);
    const half = positiveNumber(primitive.length, `${path}.length`) / 2;
    return [-radius, -radius, -half, radius, radius, half];
  }
  if (primitive.kind === 'box') {
    const lengths = positiveArray(primitive.lengths, 3, `${path}.lengths`);
    return [-lengths[0] / 2, -lengths[1] / 2, -lengths[2] / 2, lengths[0] / 2, lengths[1] / 2, lengths[2] / 2];
  }
  if (primitive.kind === 'pyramid') {
    const bottom = positiveArray(primitive.bottom, 2, `${path}.bottom`);
    const top = positiveArray(primitive.top, 2, `${path}.top`);
    const offset = finiteArray(primitive.offset, 2, `${path}.offset`);
    const radiusX = Math.max(bottom[0], top[0]) / 2 + Math.abs(offset[0]) / 2;
    const radiusY = Math.max(bottom[1], top[1]) / 2 + Math.abs(offset[1]) / 2;
    const half = positiveNumber(primitive.height, `${path}.height`) / 2;
    return [-radiusX, -radiusY, -half, radiusX, radiusY, half];
  }
  if (primitive.kind === 'sphere') {
    const radius = positiveNumber(primitive.diameter, `${path}.diameter`) / 2;
    return [-radius, -radius, -radius, radius, radius, radius];
  }
  throw new Error(`Unsupported RVM primitive kind for bounds at ${path}: ${primitive.kind}`);
}

function flattenNodes(root) {
  const nodes = [];
  visit(root, (node) => nodes.push(node));
  return nodes;
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') throw new Error('RVM CNTB bounds policy requires valid nodes');
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}

function reviewNodeName(node) {
  const name = String(node?.reviewName || node?.name || '').trim();
  if (!name) throw new Error('RVM CNTB bounds policy requires node reviewName or name');
  return name;
}

function readRvmString(view, offset, context) {
  if (offset + 4 > view.byteLength) throw new Error(`${context} is truncated before word count`);
  const wordCount = view.getUint32(offset, false);
  offset += 4;
  const byteLength = wordCount * 4;
  if (offset + byteLength > view.byteLength) throw new Error(`${context} is truncated in payload`);
  if (wordCount === 0) return { value: '', nextOffset: offset };
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, byteLength);
  const zeroIndex = bytes.indexOf(0);
  const end = zeroIndex >= 0 ? zeroIndex : bytes.length;
  const value = new TextDecoder().decode(bytes.slice(0, end));
  return { value, nextOffset: offset + byteLength };
}

function readChunkId(view, offset) {
  return [0, 1, 2, 3]
    .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
    .join('');
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  throw new Error('RVM CNTB bounds policy expects an ArrayBuffer or typed array');
}

function bboxCorners(bbox) {
  const [minX, minY, minZ, maxX, maxY, maxZ] = bbox;
  return [
    [minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, minZ], [minX, maxY, maxZ],
    [maxX, minY, minZ], [maxX, minY, maxZ], [maxX, maxY, minZ], [maxX, maxY, maxZ]
  ];
}

function pointsBbox(points, context) {
  if (!points.length) return null;
  const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const point of points) {
    const vector = vector3(point, `${context}.bboxPoint`);
    bbox[0] = Math.min(bbox[0], vector[0]);
    bbox[1] = Math.min(bbox[1], vector[1]);
    bbox[2] = Math.min(bbox[2], vector[2]);
    bbox[3] = Math.max(bbox[3], vector[0]);
    bbox[4] = Math.max(bbox[4], vector[1]);
    bbox[5] = Math.max(bbox[5], vector[2]);
  }
  assertValidBbox(bbox, context);
  return bbox;
}

function unionBboxes(boxes) {
  const valid = boxes.filter(Boolean);
  if (!valid.length) return null;
  return pointsBbox(valid.flatMap(bboxCorners), 'RVM bbox union');
}

function assertValidBbox(bbox, context) {
  if (!Array.isArray(bbox) || bbox.length !== 6 || bbox.some((value) => !Number.isFinite(value))) {
    throw new Error(`${context} must be a finite six-number bbox`);
  }
  if (bbox[0] > bbox[3] || bbox[1] > bbox[4] || bbox[2] > bbox[5]) {
    throw new Error(`${context} has inverted min/max extents`);
  }
  if (diagonal(bbox) <= BBOX_EPSILON) {
    throw new Error(`${context} must have non-empty extents`);
  }
}

function assertPositionClose(actual, expected, context) {
  const actualPosition = normalizeRvmCntbPosition(actual, `${context} actual`);
  const expectedPosition = normalizeRvmCntbPosition(expected, `${context} expected`);
  for (let index = 0; index < 3; index += 1) {
    if (Math.abs(actualPosition[index] - expectedPosition[index]) > POSITION_EPSILON) {
      throw new Error(`${context}: expected ${expectedPosition.join(',')}, got ${actualPosition.join(',')}`);
    }
  }
}

function cleanBbox(bbox) {
  return bbox.map((value) => roundNumber(Math.abs(value) < 1e-9 ? 0 : value, 6));
}

function diagonal(bbox) {
  return Math.hypot(bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]);
}

function vector3(value, context) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${context} must be [x, y, z]`);
  const vector = value.map((entry) => Number(entry));
  if (vector.some((entry) => !Number.isFinite(entry))) throw new Error(`${context} contains non-finite value`);
  return vector;
}

function finiteArray(value, length, context) {
  if (!Array.isArray(value) || value.length !== length) throw new Error(`${context} must have ${length} entries`);
  const numbers = value.map((entry) => Number(entry));
  if (numbers.some((entry) => !Number.isFinite(entry))) throw new Error(`${context} contains non-finite value`);
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
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${context} must be a positive finite number`);
  return parsed;
}

function roundNumber(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

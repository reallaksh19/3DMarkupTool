export const RVM_MATERIAL_LAYER_CONTRACT_SCHEMA = 'RvmMaterialLayerContract.v1';
export const RVM_DEFAULT_MATERIAL_ID = 0;
export const RVM_DEFAULT_LAYER_NAME = 'INPUTXML';
export const RVM_MAX_MATERIAL_ID = 65535;
export const RVM_MAX_LAYER_NAME_LENGTH = 64;

export function rvmMaterialIdForNode(node = {}) {
  return normalizeRvmMaterialId(node.material, `RVM node material for ${node.name || node.reviewName || 'UNNAMED'}`);
}

export function normalizeRvmMaterialId(value, context = 'RVM material') {
  if (value === undefined || value === null || value === '') return RVM_DEFAULT_MATERIAL_ID;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > RVM_MAX_MATERIAL_ID) {
    throw new Error(`${context} must be an integer material id from 0 to ${RVM_MAX_MATERIAL_ID}`);
  }
  return parsed;
}

export function normalizeRvmLayerName(value, context = 'RVM layer') {
  const text = String(value ?? '').trim();
  const layer = text || RVM_DEFAULT_LAYER_NAME;
  if (layer.length > RVM_MAX_LAYER_NAME_LENGTH) {
    throw new Error(`${context} must be ${RVM_MAX_LAYER_NAME_LENGTH} characters or less`);
  }
  if (!/^[A-Za-z0-9_./ -]+$/.test(layer)) {
    throw new Error(`${context} contains unsupported Review layer/name characters`);
  }
  return layer;
}

export function rvmLayerNameForNode(node = {}) {
  const raw = node.layer || node.attributes?.RVM_LAYER || node.attributes?.ROLE || node.attributes?.TYPE || RVM_DEFAULT_LAYER_NAME;
  return normalizeRvmLayerName(raw, `RVM layer for ${node.name || node.reviewName || 'UNNAMED'}`);
}

export function assertRvmMaterialLayerContract(exportModel = {}) {
  const nodes = [];
  const primitives = [];
  const materialIds = new Set();
  const layers = new Set();

  visit(exportModel.root, (node) => {
    nodes.push(node);
    const nodeMaterial = rvmMaterialIdForNode(node);
    materialIds.add(nodeMaterial);
    layers.add(rvmLayerNameForNode(node));
    for (const primitive of node.primitives || []) {
      primitives.push(primitive);
      if (primitive.material !== undefined && primitive.material !== null && primitive.material !== '') {
        materialIds.add(normalizeRvmMaterialId(primitive.material, `RVM primitive material for ${primitive.name || 'UNNAMED_PRIMITIVE'}`));
      }
    }
  });

  return {
    schema: RVM_MATERIAL_LAYER_CONTRACT_SCHEMA,
    failClosed: true,
    groupMaterialEncodedInCntb: true,
    primitiveMaterialEncodedInPrim: false,
    primitiveMaterialInheritance: 'node-material-or-viewer-default',
    nodeCount: nodes.length,
    primitiveCount: primitives.length,
    materialIds: Array.from(materialIds).sort((a, b) => a - b),
    layerNames: Array.from(layers).sort()
  };
}

function visit(node, callback) {
  if (!node) throw new Error('RVM material/layer contract requires an exportModel.root node');
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}

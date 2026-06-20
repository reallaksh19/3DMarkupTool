import { normalizeRvmMaterialId, rvmMaterialIdForNode } from './rvm-material-layer-contract.js';

export const RVM_COLR_MATERIAL_POLICY_SCHEMA = 'RvmColrMaterialPolicy.v1';
export const RVM_COLR_BODY_VERSION = 1;
export const RVM_COLR_CHUNK_ID = 'COLR';

// RMSS reference files show COLR records as:
// uint32 version=1, uint32 materialId, uint32 packedColor.
export const RVM_COLR_PAYLOAD_LAYOUT = 'uint32 version=1, uint32 materialId, uint32 packedColor';

const RVM_DEFAULT_COLOR_PALETTE = Object.freeze([
  0x82828200,
  0xffff0000,
  0x00a0ff00,
  0x00cc6600,
  0xffcc0000,
  0xcc00cc00,
  0x00cccc00,
  0xffffff00
]);

export function collectRvmColrMaterialRecords(exportModel = {}, materialLayerContract = {}) {
  const materialIds = new Set();
  const explicitColorSources = collectExplicitColorSources(exportModel, materialLayerContract);

  if (Array.isArray(materialLayerContract.materialIds)) {
    for (const materialId of materialLayerContract.materialIds) {
      materialIds.add(normalizeRvmMaterialId(materialId, 'RVM COLR material id from material-layer contract'));
    }
  }

  if (exportModel?.root) {
    visit(exportModel.root, (node) => {
      materialIds.add(rvmMaterialIdForNode(node));
      for (const primitive of node.primitives || []) {
        if (primitive.material !== undefined && primitive.material !== null && primitive.material !== '') {
          materialIds.add(normalizeRvmMaterialId(primitive.material, `RVM COLR primitive material for ${primitive.name || 'UNNAMED_PRIMITIVE'}`));
        }
      }
    });
  }

  return Array.from(materialIds)
    .filter((materialId) => materialId > 0)
    .sort((a, b) => a - b)
    .map((materialId, index) => ({
      version: RVM_COLR_BODY_VERSION,
      materialId,
      packedColor: resolveRvmPackedColor(materialId, explicitColorSources, index),
      source: explicitColorSources.has(materialId) ? 'explicit-material-color' : 'deterministic-rmss-compatible-palette',
      payloadLayout: RVM_COLR_PAYLOAD_LAYOUT
    }));
}

export function assertRvmColrMaterialPolicy(exportModel = {}, materialLayerContract = {}) {
  const records = collectRvmColrMaterialRecords(exportModel, materialLayerContract);
  assertUniqueMaterialIds(records);
  return {
    schema: RVM_COLR_MATERIAL_POLICY_SCHEMA,
    failClosed: true,
    chunkId: RVM_COLR_CHUNK_ID,
    bodyVersion: RVM_COLR_BODY_VERSION,
    payloadLayout: RVM_COLR_PAYLOAD_LAYOUT,
    emittedColorRecordCount: records.length,
    materialIds: records.map((record) => record.materialId),
    colorRecords: records,
    defaultMaterialIdZeroEmitted: false,
    rmssCompatiblePlacement: 'after CNTB/CNTE hierarchy and before END:'
  };
}

export function normalizeRvmPackedColor(value, context = 'RVM COLR packed color') {
  let parsed;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^0x[0-9a-f]{1,8}$/i.test(text)) {
      parsed = Number.parseInt(text.slice(2), 16);
    } else if (/^#[0-9a-f]{6}$/i.test(text)) {
      parsed = Number((BigInt(`0x${text.slice(1)}`) << 8n) & 0xffffffffn);
    } else if (/^#[0-9a-f]{8}$/i.test(text)) {
      parsed = Number.parseInt(text.slice(1), 16);
    } else {
      throw new Error(`${context} must be a uint32 number, 0xRRGGBBAA string, #RRGGBB, or #RRGGBBAA`);
    }
  } else {
    parsed = Number(value);
  }

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 0xffffffff) {
    throw new Error(`${context} must be a uint32 packed color`);
  }
  return parsed >>> 0;
}

function resolveRvmPackedColor(materialId, explicitColorSources, index) {
  if (explicitColorSources.has(materialId)) {
    return normalizeRvmPackedColor(explicitColorSources.get(materialId), `RVM COLR packed color for material ${materialId}`);
  }
  return normalizeRvmPackedColor(RVM_DEFAULT_COLOR_PALETTE[index % RVM_DEFAULT_COLOR_PALETTE.length], `RVM COLR default color for material ${materialId}`);
}

function collectExplicitColorSources(exportModel = {}, materialLayerContract = {}) {
  const colors = new Map();
  addColorMap(colors, exportModel.rvmMaterialColors);
  addColorMap(colors, exportModel.materialColors);
  addColorMap(colors, materialLayerContract.rvmMaterialColors);
  addColorMap(colors, materialLayerContract.materialColors);

  if (exportModel?.root) {
    visit(exportModel.root, (node) => {
      const materialId = rvmMaterialIdForNode(node);
      const explicit = node?.rvmPackedColor
        ?? node?.packedColor
        ?? node?.color
        ?? node?.colour
        ?? node?.attributes?.RVM_PACKED_COLOR
        ?? node?.attributes?.RVM_COLR
        ?? node?.attributes?.RVM_COLOR
        ?? node?.attributes?.COLOR
        ?? node?.attributes?.COLOUR;
      if (explicit !== undefined && explicit !== null && explicit !== '') {
        colors.set(materialId, explicit);
      }
    });
  }

  return colors;
}

function addColorMap(colors, source) {
  if (!source || typeof source !== 'object') return;
  for (const [key, value] of Object.entries(source)) {
    const materialId = normalizeRvmMaterialId(key, 'RVM COLR material color map key');
    if (materialId > 0 && value !== undefined && value !== null && value !== '') {
      colors.set(materialId, value);
    }
  }
}

function assertUniqueMaterialIds(records) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.materialId)) {
      throw new Error(`Duplicate RVM COLR material id ${record.materialId}`);
    }
    seen.add(record.materialId);
  }
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') throw new Error('RVM COLR material policy requires valid nodes');
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}

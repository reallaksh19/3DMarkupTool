import { auditRvmBinary } from './rvm-binary-audit.js';

export const RVM_MATERIAL_TABLE_CONTRACT_SCHEMA = 'RvmMaterialTableContract.v1';

// Observed and likely Review material/color/layer table chunk names are intentionally
// treated as unsupported until their payload layouts are decoded and writer support is
// deliberately added. Current output remains conservative: CNTB material id only.
export const RVM_BLOCKED_MATERIAL_TABLE_CHUNKS = Object.freeze([
  'MATL',
  'MTRL',
  'COLR',
  'CLRB',
  'LAYR',
  'LAYS'
]);

const BASE_WRITER_CHUNKS = Object.freeze(['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'END:']);

export function assertRvmMaterialTableContract(rvmBuffer, materialLayerContract = {}) {
  const binaryAudit = auditRvmBinary(rvmBuffer);
  const chunkIds = binaryAudit.chunks.map((chunk) => chunk.id);
  const blockedMaterialChunksPresent = chunkIds.filter((id) => RVM_BLOCKED_MATERIAL_TABLE_CHUNKS.includes(id));

  if (blockedMaterialChunksPresent.length > 0) {
    throw new Error(`Generated RVM contains unsupported material/color table chunks: ${blockedMaterialChunksPresent.join(', ')}`);
  }

  const unexpectedChunks = chunkIds.filter((id) => !BASE_WRITER_CHUNKS.includes(id));
  if (unexpectedChunks.length > 0) {
    throw new Error(`Generated RVM contains unsupported non-core chunks before material-table support is defined: ${Array.from(new Set(unexpectedChunks)).join(', ')}`);
  }

  return {
    schema: RVM_MATERIAL_TABLE_CONTRACT_SCHEMA,
    failClosed: true,
    materialTableChunksEmitted: false,
    colorTableChunksEmitted: false,
    layerTableChunksEmitted: false,
    blockedMaterialTableChunks: [...RVM_BLOCKED_MATERIAL_TABLE_CHUNKS],
    emittedChunkTypes: Array.from(new Set(chunkIds)).sort(),
    groupMaterialEncodedInCntb: materialLayerContract.groupMaterialEncodedInCntb === true,
    primitiveMaterialEncodedInPrim: materialLayerContract.primitiveMaterialEncodedInPrim === true,
    primitiveMaterialInheritance: materialLayerContract.primitiveMaterialInheritance || 'node-material-or-viewer-default',
    materialIds: Array.isArray(materialLayerContract.materialIds) ? materialLayerContract.materialIds : []
  };
}

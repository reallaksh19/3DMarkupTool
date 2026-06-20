import { auditRvmBinary } from './rvm-binary-audit.js';
import { normalizeRvmMaterialId } from './rvm-material-layer-contract.js';
import {
  RVM_COLR_BODY_VERSION,
  RVM_COLR_CHUNK_ID,
  RVM_COLR_PAYLOAD_LAYOUT,
  normalizeRvmPackedColor
} from './rvm-colr-material-policy.js';

export const RVM_MATERIAL_TABLE_CONTRACT_SCHEMA = 'RvmMaterialTableContract.v2';

// COLR is now deliberately supported because RMSS reference files use COLR
// records before END:. Other material/layer table chunks remain blocked until
// their payload layouts are decoded and writer support is intentionally added.
export const RVM_BLOCKED_MATERIAL_TABLE_CHUNKS = Object.freeze([
  'MATL',
  'MTRL',
  'CLRB',
  'LAYR',
  'LAYS'
]);

const BASE_WRITER_CHUNKS = Object.freeze(['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'COLR', 'END:']);

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

  const colorRecords = scanColrRecords(rvmBuffer);
  const colorMaterialIds = new Set();
  for (const record of colorRecords) {
    if (colorMaterialIds.has(record.materialId)) throw new Error(`Generated RVM contains duplicate COLR material id ${record.materialId}`);
    colorMaterialIds.add(record.materialId);
  }

  const materialIds = Array.isArray(materialLayerContract.materialIds)
    ? materialLayerContract.materialIds.map((id) => normalizeRvmMaterialId(id, 'RVM material table contract material id'))
    : [];
  const expectedColorMaterialIds = materialIds.filter((materialId) => materialId > 0);
  const unexpectedColorMaterialIds = expectedColorMaterialIds.length
    ? colorRecords.map((record) => record.materialId).filter((materialId) => !expectedColorMaterialIds.includes(materialId))
    : [];
  if (unexpectedColorMaterialIds.length > 0) {
    throw new Error(`Generated RVM COLR contains material id(s) not present in material-layer contract: ${unexpectedColorMaterialIds.join(', ')}`);
  }

  const missingColorMaterialIds = colorRecords.length > 0
    ? expectedColorMaterialIds.filter((materialId) => !colorMaterialIds.has(materialId))
    : [];
  if (missingColorMaterialIds.length > 0) {
    throw new Error(`Generated RVM COLR missing non-default material id(s): ${missingColorMaterialIds.join(', ')}`);
  }

  return {
    schema: RVM_MATERIAL_TABLE_CONTRACT_SCHEMA,
    failClosed: true,
    materialTableChunksEmitted: false,
    colorTableChunksEmitted: colorRecords.length > 0,
    colorTableChunkName: RVM_COLR_CHUNK_ID,
    colorTablePayloadLayout: RVM_COLR_PAYLOAD_LAYOUT,
    colorTableChunkCount: colorRecords.length,
    colorRecords,
    layerTableChunksEmitted: false,
    blockedMaterialTableChunks: [...RVM_BLOCKED_MATERIAL_TABLE_CHUNKS],
    emittedChunkTypes: Array.from(new Set(chunkIds)).sort(),
    groupMaterialEncodedInCntb: materialLayerContract.groupMaterialEncodedInCntb === true,
    primitiveMaterialEncodedInPrim: materialLayerContract.primitiveMaterialEncodedInPrim === true,
    primitiveMaterialInheritance: materialLayerContract.primitiveMaterialInheritance || 'node-material-or-viewer-default',
    materialIds,
    colrMaterialIdsMatchMaterialLayerContract: missingColorMaterialIds.length === 0 && unexpectedColorMaterialIds.length === 0
  };
}

export function scanColrRecords(rvmBuffer) {
  const arrayBuffer = toArrayBuffer(rvmBuffer);
  const view = new DataView(arrayBuffer);
  const records = [];
  let offset = 0;
  let guard = 0;

  while (offset + 24 <= arrayBuffer.byteLength) {
    const id = readChunkId(view, offset);
    const nextOffset = view.getUint32(offset + 16, false);
    if (nextOffset <= offset || nextOffset > arrayBuffer.byteLength) {
      throw new Error(`Invalid RVM chunk pointer while scanning COLR at offset ${offset}: ${nextOffset}`);
    }

    const bodyOffset = offset + 24;
    const bodyLength = nextOffset - bodyOffset;
    if (id === RVM_COLR_CHUNK_ID) {
      records.push(parseColrBody(new DataView(arrayBuffer, bodyOffset, bodyLength), offset));
    }

    offset = nextOffset;
    guard += 1;
    if (guard > 50000) throw new Error('RVM COLR scan guard tripped');
    if (id === 'END:') break;
  }

  return records;
}

function parseColrBody(bodyView, chunkOffset) {
  if (bodyView.byteLength !== 12) {
    throw new Error(`RVM COLR body at chunk offset ${chunkOffset} expected 12 bytes, got ${bodyView.byteLength}`);
  }
  const version = bodyView.getUint32(0, false);
  if (version !== RVM_COLR_BODY_VERSION) {
    throw new Error(`RVM COLR body version mismatch at chunk offset ${chunkOffset}: expected ${RVM_COLR_BODY_VERSION}, got ${version}`);
  }
  const materialId = normalizeRvmMaterialId(bodyView.getUint32(4, false), `RVM COLR material at chunk offset ${chunkOffset}`);
  const packedColor = normalizeRvmPackedColor(bodyView.getUint32(8, false), `RVM COLR packed color at chunk offset ${chunkOffset}`);
  return {
    version,
    materialId,
    packedColor,
    packedColorHex: `0x${packedColor.toString(16).padStart(8, '0')}`,
    chunkOffset,
    bodyLength: bodyView.byteLength
  };
}

function readChunkId(view, offset) {
  return [0, 1, 2, 3]
    .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
    .join('');
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  throw new Error('RVM material table contract expects an ArrayBuffer or typed array');
}

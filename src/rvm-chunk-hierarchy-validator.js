import { scanCntbRecords } from './rvm-cntb-bounds-policy.js?v=bust-cache-4';

export const RVM_CHUNK_HIERARCHY_SCHEMA = 'RvmChunkHierarchyValidator.v2';

const CHUNK_HEADER_BYTES = 24;
const REVIEW_CHUNK_HEADER_MARKER = 1;
const REVIEW_CONTAINER_CLOSE_BODY_MARKER = 2;
const REVIEW_END_BODY_MARKER = 1;
const REVIEW_COLR_BODY_VERSION = 1;
const ALLOWED_CHUNKS = new Set(['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'COLR', 'END:']);

/**
 * Validates the generated RVM chunk stream and its ATT hierarchy counterpart.
 * This intentionally checks only the generated writer contract:
 * HEAD -> MODL -> nested CNTB/PRIM/CNTE -> optional RMSS-style COLR -> END:,
 * with ATT NEW/END names matching CNTB review names in export-tree pre-order.
 */
export function assertRvmChunkHierarchy(rvmBuffer, attText, exportModel = {}) {
  if (!exportModel || !exportModel.root) {
    throw new Error('RVM chunk hierarchy validator requires exportModel.root');
  }

  const expectedNames = flattenNodeReviewNames(exportModel.root);
  const cntbRecords = scanCntbRecords(rvmBuffer);
  if (cntbRecords.length !== expectedNames.length) {
    throw new Error(`RVM chunk hierarchy CNTB count mismatch: expected ${expectedNames.length}, got ${cntbRecords.length}`);
  }

  cntbRecords.forEach((record, index) => {
    if (record.name !== expectedNames[index]) {
      throw new Error(`RVM chunk hierarchy CNTB name mismatch at index ${index}: expected ${expectedNames[index]}, got ${record.name}`);
    }
  });

  const rvmSequence = scanRvmChunkHierarchy(rvmBuffer, cntbRecords);
  const attHierarchy = parseAttHierarchy(attText);

  if (attHierarchy.names.length !== expectedNames.length) {
    throw new Error(`ATT hierarchy NEW count mismatch: expected ${expectedNames.length}, got ${attHierarchy.names.length}`);
  }
  attHierarchy.names.forEach((name, index) => {
    if (name !== expectedNames[index]) {
      throw new Error(`ATT hierarchy name mismatch at index ${index}: expected ${expectedNames[index]}, got ${name}`);
    }
  });

  return {
    schema: RVM_CHUNK_HIERARCHY_SCHEMA,
    failClosed: true,
    allowedChunkIds: Array.from(ALLOWED_CHUNKS),
    headCount: rvmSequence.counts.HEAD || 0,
    modlCount: rvmSequence.counts.MODL || 0,
    cntbCount: rvmSequence.counts.CNTB || 0,
    cnteCount: rvmSequence.counts.CNTE || 0,
    primCount: rvmSequence.counts.PRIM || 0,
    colrCount: rvmSequence.counts.COLR || 0,
    endCount: rvmSequence.counts['END:'] || 0,
    maxRvmDepth: rvmSequence.maxDepth,
    maxAttDepth: attHierarchy.maxDepth,
    cntbCnteBalanced: true,
    primInsideCntbOnly: true,
    colrAfterHierarchyOnly: true,
    rvmAttNamesMatch: true,
    chunkOrder: 'HEAD, MODL, nested CNTB/PRIM/CNTE, optional COLR, END:'
  };
}

export function scanRvmChunkHierarchy(rvmBuffer, cntbRecords = null) {
  const arrayBuffer = toArrayBuffer(rvmBuffer);
  const view = new DataView(arrayBuffer);
  const records = cntbRecords || scanCntbRecords(arrayBuffer);
  const stack = [];
  const sequence = [];
  const counts = {};
  let cntbIndex = 0;
  let offset = 0;
  let maxDepth = 0;
  let seenHead = false;
  let seenModl = false;
  let seenColr = false;
  let seenEnd = false;
  let guard = 0;

  while (offset + CHUNK_HEADER_BYTES <= arrayBuffer.byteLength) {
    const id = readChunkId(view, offset);
    if (!ALLOWED_CHUNKS.has(id)) throw new Error(`Unsupported RVM chunk id ${id} at offset ${offset}`);
    const marker = view.getUint32(offset + 20, false);
    if (marker !== REVIEW_CHUNK_HEADER_MARKER) {
      throw new Error(`RVM chunk ${id} at offset ${offset} has invalid header marker ${marker}`);
    }
    const nextOffset = view.getUint32(offset + 16, false);
    if (nextOffset <= offset || nextOffset > arrayBuffer.byteLength) {
      throw new Error(`RVM chunk ${id} at offset ${offset} has invalid next offset ${nextOffset}`);
    }
    const bodyOffset = offset + CHUNK_HEADER_BYTES;
    const bodyLength = nextOffset - bodyOffset;
    if (bodyLength < 0) throw new Error(`RVM chunk ${id} at offset ${offset} has negative body length`);

    if (seenEnd) throw new Error(`RVM chunk ${id} appears after END:`);
    if (id === 'HEAD') {
      if (offset !== 0 || seenHead) throw new Error('RVM HEAD must be the first chunk and occur once');
      if (stack.length) throw new Error('RVM HEAD cannot appear inside CNTB scope');
      seenHead = true;
    } else if (id === 'MODL') {
      if (!seenHead || seenModl) throw new Error('RVM MODL must appear once immediately after HEAD');
      if (sequence[sequence.length - 1] !== 'HEAD') throw new Error('RVM MODL must immediately follow HEAD');
      if (stack.length) throw new Error('RVM MODL cannot appear inside CNTB scope');
      seenModl = true;
    } else if (id === 'CNTB') {
      if (!seenHead || !seenModl) throw new Error('RVM CNTB cannot appear before HEAD and MODL');
      if (seenColr) throw new Error(`RVM CNTB at offset ${offset} appears after COLR material/color records`);
      if (cntbIndex >= records.length) throw new Error(`RVM CNTB at offset ${offset} has no decoded CNTB record`);
      stack.push(records[cntbIndex].name);
      cntbIndex += 1;
      maxDepth = Math.max(maxDepth, stack.length);
    } else if (id === 'PRIM') {
      if (!stack.length) throw new Error(`RVM PRIM at offset ${offset} is outside a CNTB scope`);
      if (seenColr) throw new Error(`RVM PRIM at offset ${offset} appears after COLR material/color records`);
    } else if (id === 'CNTE') {
      if (!stack.length) throw new Error(`RVM CNTE at offset ${offset} has no open CNTB scope`);
      assertUint32Body(view, bodyOffset, bodyLength, REVIEW_CONTAINER_CLOSE_BODY_MARKER, `RVM CNTE at offset ${offset}`);
      stack.pop();
    } else if (id === 'COLR') {
      if (!seenHead || !seenModl) throw new Error('RVM COLR cannot appear before HEAD and MODL');
      if (!cntbIndex) throw new Error(`RVM COLR at offset ${offset} cannot appear before CNTB hierarchy`);
      if (stack.length) throw new Error(`RVM COLR at offset ${offset} cannot appear inside CNTB scope`);
      assertColrBody(view, bodyOffset, bodyLength, `RVM COLR at offset ${offset}`);
      seenColr = true;
    } else if (id === 'END:') {
      if (!seenHead || !seenModl) throw new Error('RVM END: cannot appear before HEAD and MODL');
      if (stack.length) throw new Error(`RVM END: reached with ${stack.length} unclosed CNTB scope(s)`);
      assertUint32Body(view, bodyOffset, bodyLength, REVIEW_END_BODY_MARKER, `RVM END: at offset ${offset}`);
      seenEnd = true;
    }

    sequence.push(id);
    counts[id] = (counts[id] || 0) + 1;
    offset = nextOffset;
    guard += 1;
    if (guard > 100000) throw new Error('RVM chunk hierarchy scan guard tripped');
    if (id === 'END:') break;
  }

  if (!seenHead) throw new Error('RVM chunk hierarchy missing HEAD');
  if (!seenModl) throw new Error('RVM chunk hierarchy missing MODL');
  if (!seenEnd) throw new Error('RVM chunk hierarchy missing END:');
  if (offset !== arrayBuffer.byteLength) throw new Error(`RVM chunk hierarchy has trailing bytes after END:: ${arrayBuffer.byteLength - offset}`);
  if (cntbIndex !== records.length) throw new Error(`RVM chunk hierarchy decoded ${cntbIndex} CNTB chunks but had ${records.length} CNTB records`);
  if ((counts.CNTB || 0) !== (counts.CNTE || 0)) {
    throw new Error(`RVM CNTB/CNTE count mismatch: CNTB=${counts.CNTB || 0}, CNTE=${counts.CNTE || 0}`);
  }

  return { sequence, counts, maxDepth };
}

export function parseAttHierarchy(attText) {
  const lines = String(attText || '').split(/\r?\n/);
  const names = [];
  const stack = [];
  let maxDepth = 0;
  let headerSeen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('CADC_Attributes_File')) {
      headerSeen = true;
      continue;
    }
    if (line.startsWith('NEW ')) {
      const name = line.slice(4).trim();
      if (!name) throw new Error('ATT hierarchy contains NEW without a name');
      stack.push(name);
      names.push(name);
      maxDepth = Math.max(maxDepth, stack.length);
      continue;
    }
    if (line === 'END') {
      if (!stack.length) throw new Error('ATT hierarchy contains END without matching NEW');
      stack.pop();
      continue;
    }
  }

  if (!headerSeen) throw new Error('ATT hierarchy missing CADC header');
  if (stack.length) throw new Error(`ATT hierarchy has ${stack.length} unclosed NEW block(s)`);
  return { names, maxDepth };
}

function flattenNodeReviewNames(root) {
  const names = [];
  visit(root, (node) => {
    const name = String(node?.reviewName || node?.name || '').trim();
    if (!name) throw new Error('RVM chunk hierarchy requires node reviewName or name');
    names.push(name);
  });
  return names;
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') throw new Error('RVM chunk hierarchy requires valid export-model nodes');
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}

function assertUint32Body(view, offset, bodyLength, expected, context) {
  if (bodyLength !== 4) throw new Error(`${context} expected a 4-byte uint32 body, got ${bodyLength}`);
  const value = view.getUint32(offset, false);
  if (value !== expected) throw new Error(`${context} expected marker ${expected}, got ${value}`);
}

function assertColrBody(view, offset, bodyLength, context) {
  if (bodyLength !== 12) throw new Error(`${context} expected a 12-byte COLR body, got ${bodyLength}`);
  const version = view.getUint32(offset, false);
  if (version !== REVIEW_COLR_BODY_VERSION) throw new Error(`${context} expected COLR version ${REVIEW_COLR_BODY_VERSION}, got ${version}`);
}

function readChunkId(view, offset) {
  return [0, 1, 2, 3]
    .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
    .join('');
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  throw new Error('RVM chunk hierarchy validator expects an ArrayBuffer or typed array');
}

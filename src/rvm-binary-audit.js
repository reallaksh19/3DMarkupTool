const REQUIRED_REVIEW_CHUNKS = ['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'END:'];

export function auditRvmBinary(buffer, options = {}) {
  const arrayBuffer = toArrayBuffer(buffer);
  const view = new DataView(arrayBuffer);
  const chunks = [];
  const issues = [];
  let offset = 0;
  let guard = 0;

  while (offset + 24 <= arrayBuffer.byteLength) {
    const id = readChunkId(view, offset);
    const nextOffset = view.getUint32(offset + 16, false);
    const marker = view.getUint32(offset + 20, false);

    if (!isChunkId(id)) {
      issues.push(`Invalid RVM chunk id at offset ${offset}: ${JSON.stringify(id)}`);
      break;
    }

    if (nextOffset <= offset) {
      issues.push(`Non-forward RVM chunk pointer at offset ${offset}: ${nextOffset}`);
      break;
    }

    if (nextOffset > arrayBuffer.byteLength) {
      issues.push(`RVM chunk pointer outside buffer at offset ${offset}: ${nextOffset}`);
      break;
    }

    const bodyLength = Math.max(nextOffset - offset - 24, 0);
    chunks.push({ id, offset, nextOffset, marker, bodyLength });
    offset = nextOffset;
    guard += 1;
    if (guard > 50000) {
      issues.push('RVM chunk scan guard tripped');
      break;
    }

    if (id === 'END:') break;
  }

  const trailingBytes = arrayBuffer.byteLength - offset;
  const counts = countBy(chunks.map((chunk) => chunk.id));
  const terminalChunk = chunks[chunks.length - 1] || null;
  const requiredChunksPresent = REQUIRED_REVIEW_CHUNKS.every((id) => counts[id] > 0);
  const balancedCntbCnte = (counts.CNTB || 0) === (counts.CNTE || 0);
  const allChunkMarkersOne = chunks.length > 0 && chunks.every((chunk) => chunk.marker === 1);
  const contiguousUntilEnd = terminalChunk?.id === 'END:' && trailingBytes === 0;

  if (!requiredChunksPresent) issues.push(`Missing required Review chunks: ${REQUIRED_REVIEW_CHUNKS.filter((id) => !counts[id]).join(', ')}`);
  if (!balancedCntbCnte) issues.push(`Unbalanced CNTB/CNTE chunks: CNTB=${counts.CNTB || 0}, CNTE=${counts.CNTE || 0}`);
  if (!allChunkMarkersOne) issues.push('One or more chunks do not use Review-style marker value 1');
  if (terminalChunk?.id !== 'END:') issues.push(`Terminal chunk is not END:: ${terminalChunk?.id || 'none'}`);
  if (trailingBytes !== 0 && options.allowTrailingZeroPadding !== true) issues.push(`Unexpected trailing bytes after END:: ${trailingBytes}`);
  if (options.allowTrailingZeroPadding === true && trailingBytes > 0 && !isZeroPadding(view, offset, arrayBuffer.byteLength)) {
    issues.push(`Trailing bytes after END: are not zero padding: ${trailingBytes}`);
  }

  return {
    schema: 'RvmBinaryAudit.v1',
    byteLength: arrayBuffer.byteLength,
    chunkCount: chunks.length,
    counts,
    firstChunk: chunks[0]?.id || null,
    secondChunk: chunks[1]?.id || null,
    terminalChunk: terminalChunk?.id || null,
    endBodyLength: terminalChunk?.id === 'END:' ? terminalChunk.bodyLength : null,
    trailingBytes,
    requiredChunksPresent,
    balancedCntbCnte,
    allChunkMarkersOne,
    contiguousUntilEnd,
    primitiveChunkCount: counts.PRIM || 0,
    containerChunkCount: counts.CNTB || 0,
    closeContainerChunkCount: counts.CNTE || 0,
    chunks,
    issues,
    ok: issues.length === 0
  };
}

export function assertRvmBinaryCompatibility(buffer, expectations = {}) {
  const audit = auditRvmBinary(buffer, expectations);
  if (!audit.ok) {
    throw new Error(`RVM binary compatibility audit failed: ${audit.issues.join('; ')}`);
  }
  if (audit.firstChunk !== 'HEAD') throw new Error(`RVM first chunk must be HEAD, got ${audit.firstChunk}`);
  if (audit.secondChunk !== 'MODL') throw new Error(`RVM second chunk must be MODL, got ${audit.secondChunk}`);
  if (audit.terminalChunk !== 'END:') throw new Error(`RVM terminal chunk must be END:, got ${audit.terminalChunk}`);
  if (audit.endBodyLength !== 4) throw new Error(`RVM END: body marker must be 4 bytes, got ${audit.endBodyLength}`);
  if (expectations.primitiveCount != null && audit.primitiveChunkCount !== expectations.primitiveCount) {
    throw new Error(`RVM PRIM count mismatch: expected ${expectations.primitiveCount}, got ${audit.primitiveChunkCount}`);
  }
  if (expectations.minPrimitiveCount != null && audit.primitiveChunkCount < expectations.minPrimitiveCount) {
    throw new Error(`RVM PRIM count too small: expected at least ${expectations.minPrimitiveCount}, got ${audit.primitiveChunkCount}`);
  }
  return audit;
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  throw new Error('RVM audit expects an ArrayBuffer or typed array');
}

function readChunkId(view, offset) {
  return [0, 1, 2, 3]
    .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
    .join('');
}

function isChunkId(id) {
  return /^[A-Z0-9 :]{4}$/.test(id);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return counts;
}

function isZeroPadding(view, start, end) {
  for (let offset = start; offset < end; offset += 1) {
    if (view.getUint8(offset) !== 0) return false;
  }
  return true;
}

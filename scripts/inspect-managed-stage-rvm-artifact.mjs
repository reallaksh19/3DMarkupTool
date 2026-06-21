import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { scanCntbRecords } from '../src/rvm-cntb-bounds-policy.js';
import { parseAttHierarchy } from '../src/rvm-chunk-hierarchy-validator.js';
import { scanRvmPrimitivePayloads } from '../src/rvm-primitive-payload-decoder.js';
import { assertManagedStageRvmAuditGate } from '../src/managed-stage-rvm-audit-gate.js';

const args = parseArgs(process.argv.slice(2));
const dir = args.dir || 'artifacts/managed-stage-rvm';
const base = args.base || 'BM_CII_INPUT_managed_stage';
const outDir = args.outdir || dir;
const expectations = args['expect-bm-cii'] ? bmCiiExpectations() : {};

const rvm = readRequired(join(dir, `${base}.rvm`));
const att = readRequired(join(dir, `${base}.att`), 'utf8');
const audit = JSON.parse(readRequired(join(dir, `${base}.audit.json`), 'utf8'));
const chunks = scanChunkIndex(rvm);
const cntbRecords = scanCntbRecords(rvm);
const primitives = scanRvmPrimitivePayloads(rvm);
const attHierarchy = parseAttHierarchy(att);
const gate = assertManagedStageRvmAuditGate(audit, expectations);
const primitiveRows = buildPrimitiveRows(audit, primitives);
const elementRows = buildElementRows(audit);
const issues = validateInspection({ audit, chunks, cntbRecords, primitives, attHierarchy, primitiveRows, elementRows });
if (issues.length) throw new Error(`Managed-stage RVM inspection failed: ${issues.join('; ')}`);

const inspection = {
  schema: 'ManagedStageRvmArtifactInspection.v1',
  base,
  generatedAt: new Date().toISOString(),
  files: {
    rvm: `${base}.rvm`,
    att: `${base}.att`,
    audit: `${base}.audit.json`
  },
  byteCounts: {
    rvm: rvm.byteLength,
    att: Buffer.byteLength(att),
    audit: Buffer.byteLength(JSON.stringify(audit))
  },
  gate,
  processingConfig: audit.processingConfig || null,
  inputXmlBendExclusionAudit: audit.inputXmlBendExclusionAudit || null,
  inputXmlNodeLocalElbowAudit: audit.inputXmlNodeLocalElbowAudit || null,
  inputXmlBranchFittingInferenceAudit: audit.inputXmlBranchFittingInferenceAudit || null,
  chunkSummary: summarizeChunks(chunks),
  chunkIndex: chunks,
  cntbCount: cntbRecords.length,
  attNewCount: attHierarchy.names.length,
  primitiveCount: primitives.length,
  primitiveRows,
  elementRows,
  issues
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${base}.inspection.json`), `${JSON.stringify(inspection, null, 2)}\n`);
writeFileSync(join(outDir, `${base}.primitives.csv`), renderCsv(primitiveRows));
writeFileSync(join(outDir, `${base}.elements.csv`), renderCsv(elementRows));
writeFileSync(join(outDir, `${base}.inspection.md`), renderMarkdown(inspection));

console.log(JSON.stringify({
  schema: inspection.schema,
  base,
  ok: true,
  processingMode: audit.processingConfig?.mode || '',
  inputXmlBendsExcluded: audit.inputXmlBendExclusionAudit?.code4BendsExcluded || 0,
  inputXmlNodeLocalElbows: audit.inputXmlNodeLocalElbowAudit?.nodeLocalElbowCount || 0,
  inputXmlBranchFittingsInferred: audit.inputXmlBranchFittingInferenceAudit?.genericBranchFittingCount || 0,
  chunks: inspection.chunkSummary.counts,
  cntbCount: inspection.cntbCount,
  primitiveCount: inspection.primitiveCount,
  elementCount: inspection.elementRows.length,
  outputs: [
    `${base}.inspection.json`,
    `${base}.primitives.csv`,
    `${base}.elements.csv`,
    `${base}.inspection.md`
  ]
}, null, 2));

function buildPrimitiveRows(audit, decodedPrimitives) {
  const stitchPrimitives = (audit.stitchManifest?.elements || []).flatMap((element) =>
    (element.primitives || []).map((primitive) => ({ element, primitive }))
  );
  return decodedPrimitives.map((decoded, index) => {
    const stitch = stitchPrimitives[index] || {};
    const element = stitch.element || {};
    const primitive = stitch.primitive || {};
    return {
      primIndex: index + 1,
      elementIndex: element.index || '',
      elementName: element.reviewName || element.inputName || '',
      fromNode: element.fromNode || '',
      toNode: element.toNode || '',
      dtxr: element.dtxr || '',
      localName: primitive.localName || '',
      kind: primitive.kind || decoded.candidateEmissionKind || '',
      code: decoded.code,
      bodyLength: decoded.bodyLength,
      chunkOffset: decoded.offset,
      expectedCode: primitive.expectedCode || '',
      material: primitive.material || '',
      centerMm: formatVector(primitive.centerMm),
      direction: formatVector(primitive.direction),
      payload: JSON.stringify(decoded.payloadSemantics || decoded.parameters || {})
    };
  });
}

function buildElementRows(audit) {
  return (audit.stitchManifest?.elements || []).map((element) => ({
    elementIndex: element.index,
    reviewName: element.reviewName,
    fromNode: element.fromNode,
    toNode: element.toNode,
    type: element.type,
    dtxr: element.dtxr,
    material: element.material,
    primitiveCount: element.primitiveCount,
    primitiveCodes: (element.primitiveCodes || []).join('|'),
    primitiveOffsets: (element.primitives || []).map((primitive) => primitive.chunkOffset).join('|'),
    primitiveKinds: (element.primitives || []).map((primitive) => primitive.kind).join('|')
  }));
}

function validateInspection({ audit, chunks, cntbRecords, primitives, attHierarchy, primitiveRows, elementRows }) {
  const issues = [];
  if (rvm.byteLength !== audit.rvmBytes) issues.push(`RVM byte count mismatch ${rvm.byteLength}/${audit.rvmBytes}`);
  if (Buffer.byteLength(att) !== audit.attBytes) issues.push(`ATT byte count mismatch ${Buffer.byteLength(att)}/${audit.attBytes}`);
  if (cntbRecords.length !== audit.chunkHierarchy?.cntbCount) issues.push('CNTB count mismatch vs audit');
  if (primitives.length !== audit.chunkHierarchy?.primCount) issues.push('PRIM count mismatch vs audit');
  if (attHierarchy.names.length !== cntbRecords.length) issues.push('ATT NEW count mismatch vs CNTB count');
  if ((audit.stitchManifest?.elements || []).length !== elementRows.length) issues.push('stitch element row count mismatch');
  if ((audit.stitchManifest?.primitiveCount || 0) !== primitiveRows.length) issues.push('stitch primitive row count mismatch');
  const first = chunks[0]?.id;
  const second = chunks[1]?.id;
  const last = chunks[chunks.length - 1]?.id;
  if (first !== 'HEAD' || second !== 'MODL' || last !== 'END:') issues.push(`unexpected chunk envelope ${first}/${second}/${last}`);
  for (let index = 0; index < cntbRecords.length; index += 1) {
    if (cntbRecords[index].name !== attHierarchy.names[index]) issues.push(`ATT/CNTB name mismatch at ${index + 1}`);
  }
  for (const row of primitiveRows) {
    if (row.expectedCode && Number(row.expectedCode) !== Number(row.code)) issues.push(`primitive code mismatch at PRIM ${row.primIndex}`);
  }
  return issues;
}

function scanChunkIndex(buffer) {
  const view = new DataView(toArrayBuffer(buffer));
  const chunks = [];
  let offset = 0;
  let depth = 0;
  let guard = 0;
  while (offset + 24 <= buffer.byteLength) {
    const id = readChunkId(view, offset);
    const nextOffset = view.getUint32(offset + 16, false);
    const bodyLength = nextOffset - offset - 24;
    if (nextOffset <= offset || nextOffset > buffer.byteLength) throw new Error(`Invalid chunk pointer at ${offset}`);
    if (id === 'CNTE') depth -= 1;
    chunks.push({ index: chunks.length + 1, id, offset, nextOffset, bodyLength, depth: Math.max(depth, 0) });
    if (id === 'CNTB') depth += 1;
    if (id === 'END:') break;
    offset = nextOffset;
    guard += 1;
    if (guard > 100000) throw new Error('Chunk scan guard exceeded');
  }
  return chunks;
}

function summarizeChunks(chunks) {
  return {
    total: chunks.length,
    counts: chunks.reduce((out, chunk) => {
      out[chunk.id] = (out[chunk.id] || 0) + 1;
      return out;
    }, {})
  };
}

function renderMarkdown(inspection) {
  return [
    `# Managed-stage RVM artifact inspection`,
    '',
    `Base: ${inspection.base}`,
    '',
    `- RVM bytes: ${inspection.byteCounts.rvm}`,
    `- ATT bytes: ${inspection.byteCounts.att}`,
    `- CNTB: ${inspection.cntbCount}`,
    `- PRIM: ${inspection.primitiveCount}`,
    `- Issues: ${inspection.issues.length}`,
    '',
    '## Chunk counts',
    '',
    ...Object.entries(inspection.chunkSummary.counts).map(([id, count]) => `- ${id}: ${count}`),
    ''
  ].join('\n');
}

function renderCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\n')}\n`;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatVector(value) {
  if (!Array.isArray(value)) return '';
  return value.map((entry) => Number(entry).toFixed(6)).join('|');
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.slice(2).split('=');
    out[key] = value === undefined ? true : value;
  }
  return out;
}

function readRequired(path, encoding = null) {
  try {
    return readFileSync(path, encoding || undefined);
  } catch (error) {
    throw new Error(`Required artifact missing: ${basename(path)}`);
  }
}

function readChunkId(view, offset) {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function bmCiiExpectations() {
  return {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    code4: 0,
    code8: 91,
    cntbCount: 43,
    primCount: 91
  };
}

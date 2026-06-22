import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const dir = valueAfterPrefix(args, '--dir=') || 'artifacts/managed-stage-rvm';
const base = valueAfterPrefix(args, '--base=') || 'BM_CII_INPUT_managed_stage';
const expectBmCii = args.includes('--expect-bm-cii');
const artifactDir = join(repoRoot, dir);

const { assertManagedStageRvmAuditGate } = await import('../src/managed-stage-rvm-audit-gate.js');
const { scanCntbRecords } = await import('../src/rvm-cntb-bounds-policy.js');
const { parseAttHierarchy, scanRvmChunkHierarchy } = await import('../src/rvm-chunk-hierarchy-validator.js');
const { scanRvmPrimitivePayloads } = await import('../src/rvm-primitive-payload-decoder.js');

const result = verifyManagedStageRvmArtifact({ artifactDir, base, expectations: expectBmCii ? bmCiiExpectations() : {} });
console.log(JSON.stringify(result, null, 2));

export function verifyManagedStageRvmArtifact({ artifactDir, base, expectations = {} }) {
  const rvmPath = join(artifactDir, `${base}.rvm`);
  const attPath = join(artifactDir, `${base}.att`);
  const auditPath = join(artifactDir, `${base}.audit.json`);
  const zipPath = join(artifactDir, `${base}.zip`);
  for (const path of [rvmPath, attPath, auditPath, zipPath]) {
    if (!existsSync(path)) throw new Error(`Missing managed-stage artifact file: ${path}`);
  }

  const rvm = readFileSync(rvmPath);
  const att = readFileSync(attPath, 'utf8');
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  const primitivePayloads = scanRvmPrimitivePayloads(rvm);
  const cntbRecords = scanCntbRecords(rvm);
  const chunkHierarchy = scanRvmChunkHierarchy(rvm, cntbRecords);
  const attHierarchy = parseAttHierarchy(att);
  const primitiveHistogram = histogram(primitivePayloads.map((primitive) => primitive.code));
  const supportPrimitiveHistogram = histogram(primitivePayloads.slice(audit.stitchManifest?.geometryPrimitiveCount || 0).map((primitive) => primitive.code));
  const zip = inspectStoredZip(readFileSync(zipPath));
  const issues = [];

  requireEqual(audit.rvmBytes, rvm.byteLength, 'audit.rvmBytes vs persisted RVM bytes', issues);
  requireEqual(audit.attBytes, Buffer.byteLength(att), 'audit.attBytes vs persisted ATT bytes', issues);
  requireEqual(audit.chunkHierarchy.cntbCount, chunkHierarchy.counts.CNTB || 0, 'CNTB count', issues);
  requireEqual(audit.chunkHierarchy.primCount, chunkHierarchy.counts.PRIM || 0, 'PRIM count', issues);
  requireEqual(audit.chunkHierarchy.colrCount, chunkHierarchy.counts.COLR || 0, 'COLR count', issues);
  requireEqual(audit.chunkHierarchy.cntbCount, cntbRecords.length, 'CNTB record scan count', issues);
  requireEqual(audit.chunkHierarchy.primCount, primitivePayloads.length, 'decoded PRIM count', issues);
  if (attHierarchy.names.length < cntbRecords.length) issues.push(`ATT NEW count is less than CNTB count: ${attHierarchy.names.length}/${cntbRecords.length}`);
  compareHistogram(audit.primitiveHistogram || {}, primitiveHistogram, 'primitive histogram', issues);
  compareHistogram(audit.supportRvmExportAudit?.supportPrimitiveCodeHistogram || {}, supportPrimitiveHistogram, 'support primitive histogram', issues);

  for (const expectedName of [`${base}.rvm`, `${base}.att`, `${base}.audit.json`]) {
    if (!zip.entries.includes(expectedName)) issues.push(`ZIP missing ${expectedName}`);
  }
  if (!zip.onlyStoredEntries) issues.push('ZIP contains compressed entries; expected stored method only');
  if (zip.trailingBytes !== 0) issues.push(`ZIP has trailing bytes: ${zip.trailingBytes}`);

  const strictGate = assertManagedStageRvmAuditGate(audit, expectations);
  if (issues.length) throw new Error(`Managed-stage artifact round-trip failed: ${issues.join('; ')}`);

  return {
    schema: 'ManagedStageRvmArtifactRoundTripVerification.v1',
    artifactDir: basename(artifactDir),
    base,
    strictGateOk: strictGate.ok,
    supportRecordsEmittedToRvm: audit.supportRvmExportAudit?.supportRecordCount || 0,
    supportRvmPrimitives: audit.supportRvmExportAudit?.supportPrimitiveCount || 0,
    supportPrimitiveCodeHistogram: audit.supportRvmExportAudit?.supportPrimitiveCodeHistogram || {},
    supportConePrimitives: audit.supportRvmExportAudit?.supportConePrimitiveCount || 0,
    supportBarPrimitives: audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0,
    supportMaxGlyphExtentMm: audit.supportRvmExportAudit?.supportMaxGlyphExtentMm || 0,
    supportMaxClusterOffsetMm: audit.supportRvmExportAudit?.supportMaxClusterOffsetMm || 0,
    rvmBytes: rvm.byteLength,
    attBytes: Buffer.byteLength(att),
    cntbCount: cntbRecords.length,
    attNewCount: attHierarchy.names.length,
    primitiveHistogram,
    stitchManifestElements: audit.stitchManifest?.elementCount || 0,
    zipEntries: zip.entries
  };
}

function inspectStoredZip(buffer) {
  let offset = 0;
  const entries = [];
  let onlyStoredEntries = true;
  while (offset + 4 <= buffer.byteLength && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    entries.push(name);
    if (method !== 0 || compressedSize !== uncompressedSize) onlyStoredEntries = false;
    offset += 30 + nameLength + extraLength + compressedSize;
  }
  const centralDirectoryOffset = offset;
  while (offset + 4 <= buffer.byteLength && buffer.readUInt32LE(offset) === 0x02014b50) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset + 22 > buffer.byteLength || buffer.readUInt32LE(offset) !== 0x06054b50) {
    throw new Error('Invalid managed-stage ZIP: missing end-of-central-directory record');
  }
  const centralSize = buffer.readUInt32LE(offset + 12);
  const recordedCentralOffset = buffer.readUInt32LE(offset + 16);
  if (recordedCentralOffset !== centralDirectoryOffset) throw new Error('Invalid managed-stage ZIP: central directory offset mismatch');
  if (centralSize !== offset - centralDirectoryOffset) throw new Error('Invalid managed-stage ZIP: central directory size mismatch');
  return { entries, onlyStoredEntries, trailingBytes: buffer.byteLength - (offset + 22) };
}

function compareHistogram(actual, expected, label, issues) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)].map(String));
  for (const key of keys) requireEqual(Number(actual[key] || 0), Number(expected[key] || 0), `${label} code ${key}`, issues);
}

function histogram(values) {
  return values.reduce((out, value) => {
    const key = String(Number(value));
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function requireEqual(actual, expected, label, issues) {
  if (actual !== expected) issues.push(`${label}: expected ${expected}, got ${actual}`);
}

function bmCiiExpectations() {
  return {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12,
    supportRvmPrimitiveCount: 42,
    code1: 0,
    code4: 0,
    code8: 133,
    cntbCount: 56,
    primCount: 133,
    supportMaxGlyphExtentMm: 100,
    supportMaxClusterOffsetMm: 30,
    supportMaxPrimitiveSpanMm: 60,
    supportMaxBarRadiusMm: 3
  };
}

function valueAfterPrefix(values, prefix) {
  const entry = values.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

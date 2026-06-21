import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const dir = valueAfterPrefix(args, '--dir=') || 'artifacts/managed-stage-rvm';
const base = valueAfterPrefix(args, '--base=') || 'BM_CII_INPUT_managed_stage';
const referenceRvm = valueAfterPrefix(args, '--reference-rvm=');
const auditOut = valueAfterPrefix(args, '--audit-out=');
const expectBmCii = args.includes('--expect-bm-cii');
const artifactDir = join(repoRoot, dir);

const { auditRvmBinary } = await import('../src/rvm-binary-audit.js');
const { scanCntbRecords } = await import('../src/rvm-cntb-bounds-policy.js');
const { scanColrRecords } = await import('../src/rvm-material-table-contract.js');
const { scanRvmPrimitivePayloads, RVM_PRIMITIVE_PAYLOAD_LAYOUTS } = await import('../src/rvm-primitive-payload-decoder.js');

const result = verifyManagedStageRvmReferenceCompatibility({ artifactDir, base, referenceRvm, expectBmCii });
if (auditOut) {
  const outputPath = join(repoRoot, auditOut);
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));

export function verifyManagedStageRvmReferenceCompatibility({ artifactDir, base, referenceRvm = '', expectBmCii = false }) {
  const rvmPath = join(artifactDir, `${base}.rvm`);
  const auditPath = join(artifactDir, `${base}.audit.json`);
  if (!existsSync(rvmPath)) throw new Error(`Missing generated RVM artifact: ${rvmPath}`);
  if (!existsSync(auditPath)) throw new Error(`Missing generated audit artifact: ${auditPath}`);

  const generated = inspectRvm(readFileSync(rvmPath), 'generated-managed-stage-rvm');
  const persistedAudit = JSON.parse(readFileSync(auditPath, 'utf8'));
  const reference = referenceRvm ? inspectReference(referenceRvm) : null;
  const issues = [];

  requireReviewCore(generated, issues);
  requireGeneratedManagedStageLayout(generated, issues);
  requireAuditAlignment(generated, persistedAudit, issues);
  if (expectBmCii) requireBmCiiCounts(generated, persistedAudit, issues);
  if (reference) requireReferenceCompatibility(generated, reference, issues);

  if (issues.length) throw new Error(`Managed-stage RVM reference compatibility failed: ${issues.join('; ')}`);
  return {
    schema: 'ManagedStageRvmReferenceCompatibility.v1',
    generated: summarizeRvm(generated),
    reference: reference ? summarizeRvm(reference) : null,
    referenceMode: reference ? 'external-reference-rvm' : 'decoder-layout-self-check',
    compatible: true,
    checks: {
      reviewCoreChunks: true,
      generatedPrimitiveCodesRestrictedTo4And8: true,
      generatedCode4BodyLength92: true,
      generatedCode8BodyLength88: true,
      persistedAuditAligned: true,
      referenceLayoutsMatched: Boolean(reference)
    }
  };
}

function inspectReference(referenceRvm) {
  if (!existsSync(referenceRvm)) throw new Error(`Missing reference RVM: ${referenceRvm}`);
  const reference = inspectRvm(readFileSync(referenceRvm), basename(referenceRvm));
  const issues = [];
  requireReviewCore(reference, issues);
  requireObservedReferenceLayouts(reference, issues);
  if (issues.length) throw new Error(`Reference RVM is not usable for compatibility comparison: ${issues.join('; ')}`);
  return reference;
}

function inspectRvm(buffer, label) {
  const binary = auditRvmBinary(buffer, { allowTrailingZeroPadding: true });
  const primitives = scanRvmPrimitivePayloads(buffer);
  const cntbRecords = scanCntbRecords(buffer);
  const colrRecords = scanColrRecords(buffer);
  const primitiveHistogram = histogram(primitives.map((primitive) => primitive.code));
  const primitiveLayouts = layoutMap(primitives);
  return { label, binary, primitives, cntbRecords, colrRecords, primitiveHistogram, primitiveLayouts };
}

function requireReviewCore(rvm, issues) {
  if (!rvm.binary.ok) issues.push(`${rvm.label}: binary audit failed: ${rvm.binary.issues.join(', ')}`);
  requireEqual(rvm.binary.firstChunk, 'HEAD', `${rvm.label}: first chunk`, issues);
  requireEqual(rvm.binary.secondChunk, 'MODL', `${rvm.label}: second chunk`, issues);
  requireEqual(rvm.binary.terminalChunk, 'END:', `${rvm.label}: terminal chunk`, issues);
  requireEqual(rvm.binary.endBodyLength, 4, `${rvm.label}: END body length`, issues);
  requireEqual(rvm.binary.counts.CNTB || 0, rvm.binary.counts.CNTE || 0, `${rvm.label}: CNTB/CNTE balance`, issues);
  if (!rvm.binary.allChunkMarkersOne) issues.push(`${rvm.label}: all chunks must use Review marker 1`);
  if (!rvm.binary.contiguousUntilEnd && rvm.binary.trailingBytes !== 0) issues.push(`${rvm.label}: chunk stream not contiguous to END`);
}

function requireGeneratedManagedStageLayout(generated, issues) {
  const allowed = new Set([4, 8]);
  for (const primitive of generated.primitives) {
    if (!allowed.has(Number(primitive.code))) issues.push(`generated primitive at offset ${primitive.offset} uses forbidden code ${primitive.code}`);
    if (primitive.code === 4) requirePrimitiveLayout(primitive, 92, 3, 'generated code 4 elbow/torus', issues);
    if (primitive.code === 8) requirePrimitiveLayout(primitive, 88, 2, 'generated code 8 cylinder', issues);
  }
  requireLayoutFromDecoderConstant(4, 92, 3, issues);
  requireLayoutFromDecoderConstant(8, 88, 2, issues);
}

function requireObservedReferenceLayouts(reference, issues) {
  if (!reference.primitiveLayouts['4']) issues.push(`${reference.label}: no code 4 primitive found in reference`);
  if (!reference.primitiveLayouts['8']) issues.push(`${reference.label}: no code 8 primitive found in reference`);
  if (reference.primitiveLayouts['4']) requireLayoutSignature(reference.primitiveLayouts['4'], 92, 3, `${reference.label}: reference code 4`, issues);
  if (reference.primitiveLayouts['8']) requireLayoutSignature(reference.primitiveLayouts['8'], 88, 2, `${reference.label}: reference code 8`, issues);
}

function requireReferenceCompatibility(generated, reference, issues) {
  for (const code of ['4', '8']) {
    const generatedLayout = generated.primitiveLayouts[code];
    const referenceLayout = reference.primitiveLayouts[code];
    if (!generatedLayout) continue;
    if (!referenceLayout) {
      issues.push(`reference missing generated primitive code ${code}`);
      continue;
    }
    compareArrays(generatedLayout.bodyLengths, referenceLayout.bodyLengths, `code ${code} body length signature`, issues);
    compareArrays(generatedLayout.payloadWordCounts, referenceLayout.payloadWordCounts, `code ${code} payload word-count signature`, issues);
  }
}

function requireAuditAlignment(generated, audit, issues) {
  compareHistogram(audit.primitiveHistogram || {}, generated.primitiveHistogram, 'persisted audit primitive histogram', issues);
  requireEqual(audit.chunkHierarchy?.cntbCount, generated.binary.counts.CNTB || 0, 'persisted audit CNTB count', issues);
  requireEqual(audit.chunkHierarchy?.primCount, generated.binary.counts.PRIM || 0, 'persisted audit PRIM count', issues);
  requireEqual(audit.rvmBytes, generated.binary.byteLength, 'persisted audit RVM byte length', issues);
}

function requireBmCiiCounts(generated, audit, issues) {
  requireEqual(generated.primitiveHistogram['4'] || 0, 7, 'BM_CII code 4 primitive count', issues);
  requireEqual(generated.primitiveHistogram['8'] || 0, 41, 'BM_CII code 8 primitive count', issues);
  requireEqual(generated.binary.counts.CNTB || 0, 43, 'BM_CII CNTB count', issues);
  requireEqual(generated.binary.counts.PRIM || 0, 48, 'BM_CII PRIM count', issues);
  requireEqual(audit.inputCounts?.supportRecordsSkippedFromGeometry, 12, 'BM_CII skipped support records', issues);
}

function requirePrimitiveLayout(primitive, bodyLength, payloadWords, label, issues) {
  requireEqual(primitive.bodyLength, bodyLength, `${label} body length`, issues);
  requireEqual(primitive.payloadWordCount, payloadWords, `${label} payload word count`, issues);
  if (!primitive.matrix.every(Number.isFinite)) issues.push(`${label} matrix contains non-finite value`);
  if (!primitive.bbox.every(Number.isFinite)) issues.push(`${label} bbox contains non-finite value`);
  if (!primitive.payload.every(Number.isFinite)) issues.push(`${label} payload contains non-finite value`);
}

function requireLayoutFromDecoderConstant(code, bodyLength, payloadWords, issues) {
  const layout = RVM_PRIMITIVE_PAYLOAD_LAYOUTS[code];
  requireEqual(layout?.bodyLength, bodyLength, `decoder constant code ${code} body length`, issues);
  requireEqual(layout?.payloadWordCount, payloadWords, `decoder constant code ${code} payload words`, issues);
}

function requireLayoutSignature(layout, bodyLength, payloadWords, label, issues) {
  compareArrays(layout.bodyLengths, [bodyLength], `${label} body lengths`, issues);
  compareArrays(layout.payloadWordCounts, [payloadWords], `${label} payload words`, issues);
}

function layoutMap(primitives) {
  const map = {};
  for (const primitive of primitives) {
    const code = String(primitive.code);
    const entry = map[code] || { code: Number(code), count: 0, bodyLengths: new Set(), payloadWordCounts: new Set(), compatibilityStatuses: new Set() };
    entry.count += 1;
    entry.bodyLengths.add(primitive.bodyLength);
    entry.payloadWordCounts.add(primitive.payloadWordCount);
    entry.compatibilityStatuses.add(primitive.compatibilityStatus || 'unknown');
    map[code] = entry;
  }
  return Object.fromEntries(Object.entries(map).map(([code, entry]) => [code, {
    code: entry.code,
    count: entry.count,
    bodyLengths: Array.from(entry.bodyLengths).sort((a, b) => a - b),
    payloadWordCounts: Array.from(entry.payloadWordCounts).sort((a, b) => a - b),
    compatibilityStatuses: Array.from(entry.compatibilityStatuses).sort()
  }]));
}

function summarizeRvm(rvm) {
  return {
    label: rvm.label,
    byteLength: rvm.binary.byteLength,
    chunkCounts: rvm.binary.counts,
    primitiveHistogram: rvm.primitiveHistogram,
    primitiveLayouts: rvm.primitiveLayouts,
    cntbCount: rvm.cntbRecords.length,
    colrCount: rvm.colrRecords.length
  };
}

function compareHistogram(actual, expected, label, issues) {
  const keys = new Set([...Object.keys(actual || {}), ...Object.keys(expected || {})].map(String));
  for (const key of keys) requireEqual(Number(actual?.[key] || 0), Number(expected?.[key] || 0), `${label} code ${key}`, issues);
}

function compareArrays(actual, expected, label, issues) {
  const a = (actual || []).map(Number).sort((x, y) => x - y);
  const e = (expected || []).map(Number).sort((x, y) => x - y);
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) issues.push(`${label}: expected [${e.join(',')}], got [${a.join(',')}]`);
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

function valueAfterPrefix(values, prefix) {
  const entry = values.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

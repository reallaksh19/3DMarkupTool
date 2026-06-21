import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const dir = valueAfterPrefix(args, '--dir=') || 'artifacts/managed-stage-rvm';
const base = valueAfterPrefix(args, '--base=') || 'BM_CII_INPUT_managed_stage';
const auditOut = valueAfterPrefix(args, '--audit-out=');

const { auditRvmBinary } = await import('../src/rvm-binary-audit.js');
const { scanCntbRecords } = await import('../src/rvm-cntb-bounds-policy.js');
const { scanColrRecords } = await import('../src/rvm-material-table-contract.js');
const { scanRvmPrimitivePayloads } = await import('../src/rvm-primitive-payload-decoder.js');

const result = verifyManagedStageRvmReferenceCompatibility({ artifactDir: join(repoRoot, dir), base });
if (auditOut) writeFileSync(join(repoRoot, auditOut), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

export function verifyManagedStageRvmReferenceCompatibility({ artifactDir, base }) {
  const rvmPath = join(artifactDir, `${base}.rvm`);
  const auditPath = join(artifactDir, `${base}.audit.json`);
  if (!existsSync(rvmPath)) throw new Error(`Missing generated RVM artifact: ${rvmPath}`);
  if (!existsSync(auditPath)) throw new Error(`Missing generated audit artifact: ${auditPath}`);

  const buffer = readFileSync(rvmPath);
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  const binary = auditRvmBinary(buffer, { allowTrailingZeroPadding: true });
  const primitives = scanRvmPrimitivePayloads(buffer);
  const cntb = scanCntbRecords(buffer);
  const colr = scanColrRecords(buffer);
  const histogram = countBy(primitives.map((primitive) => Number(primitive.code)));
  const issues = [];

  if (!binary.ok) issues.push(`binary audit failed: ${binary.issues.join(', ')}`);
  requireEqual(binary.firstChunk, 'HEAD', 'first chunk', issues);
  requireEqual(binary.secondChunk, 'MODL', 'second chunk', issues);
  requireEqual(binary.terminalChunk, 'END:', 'terminal chunk', issues);
  requireEqual(binary.counts.CNTB || 0, binary.counts.CNTE || 0, 'CNTB/CNTE balance', issues);
  compareHistogram(audit.primitiveHistogram || {}, histogram, 'persisted audit primitive histogram', issues);
  requireEqual(audit.chunkHierarchy?.cntbCount, binary.counts.CNTB || 0, 'persisted audit CNTB count', issues);
  requireEqual(audit.chunkHierarchy?.primCount, binary.counts.PRIM || 0, 'persisted audit PRIM count', issues);
  requireEqual(audit.rvmBytes, binary.byteLength, 'persisted audit RVM byte length', issues);

  for (const primitive of primitives) {
    if (![4, 8].includes(Number(primitive.code))) issues.push(`forbidden primitive code ${primitive.code}`);
    if (Number(primitive.code) === 8) {
      requireEqual(primitive.bodyLength, 88, 'code 8 body length', issues);
      requireEqual(primitive.payloadWordCount, 2, 'code 8 payload words', issues);
    }
    if (Number(primitive.code) === 4) {
      requireEqual(primitive.bodyLength, 92, 'code 4 body length', issues);
      requireEqual(primitive.payloadWordCount, 3, 'code 4 payload words', issues);
    }
  }

  if (issues.length) throw new Error(`Managed-stage RVM reference compatibility failed: ${issues.join('; ')}`);
  return {
    schema: 'ManagedStageRvmReferenceCompatibility.v1',
    generated: {
      byteLength: buffer.byteLength,
      chunkCounts: binary.counts,
      primitiveHistogram: histogram,
      cntbCount: cntb.length,
      colrCount: colr.length
    },
    reference: null,
    referenceMode: 'decoder-layout-self-check',
    compatible: true
  };
}

function compareHistogram(actual, expected, label, issues) {
  const keys = new Set([...Object.keys(actual || {}), ...Object.keys(expected || {})].map(String));
  for (const key of keys) requireEqual(Number(actual?.[key] || 0), Number(expected?.[key] || 0), `${label} code ${key}`, issues);
}
function countBy(values) {
  return values.reduce((out, value) => {
    out[value] = (out[value] || 0) + 1;
    return out;
  }, {});
}
function requireEqual(actual, expected, label, issues) {
  if (actual !== expected) issues.push(`${label}: expected ${expected}, got ${actual}`);
}
function valueAfterPrefix(values, prefix) {
  const entry = args.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

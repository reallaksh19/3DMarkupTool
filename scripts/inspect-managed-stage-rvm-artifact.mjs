import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const dir = args.dir || 'artifacts/managed-stage-rvm';
const base = args.base || 'BM_CII_INPUT_managed_stage';
const outDir = args.outdir || dir;

const { scanCntbRecords } = await import('../src/rvm-cntb-bounds-policy.js');
const { parseAttHierarchy, scanRvmChunkHierarchy } = await import('../src/rvm-chunk-hierarchy-validator.js');
const { scanRvmPrimitivePayloads } = await import('../src/rvm-primitive-payload-decoder.js');
const { assertManagedStageRvmAuditGate } = await import('../src/managed-stage-rvm-audit-gate.js');

const rvm = readFileSync(join(dir, `${base}.rvm`));
const att = readFileSync(join(dir, `${base}.att`), 'utf8');
const audit = JSON.parse(readFileSync(join(dir, `${base}.audit.json`), 'utf8'));
const cntbRecords = scanCntbRecords(rvm);
const primitives = scanRvmPrimitivePayloads(rvm);
const chunkHierarchy = scanRvmChunkHierarchy(rvm, cntbRecords);
const attHierarchy = parseAttHierarchy(att);
const gate = assertManagedStageRvmAuditGate(audit, args['expect-bm-cii'] ? bmCiiExpectations() : {});
const primitiveHistogram = histogram(primitives.map((primitive) => primitive.code));
const issues = [];

requireEqual(rvm.byteLength, audit.rvmBytes, 'RVM byte count', issues);
requireEqual(Buffer.byteLength(att), audit.attBytes, 'ATT byte count', issues);
requireEqual(cntbRecords.length, audit.chunkHierarchy?.cntbCount, 'CNTB count', issues);
requireEqual(primitives.length, audit.chunkHierarchy?.primCount, 'PRIM count', issues);
requireEqual(chunkHierarchy.counts.CNTB || 0, audit.chunkHierarchy?.cntbCount, 'chunk CNTB count', issues);
requireEqual(chunkHierarchy.counts.PRIM || 0, audit.chunkHierarchy?.primCount, 'chunk PRIM count', issues);
compareHistogram(audit.primitiveHistogram || {}, primitiveHistogram, 'primitive histogram', issues);
if (attHierarchy.names.length < cntbRecords.length) issues.push(`ATT NEW count is less than CNTB count: ${attHierarchy.names.length}/${cntbRecords.length}`);
if (issues.length) throw new Error(`Managed-stage RVM inspection failed: ${issues.join('; ')}`);

const rows = primitives.map((primitive, index) => ({
  primIndex: index + 1,
  code: primitive.code,
  bodyLength: primitive.bodyLength,
  chunkOffset: primitive.offset,
  supportOverlay: index >= (audit.stitchManifest?.geometryPrimitiveCount || 0),
  candidateKind: primitive.candidateEmissionKind || primitive.emittedKind || '',
  semanticType: primitive.semanticType || ''
}));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${base}.inspection.json`), `${JSON.stringify({ schema: 'ManagedStageRvmArtifactInspection.v2', base, gate, cntbCount: cntbRecords.length, primitiveCount: primitives.length, primitiveHistogram, supportRvmExportAudit: audit.supportRvmExportAudit || null, issues: [] }, null, 2)}\n`);
writeFileSync(join(outDir, `${base}.primitives.csv`), renderCsv(rows));
writeFileSync(join(outDir, `${base}.elements.csv`), renderCsv((audit.stitchManifest?.elements || []).map((element) => ({ elementIndex: element.index, reviewName: element.reviewName, primitiveCount: element.primitiveCount }))));
writeFileSync(join(outDir, `${base}.inspection.md`), `# Managed-stage RVM inspection\n\nBase: ${base}\nCNTB: ${cntbRecords.length}\nPRIM: ${primitives.length}\nCode histogram: ${JSON.stringify(primitiveHistogram)}\nSupport RVM primitives: ${audit.supportRvmExportAudit?.supportPrimitiveCount || 0}\nSupport cones: ${audit.supportRvmExportAudit?.supportConePrimitiveCount || 0}\nSupport bars: ${audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0}\n`);

console.log(JSON.stringify({ schema: 'ManagedStageRvmArtifactInspection.v2', ok: true, base, cntbCount: cntbRecords.length, primitiveCount: primitives.length, primitiveHistogram, supportRvmPrimitives: audit.supportRvmExportAudit?.supportPrimitiveCount || 0, supportCones: audit.supportRvmExportAudit?.supportConePrimitiveCount || 0, supportBars: audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0 }, null, 2));

function parseArgs(values) {
  const out = {};
  for (const value of values) {
    if (!value.startsWith('--')) continue;
    const [key, raw = 'true'] = value.slice(2).split('=');
    out[key] = raw;
  }
  return out;
}
function bmCiiExpectations() {
  return { geometryComponents: 40, supportRecordsSkippedFromGeometry: 12, supportRecordsEmittedToRvm: 12, supportRvmPrimitiveCount: 25, code1: 17, code4: 0, code8: 99, cntbCount: 56, primCount: 116 };
}
function histogram(values) {
  return values.reduce((out, value) => {
    const key = String(Number(value));
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}
function compareHistogram(actual, expected, label, issues) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)].map(String));
  for (const key of keys) requireEqual(Number(actual[key] || 0), Number(expected[key] || 0), `${label} code ${key}`, issues);
}
function requireEqual(actual, expected, label, issues) {
  if (actual !== expected) issues.push(`${label}: expected ${expected}, got ${actual}`);
}
function renderCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return `${[keys.join(','), ...rows.map((row) => keys.map((key) => String(row[key] ?? '')).join(','))].join('\n')}\n`;
}

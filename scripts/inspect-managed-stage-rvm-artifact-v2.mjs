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
const issues = [];

if (rvm.byteLength !== audit.rvmBytes) issues.push(`RVM byte count mismatch ${rvm.byteLength}/${audit.rvmBytes}`);
if (Buffer.byteLength(att) !== audit.attBytes) issues.push(`ATT byte count mismatch ${Buffer.byteLength(att)}/${audit.attBytes}`);
if (cntbRecords.length !== audit.chunkHierarchy?.cntbCount) issues.push('CNTB count mismatch vs audit');
if (primitives.length !== audit.chunkHierarchy?.primCount) issues.push('PRIM count mismatch vs audit');
if ((chunkHierarchy.counts.CNTB || 0) !== (chunkHierarchy.counts.CNTE || 0)) issues.push('CNTB/CNTE imbalance');
if (attHierarchy.names.length < cntbRecords.length) issues.push('ATT NEW count is less than CNTB count');
for (const primitive of primitives) {
  if (Number(primitive.code) !== 8) issues.push(`unexpected primitive code ${primitive.code}`);
  if (primitive.bodyLength !== 88) issues.push(`code 8 body length mismatch ${primitive.bodyLength}`);
}
if (issues.length) throw new Error(`Managed-stage RVM inspection v2 failed: ${issues.join('; ')}`);

const rows = primitives.map((primitive, index) => ({
  primIndex: index + 1,
  code: primitive.code,
  bodyLength: primitive.bodyLength,
  chunkOffset: primitive.offset,
  supportOverlay: index >= (audit.stitchManifest?.geometryPrimitiveCount || 0)
}));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${base}.inspection.json`), `${JSON.stringify({ schema: 'ManagedStageRvmArtifactInspection.v2', base, gate, cntbCount: cntbRecords.length, primitiveCount: primitives.length, supportRvmExportAudit: audit.supportRvmExportAudit || null, issues: [] }, null, 2)}\n`);
writeFileSync(join(outDir, `${base}.primitives.csv`), renderCsv(rows));
writeFileSync(join(outDir, `${base}.elements.csv`), renderCsv((audit.stitchManifest?.elements || []).map((element) => ({ elementIndex: element.index, reviewName: element.reviewName, primitiveCount: element.primitiveCount }))));
writeFileSync(join(outDir, `${base}.inspection.md`), `# Managed-stage RVM inspection\n\nBase: ${base}\nCNTB: ${cntbRecords.length}\nPRIM: ${primitives.length}\nSupport RVM primitives: ${audit.supportRvmExportAudit?.supportPrimitiveCount || 0}\n`);

console.log(JSON.stringify({ schema: 'ManagedStageRvmArtifactInspection.v2', ok: true, base, cntbCount: cntbRecords.length, primitiveCount: primitives.length, supportRvmPrimitives: audit.supportRvmExportAudit?.supportPrimitiveCount || 0 }, null, 2));

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
  return { geometryComponents: 40, supportRecordsSkippedFromGeometry: 12, supportRecordsEmittedToRvm: 12, supportRvmPrimitiveCount: 25, code4: 0, code8: 116, cntbCount: 56, primCount: 116 };
}
function renderCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return `${[keys.join(','), ...rows.map((row) => keys.map((key) => String(row[key] ?? '')).join(','))].join('\n')}\n`;
}

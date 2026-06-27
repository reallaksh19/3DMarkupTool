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
const { assertManagedStageTopologyProofGate } = await import('../src/managed-stage-topology-audit-gate.js');

const rvm = readFileSync(join(dir, `${base}.rvm`));
const att = readFileSync(join(dir, `${base}.att`), 'utf8');
const audit = JSON.parse(readFileSync(join(dir, `${base}.audit.json`), 'utf8'));
const cntbRecords = scanCntbRecords(rvm);
const primitives = scanRvmPrimitivePayloads(rvm);
const chunkHierarchy = scanRvmChunkHierarchy(rvm, cntbRecords);
const attHierarchy = parseAttHierarchy(att);
const expectations = args['expect-bm-cii'] ? bmCiiExpectations() : {};
const topologyGate = assertManagedStageTopologyProofGate(audit, expectations);
const gate = assertManagedStageRvmAuditGate(audit, expectations);
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
const componentAudit = audit.componentPrimitiveSymbolExportAudit || null;
const inspection = {
  schema: 'ManagedStageRvmArtifactInspection.v3',
  base,
  gate,
  topologyGate,
  cntbCount: cntbRecords.length,
  primitiveCount: primitives.length,
  primitiveHistogram,
  componentPrimitiveSymbolExportAudit: componentAudit,
  supportTopologyAudit: audit.supportTopologyAudit?.summary || null,
  supportRvmExportAudit: audit.supportRvmExportAudit || null,
  issues: []
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${base}.inspection.json`), `${JSON.stringify(inspection, null, 2)}\n`);
writeFileSync(join(outDir, `${base}.primitives.csv`), renderCsv(rows));
writeFileSync(join(outDir, `${base}.elements.csv`), renderCsv((audit.stitchManifest?.elements || []).map((element) => ({ elementIndex: element.index, reviewName: element.reviewName, primitiveCount: element.primitiveCount }))));
writeFileSync(join(outDir, `${base}.inspection.md`), `# Managed-stage RVM inspection\n\nBase: ${base}\nCNTB: ${cntbRecords.length}\nPRIM: ${primitives.length}\nCode histogram: ${JSON.stringify(primitiveHistogram)}\nTopology proof gate: ${topologyGate.ok ? 'PASS' : 'FAIL'}\nExplicit BEND records: ${topologyGate.explicitBendRecordCount}\nExplicit BEND details: ${topologyGate.explicitBendDetailCount}\nMissing explicit BEND details: ${topologyGate.missingExplicitBendDetailCount}\nSynthetic 1.5D BEND trim blocked: ${topologyGate.synthetic1p5DTrimBlockedCount}\nSupport association-only count: ${topologyGate.supportAssociationOnlyCount}\nSupport topology blocked count: ${topologyGate.supportTopologyBlockedCount}\nSupport continuity edge count: ${topologyGate.supportContinuityEdgeCount}\nSupport inline face count: ${topologyGate.supportInlineFaceCount}\nFlange nodes: ${componentAudit?.flangeNodeCount || 0}\nValve nodes: ${componentAudit?.valveNodeCount || 0}\nWeldNeck flange primitives: ${componentAudit?.weldNeckFlangePrimitiveCount || 0}\nBall valve primitives: ${componentAudit?.ballValvePrimitiveCount || 0}\nSupport RVM primitives: ${audit.supportRvmExportAudit?.supportPrimitiveCount || 0}\nSupport code histogram: ${JSON.stringify(audit.supportRvmExportAudit?.supportPrimitiveCodeHistogram || {})}\nSupport cones: ${audit.supportRvmExportAudit?.supportConePrimitiveCount || 0}\nSupport bars: ${audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0}\nSupport max glyph extent mm: ${audit.supportRvmExportAudit?.supportMaxGlyphExtentMm || 0}\nSupport max cluster offset mm: ${audit.supportRvmExportAudit?.supportMaxClusterOffsetMm || 0}\n`);

console.log(JSON.stringify({
  schema: 'ManagedStageRvmArtifactInspection.v3',
  ok: true,
  base,
  topologyProofGateOk: topologyGate.ok,
  explicitBendRecordCount: topologyGate.explicitBendRecordCount,
  explicitBendDetailCount: topologyGate.explicitBendDetailCount,
  missingExplicitBendDetailCount: topologyGate.missingExplicitBendDetailCount,
  synthetic1p5DTrimBlockedCount: topologyGate.synthetic1p5DTrimBlockedCount,
  supportAssociationOnlyCount: topologyGate.supportAssociationOnlyCount,
  supportTopologyBlockedCount: topologyGate.supportTopologyBlockedCount,
  supportContinuityEdgeCount: topologyGate.supportContinuityEdgeCount,
  supportInlineFaceCount: topologyGate.supportInlineFaceCount,
  cntbCount: cntbRecords.length,
  primitiveCount: primitives.length,
  primitiveHistogram,
  componentPrimitiveSymbolExportAudit: componentAudit,
  supportRvmPrimitives: audit.supportRvmExportAudit?.supportPrimitiveCount || 0,
  supportPrimitiveCodeHistogram: audit.supportRvmExportAudit?.supportPrimitiveCodeHistogram || {},
  supportCones: audit.supportRvmExportAudit?.supportConePrimitiveCount || 0,
  supportBars: audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0,
  supportMaxGlyphExtentMm: audit.supportRvmExportAudit?.supportMaxGlyphExtentMm || 0,
  supportMaxClusterOffsetMm: audit.supportRvmExportAudit?.supportMaxClusterOffsetMm || 0
}, null, 2));

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
  return {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12,
    supportRvmPrimitiveCount: 42,
    topologyComponentCount: 52,
    topologyGeometryComponentCount: 40,
    topologySupportCount: 12,
    explicitBendRecordCount: 7,
    explicitBendDetailCount: 7,
    missingExplicitBendDetailCount: 0,
    synthetic1p5DTrimBlockedCount: 7,
    supportAssociationOnlyCount: 12,
    supportTopologyBlockedCount: 0,
    supportContinuityEdgeCount: 0,
    supportInlineFaceCount: 0,
    code1: 0,
    code4: 7,
    code7: 6,
    code8: 110,
    code9: 6,
    cntbCount: 56,
    primCount: 129,
    supportMaxGlyphExtentMm: 100,
    supportMaxClusterOffsetMm: 30,
    supportMaxPrimitiveSpanMm: 60,
    supportMaxBarRadiusMm: 3
  };
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

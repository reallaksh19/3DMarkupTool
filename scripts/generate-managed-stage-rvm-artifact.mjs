import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('--')) || '';
const fixtureName = valueAfterPrefix(args, '--fixture=');
const outDir = resolveOutDir(args);
const baseNameOverride = valueAfterPrefix(args, '--base=');
const expectBmCii = args.includes('--expect-bm-cii');

if (!inputPath && fixtureName !== 'bm-cii') {
  throw new Error('Usage: node scripts/generate-managed-stage-rvm-artifact.mjs input.json [--expect-bm-cii] [--base=name] --outdir=artifacts/managed-stage-rvm OR --fixture=bm-cii');
}

const { convertManagedStageJsonToRvmAtt } = await import('../src/managed-stage-rvm-converter.js');
const { sourceText, baseName, strictAuditExpectations } = await resolveSource(inputPath, fixtureName, { baseNameOverride, expectBmCii });
const result = convertManagedStageJsonToRvmAtt(sourceText, { strictAuditExpectations });
const artifactSummary = buildArtifactSummary(result.audit);
assertArtifactAuditGates(result.audit);
mkdirSync(outDir, { recursive: true });

const files = [
  [`${baseName}.rvm`, Buffer.from(result.rvm)],
  [`${baseName}.att`, Buffer.from(result.att)],
  [`${baseName}.audit.json`, Buffer.from(`${JSON.stringify(result.audit, null, 2)}\n`)],
  [`${baseName}.summary.json`, Buffer.from(`${JSON.stringify(artifactSummary, null, 2)}\n`)]
];
for (const [name, bytes] of files) writeFileSync(join(outDir, name), bytes);
writeFileSync(join(outDir, `${baseName}.zip`), makeStoredZip(files));

console.log(`Generated managed-stage RVM artifacts in ${outDir}`);
console.log(`Base name: ${baseName}`);
console.log(`Summary file: ${baseName}.summary.json`);
console.log(`Ready: ${artifactSummary.ready ? 'YES' : 'NO'}`);
console.log(`RVM bytes: ${artifactSummary.artifacts.rvmBytes}`);
console.log(`ATT bytes: ${artifactSummary.artifacts.attBytes}`);
console.log(`CNTB / PRIM: ${artifactSummary.counts.cntb} / ${artifactSummary.counts.prim}`);
console.log(`Primitive histogram: ${JSON.stringify(artifactSummary.primitiveHistogram)}`);
console.log(`Payload issues: ${artifactSummary.payloadIssues.total}`);
console.log(`Geometry primitive histogram: ${JSON.stringify(artifactSummary.geometry.primitiveCodeHistogram)}`);
console.log(`Support primitive histogram: ${JSON.stringify(artifactSummary.supportOverlay.primitiveCodeHistogram)}`);
console.log(`Support isolated from pipe/fitting codes: ${artifactSummary.supportOverlay.isolatedFromPipeFittingCodes ? 'YES' : 'NO'}`);
console.log(`Processing mode: ${result.audit.processingConfig?.mode || 'unknown'}`);
console.log(`InputXML bends excluded: ${result.audit.inputXmlBendExclusionAudit?.code4BendsExcluded || 0}`);
console.log(`InputXML branch fittings inferred: ${result.audit.inputXmlBranchFittingInferenceAudit?.genericBranchFittingCount || 0}`);
console.log(`Component symbol export: ${JSON.stringify(result.audit.componentPrimitiveSymbolExportAudit || result.exportModel?.audit?.componentPrimitiveSymbolExportAudit || {})}`);
console.log(`Support records emitted to RVM: ${result.audit.supportRvmExportAudit?.supportRecordCount || 0}`);
console.log(`Support RVM primitives: ${result.audit.supportRvmExportAudit?.supportPrimitiveCount || 0}`);
console.log(`Support code histogram: ${JSON.stringify(result.audit.supportRvmExportAudit?.supportPrimitiveCodeHistogram || {})}`);
console.log(`Support cones: ${result.audit.supportRvmExportAudit?.supportConePrimitiveCount || 0}`);
console.log(`Support bars: ${result.audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0}`);
console.log(`Support max glyph extent mm: ${result.audit.supportRvmExportAudit?.supportMaxGlyphExtentMm || 0}`);
console.log(`Support max cluster offset mm: ${result.audit.supportRvmExportAudit?.supportMaxClusterOffsetMm || 0}`);
console.log(`Explicit BEND records: ${result.audit.managedStageTopologyProofGate?.explicitBendRecordCount || 0}`);
console.log(`Explicit BEND details: ${result.audit.managedStageTopologyProofGate?.explicitBendDetailCount || 0}`);
console.log(`Synthetic 1.5D BEND trim blocked: ${result.audit.managedStageTopologyProofGate?.synthetic1p5DTrimBlockedCount || 0}`);
console.log(`Support association-only count: ${result.audit.managedStageTopologyProofGate?.supportAssociationOnlyCount || 0}`);
console.log(`Support continuity edge count: ${result.audit.managedStageTopologyProofGate?.supportContinuityEdgeCount || 0}`);
console.log(`Support inline face count: ${result.audit.managedStageTopologyProofGate?.supportInlineFaceCount || 0}`);
console.log(`Max centerline gap mm: ${result.audit.topology.maxCenterlineGapMm}`);
console.log(`Topology proof gate: ${result.audit.managedStageTopologyProofGate.ok ? 'PASS' : 'FAIL'}`);
console.log(`Strict audit gate: ${result.audit.managedStageStrictGate.ok ? 'PASS' : 'FAIL'}`);

async function resolveSource(input, fixture, options = {}) {
  if (fixture === 'bm-cii') {
    const { createBmCiiManagedStageFixture } = await import('../tests/managed-stage-bm-cii-profile-fixture.mjs');
    return {
      sourceText: JSON.stringify(createBmCiiManagedStageFixture()),
      baseName: options.baseNameOverride || 'BM_CII_INPUT_managed_stage',
      strictAuditExpectations: bmCiiExpectations()
    };
  }
  return {
    sourceText: readFileSync(input, 'utf8'),
    baseName: options.baseNameOverride || basename(input).replace(/\.json$/i, '') || 'BM_CII_INPUT_managed_stage',
    strictAuditExpectations: options.expectBmCii ? bmCiiExpectations() : {}
  };
}

function buildArtifactSummary(audit = {}) {
  const sourceSummary = audit.rvmAuditSummary || {};
  const payload = audit.rvmPrimitivePayloadSemanticsAudit || {};
  const geometry = audit.rvmGeometryAudit || {};
  const support = audit.supportRvmExportAudit || {};
  const stitch = audit.stitchManifest || {};
  const payloadIssues = {
    total: Number(payload.issueCount || sourceSummary.payloadIssues?.total || 0),
    code4: Number(payload.code4?.issueCount || sourceSummary.payloadIssues?.code4 || 0),
    code7: Number(payload.code7?.issueCount || sourceSummary.payloadIssues?.code7 || 0),
    code9: Number(payload.code9?.issueCount || sourceSummary.payloadIssues?.code9 || 0)
  };
  const supportCodeHistogram = geometry.supportOverlay?.primitiveCodeHistogram || support.supportPrimitiveCodeHistogram || {};
  const supportIsolated = geometry.supportOverlay?.isolatedFromPipeFittingCodes !== false;
  const geometryOk = geometry.issueCount === undefined ? true : Number(geometry.issueCount || 0) === 0;
  const fallbackReady = payloadIssues.total === 0
    && geometryOk
    && audit.managedStageTopologyProofGate?.ok !== false
    && audit.managedStageStrictGate?.ok !== false
    && audit.stitchManifestGate?.ok !== false;
  const ready = sourceSummary.ready ?? fallbackReady;
  return {
    schema: 'ManagedStageRvmArtifactSummary.v1',
    ready: Boolean(ready),
    counts: {
      geometryComponents: audit.inputCounts?.geometryComponents || 0,
      supportRecords: audit.inputCounts?.supportRecordsEmittedToRvm || 0,
      cntb: audit.chunkHierarchy?.cntbCount || sourceSummary.counts?.cntb || 0,
      prim: audit.chunkHierarchy?.primCount || sourceSummary.counts?.prim || 0
    },
    primitiveHistogram: audit.primitiveHistogram || sourceSummary.primitiveHistogram || {},
    payloadIssues,
    geometry: {
      primitiveCount: geometry.geometry?.primitiveCount || stitch.geometryPrimitiveCount || sourceSummary.geometry?.primitiveCount || 0,
      primitiveCodeHistogram: geometry.geometry?.primitiveCodeHistogram || sourceSummary.geometry?.primitiveCodeHistogram || {},
      primitiveRoleTagCounts: geometry.geometry?.primitiveRoleTagCounts || sourceSummary.geometry?.primitiveRoleTagCounts || {},
      code4Count: geometry.geometry?.code4Elbows?.count || sourceSummary.geometry?.code4Count || 0,
      code7Count: geometry.geometry?.code7Snouts?.count || sourceSummary.geometry?.code7Count || 0,
      code8Count: geometry.geometry?.code8Cylinders?.count || sourceSummary.geometry?.code8Count || 0,
      code9Count: geometry.geometry?.code9Spheres?.count || sourceSummary.geometry?.code9Count || 0
    },
    supportOverlay: {
      primitiveCount: geometry.supportOverlay?.primitiveCount || stitch.supportOverlayPrimitiveCount || sourceSummary.supportOverlay?.primitiveCount || 0,
      primitiveCodeHistogram: supportCodeHistogram,
      isolatedFromPipeFittingCodes: supportIsolated,
      nonCode8PrimitiveCount: geometry.supportOverlay?.nonCode8PrimitiveCount || sourceSummary.supportOverlay?.nonCode8PrimitiveCount || 0
    },
    gates: {
      topologyProof: audit.managedStageTopologyProofGate?.ok !== false,
      strictAudit: audit.managedStageStrictGate?.ok !== false,
      stitchManifest: audit.stitchManifestGate?.ok !== false
    },
    artifacts: {
      rvmBytes: audit.rvmBytes || sourceSummary.artifacts?.rvmBytes || 0,
      attBytes: audit.attBytes || sourceSummary.artifacts?.attBytes || 0,
      generationMode: audit.generationMode || sourceSummary.artifacts?.generationMode || ''
    }
  };
}

function assertArtifactAuditGates(audit) {
  if (audit.managedStageTopologyProofGate?.ok !== true) throw new Error('Managed-stage artifact topology proof gate failed');
  if (audit.managedStageStrictGate?.ok !== true) throw new Error('Managed-stage artifact strict audit gate failed');
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

function resolveOutDir(values) {
  const arg = valueAfterPrefix(values, '--outdir=');
  return arg ? join(repoRoot, arg) : join(repoRoot, 'artifacts', 'managed-stage-rvm');
}

function valueAfterPrefix(values, prefix) {
  const entry = values.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

function makeStoredZip(entries) {
  let offset = 0;
  const locals = [];
  const centrals = [];
  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30); data.copy(local, 30 + nameBytes.length); locals.push(local);
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42); nameBytes.copy(central, 46); centrals.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, entry) => sum + entry.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralOffset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const dir = join(repoRoot, args.dir || 'artifacts/managed-stage-rvm');
const base = args.base || 'BM_CII_INPUT_managed_stage';

const { scanRvmPrimitivePayloads } = await import('../src/rvm-primitive-payload-decoder.js');

const rvmPath = join(dir, `${base}.rvm`);
const attPath = join(dir, `${base}.att`);
const auditPath = join(dir, `${base}.audit.json`);
const summaryPath = join(dir, `${base}.summary.json`);

for (const path of [rvmPath, attPath, auditPath]) {
  if (!existsSync(path)) throw new Error(`Missing artifact file: ${path}`);
}

const rvm = readFileSync(rvmPath);
const att = readFileSync(attPath, 'utf8');
const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
const summary = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, 'utf8')) : null;
const primitives = scanRvmPrimitivePayloads(rvm);
const geometryPrimitiveCount = Number(audit.stitchManifest?.geometryPrimitiveCount || 0);
const supportPrimitives = primitives.slice(geometryPrimitiveCount);
const report = {
  schema: 'ManagedStageRvmArtifactFileInspection.v1',
  ok: true,
  base,
  files: {
    rvmBytes: rvm.byteLength,
    attBytes: Buffer.byteLength(att),
    hasSummaryJson: Boolean(summary)
  },
  decodedRvm: {
    primitiveCount: primitives.length,
    primitiveHistogram: histogram(primitives.map((primitive) => primitive.code)),
    bodyLengthHistogram: histogram(primitives.map((primitive) => primitive.bodyLength)),
    supportedForEmissionCount: primitives.filter((primitive) => primitive.supportedForEmission === true).length
  },
  att: {
    blockCount: countAttBlocks(att),
    hasTargetViewerMetadata: att.includes("TARGET_VIEWER := 'Navisworks'"),
    hasSupportMetadata: /FAMILY := '(GUIDE|LINE_STOP|SPRING)'/.test(att)
  },
  audit: {
    primitiveHistogram: audit.primitiveHistogram || {},
    chunkHierarchy: {
      cntbCount: audit.chunkHierarchy?.cntbCount || 0,
      primCount: audit.chunkHierarchy?.primCount || 0
    },
    geometryPrimitiveCount,
    supportOverlayPrimitiveCount: Number(audit.stitchManifest?.supportOverlayPrimitiveCount || 0),
    payloadIssueCount: Number(audit.rvmPrimitivePayloadSemanticsAudit?.issueCount || 0),
    geometryIssueCount: Number(audit.rvmGeometryAudit?.issueCount || 0),
    continuityIssueCount: Number(audit.rvmContinuityAudit?.issueCount || 0),
    ready: audit.rvmAuditSummary?.ready ?? summary?.ready ?? null
  },
  geometrySupportSplit: {
    geometryPrimitiveCount,
    supportPrimitiveCount: supportPrimitives.length,
    supportPrimitiveHistogram: histogram(supportPrimitives.map((primitive) => primitive.code)),
    supportUsesOnlyCode8: supportPrimitives.every((primitive) => Number(primitive.code) === 8)
  },
  summary
};

console.log(JSON.stringify(report, null, 2));

function parseArgs(values) {
  const out = {};
  for (const value of values) {
    if (!value.startsWith('--')) continue;
    const [key, raw = 'true'] = value.slice(2).split('=');
    out[key] = raw;
  }
  return out;
}

function histogram(values) {
  return values.reduce((out, value) => {
    const key = String(Number(value));
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function countAttBlocks(text) {
  return (String(text || '').match(/^NEW\s+/gm) || []).length;
}

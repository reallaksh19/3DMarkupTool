import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('--')) || '';
const fixture = valueAfterPrefix('--fixture=');
const auditOut = valueAfterPrefix('--audit-out=');
const expectBmCii = args.includes('--expect-bm-cii') || fixture === 'bm-cii';

if (!inputPath && fixture !== 'bm-cii') throw new Error('Usage: verify-managed-stage-rvm-profile-v2.mjs input.json [--expect-bm-cii] [--audit-out=path] OR --fixture=bm-cii');

const { convertManagedStageJsonToRvmAtt } = await import('../src/managed-stage-rvm-converter.js');
const source = await resolveSource();
const result = convertManagedStageJsonToRvmAtt(source.text, {
  strictAuditExpectations: expectBmCii ? bmCiiExpectations() : {}
});

if (auditOut) writeFileSync(join(repoRoot, auditOut), `${JSON.stringify(result.audit, null, 2)}\n`);
console.log(JSON.stringify({
  schema: 'ManagedStageRvmProfileVerification.v2',
  source: source.label,
  strictGateOk: result.audit.managedStageStrictGate?.ok === true,
  geometryComponents: result.audit.inputCounts.geometryComponents,
  supportRecordsSkippedFromGeometry: result.audit.inputCounts.supportRecordsSkippedFromGeometry,
  supportRecordsEmittedToRvm: result.audit.inputCounts.supportRecordsEmittedToRvm,
  supportRvmPrimitives: result.audit.supportRvmExportAudit?.supportPrimitiveCount || 0,
  supportPrimitiveCodeHistogram: result.audit.supportRvmExportAudit?.supportPrimitiveCodeHistogram || {},
  supportConePrimitives: result.audit.supportRvmExportAudit?.supportConePrimitiveCount || 0,
  supportBarPrimitives: result.audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0,
  supportMaxGlyphExtentMm: result.audit.supportRvmExportAudit?.supportMaxGlyphExtentMm || 0,
  supportMaxClusterOffsetMm: result.audit.supportRvmExportAudit?.supportMaxClusterOffsetMm || 0,
  primitiveHistogram: result.audit.primitiveHistogram,
  cntbCount: result.audit.chunkHierarchy.cntbCount,
  primCount: result.audit.chunkHierarchy.primCount,
  rvmBytes: result.audit.rvmBytes,
  attBytes: result.audit.attBytes,
  auditOutWritten: Boolean(auditOut)
}, null, 2));

async function resolveSource() {
  if (fixture === 'bm-cii') {
    const { createBmCiiManagedStageFixture } = await import('../tests/managed-stage-bm-cii-profile-fixture.mjs');
    return { text: JSON.stringify(createBmCiiManagedStageFixture()), label: 'fixture:bm-cii' };
  }
  return { text: readFileSync(inputPath, 'utf8'), label: basename(inputPath) };
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

function valueAfterPrefix(prefix) {
  const entry = args.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

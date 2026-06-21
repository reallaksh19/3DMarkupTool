import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('--')) || '';
const fixtureName = valueAfterPrefix(args, '--fixture=');
const auditOut = valueAfterPrefix(args, '--audit-out=');
const exactBmCii = args.includes('--expect-bm-cii');

if (!inputPath && fixtureName !== 'bm-cii') {
  throw new Error('Usage: node scripts/verify-managed-stage-rvm-profile.mjs input.json [--expect-bm-cii] [--audit-out=path] OR --fixture=bm-cii');
}

const { convertManagedStageJsonToRvmAtt } = await import('../src/managed-stage-rvm-converter.js');
const { sourceText, sourceLabel, strictAuditExpectations } = await resolveSource(inputPath, fixtureName, exactBmCii);
const result = convertManagedStageJsonToRvmAtt(sourceText, { strictAuditExpectations });
const summary = buildSummary(sourceLabel, result.audit);

if (auditOut) writeFileSync(join(repoRoot, auditOut), `${JSON.stringify(result.audit, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

if (!result.audit.managedStageStrictGate?.ok) {
  throw new Error('Managed-stage strict gate failed');
}

async function resolveSource(input, fixture, expectBmCii) {
  if (fixture === 'bm-cii') {
    const { createBmCiiManagedStageFixture } = await import('../tests/managed-stage-bm-cii-profile-fixture.mjs');
    return {
      sourceText: JSON.stringify(createBmCiiManagedStageFixture()),
      sourceLabel: 'fixture:bm-cii',
      strictAuditExpectations: bmCiiExpectations()
    };
  }
  return {
    sourceText: readFileSync(input, 'utf8'),
    sourceLabel: basename(input),
    strictAuditExpectations: expectBmCii ? bmCiiExpectations() : {}
  };
}

function bmCiiExpectations() {
  return {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    code4: 7,
    code8: 41,
    cntbCount: 43,
    primCount: 48
  };
}

function buildSummary(sourceLabel, audit) {
  return {
    schema: 'ManagedStageRvmProfileVerification.v1',
    source: sourceLabel,
    strictGateOk: audit.managedStageStrictGate?.ok === true,
    generationMode: audit.generationMode,
    units: audit.units,
    geometryComponents: audit.inputCounts.geometryComponents,
    supportRecordsSkippedFromGeometry: audit.inputCounts.supportRecordsSkippedFromGeometry,
    statsRestraintsMismatch: audit.inputCounts.statsRestraintsMismatch,
    primitiveHistogram: audit.primitiveHistogram,
    cntbCount: audit.chunkHierarchy.cntbCount,
    primCount: audit.chunkHierarchy.primCount,
    colrCount: audit.chunkHierarchy.colrCount,
    maxCenterlineGapMm: audit.topology.maxCenterlineGapMm,
    zeroLengthComponents: audit.topology.zeroLength.length,
    branchNodes: audit.topology.branchNodes,
    terminalNodes: audit.topology.terminalNodes,
    torusOrientationAssumptions: audit.torusOrientationAssumptions.length,
    rvmBytes: audit.rvmBytes,
    attBytes: audit.attBytes,
    auditOutWritten: Boolean(auditOut)
  };
}

function valueAfterPrefix(values, prefix) {
  const entry = values.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

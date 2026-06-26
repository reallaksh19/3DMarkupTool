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
if (!result.audit.managedStageTopologyProofGate?.ok) {
  throw new Error('Managed-stage topology proof gate failed');
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
    code4: 0,
    code8: 157,
    cntbCount: 56,
    primCount: 157,
    supportMaxGlyphExtentMm: 100,
    supportMaxClusterOffsetMm: 30,
    supportMaxPrimitiveSpanMm: 60,
    supportMaxBarRadiusMm: 3
  };
}

function buildSummary(sourceLabel, audit) {
  return {
    schema: 'ManagedStageRvmProfileVerification.v1',
    source: sourceLabel,
    strictGateOk: audit.managedStageStrictGate?.ok === true,
    topologyProofGateOk: audit.managedStageTopologyProofGate?.ok === true,
    topologyProofGate: audit.managedStageTopologyProofGate || null,
    generationMode: audit.generationMode,
    units: audit.units,
    processingConfig: audit.processingConfig,
    inputXmlBendExclusion: audit.inputXmlBendExclusionAudit,
    inputXmlNodeLocalElbows: audit.inputXmlNodeLocalElbowAudit,
    inputXmlBranchFittingInference: audit.inputXmlBranchFittingInferenceAudit,
    supportTopologyAudit: audit.supportTopologyAudit?.summary || null,
    supportRvmExport: audit.supportRvmExportAudit,
    componentPrimitiveSymbolExport: audit.componentPrimitiveSymbolExportAudit || audit.exportModel?.audit?.componentPrimitiveSymbolExportAudit || null,
    geometryComponents: audit.inputCounts.geometryComponents,
    supportRecordsSkippedFromGeometry: audit.inputCounts.supportRecordsSkippedFromGeometry,
    supportRecordsEmittedToRvm: audit.inputCounts.supportRecordsEmittedToRvm,
    statsRestraintsMismatch: audit.inputCounts.statsRestraintsMismatch,
    primitiveHistogram: audit.primitiveHistogram,
    cntbCount: audit.chunkHierarchy.cntbCount,
    primCount: audit.chunkHierarchy.primCount,
    colrCount: audit.chunkHierarchy.colrCount,
    maxCenterlineGapMm: audit.topology.maxCenterlineGapMm,
    zeroLengthComponents: audit.topology.zeroLength.length,
    branchNodes: audit.topology.branchNodes,
    terminalNodes: audit.topology.terminalNodes,
    explicitBendRecordCount: audit.supportTopologyAudit?.summary?.explicitBendRecordCount || 0,
    explicitBendDetailCount: audit.supportTopologyAudit?.summary?.explicitBendDetailCount || 0,
    missingExplicitBendDetailCount: audit.supportTopologyAudit?.summary?.missingExplicitBendDetailCount || 0,
    synthetic1p5DTrimBlockedCount: audit.supportTopologyAudit?.summary?.synthetic1p5DTrimBlockedCount || 0,
    supportAssociationOnlyCount: audit.supportRvmExportAudit?.supportAssociationOnlyCount || 0,
    supportTopologyBlockedCount: audit.supportRvmExportAudit?.supportTopologyBlockedCount || 0,
    supportContinuityEdgeCount: audit.supportRvmExportAudit?.supportContinuityEdgeCount || 0,
    supportInlineFaceCount: audit.supportRvmExportAudit?.supportInlineFaceCount || 0,
    torusOrientationAssumptions: audit.torusOrientationAssumptions.length,
    genericInputXmlBendAssumptions: audit.genericInputXmlBendAssumptions?.length || 0,
    genericInputXmlNodeLocalElbowAssumptions: audit.genericInputXmlNodeLocalElbowAssumptions?.length || 0,
    genericInputXmlBranchFittingAssumptions: audit.genericInputXmlBranchFittingAssumptions?.length || 0,
    rvmBytes: audit.rvmBytes,
    attBytes: audit.attBytes,
    auditOutWritten: Boolean(auditOut)
  };
}

function valueAfterPrefix(values, prefix) {
  const entry = values.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

const RVM_TRANSFORM_BLOCK_REASON = 'RVM artifact blocked until final review transform policy is implemented';
const RVM_BRIDGE_BLOCK_REASON = 'RVM full model artifact remains blocked; straight-pipe subset transform readiness proven; pipe+bend and flange subsets are handled by isolated test bridges';

export function adaptRvmExportModelToTestArtifact(rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1' && exportAudit.ok === true && writerAdapterPlan?.schema === 'WriterAdapterPlan.v1' && writerAdapterAudit?.schema === 'WriterAdapterAudit.v1' && writerAdapterAudit.ok === true;
  const primitiveCount = (Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives.length : 0) + (Array.isArray(rvmExportModel?.testByteEligiblePrimitives) ? rvmExportModel.testByteEligiblePrimitives.length : 0) + (Array.isArray(rvmExportModel?.flangeTestByteEligiblePrimitives) ? rvmExportModel.flangeTestByteEligiblePrimitives.length : 0);
  if (!canPlan) return blockedRvmArtifact('Writer adapter audit must be ok before test artifact planning', primitiveCount, false, false, false);
  const straightReady = rvmExportModel?.transformApplied === true && rvmExportModel?.transformPolicy === 'final-review-transform.v1' && writerAdapterPlan?.rvmAdapter?.transformApplied === true && writerAdapterPlan?.rvmAdapter?.transformPolicy === 'final-review-transform.v1' && writerAdapterPlan?.rvmAdapter?.writerReady === true;
  const bendReady = writerAdapterPlan?.rvmAdapter?.pipeBendSubsetTestByteReady === true && Number(writerAdapterPlan?.rvmAdapter?.testByteEligibleBendTorusCount || 0) > 0;
  const flangeReady = writerAdapterPlan?.rvmAdapter?.flangeSubsetTestByteReady === true && Number(writerAdapterPlan?.rvmAdapter?.flangeTestByteEligibleCount || 0) > 0;
  if (!straightReady) return blockedRvmArtifact(RVM_TRANSFORM_BLOCK_REASON, primitiveCount, false, false, false);
  return blockedRvmArtifact(options.reason || RVM_BRIDGE_BLOCK_REASON, primitiveCount, true, bendReady, flangeReady);
}
function blockedRvmArtifact(reason, primitiveCount, transformReady, bendTorusReady, flangeReady) { return { artifactKind: 'rvm', artifactReady: false, artifactGenerated: false, artifactBlocked: true, reason, byteLength: 0, primitiveCount, transformReady, straightPipeSubsetReady: transformReady, bendTorusSubsetReady: bendTorusReady, flangeSubsetReady: flangeReady, pipeBendSubsetReady: transformReady && bendTorusReady }; }

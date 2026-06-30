const RVM_TRANSFORM_BLOCK_REASON = 'RVM artifact blocked until final review transform policy is implemented';
const RVM_BRIDGE_BLOCK_REASON = 'RVM artifact byte generation not implemented in Phase 8B; straight-pipe subset transform readiness proven';

export function adaptRvmExportModelToTestArtifact(rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1'
    && exportAudit.ok === true
    && writerAdapterPlan?.schema === 'WriterAdapterPlan.v1'
    && writerAdapterAudit?.schema === 'WriterAdapterAudit.v1'
    && writerAdapterAudit.ok === true;
  const primitiveCount = Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives.length : 0;
  if (!canPlan) return blockedRvmArtifact('Writer adapter audit must be ok before test artifact planning', primitiveCount, false);
  const transformReady = rvmExportModel?.transformApplied === true
    && rvmExportModel?.transformPolicy === 'final-review-transform.v1'
    && writerAdapterPlan?.rvmAdapter?.transformApplied === true
    && writerAdapterPlan?.rvmAdapter?.transformPolicy === 'final-review-transform.v1'
    && writerAdapterPlan?.rvmAdapter?.writerReady === true;
  if (!transformReady) return blockedRvmArtifact(RVM_TRANSFORM_BLOCK_REASON, primitiveCount, false);
  return blockedRvmArtifact(options.reason || RVM_BRIDGE_BLOCK_REASON, primitiveCount, true);
}

function blockedRvmArtifact(reason, primitiveCount, transformReady) {
  return {
    artifactKind: 'rvm',
    artifactReady: false,
    artifactGenerated: false,
    artifactBlocked: true,
    reason,
    byteLength: 0,
    primitiveCount,
    transformReady,
    straightPipeSubsetReady: transformReady
  };
}

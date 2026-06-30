const RVM_TRANSFORM_BLOCK_REASON = 'RVM artifact blocked until final review transform policy is implemented';
const RVM_BRIDGE_BLOCK_REASON = 'RVM test artifact writer bridge not implemented in Phase 8A';

export function adaptRvmExportModelToTestArtifact(rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1'
    && exportAudit.ok === true
    && writerAdapterPlan?.schema === 'WriterAdapterPlan.v1'
    && writerAdapterAudit?.schema === 'WriterAdapterAudit.v1'
    && writerAdapterAudit.ok === true;
  const primitiveCount = Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives.length : 0;
  if (!canPlan) return blockedRvmArtifact('Writer adapter audit must be ok before test artifact planning', primitiveCount);
  if (rvmExportModel?.transformApplied !== true || writerAdapterPlan?.rvmAdapter?.transformApplied !== true) {
    return blockedRvmArtifact(RVM_TRANSFORM_BLOCK_REASON, primitiveCount);
  }
  return blockedRvmArtifact(options.reason || RVM_BRIDGE_BLOCK_REASON, primitiveCount);
}

function blockedRvmArtifact(reason, primitiveCount) {
  return {
    artifactKind: 'rvm',
    artifactReady: false,
    artifactGenerated: false,
    artifactBlocked: true,
    reason,
    byteLength: 0,
    primitiveCount
  };
}

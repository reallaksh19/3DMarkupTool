const GLB_BLOCK_REASON = 'GLB test artifact writer not implemented in Phase 8A';

export function adaptGlbVisualModelToTestArtifact(glbVisualModel, exportAudit, writerAdapterPlan, writerAdapterAudit) {
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1'
    && exportAudit.ok === true
    && writerAdapterPlan?.schema === 'WriterAdapterPlan.v1'
    && writerAdapterAudit?.schema === 'WriterAdapterAudit.v1'
    && writerAdapterAudit.ok === true;
  const primitiveCount = Array.isArray(glbVisualModel?.visualItems) ? glbVisualModel.visualItems.length : 0;
  if (!canPlan) return blockedGlbArtifact('Writer adapter audit must be ok before test artifact planning', primitiveCount);
  return blockedGlbArtifact(GLB_BLOCK_REASON, primitiveCount);
}

function blockedGlbArtifact(reason, primitiveCount) {
  return {
    artifactKind: 'glb',
    artifactReady: false,
    artifactGenerated: false,
    artifactBlocked: true,
    reason,
    byteLength: 0,
    primitiveCount
  };
}

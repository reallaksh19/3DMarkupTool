const ATT_BRIDGE_BLOCK_REASON = 'ATT writer adapter requires production writer model bridge not implemented in Phase 8A';

export function adaptAttExportModelToTestArtifact(attExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit) {
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1'
    && exportAudit.ok === true
    && writerAdapterPlan?.schema === 'WriterAdapterPlan.v1'
    && writerAdapterAudit?.schema === 'WriterAdapterAudit.v1'
    && writerAdapterAudit.ok === true;
  const recordCount = Array.isArray(attExportModel?.records) ? attExportModel.records.length : 0;
  if (!canPlan) return blockedAttArtifact('Writer adapter audit must be ok before test artifact planning', recordCount);
  return blockedAttArtifact(ATT_BRIDGE_BLOCK_REASON, recordCount);
}

function blockedAttArtifact(reason, recordCount) {
  return {
    artifactKind: 'att',
    artifactReady: false,
    artifactGenerated: false,
    artifactBlocked: true,
    reason,
    textLength: 0,
    recordCount
  };
}

const ATT_WRITER_ADAPTER_SCHEMA = 'AttWriterAdapterPlan.v1';

export function adaptAttExportModelForWriter(attExportModel, exportAudit, options = {}) {
  const mode = options.mode || 'dryRun';
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1' && exportAudit.ok === true;
  const plannedRecords = [];
  const blockedRecords = [];
  const deferredRecords = [];
  const warnings = [];

  if (canPlan) {
    for (const record of Array.isArray(attExportModel?.records) ? attExportModel.records : []) {
      if (record.recordId && record.sourceItemId) {
        plannedRecords.push({
          recordId: record.recordId,
          sourceItemId: record.sourceItemId,
          sourceRef: record.sourceRef,
          resolutionMode: record.resolutionMode,
          writerStatus: 'planned',
          reason: 'metadata record summary accepted'
        });
      }
    }
    for (const blocked of Array.isArray(attExportModel?.blockedRecords) ? attExportModel.blockedRecords : []) {
      blockedRecords.push(statusRecord(blocked, 'blocked'));
    }
    for (const deferred of Array.isArray(attExportModel?.deferredRecords) ? attExportModel.deferredRecords : []) {
      deferredRecords.push(statusRecord(deferred, 'deferred'));
    }
  }

  return {
    schema: ATT_WRITER_ADAPTER_SCHEMA,
    graphId: attExportModel?.graphId || options.graphId || '<unknown-graph>',
    writerKind: 'att',
    mode,
    writerReady: canPlan && plannedRecords.every((entry) => entry.recordId && entry.sourceItemId),
    sourceSchema: 'AttExportModel.v1',
    plannedRecordCount: plannedRecords.length,
    plannedRecords,
    blockedRecords,
    deferredRecords,
    warnings
  };
}

function statusRecord(entry, writerStatus) {
  return {
    sourceItemId: entry.sourceItemId,
    family: entry.family,
    type: entry.type,
    writerStatus,
    reason: entry.reason,
    sourceRef: entry.sourceRef
  };
}

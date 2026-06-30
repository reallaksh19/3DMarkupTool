const ATT_EXPORT_MODEL_SCHEMA = 'AttExportModel.v1';

export function compileResolvedPrimitiveModelToAttExportModel(primitiveModel, primitiveAudit, options = {}) {
  const canCompile = primitiveAudit?.schema === 'PrimitiveCompilationAudit.v1' && primitiveAudit.ok === true;
  const graphId = primitiveModel?.graphId || options.graphId || '<unknown-graph>';
  const records = [];
  const blockedRecords = [];
  const deferredRecords = [];

  if (canCompile) {
    for (const item of Array.isArray(primitiveModel?.items) ? primitiveModel.items : []) {
      if (item.resolutionMode === 'blocked') continue;
      if (item.resolutionMode === 'deferred') continue;
      records.push({
        recordId: `ATT-${item.id}`,
        sourceItemId: item.id,
        sourceRef: item.sourceRef,
        resolutionMode: item.resolutionMode,
        exportStatus: 'recordPlanned'
      });
    }
    for (const blocked of Array.isArray(primitiveModel?.blockedPrimitives) ? primitiveModel.blockedPrimitives : []) {
      blockedRecords.push({
        sourceItemId: blocked.sourceItemId,
        family: blocked.family,
        type: blocked.type,
        recordStatus: 'blocked',
        reason: blocked.reason,
        sourceRef: blocked.sourceRef
      });
    }
    for (const deferred of Array.isArray(primitiveModel?.deferredPrimitives) ? primitiveModel.deferredPrimitives : []) {
      deferredRecords.push({
        sourceItemId: deferred.sourceItemId,
        family: deferred.family,
        type: deferred.type,
        recordStatus: 'deferred',
        reason: deferred.reason,
        sourceRef: deferred.sourceRef
      });
    }
  }

  return {
    schema: ATT_EXPORT_MODEL_SCHEMA,
    graphId,
    units: primitiveModel?.units || options.units || 'mm',
    records,
    blockedRecords,
    deferredRecords,
    sourceRefs: Array.isArray(primitiveModel?.sourceRefs) ? primitiveModel.sourceRefs : []
  };
}

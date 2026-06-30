const RVM_WRITER_ADAPTER_SCHEMA = 'RvmWriterAdapterPlan.v1';
const TRANSFORM_BLOCK_WARNING = 'RVM writer artifact readiness blocked until final review transform policy is implemented.';

export function adaptRvmExportModelForWriter(rvmExportModel, exportAudit, options = {}) {
  const mode = options.mode || 'dryRun';
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1' && exportAudit.ok === true;
  const plannedChunks = [];
  const blockedItems = [];
  const deferredItems = [];
  const warnings = [];

  if (canPlan) {
    for (const primitive of Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives : []) {
      if (isCylinderCode8Plan(primitive)) {
        plannedChunks.push({
          chunkKind: 'PRIM',
          sourcePrimitiveId: primitive.sourcePrimitiveId,
          sourceItemId: primitive.sourceItemId,
          primitiveKind: 'CYLINDER',
          primitiveCode: 8,
          writerStatus: 'planned',
          reason: 'writer-neutral cylinder primitive plan accepted'
        });
      }
    }
    for (const blocked of Array.isArray(rvmExportModel?.blockedExports) ? rvmExportModel.blockedExports : []) {
      blockedItems.push(statusItem(blocked, 'blocked'));
    }
    for (const deferred of Array.isArray(rvmExportModel?.deferredExports) ? rvmExportModel.deferredExports : []) {
      deferredItems.push(statusItem(deferred, 'deferred'));
    }
  }

  if (rvmExportModel?.transformApplied === false) warnings.push(TRANSFORM_BLOCK_WARNING);
  const plannedCylinderCount = plannedChunks.filter((entry) => entry.primitiveKind === 'CYLINDER').length;
  return {
    schema: RVM_WRITER_ADAPTER_SCHEMA,
    graphId: rvmExportModel?.graphId || options.graphId || '<unknown-graph>',
    writerKind: 'rvm',
    mode,
    writerReady: canPlan && plannedChunks.length > 0 && rvmExportModel?.transformApplied === true,
    sourceSchema: 'RvmExportModel.v1',
    transformPolicy: rvmExportModel?.transformPolicy || '<missing-transform-policy>',
    transformApplied: rvmExportModel?.transformApplied === true,
    plannedPrimitiveCount: plannedChunks.length,
    plannedCylinderCount,
    plannedTorusCount: plannedChunks.filter((entry) => entry.primitiveKind === 'TORUS').length,
    plannedBoxCount: plannedChunks.filter((entry) => entry.primitiveKind === 'BOX').length,
    plannedSphereCount: plannedChunks.filter((entry) => entry.primitiveKind === 'SPHERE').length,
    plannedPyramidCount: plannedChunks.filter((entry) => entry.primitiveKind === 'PYRAMID').length,
    plannedChunks,
    blockedItems,
    deferredItems,
    warnings
  };
}

function isCylinderCode8Plan(primitive) {
  return primitive?.primitiveKind === 'CYLINDER'
    && Number(primitive?.primitiveCode) === 8
    && isPoint3(primitive?.center)
    && isPoint3(primitive?.axis)
    && Number.isFinite(Number(primitive?.lengthMm))
    && Number.isFinite(Number(primitive?.radiusMm))
    && Boolean(primitive?.transformPolicy);
}

function statusItem(entry, writerStatus) {
  return {
    sourceItemId: entry.sourceItemId,
    family: entry.family,
    type: entry.type,
    writerStatus,
    reason: entry.reason,
    sourceRef: entry.sourceRef
  };
}

function isPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

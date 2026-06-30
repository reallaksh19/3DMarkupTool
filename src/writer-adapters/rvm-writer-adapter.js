const RVM_WRITER_ADAPTER_SCHEMA = 'RvmWriterAdapterPlan.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const TRANSFORM_BLOCK_WARNING = 'RVM writer artifact readiness blocked until final review transform policy is implemented.';
const STRAIGHT_PIPE_READY_WARNING = 'RVM writer dry-run ready for straight-pipe cylinder subset only';
const AXIS_EPSILON = 1e-6;

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

  const finalTransformReady = rvmExportModel?.transformApplied === true && rvmExportModel?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY;
  if (!finalTransformReady) warnings.push(TRANSFORM_BLOCK_WARNING);
  const plannedCylinderCount = plannedChunks.filter((entry) => entry.primitiveKind === 'CYLINDER').length;
  const writerReady = canPlan && plannedChunks.length > 0 && finalTransformReady;
  if (writerReady) warnings.push(STRAIGHT_PIPE_READY_WARNING);
  return {
    schema: RVM_WRITER_ADAPTER_SCHEMA,
    graphId: rvmExportModel?.graphId || options.graphId || '<unknown-graph>',
    writerKind: 'rvm',
    mode,
    writerReady,
    writerReadinessScope: writerReady ? 'straightPipeSubsetDryRunReady' : 'blocked',
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
    && isUnitVector(primitive.axis)
    && Number.isFinite(Number(primitive?.lengthMm))
    && Number.isFinite(Number(primitive?.radiusMm))
    && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY;
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

function isUnitVector(value) {
  const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2]));
  return Number.isFinite(length) && Math.abs(length - 1) <= AXIS_EPSILON;
}

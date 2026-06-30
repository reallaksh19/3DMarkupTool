const GLB_WRITER_ADAPTER_SCHEMA = 'GlbWriterAdapterPlan.v1';
const GLB_ARTIFACT_WARNING = 'GLB artifact output is not implemented in Phase 8.';

export function adaptGlbVisualModelForWriter(glbVisualModel, exportAudit, options = {}) {
  const mode = options.mode || 'dryRun';
  const canPlan = exportAudit?.schema === 'ExportModelCompilationAudit.v1' && exportAudit.ok === true;
  const plannedVisuals = [];
  const blockedVisuals = [];
  const deferredVisuals = [];
  const warnings = [GLB_ARTIFACT_WARNING];

  if (canPlan) {
    for (const visual of Array.isArray(glbVisualModel?.visualItems) ? glbVisualModel.visualItems : []) {
      if (visual.visualItemId && visual.sourceItemId) {
        plannedVisuals.push({
          visualItemId: visual.visualItemId,
          sourcePrimitiveId: visual.sourcePrimitiveId,
          sourceItemId: visual.sourceItemId,
          visualKind: visual.visualKind,
          writerStatus: 'planned',
          reason: 'writer-neutral visual summary accepted',
          sourceRef: visual.sourceRef
        });
      }
    }
    for (const blocked of Array.isArray(glbVisualModel?.blockedVisuals) ? glbVisualModel.blockedVisuals : []) {
      blockedVisuals.push(statusVisual(blocked, 'blocked'));
    }
    for (const deferred of Array.isArray(glbVisualModel?.deferredVisuals) ? glbVisualModel.deferredVisuals : []) {
      deferredVisuals.push(statusVisual(deferred, 'deferred'));
    }
  }

  return {
    schema: GLB_WRITER_ADAPTER_SCHEMA,
    graphId: glbVisualModel?.graphId || options.graphId || '<unknown-graph>',
    writerKind: 'glb',
    mode,
    writerReady: canPlan && plannedVisuals.every((entry) => entry.visualItemId && entry.sourceItemId),
    sourceSchema: 'GlbVisualModel.v1',
    plannedVisualCount: plannedVisuals.length,
    plannedVisuals,
    blockedVisuals,
    deferredVisuals,
    warnings
  };
}

function statusVisual(entry, writerStatus) {
  return {
    sourceItemId: entry.sourceItemId,
    family: entry.family,
    type: entry.type,
    writerStatus,
    reason: entry.reason,
    sourceRef: entry.sourceRef
  };
}

const GLB_VISUAL_MODEL_SCHEMA = 'GlbVisualModel.v1';

export function compileResolvedPrimitiveModelToGlbVisualModel(primitiveModel, primitiveAudit, options = {}) {
  const canCompile = primitiveAudit?.schema === 'PrimitiveCompilationAudit.v1' && primitiveAudit.ok === true;
  const graphId = primitiveModel?.graphId || options.graphId || '<unknown-graph>';
  const visualItems = [];
  const blockedVisuals = [];
  const deferredVisuals = [];

  if (canCompile) {
    for (const primitive of Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : []) {
      if (primitive.primitiveKind === 'CYLINDER' && Number(primitive.primitiveCode) === 8) {
        visualItems.push({
          visualItemId: `VIS-${primitive.primitiveId || primitive.sourceItemId}`,
          sourcePrimitiveId: primitive.primitiveId,
          sourceItemId: primitive.sourceItemId,
          visualKind: 'cylinder',
          center: Array.isArray(primitive.center) ? [...primitive.center] : [0, 0, 0],
          axis: Array.isArray(primitive.axis) ? [...primitive.axis] : [1, 0, 0],
          lengthMm: Number(primitive.lengthMm),
          radiusMm: Number(primitive.radiusMm),
          basis: 'authoring',
          visualStatus: 'visualPlanned',
          sourceRef: primitive.sourceRef
        });
      }
    }
    for (const blocked of Array.isArray(primitiveModel?.blockedPrimitives) ? primitiveModel.blockedPrimitives : []) {
      blockedVisuals.push({
        sourceItemId: blocked.sourceItemId,
        family: blocked.family,
        type: blocked.type,
        visualStatus: 'blocked',
        reason: blocked.reason,
        sourceRef: blocked.sourceRef
      });
    }
    for (const deferred of Array.isArray(primitiveModel?.deferredPrimitives) ? primitiveModel.deferredPrimitives : []) {
      deferredVisuals.push({
        sourceItemId: deferred.sourceItemId,
        family: deferred.family,
        type: deferred.type,
        visualStatus: 'deferred',
        reason: deferred.reason,
        sourceRef: deferred.sourceRef
      });
    }
  }

  return {
    schema: GLB_VISUAL_MODEL_SCHEMA,
    graphId,
    units: primitiveModel?.units || options.units || 'mm',
    sourceAxisBasis: primitiveModel?.axisBasis || { authoring: 'canvas-current' },
    visualItems,
    blockedVisuals,
    deferredVisuals,
    sourceRefs: Array.isArray(primitiveModel?.sourceRefs) ? primitiveModel.sourceRefs : []
  };
}

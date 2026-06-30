import {
  phase7TransformMetadata,
  transformAuthoringAxisToReview,
  transformAuthoringPointToReview
} from './review-transform-policy.js';

const RVM_EXPORT_MODEL_SCHEMA = 'RvmExportModel.v1';

export function compileResolvedPrimitiveModelToRvmExportModel(primitiveModel, primitiveAudit, options = {}) {
  const canCompile = primitiveAudit?.schema === 'PrimitiveCompilationAudit.v1' && primitiveAudit.ok === true;
  const transform = phase7TransformMetadata();
  const graphId = primitiveModel?.graphId || options.graphId || '<unknown-graph>';
  const primitives = [];
  const blockedExports = [];
  const deferredExports = [];

  if (canCompile) {
    for (const primitive of Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : []) {
      if (primitive.primitiveKind === 'CYLINDER' && Number(primitive.primitiveCode) === 8) {
        primitives.push({
          exportPrimitiveId: `RVM-${primitive.primitiveId || primitive.sourceItemId}`,
          sourcePrimitiveId: primitive.primitiveId,
          sourceItemId: primitive.sourceItemId,
          primitiveKind: 'CYLINDER',
          primitiveCode: 8,
          center: transformAuthoringPointToReview(primitive.center),
          axis: transformAuthoringAxisToReview(primitive.axis),
          lengthMm: Number(primitive.lengthMm),
          radiusMm: Number(primitive.radiusMm),
          basis: transform.transformApplied ? 'navis-review' : 'authoring',
          transformPolicy: transform.transformPolicy,
          sourceRef: primitive.sourceRef
        });
      }
    }
    for (const blocked of Array.isArray(primitiveModel?.blockedPrimitives) ? primitiveModel.blockedPrimitives : []) {
      blockedExports.push({
        sourceItemId: blocked.sourceItemId,
        family: blocked.family,
        type: blocked.type,
        exportStatus: 'blocked',
        reason: blocked.reason,
        sourceRef: blocked.sourceRef
      });
    }
    for (const deferred of Array.isArray(primitiveModel?.deferredPrimitives) ? primitiveModel.deferredPrimitives : []) {
      deferredExports.push({
        sourceItemId: deferred.sourceItemId,
        family: deferred.family,
        type: deferred.type,
        exportStatus: 'deferred',
        reason: deferred.reason,
        sourceRef: deferred.sourceRef
      });
    }
  }

  return {
    schema: RVM_EXPORT_MODEL_SCHEMA,
    graphId,
    units: primitiveModel?.units || options.units || 'mm',
    sourceAxisBasis: primitiveModel?.axisBasis || transform.sourceAxisBasis,
    exportAxisBasis: transform.exportAxisBasis,
    transformPolicy: transform.transformPolicy,
    transformApplied: transform.transformApplied,
    transformWarnings: [transform.warning],
    primitives,
    blockedExports,
    deferredExports,
    sourceRefs: Array.isArray(primitiveModel?.sourceRefs) ? primitiveModel.sourceRefs : []
  };
}

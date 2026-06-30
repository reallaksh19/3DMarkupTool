import { finalReviewTransformMetadata } from './review-transform-policy.js';
import { applyFinalReviewTransformToRvmPrimitive } from './review-transform-policy.js';

const RVM_EXPORT_MODEL_SCHEMA = 'RvmExportModel.v1';
const TORUS_DEFER_REASON = 'TORUS/code4 RVM byte writer bridge not implemented in Phase 11A';

export function compileResolvedPrimitiveModelToRvmExportModel(primitiveModel, primitiveAudit, options = {}) {
  const canCompile = primitiveAudit?.schema === 'PrimitiveCompilationAudit.v1' && primitiveAudit.ok === true;
  const transform = finalReviewTransformMetadata();
  const graphId = primitiveModel?.graphId || options.graphId || '<unknown-graph>';
  const primitives = [];
  const blockedExports = [];
  const deferredExports = [];

  if (canCompile) {
    for (const primitive of Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : []) {
      if (primitive.primitiveKind === 'CYLINDER' && Number(primitive.primitiveCode) === 8) {
        const transformed = applyFinalReviewTransformToRvmPrimitive(primitive);
        primitives.push(copyDefined({ exportPrimitiveId: `RVM-${primitive.primitiveId || primitive.sourceItemId}`, sourcePrimitiveId: primitive.primitiveId, sourceItemId: primitive.sourceItemId, primitiveKind: 'CYLINDER', primitiveCode: 8, center: transformed.center, axis: transformed.axis, lengthMm: transformed.lengthMm, radiusMm: transformed.radiusMm, diameterMm: transformed.diameterMm, wallMm: transformed.wallMm, basis: 'navis-review', transformPolicy: transform.transformPolicy, sourceRef: primitive.sourceRef }));
        continue;
      }
      if (primitive.primitiveKind === 'TORUS' && Number(primitive.primitiveCode) === 4) {
        deferredExports.push(copyDefined({ sourcePrimitiveId: primitive.primitiveId, sourceItemId: primitive.sourceItemId, family: 'elbow', type: primitive.type || 'bend', primitiveKind: 'TORUS', primitiveCode: 4, exportStatus: 'deferred', writerReady: false, reason: TORUS_DEFER_REASON, resolver: primitive.resolver, catalogueItemId: primitive.catalogueItemId, catalogueRef: primitive.catalogueRef, sourceRef: primitive.sourceRef }));
      }
    }
    for (const blocked of Array.isArray(primitiveModel?.blockedPrimitives) ? primitiveModel.blockedPrimitives : []) {
      blockedExports.push({ sourceItemId: blocked.sourceItemId, family: blocked.family, type: blocked.type, exportStatus: 'blocked', reason: blocked.reason, sourceRef: blocked.sourceRef });
    }
    for (const deferred of Array.isArray(primitiveModel?.deferredPrimitives) ? primitiveModel.deferredPrimitives : []) {
      deferredExports.push({ sourceItemId: deferred.sourceItemId, family: deferred.family, type: deferred.type, exportStatus: 'deferred', reason: deferred.reason, sourceRef: deferred.sourceRef });
    }
  }

  return { schema: RVM_EXPORT_MODEL_SCHEMA, graphId, units: primitiveModel?.units || options.units || 'mm', sourceAxisBasis: primitiveModel?.axisBasis || transform.sourceAxisBasis, exportAxisBasis: transform.exportAxisBasis, transformPolicy: transform.transformPolicy, transformApplied: transform.transformApplied, transformWarnings: transform.transformWarnings, primitives, blockedExports, deferredExports, sourceRefs: Array.isArray(primitiveModel?.sourceRefs) ? primitiveModel.sourceRefs : [] };
}

function copyDefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

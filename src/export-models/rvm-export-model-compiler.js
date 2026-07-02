import { finalReviewTransformMetadata, applyFinalReviewTransformToRvmPrimitive, transformAuthoringPointToReview, transformAuthoringVectorToReview } from './review-transform-policy.js';

const RVM_EXPORT_MODEL_SCHEMA = 'RvmExportModel.v1';
const TORUS_TEST_REASON = 'TORUS/code4 is eligible for Phase 11B test-only byte proof; production writer remains disabled';
const FLANGE_TEST_REASON = 'FLANGE_CYLINDER/code8 is eligible for Phase 11C-B test-only byte proof; production writer remains disabled';

export function compileResolvedPrimitiveModelToRvmExportModel(primitiveModel, primitiveAudit, options = {}) {
  const canCompile = primitiveAudit?.schema === 'PrimitiveCompilationAudit.v1' && primitiveAudit.ok === true;
  const transform = finalReviewTransformMetadata();
  const graphId = primitiveModel?.graphId || options.graphId || '<unknown-graph>';
  const primitives = [];
  const testByteEligiblePrimitives = [];
  const flangeTestByteEligiblePrimitives = [];
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
        const transformed = transformTorus(primitive, transform.transformPolicy);
        testByteEligiblePrimitives.push(transformed);
        deferredExports.push(copyDefined({ sourcePrimitiveId: primitive.primitiveId, sourceItemId: primitive.sourceItemId, family: 'elbow', type: primitive.type || 'bend', primitiveKind: 'TORUS', primitiveCode: 4, exportStatus: 'deferred', writerReady: false, testByteEligible: true, byteBridge: 'test-only', reason: TORUS_TEST_REASON, resolver: primitive.resolver, catalogueItemId: primitive.catalogueItemId, catalogueRef: primitive.catalogueRef, sourceRef: primitive.sourceRef }));
        continue;
      }
      if (primitive.primitiveKind === 'FLANGE_CYLINDER' && Number(primitive.primitiveCode) === 8) {
        const transformed = transformFlange(primitive, transform.transformPolicy);
        flangeTestByteEligiblePrimitives.push(transformed);
        deferredExports.push(copyDefined({ sourcePrimitiveId: primitive.primitiveId, sourceItemId: primitive.sourceItemId, family: 'flange', type: primitive.type || 'flange', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, exportStatus: 'deferred', writerReady: false, testByteEligible: true, byteBridge: 'test-only-phase-11c-b', reason: FLANGE_TEST_REASON, resolver: primitive.resolver, catalogueItemId: primitive.catalogueItemId, catalogueRef: primitive.catalogueRef, sourceRef: primitive.sourceRef }));
      }
    }
    for (const blocked of Array.isArray(primitiveModel?.blockedPrimitives) ? primitiveModel.blockedPrimitives : []) blockedExports.push({ sourceItemId: blocked.sourceItemId, family: blocked.family, type: blocked.type, exportStatus: 'blocked', reason: blocked.reason, sourceRef: blocked.sourceRef });
    for (const deferred of Array.isArray(primitiveModel?.deferredPrimitives) ? primitiveModel.deferredPrimitives : []) deferredExports.push({ sourceItemId: deferred.sourceItemId, family: deferred.family, type: deferred.type, exportStatus: 'deferred', reason: deferred.reason, sourceRef: deferred.sourceRef });
  }
  return { schema: RVM_EXPORT_MODEL_SCHEMA, graphId, units: primitiveModel?.units || options.units || 'mm', sourceAxisBasis: primitiveModel?.axisBasis || transform.sourceAxisBasis, exportAxisBasis: transform.exportAxisBasis, transformPolicy: transform.transformPolicy, transformApplied: transform.transformApplied, transformWarnings: transform.transformWarnings, primitives, testByteEligiblePrimitives, flangeTestByteEligiblePrimitives, blockedExports, deferredExports, sourceRefs: Array.isArray(primitiveModel?.sourceRefs) ? primitiveModel.sourceRefs : [] };
}
function transformTorus(primitive, transformPolicy) { return copyDefined({ exportPrimitiveId: `RVM-${primitive.primitiveId || primitive.sourceItemId}`, sourcePrimitiveId: primitive.primitiveId, sourceItemId: primitive.sourceItemId, primitiveKind: 'TORUS', primitiveCode: 4, center: transformAuthoringPointToReview(primitive.center, { fieldName: 'torus.center' }), normal: transformAuthoringVectorToReview(primitive.normal, { fieldName: 'torus.normal' }), startTangent: transformAuthoringVectorToReview(primitive.startTangent, { fieldName: 'torus.startTangent' }), endTangent: transformAuthoringVectorToReview(primitive.endTangent, { fieldName: 'torus.endTangent' }), majorRadiusMm: scalar(primitive.majorRadiusMm), tubeRadiusMm: scalar(primitive.tubeRadiusMm), bendAngleDeg: scalar(primitive.bendAngleDeg), sweepAngleDeg: scalar(primitive.sweepAngleDeg), basis: 'navis-review', transformPolicy, transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: primitive.resolver, catalogueItemId: primitive.catalogueItemId, catalogueRef: primitive.catalogueRef, sourceRef: primitive.sourceRef, evidence: primitive.evidence }); }
function transformFlange(primitive, transformPolicy) { return copyDefined({ exportPrimitiveId: `RVM-${primitive.primitiveId || primitive.sourceItemId}`, sourcePrimitiveId: primitive.primitiveId, sourceItemId: primitive.sourceItemId, family: 'flange', type: primitive.type || 'flange', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, center: transformAuthoringPointToReview(primitive.center, { fieldName: 'flange.center' }), axis: transformAuthoringVectorToReview(primitive.axis, { fieldName: 'flange.axis' }), lengthMm: scalar(primitive.lengthMm), boreRadiusMm: scalar(primitive.boreRadiusMm), outerRadiusMm: scalar(primitive.outerRadiusMm), basis: 'navis-review', transformPolicy, transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only-phase-11c-b', resolver: primitive.resolver, geometryStatus: primitive.geometryStatus, flangeType: primitive.flangeType, facing: primitive.facing, rating: primitive.rating, connectionType: primitive.connectionType, catalogueItemId: primitive.catalogueItemId, catalogueRef: primitive.catalogueRef, sourceRef: primitive.sourceRef, evidence: primitive.evidence }); }
function scalar(value) { const number = Number(value); if (!Number.isFinite(number)) throw new Error('Invalid RVM export scalar during transform'); return number; }
function copyDefined(value) { return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)); }

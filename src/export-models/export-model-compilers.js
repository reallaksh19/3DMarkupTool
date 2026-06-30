import { collectExportModelForbiddenFieldHits, validateAttExportModelContract, validateGlbVisualModelContract, validateRvmExportModelContract } from '../contracts/index.js';
import { compileResolvedPrimitiveModelToAttExportModel } from './att-export-model-compiler.js';
import { compileResolvedPrimitiveModelToGlbVisualModel } from './glb-visual-model-compiler.js';
import { compileResolvedPrimitiveModelToRvmExportModel } from './rvm-export-model-compiler.js';

const EXPORT_AUDIT_SCHEMA = 'ExportModelCompilationAudit.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const AXIS_EPSILON = 1e-6;

export function compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit, options = {}) {
  return {
    rvmExportModel: compileResolvedPrimitiveModelToRvmExportModel(primitiveModel, primitiveAudit, options),
    attExportModel: compileResolvedPrimitiveModelToAttExportModel(primitiveModel, primitiveAudit, options),
    glbVisualModel: compileResolvedPrimitiveModelToGlbVisualModel(primitiveModel, primitiveAudit, options)
  };
}

export function buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit, options = {}) {
  const rvm = exportModels?.rvmExportModel;
  const att = exportModels?.attExportModel;
  const glb = exportModels?.glbVisualModel;
  const rvmValidation = validateRvmExportModelContract(rvm);
  const attValidation = validateAttExportModelContract(att);
  const glbValidation = validateGlbVisualModelContract(glb);
  const allExportModels = { rvm, att, glb };
  const forbiddenHits = collectExportModelForbiddenFieldHits(allExportModels);
  const errors = [
    ...rvmValidation.errors,
    ...attValidation.errors,
    ...glbValidation.errors
  ];
  const warnings = [];
  if (!primitiveAudit || primitiveAudit.schema !== 'PrimitiveCompilationAudit.v1') errors.push('PrimitiveCompilationAudit.v1 is required');
  if (primitiveAudit?.ok !== true) errors.push('PrimitiveCompilationAudit.ok must be true before export model compilation');
  if (Array.isArray(rvm?.transformWarnings)) warnings.push(...rvm.transformWarnings);
  if (!rvm?.transformPolicy) errors.push('RVM transform policy is required');
  if (rvm?.transformApplied === true && rvm?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('RVM transformApplied true requires final-review-transform.v1');
  if (rvm?.transformApplied !== true && rvm?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY) errors.push('final-review-transform.v1 requires transformApplied true');

  const rvmPrimitives = Array.isArray(rvm?.primitives) ? rvm.primitives : [];
  const primitiveById = new Map((Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : [])
    .map((entry) => [entry.primitiveId, entry]));
  for (const [index, primitive] of rvmPrimitives.entries()) {
    if (!isPoint3(primitive.center)) errors.push(`RVM primitive ${index} transformed center is missing or non-finite`);
    if (!isPoint3(primitive.axis)) errors.push(`RVM primitive ${index} transformed axis is missing or non-finite`);
    if (isPoint3(primitive.axis) && !isUnitVector(primitive.axis)) errors.push(`RVM primitive ${index} transformed axis is not normalized`);
    const source = primitiveById.get(primitive.sourcePrimitiveId);
    if (source) {
      if (Number(primitive.lengthMm) !== Number(source.lengthMm)) errors.push(`RVM primitive ${index} lengthMm changed during transform`);
      if (Number(primitive.radiusMm) !== Number(source.radiusMm)) errors.push(`RVM primitive ${index} radiusMm changed during transform`);
      if (source.diameterMm !== undefined && Number(primitive.diameterMm) !== Number(source.diameterMm)) errors.push(`RVM primitive ${index} diameterMm changed during transform`);
      if (source.wallMm !== undefined && Number(primitive.wallMm) !== Number(source.wallMm)) errors.push(`RVM primitive ${index} wallMm changed during transform`);
    }
  }

  const audit = {
    schema: EXPORT_AUDIT_SCHEMA,
    graphId: primitiveModel?.graphId || options.graphId || '<unknown-graph>',
    transformPolicy: rvm?.transformPolicy || '<missing-transform-policy>',
    rvmTransformWarningCount: Array.isArray(rvm?.transformWarnings) ? rvm.transformWarnings.length : 0,
    rvmPrimitivePlanCount: rvmPrimitives.length,
    rvmCylinderPlanCount: rvmPrimitives.filter((entry) => entry.primitiveKind === 'CYLINDER').length,
    rvmTorusPlanCount: rvmPrimitives.filter((entry) => entry.primitiveKind === 'TORUS').length,
    rvmBoxPlanCount: rvmPrimitives.filter((entry) => entry.primitiveKind === 'BOX').length,
    rvmSpherePlanCount: rvmPrimitives.filter((entry) => entry.primitiveKind === 'SPHERE').length,
    rvmPyramidPlanCount: rvmPrimitives.filter((entry) => entry.primitiveKind === 'PYRAMID').length,
    attRecordPlanCount: Array.isArray(att?.records) ? att.records.length : 0,
    glbVisualPlanCount: Array.isArray(glb?.visualItems) ? glb.visualItems.length : 0,
    blockedExportCount: Array.isArray(rvm?.blockedExports) ? rvm.blockedExports.length : 0,
    deferredExportCount: Array.isArray(rvm?.deferredExports) ? rvm.deferredExports.length : 0,
    blockedAttRecordCount: Array.isArray(att?.blockedRecords) ? att.blockedRecords.length : 0,
    deferredAttRecordCount: Array.isArray(att?.deferredRecords) ? att.deferredRecords.length : 0,
    blockedVisualCount: Array.isArray(glb?.blockedVisuals) ? glb.blockedVisuals.length : 0,
    deferredVisualCount: Array.isArray(glb?.deferredVisuals) ? glb.deferredVisuals.length : 0,
    blockedUnresolvedExportCount: Array.isArray(rvm?.blockedExports) ? rvm.blockedExports.length : 0,
    deferredSupportExportCount: Array.isArray(rvm?.deferredExports) ? rvm.deferredExports.filter((entry) => entry.family === 'support').length : 0,
    writerCallCount: 0,
    binaryPayloadCount: forbiddenHits.filter((hit) => ['binary', 'bytes', 'buffer', 'arrayBuffer', 'chunk', 'cntb', 'primBody', 'fileBlob', 'writerPayload'].includes(hit.field)).length,
    textPayloadCount: forbiddenHits.filter((hit) => hit.field === 'attText').length,
    glbPayloadCount: forbiddenHits.filter((hit) => hit.field === 'glbBytes' || hit.field === 'gltfJson').length,
    navisTransformApplied: rvm?.transformApplied === true,
    hardErrorCount: errors.length,
    ok: false,
    errors,
    warnings
  };
  audit.ok = rvmValidation.ok
    && attValidation.ok
    && glbValidation.ok
    && primitiveAudit?.ok === true
    && audit.hardErrorCount === 0
    && audit.writerCallCount === 0
    && audit.binaryPayloadCount === 0
    && audit.textPayloadCount === 0
    && audit.glbPayloadCount === 0;
  return audit;
}

export {
  compileResolvedPrimitiveModelToRvmExportModel,
  compileResolvedPrimitiveModelToAttExportModel,
  compileResolvedPrimitiveModelToGlbVisualModel
};

function isPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

function isUnitVector(value) {
  const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2]));
  return Number.isFinite(length) && Math.abs(length - 1) <= AXIS_EPSILON;
}

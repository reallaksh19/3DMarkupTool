import { writeAtt } from './att-writer.js?v=bust-cache-4';
import { assertRvmChunkHierarchy } from './rvm-chunk-hierarchy-validator.js?v=bust-cache-4';
import { buildRvmAxisBasis, normalizeRvmAxisBasis } from './rvm-axis-basis-policy.js?v=bust-cache-4';
import { assertRvmMaterialLayerContract } from './rvm-material-layer-contract.js?v=bust-cache-4';
import { assertRvmMaterialTableContract } from './rvm-material-table-contract.js?v=bust-cache-4';
import { scanRvmPrimitivePayloads } from './rvm-primitive-payload-decoder.js?v=bust-cache-4';
import { auditManagedStageRvmPayloadSemantics } from './managed-stage-rvm-payload-semantics-audit.js?v=bust-cache-4';
import { auditManagedStageRvmGeometry } from './managed-stage-rvm-geometry-audit.js?v=bust-cache-4';
import { writeRvm } from './rvm-writer.js?v=bust-cache-4';
import { evaluateRvmCode4ElbowEmissionCandidate } from './rvm-code4-elbow-emission-candidate-policy.js?v=bust-cache-4';
import { assertManagedStageRvmAuditGate } from './managed-stage-rvm-audit-gate.js?v=bust-cache-4';
import { assertManagedStageTopologyProofGate } from './managed-stage-topology-audit-gate.js?v=bust-cache-4';
import { buildManagedStageRvmExportModel } from './managed-stage-rvm-export-model.js?v=bust-cache-4';
import { parseManagedStageProfile } from './managed-stage-profile-parser.js?v=bust-cache-4';
import { parseStagedJsonSourceContract } from './stagedjson-source-contract.js?v=bust-cache-4';
import { auditManagedStageTopology } from './managed-stage-topology-audit.js?v=bust-cache-4';
import {
  assertManagedStageRvmStitchManifest,
  buildManagedStageRvmStitchManifest
} from './managed-stage-rvm-stitch-manifest.js?v=bust-cache-4';

export const MANAGED_STAGE_CODE4_RVM_OPTIONS = Object.freeze({
  experimentalRvmPrimitiveCodes: ['code4-elbow'],
  allowExperimentalCode4ElbowEmission: true,
  allowManagedStageCode4Elbows: true,
  excludeBendsWhileProcessingInputXmlBasedJson: false
});

export function convertManagedStageJsonToRvmAtt(sourceText, options = {}) {
  const profile = parseManagedStageProfile(sourceText);
  const sourceContract = parseStagedJsonSourceContract(sourceText, {
    filename: options.filename || options.sourceName || profile.source || '',
    isonoteText: options.isonoteText || '',
    supportMapperConfig: options.supportMapperConfig || {}
  });
  const topology = auditManagedStageTopology(profile.geometryRecords);
  const writerOptions = {
    ...MANAGED_STAGE_CODE4_RVM_OPTIONS,
    warningOnlyManagedStageGates: true,
    nonBlockingGeometryGates: true,
    sourceContract,
    ...options
  };
  const exportModel = buildManagedStageRvmExportModel(profile, writerOptions);
  const rvm = writeRvm(exportModel, writerOptions);
  const att = writeAtt(exportModel);
  const primitivePayloads = scanRvmPrimitivePayloads(rvm);
  const primitivePayloadContract = assertManagedStagePrimitivePayloadCompatibility(primitivePayloads, writerOptions);
  const primitivePayloadSemanticsAudit = auditManagedStageRvmPayloadSemantics(primitivePayloads);
  const materialLayerContract = assertRvmMaterialLayerContract(exportModel);
  const materialTableContract = assertRvmMaterialTableContract(rvm, materialLayerContract);
  const boundingExtentsMm = computeExportModelBoundingExtents(exportModel);
  const chunkHierarchy = assertRvmChunkHierarchy(rvm, att, exportModel);
  const stitchManifest = buildManagedStageRvmStitchManifest(profile, exportModel, primitivePayloads);
  const rvmGeometryAudit = auditManagedStageRvmGeometry(stitchManifest, primitivePayloadSemanticsAudit);
  const stitchManifestGate = warningOnlyGate('ManagedStageRvmStitchManifest', () => assertManagedStageRvmStitchManifest(stitchManifest), writerOptions);
  const supportRvmExportAudit = exportModel.audit?.supportRvmExportAudit || null;
  const supportTopologyAudit = exportModel.audit?.supportTopologyAudit || null;
  const componentPrimitiveSymbolExportAudit = exportModel.audit?.componentPrimitiveSymbolExportAudit || null;
  const audit = {
    schema: 'ManagedStageRvmConverterAudit.v1',
    source: profile.source,
    profile: profile.profile,
    units: profile.units,
    generationMode: 'managed-stage-cylinder-torus',
    inputCounts: {
      geometryComponents: profile.geometryRecords.length,
      geometryContractsEmitted: exportModel.audit?.componentCount || profile.geometryRecords.length,
      geometryContractsSkipped: exportModel.audit?.skippedGeometryContractCount || 0,
      supportRecordsSkippedFromGeometry: profile.supportRecords.length,
      supportRecordsEmittedToRvm: supportRvmExportAudit?.supportRecordCount || 0,
      stats: profile.inputStats,
      statsRestraintsMismatch: Number(profile.inputStats?.validRestraints ?? profile.inputStats?.restraints ?? 0) !== profile.supportRecords.length
    },
    topology,
    supportTopologyAudit,
    processingConfig: exportModel.audit?.processingConfig || null,
    geometryContractAudit: exportModel.audit?.geometryContractAudit || null,
    elbowTangentHintAudit: exportModel.audit?.elbowTangentHintAudit || null,
    inputXmlBendExclusionAudit: exportModel.audit?.inputXmlBendExclusionAudit || null,
    inputXmlNodeLocalElbowAudit: exportModel.audit?.inputXmlNodeLocalElbowAudit || null,
    inputXmlBendEndpointLockAudit: exportModel.audit?.inputXmlBendEndpointLockAudit || null,
    inputXmlBranchFittingInferenceAudit: exportModel.audit?.inputXmlBranchFittingInferenceAudit || null,
    supportRvmExportAudit,
    componentPrimitiveSymbolExportAudit,
    primitiveHistogram: primitivePayloadContract.codeCounts,
    primitiveBodyLengths: primitivePayloads.map((primitive) => ({ code: primitive.code, bodyLength: primitive.bodyLength })),
    rvmPrimitivePayloadSemanticsAudit: primitivePayloadSemanticsAudit,
    rvmGeometryAudit,
    torusOrientationAssumptions: collectTorusAssumptions(exportModel.root),
    genericInputXmlBendAssumptions: collectGenericInputXmlBendAssumptions(exportModel.root),
    genericInputXmlNodeLocalElbowAssumptions: collectGenericInputXmlNodeLocalElbowAssumptions(exportModel.root),
    genericInputXmlBranchFittingAssumptions: collectGenericInputXmlBranchFittingAssumptions(exportModel.root),
    exportedSupportRecords: profile.supportRecords.map((record) => ({ name: record.name, type: record.type, supportKind: record.attributes?.SUPPORT_KIND || record.attributes?.SUPPORT_TYPE || '', geometryEmitted: true, rvmExported: true })),
    skippedSupportRecords: [],
    materialLayerContract,
    materialTableContract,
    boundingExtentsMm,
    chunkHierarchy,
    stitchManifest,
    stitchManifestGate,
    rvmPrimitivePayloadContract: primitivePayloadContract,
    rvmBytes: rvm.byteLength,
    attBytes: new TextEncoder().encode(att).byteLength,
    cntbCoordinatePolicy: 'CNTB x/y/z fields are RMSS coordinate fields, not bbox fields'
  };
  audit.managedStageTopologyProofGate = warningOnlyGate('ManagedStageTopologyProofGate', () => assertManagedStageTopologyProofGate(audit, options.strictAuditExpectations || {}), writerOptions);
  audit.managedStageStrictGate = warningOnlyGate('ManagedStageRvmAuditGate', () => assertManagedStageRvmAuditGate(audit, options.strictAuditExpectations || {}), writerOptions);
  return { profile, sourceContract, exportModel, rvm, att, audit };
}

export function assertManagedStagePrimitivePayloadCompatibility(primitives = [], options = MANAGED_STAGE_CODE4_RVM_OPTIONS) {
  const codeCounts = {};
  const statusCounts = {};
  const rejected = [];
  for (const primitive of primitives) {
    const code = Number(primitive.code);
    codeCounts[code] = (codeCounts[code] || 0) + 1;
    statusCounts[primitive.compatibilityStatus || 'unknown'] = (statusCounts[primitive.compatibilityStatus || 'unknown'] || 0) + 1;
    if ([7, 8, 9].includes(code) && primitive.supportedForEmission === true) continue;
    if (code === 1 && primitive.emittedKind === 'pyramid' && primitive.lengthMatchesKnownLayout) continue;
    if (code === 4 && evaluateRvmCode4ElbowEmissionCandidate(primitive, options).experimentalEmissionCandidateAllowed) continue;
    rejected.push(primitive);
  }
  if (rejected.length && options.warningOnlyManagedStageGates !== true) throw new Error(`Managed-stage RVM rejected primitive code(s): ${rejected.map((p) => p.code).join(', ')}`);
  return {
    schema: 'ManagedStageRvmPrimitivePayloadContract.v3',
    primitiveCount: primitives.length,
    allowedPrimitiveCodes: [1, 4, 7, 8, 9],
    forbiddenPrimitiveCodesPresent: [2, 5, 6, 11].filter((code) => codeCounts[code]),
    unsupportedPrimitivePayloadsPresent: rejected.length > 0,
    warningOnlyUnsupportedPrimitivePayloads: rejected.map((primitive) => ({ code: primitive.code, bodyLength: primitive.bodyLength })),
    codeCounts,
    statusCounts
  };
}

function collectTorusAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => { for (const primitive of node.primitives || []) if (primitive.kind === 'elbow') assumptions.push({ element: node.reviewName || node.name, primitive: primitive.name, primitiveCode: 4, bendRadiusMm: primitive.bendRadius, tubeRadiusMm: primitive.tubeRadius, sweepAngleRad: primitive.sweepAngleRad, orientationAssumption: primitive.orientationAssumption, tangentHintState: primitive.tangentHintState || '', tangentHintSources: primitive.tangentHintSources || null }); });
  return assumptions;
}

function collectGenericInputXmlBendAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => { for (const primitive of node.primitives || []) if (primitive.genericInputXmlBend) assumptions.push({ element: node.reviewName || node.name, primitive: primitive.name, primitiveCode: 8, segmentRole: primitive.genericInputXmlBendSegmentRole || '', genericBendRadiusMm: primitive.genericBendRadiusMm, genericBendTrimLengthMm: primitive.genericBendTrimLengthMm, originalBendRadiusMm: primitive.originalBendRadiusMm, startMm: primitive.startMm, endMm: primitive.endMm, sourceRouteTrimmedForNodeLocalElbow: primitive.sourceRouteTrimmedForNodeLocalElbow || false, orientationAssumption: primitive.orientationAssumption }); });
  return assumptions;
}

function collectGenericInputXmlNodeLocalElbowAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => { for (const primitive of node.primitives || []) if (primitive.genericInputXmlNodeLocalElbow) assumptions.push({ element: node.reviewName || node.name, primitive: primitive.name, primitiveCode: 8, node: primitive.nodeLocalElbowNode, segmentIndex: primitive.nodeLocalElbowSegmentIndex, segmentCount: primitive.nodeLocalElbowSegmentCount, parentSourceContractNames: primitive.nodeLocalElbowParentSourceContractNames, startMm: primitive.startMm, endMm: primitive.endMm, orientationAssumption: primitive.orientationAssumption }); });
  return assumptions;
}

function collectGenericInputXmlBranchFittingAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => { for (const primitive of node.primitives || []) if (primitive.genericInputXmlBranchFitting) assumptions.push({ element: node.reviewName || node.name, primitive: primitive.name, primitiveCode: 8, branchFittingClass: primitive.branchFittingClass, branchFittingNode: primitive.branchFittingNode, hostContractName: primitive.branchFittingHostContractName, startMm: primitive.startMm, endMm: primitive.endMm, orientationAssumption: primitive.orientationAssumption }); });
  return assumptions;
}

function warningOnlyGate(schema, callback, options = {}) {
  try { return callback(); } catch (error) {
    if (options.warningOnlyManagedStageGates !== true) throw error;
    return { schema: `${schema}.warning-only`, ok: false, failClosed: false, warningOnly: true, nonBlockingAuditIssues: [error.message], nonBlockingAuditWarningCount: 1 };
  }
}

function visit(node, callback) { callback(node); for (const child of node.children || []) visit(child, callback); }

function computeExportModelBoundingExtents(exportModel) {
  const boxes = [];
  visit(exportModel.root, (node) => { for (const primitive of node.primitives || []) boxes.push(primitiveWorldBbox(primitive)); });
  const bbox = unionBboxes(boxes);
  return { schema: 'ManagedStageRvmBoundingExtents.v1', primitiveCount: boxes.length, bboxMm: bbox ? bbox.map((value) => Number(value.toFixed(6))) : null, cntbBboxFieldsWritten: false, bboxSource: 'writer-ready primitive local bbox and transform basis' };
}

function primitiveWorldBbox(primitive) {
  const bbox = primitive.localBbox || [0, 0, 0, 0, 0, 0];
  const basis = normalizeRvmAxisBasis(primitive.basis || buildRvmAxisBasis(primitive.direction || [0, 0, 1]));
  const center = primitive.center || [0, 0, 0];
  const corners = [];
  for (const x of [bbox[0], bbox[3]]) for (const y of [bbox[1], bbox[4]]) for (const z of [bbox[2], bbox[5]]) corners.push(transformLocalPoint(center, basis, [x, y, z]));
  return unionBboxes(corners.map((corner) => [corner[0], corner[1], corner[2], corner[0], corner[1], corner[2]]));
}

function transformLocalPoint(center, basis, local) { return [0, 1, 2].map((axis) => center[axis] + basis.x[axis] * local[0] + basis.y[axis] * local[1] + basis.z[axis] * local[2]); }
function unionBboxes(boxes) { if (!boxes.length) return null; const out = [...boxes[0]]; for (const box of boxes.slice(1)) { out[0] = Math.min(out[0], box[0]); out[1] = Math.min(out[1], box[1]); out[2] = Math.min(out[2], box[2]); out[3] = Math.max(out[3], box[3]); out[4] = Math.max(out[4], box[4]); out[5] = Math.max(out[5], box[5]); } return out; }
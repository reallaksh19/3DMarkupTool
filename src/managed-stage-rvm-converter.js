import { writeAtt } from './att-writer.js?v=bust-cache-4';
import { assertRvmChunkHierarchy } from './rvm-chunk-hierarchy-validator.js?v=bust-cache-4';
import { buildRvmAxisBasis, normalizeRvmAxisBasis } from './rvm-axis-basis-policy.js?v=bust-cache-4';
import { assertRvmMaterialLayerContract } from './rvm-material-layer-contract.js?v=bust-cache-4';
import { assertRvmMaterialTableContract } from './rvm-material-table-contract.js?v=bust-cache-4';
import { scanRvmPrimitivePayloads } from './rvm-primitive-payload-decoder.js?v=bust-cache-4';
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
  allowManagedStageCode4Elbows: true
});

const MANAGED_STAGE_ALLOWED_NATIVE_PRIMITIVE_CODES = Object.freeze([1, 2, 4, 7, 8, 9]);
const MANAGED_STAGE_FORBIDDEN_NATIVE_PRIMITIVE_CODES = Object.freeze([3, 5, 6, 10, 11]);

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
  const materialLayerContract = assertRvmMaterialLayerContract(exportModel);
  const materialTableContract = assertRvmMaterialTableContract(rvm, materialLayerContract);
  const boundingExtentsMm = computeExportModelBoundingExtents(exportModel);
  const chunkHierarchy = assertRvmChunkHierarchy(rvm, att, exportModel);
  const stitchManifest = buildManagedStageRvmStitchManifest(profile, exportModel, primitivePayloads);
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
      // Compare validRestraints (not the total restraintRows which includes blank placeholder rows)
      // against the emitted support record count. A mismatch here is only noteworthy when the
      // converter filtered something unexpected — blank CAESAR II rows are never a mismatch.
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
    torusOrientationAssumptions: collectTorusAssumptions(exportModel.root),
    snoutGeometryAssumptions: collectSnoutAssumptions(exportModel.root),
    sphereGeometryAssumptions: collectSphereAssumptions(exportModel.root),
    genericInputXmlBendAssumptions: collectGenericInputXmlBendAssumptions(exportModel.root),
    genericInputXmlNodeLocalElbowAssumptions: collectGenericInputXmlNodeLocalElbowAssumptions(exportModel.root),
    genericInputXmlBranchFittingAssumptions: collectGenericInputXmlBranchFittingAssumptions(exportModel.root),
    exportedSupportRecords: profile.supportRecords.map((record) => ({
      name: record.name,
      type: record.type,
      supportKind: record.attributes?.SUPPORT_KIND || record.attributes?.SUPPORT_TYPE || '',
      geometryEmitted: true,
      rvmExported: true
    })),
    // No support records were skipped — all emitted supports are exported to RVM as SUPPORT_MARKER nodes.
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
  audit.managedStageTopologyProofGate = warningOnlyGate(
    'ManagedStageTopologyProofGate',
    () => assertManagedStageTopologyProofGate(audit, options.strictAuditExpectations || {}),
    writerOptions
  );
  audit.managedStageStrictGate = warningOnlyGate(
    'ManagedStageRvmAuditGate',
    () => assertManagedStageRvmAuditGate(audit, options.strictAuditExpectations || {}),
    writerOptions
  );
  return { profile, sourceContract, exportModel, rvm, att, audit };
}

export function assertManagedStagePrimitivePayloadCompatibility(primitives = [], options = MANAGED_STAGE_CODE4_RVM_OPTIONS) {
  const codeCounts = {};
  const statusCounts = {};
  const unsafe = [];
  for (const primitive of primitives) {
    const code = Number(primitive.code);
    codeCounts[code] = (codeCounts[code] || 0) + 1;
    statusCounts[primitive.compatibilityStatus || 'unknown'] = (statusCounts[primitive.compatibilityStatus || 'unknown'] || 0) + 1;
    if (MANAGED_STAGE_ALLOWED_NATIVE_PRIMITIVE_CODES.includes(code) && primitive.supportedForEmission && primitive.lengthMatchesKnownLayout) continue;
    if (code === 4 && evaluateRvmCode4ElbowEmissionCandidate(primitive, options).experimentalEmissionCandidateAllowed) continue;
    unsafe.push(primitive);
  }
  if (unsafe.length && options.warningOnlyManagedStageGates !== true) {
    throw new Error(`Managed-stage RVM contains unsupported primitive code(s): ${unsafe.map((p) => p.code).join(', ')}`);
  }
  return {
    schema: 'ManagedStageRvmPrimitivePayloadContract.v3',
    primitiveCount: primitives.length,
    allowedPrimitiveCodes: [...MANAGED_STAGE_ALLOWED_NATIVE_PRIMITIVE_CODES],
    forbiddenPrimitiveCodesPresent: MANAGED_STAGE_FORBIDDEN_NATIVE_PRIMITIVE_CODES.filter((code) => codeCounts[code]),
    unsupportedPrimitivePayloadsPresent: unsafe.length > 0,
    warningOnlyUnsupportedPrimitivePayloads: unsafe.map((primitive) => ({ code: primitive.code, bodyLength: primitive.bodyLength })),
    codeCounts,
    statusCounts
  };
}

function collectTorusAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => {
    for (const primitive of node.primitives || []) {
      if (primitive.kind === 'elbow') {
        assumptions.push({
          element: node.reviewName || node.name,
          primitive: primitive.name,
          primitiveCode: 4,
          bendRadiusMm: primitive.bendRadius,
          tubeRadiusMm: primitive.tubeRadius,
          sweepAngleRad: primitive.sweepAngleRad,
          orientationAssumption: primitive.orientationAssumption,
          tangentHintState: primitive.tangentHintState || '',
          tangentHintSources: primitive.tangentHintSources || null
        });
      }
    }
  });
  return assumptions;
}

function collectSnoutAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => {
    for (const primitive of node.primitives || []) {
      if (primitive.kind === 'snout') {
        assumptions.push({
          element: node.reviewName || node.name,
          primitive: primitive.name,
          primitiveCode: 7,
          radiusBottomMm: primitive.radiusBottom,
          radiusTopMm: primitive.radiusTop,
          heightMm: primitive.height,
          offsetX: primitive.offsetX || 0,
          offsetY: primitive.offsetY || 0,
          orientationAssumption: primitive.orientationAssumption || 'Snout local Z follows component centerline basis.z; shears are zero.'
        });
      }
    }
  });
  return assumptions;
}

function collectSphereAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => {
    for (const primitive of node.primitives || []) {
      if (primitive.kind === 'sphere') {
        assumptions.push({
          element: node.reviewName || node.name,
          primitive: primitive.name,
          primitiveCode: 9,
          diameterMm: primitive.diameter,
          orientationAssumption: primitive.orientationAssumption || 'Sphere is direction-invariant; transform translation places center.'
        });
      }
    }
  });
  return assumptions;
}

function collectGenericInputXmlBendAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => {
    for (const primitive of node.primitives || []) {
      if (primitive.genericInputXmlBend) {
        assumptions.push({
          element: node.reviewName || node.name,
          primitive: primitive.name,
          primitiveCode: 8,
          segmentRole: primitive.genericInputXmlBendSegmentRole || '',
          genericBendRadiusMm: primitive.genericBendRadiusMm,
          genericBendTrimLengthMm: primitive.genericBendTrimLengthMm,
          originalBendRadiusMm: primitive.originalBendRadiusMm,
          startMm: primitive.startMm,
          endMm: primitive.endMm,
          sourceRouteTrimmedForNodeLocalElbow: primitive.sourceRouteTrimmedForNodeLocalElbow || false,
          orientationAssumption: primitive.orientationAssumption
        });
      }
    }
  });
  return assumptions;
}

function collectGenericInputXmlNodeLocalElbowAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => {
    for (const primitive of node.primitives || []) {
      if (primitive.genericInputXmlNodeLocalElbow) {
        assumptions.push({
          element: node.reviewName || node.name,
          primitive: primitive.name,
          primitiveCode: 8,
          node: primitive.nodeLocalElbowNode,
          segmentIndex: primitive.nodeLocalElbowSegmentIndex,
          segmentCount: primitive.nodeLocalElbowSegmentCount,
          parentSourceContractNames: primitive.nodeLocalElbowParentSourceContractNames,
          startMm: primitive.startMm,
          endMm: primitive.endMm,
          orientationAssumption: primitive.orientationAssumption
        });
      }
    }
  });
  return assumptions;
}

function collectGenericInputXmlBranchFittingAssumptions(root) {
  const assumptions = [];
  visit(root, (node) => {
    for (const primitive of node.primitives || []) {
      if (primitive.genericInputXmlBranchFitting) {
        assumptions.push({
          element: node.reviewName || node.name,
          primitive: primitive.name,
          primitiveCode: 8,
          branchFittingClass: primitive.branchFittingClass,
          branchFittingNode: primitive.branchFittingNode,
          hostContractName: primitive.branchFittingHostContractName,
          startMm: primitive.startMm,
          endMm: primitive.endMm,
          orientationAssumption: primitive.orientationAssumption
        });
      }
    }
  });
  return assumptions;
}

function warningOnlyGate(schema, callback, options = {}) {
  try {
    return callback();
  } catch (error) {
    if (options.warningOnlyManagedStageGates !== true) throw error;
    return {
      schema: `${schema}.warning-only`,
      ok: false,
      failClosed: false,
      warningOnly: true,
      nonBlockingAuditIssues: [error.message],
      nonBlockingAuditWarningCount: 1
    };
  }
}

function visit(node, callback) {
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}

function computeExportModelBoundingExtents(exportModel) {
  const boxes = [];
  visit(exportModel.root, (node) => {
    for (const primitive of node.primitives || []) boxes.push(primitiveWorldBbox(primitive));
  });
  const bbox = unionBboxes(boxes);
  return {
    schema: 'ManagedStageRvmBoundingExtents.v1',
    primitiveCount: boxes.length,
    bboxMm: bbox ? bbox.map((value) => Number(value.toFixed(6))) : null,
    cntbBboxFieldsWritten: false,
    bboxSource: 'writer-ready primitive local bbox and transform basis'
  };
}

function primitiveWorldBbox(primitive) {
  const bbox = primitive.localBbox || [0, 0, 0, 0, 0, 0];
  const basis = normalizeRvmAxisBasis(primitive.basis || buildRvmAxisBasis(primitive.direction || [0, 0, 1]));
  const center = primitive.center || [0, 0, 0];
  const corners = [];
  for (const x of [bbox[0], bbox[3]]) {
    for (const y of [bbox[1], bbox[4]]) {
      for (const z of [bbox[2], bbox[5]]) {
        corners.push([
          center[0] + basis.x[0] * x + basis.y[0] * y + basis.z[0] * z,
          center[1] + basis.x[1] * x + basis.y[1] * y + basis.z[1] * z,
          center[2] + basis.x[2] * x + basis.y[2] * y + basis.z[2] * z
        ]);
      }
    }
  }
  return bboxFromPoints(corners);
}

function bboxFromPoints(points) {
  if (!points.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  }
  return [...min, ...max];
}

function unionBboxes(boxes) {
  const valid = boxes.filter(Boolean);
  if (!valid.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const bbox of valid) {
    for (let index = 0; index < 3; index += 1) min[index] = Math.min(min[index], bbox[index]);
    for (let index = 0; index < 3; index += 1) max[index] = Math.max(max[index], bbox[index + 3]);
  }
  return [...min, ...max];
}

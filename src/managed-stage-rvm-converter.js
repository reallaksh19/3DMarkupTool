import { writeAtt } from './att-writer.js';
import { assertRvmChunkHierarchy } from './rvm-chunk-hierarchy-validator.js';
import { buildRvmAxisBasis, normalizeRvmAxisBasis } from './rvm-axis-basis-policy.js';
import { assertRvmMaterialLayerContract } from './rvm-material-layer-contract.js';
import { assertRvmMaterialTableContract } from './rvm-material-table-contract.js';
import { scanRvmPrimitivePayloads } from './rvm-primitive-payload-decoder.js';
import { writeRvm } from './rvm-writer.js';
import { evaluateRvmCode4ElbowEmissionCandidate } from './rvm-code4-elbow-emission-candidate-policy.js';
import { assertManagedStageRvmAuditGate } from './managed-stage-rvm-audit-gate.js';
import { buildManagedStageRvmExportModel } from './managed-stage-rvm-export-model.js';
import { parseManagedStageProfile } from './managed-stage-profile-parser.js';
import { auditManagedStageTopology } from './managed-stage-topology-audit.js';
import {
  assertManagedStageRvmStitchManifest,
  buildManagedStageRvmStitchManifest
} from './managed-stage-rvm-stitch-manifest.js';

export const MANAGED_STAGE_CODE4_RVM_OPTIONS = Object.freeze({
  experimentalRvmPrimitiveCodes: ['code4-elbow'],
  allowExperimentalCode4ElbowEmission: true,
  allowManagedStageCode4Elbows: true
});

export function convertManagedStageJsonToRvmAtt(sourceText, options = {}) {
  const profile = parseManagedStageProfile(sourceText);
  const topology = auditManagedStageTopology(profile.geometryRecords);
  const exportModel = buildManagedStageRvmExportModel(profile, options);
  const writerOptions = { ...MANAGED_STAGE_CODE4_RVM_OPTIONS, ...options };
  const rvm = writeRvm(exportModel, writerOptions);
  const att = writeAtt(exportModel);
  const primitivePayloads = scanRvmPrimitivePayloads(rvm);
  const primitivePayloadContract = assertManagedStagePrimitivePayloadCompatibility(primitivePayloads, writerOptions);
  const materialLayerContract = assertRvmMaterialLayerContract(exportModel);
  const materialTableContract = assertRvmMaterialTableContract(rvm, materialLayerContract);
  const boundingExtentsMm = computeExportModelBoundingExtents(exportModel);
  const chunkHierarchy = assertRvmChunkHierarchy(rvm, att, exportModel);
  const stitchManifest = buildManagedStageRvmStitchManifest(profile, exportModel, primitivePayloads);
  const stitchManifestGate = assertManagedStageRvmStitchManifest(stitchManifest);
  const audit = {
    schema: 'ManagedStageRvmConverterAudit.v1',
    source: profile.source,
    profile: profile.profile,
    units: profile.units,
    generationMode: 'managed-stage-cylinder-torus',
    inputCounts: {
      geometryComponents: profile.geometryRecords.length,
      supportRecordsSkippedFromGeometry: profile.supportRecords.length,
      stats: profile.inputStats,
      statsRestraintsMismatch: Number(profile.inputStats?.restraints || 0) !== profile.supportRecords.length
    },
    topology,
    primitiveHistogram: primitivePayloadContract.codeCounts,
    primitiveBodyLengths: primitivePayloads.map((primitive) => ({ code: primitive.code, bodyLength: primitive.bodyLength })),
    torusOrientationAssumptions: collectTorusAssumptions(exportModel.root),
    skippedSupportRecords: profile.supportRecords.map((record) => ({
      name: record.name,
      type: record.type,
      supportKind: record.attributes?.SUPPORT_KIND || record.attributes?.SUPPORT_TYPE || '',
      geometryEmitted: false
    })),
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
  audit.managedStageStrictGate = assertManagedStageRvmAuditGate(audit, options.strictAuditExpectations || {});
  return { profile, exportModel, rvm, att, audit };
}

export function assertManagedStagePrimitivePayloadCompatibility(primitives = [], options = MANAGED_STAGE_CODE4_RVM_OPTIONS) {
  const codeCounts = {};
  const statusCounts = {};
  const unsafe = [];
  for (const primitive of primitives) {
    const code = Number(primitive.code);
    codeCounts[code] = (codeCounts[code] || 0) + 1;
    statusCounts[primitive.compatibilityStatus || 'unknown'] = (statusCounts[primitive.compatibilityStatus || 'unknown'] || 0) + 1;
    if (code === 8) continue;
    if (code === 4 && evaluateRvmCode4ElbowEmissionCandidate(primitive, options).experimentalEmissionCandidateAllowed) continue;
    unsafe.push(primitive);
  }
  if (unsafe.length) {
    throw new Error(`Managed-stage RVM contains unsupported primitive code(s): ${unsafe.map((p) => p.code).join(', ')}`);
  }
  return {
    schema: 'ManagedStageRvmPrimitivePayloadContract.v1',
    primitiveCount: primitives.length,
    allowedPrimitiveCodes: [4, 8],
    forbiddenPrimitiveCodesPresent: [2, 5, 6, 7, 11].filter((code) => codeCounts[code]),
    unsupportedPrimitivePayloadsPresent: false,
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
          orientationAssumption: primitive.orientationAssumption
        });
      }
    }
  });
  return assumptions;
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
  const center = vector3(primitive.center);
  const basis = primitive.basis ? normalizeRvmAxisBasis(primitive.basis) : buildRvmAxisBasis(primitive.direction || [0, 0, 1]);
  const local = primitive.localBbox || cylinderBbox(primitive);
  return pointsBbox(bboxCorners(local).map(([x, y, z]) => [
    center[0] + basis.x[0] * x + basis.y[0] * y + basis.z[0] * z,
    center[1] + basis.x[1] * x + basis.y[1] * y + basis.z[1] * z,
    center[2] + basis.x[2] * x + basis.y[2] * y + basis.z[2] * z
  ]));
}

function cylinderBbox(primitive) {
  const radius = Number(primitive.radius);
  const half = Number(primitive.length) / 2;
  if (!(radius > 0) || !(half > 0)) throw new Error(`Invalid primitive bbox dimensions for ${primitive.name || 'UNNAMED'}`);
  return [-radius, -radius, -half, radius, radius, half];
}

function bboxCorners(bbox) {
  const [minX, minY, minZ, maxX, maxY, maxZ] = bbox;
  return [
    [minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, minZ], [minX, maxY, maxZ],
    [maxX, minY, minZ], [maxX, minY, maxZ], [maxX, maxY, minZ], [maxX, maxY, maxZ]
  ];
}

function pointsBbox(points) {
  const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const point of points) {
    const p = vector3(point);
    bbox[0] = Math.min(bbox[0], p[0]); bbox[1] = Math.min(bbox[1], p[1]); bbox[2] = Math.min(bbox[2], p[2]);
    bbox[3] = Math.max(bbox[3], p[0]); bbox[4] = Math.max(bbox[4], p[1]); bbox[5] = Math.max(bbox[5], p[2]);
  }
  return bbox;
}

function unionBboxes(boxes) {
  if (!boxes.length) return null;
  return pointsBbox(boxes.flatMap(bboxCorners));
}

function vector3(value) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error('Expected vector3');
  const out = value.map(Number);
  if (out.some((entry) => !Number.isFinite(entry))) throw new Error('Vector3 contains non-finite value');
  return out;
}

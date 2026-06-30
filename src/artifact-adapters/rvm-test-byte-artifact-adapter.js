import { createHash } from 'node:crypto';
import { writeRvm } from '../rvm-writer.js';
import { assertRvmBinaryCompatibility } from '../rvm-binary-audit.js';
import { decodeRvmPrimitivePayload } from '../rvm-primitive-payload-decoder.js';
import {
  collectRvmTestArtifactByteProofForbiddenFieldHits,
  validateRvmTestArtifactByteProofContract
} from '../contracts/index.js';

const BYTE_PROOF_SCHEMA = 'RvmTestArtifactByteProof.v1';
const BYTE_PROOF_AUDIT_SCHEMA = 'RvmTestArtifactByteProofAudit.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const AXIS_EPSILON = 1e-6;
const FULL_MODEL_WARNING = 'RVM full model remains not ready because blocked/deferred items are excluded from the test-only byte proof';

export function buildRvmTestArtifactByteProof(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit, options = {}) {
  const rvmExportModel = exportModels?.rvmExportModel;
  const graphId = rvmExportModel?.graphId || writerAdapterPlan?.graphId || testArtifactPlan?.graphId || options.graphId || '<unknown-graph>';
  const blockedArtifactItems = cloneArray(testArtifactPlan?.blockedArtifactItems);
  const deferredArtifactItems = cloneArray(testArtifactPlan?.deferredArtifactItems);
  const sourceTrace = cloneArray(testArtifactPlan?.sourceTrace);
  const base = {
    schema: BYTE_PROOF_SCHEMA,
    graphId,
    units: rvmExportModel?.units || testArtifactPlan?.units || options.units || 'mm',
    mode: 'testOnly',
    artifactKind: 'rvm',
    writerBridge: 'src/rvm-writer.js',
    writerBridgeMode: 'isolated-test-only',
    transformPolicy: rvmExportModel?.transformPolicy || '<missing-transform-policy>',
    transformApplied: rvmExportModel?.transformApplied === true,
    sourceSchema: 'RvmExportModel.v1',
    blockedArtifactItems,
    deferredArtifactItems,
    sourceTrace
  };

  const preflightErrors = preflightErrorsForByteProof(rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
  if (preflightErrors.length) return blockedProof(base, preflightErrors.join('; '), preflightErrors);

  const acceptedPrimitives = (Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives : []).filter(isWritableCylinderPrimitive);
  const rejectedCount = (Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives : []).length - acceptedPrimitives.length;
  if (rejectedCount > 0) return blockedProof(base, 'RVM test byte bridge accepts only final transformed CYLINDER/code8 primitives', [`Rejected ${rejectedCount} non-writable RVM primitive plan(s)`]);
  if (acceptedPrimitives.length === 0) return blockedProof(base, 'RVM test byte bridge requires at least one transformed CYLINDER/code8 primitive', ['No writable cylinder primitives']);

  try {
    const writerModel = buildStraightPipeWriterModel(rvmExportModel, acceptedPrimitives);
    const arrayBuffer = writeRvm(writerModel, { mode: 'testOnly', phase: '8C' });
    const binaryAudit = assertRvmBinaryCompatibility(arrayBuffer, { primitiveCount: acceptedPrimitives.length });
    const decodedPrimitives = decodePrimitiveBodies(arrayBuffer);
    const counts = primitiveCounts(decodedPrimitives);
    const byteView = new Uint8Array(arrayBuffer);
    const checksumSha256 = createHash('sha256').update(Buffer.from(byteView)).digest('hex');
    const byteHeaderHex = Buffer.from(byteView.slice(0, 32)).toString('hex');
    const errors = [];
    if (counts.primitiveCount !== acceptedPrimitives.length) errors.push(`Decoded PRIM count mismatch: expected ${acceptedPrimitives.length}, got ${counts.primitiveCount}`);
    if (counts.cylinderPrimitiveCount !== acceptedPrimitives.length) errors.push(`Decoded cylinder count mismatch: expected ${acceptedPrimitives.length}, got ${counts.cylinderPrimitiveCount}`);
    if (counts.torusPrimitiveCount || counts.boxPrimitiveCount || counts.spherePrimitiveCount || counts.pyramidPrimitiveCount) errors.push('Decoded byte proof contains non-cylinder primitive codes');
    if (binaryAudit.primitiveChunkCount !== acceptedPrimitives.length) errors.push('RVM binary audit primitive count mismatch');
    return {
      ...base,
      artifactReady: errors.length === 0,
      artifactGenerated: errors.length === 0,
      artifactBlocked: errors.length > 0,
      artifactByteLength: arrayBuffer.byteLength,
      checksumSha256: errors.length === 0 ? checksumSha256 : '',
      byteHeaderHex: errors.length === 0 ? byteHeaderHex : '',
      primitiveCount: counts.primitiveCount,
      cylinderPrimitiveCount: counts.cylinderPrimitiveCount,
      torusPrimitiveCount: counts.torusPrimitiveCount,
      boxPrimitiveCount: counts.boxPrimitiveCount,
      spherePrimitiveCount: counts.spherePrimitiveCount,
      pyramidPrimitiveCount: counts.pyramidPrimitiveCount,
      warnings: blockedArtifactItems.length || deferredArtifactItems.length ? [FULL_MODEL_WARNING] : [],
      errors
    };
  } catch (error) {
    return blockedProof(base, 'RVM test byte bridge requires writer model bridge not implemented', [error instanceof Error ? error.message : String(error)]);
  }
}

export function buildRvmTestArtifactByteProofAudit(byteProof, exportModels, writerAdapterPlan, writerAdapterAudit, testArtifactAudit, options = {}) {
  const validation = validateRvmTestArtifactByteProofContract(byteProof);
  const forbiddenHits = collectRvmTestArtifactByteProofForbiddenFieldHits(byteProof);
  const errors = [...validation.errors];
  if (!writerAdapterAudit || writerAdapterAudit.schema !== 'WriterAdapterAudit.v1') errors.push('WriterAdapterAudit.v1 is required');
  if (writerAdapterAudit?.ok !== true) errors.push('WriterAdapterAudit.ok must be true before RVM byte proof');
  if (!testArtifactAudit || testArtifactAudit.schema !== 'TestArtifactAdapterAudit.v1') errors.push('TestArtifactAdapterAudit.v1 is required');
  if (testArtifactAudit?.ok !== true) errors.push('TestArtifactAdapterAudit.ok must be true before RVM byte proof');

  const trace = Array.isArray(byteProof?.sourceTrace) ? byteProof.sourceTrace : [];
  const blockedItems = Array.isArray(byteProof?.blockedArtifactItems) ? byteProof.blockedArtifactItems : [];
  const deferredItems = Array.isArray(byteProof?.deferredArtifactItems) ? byteProof.deferredArtifactItems : [];
  const warnings = Array.isArray(byteProof?.warnings) ? [...byteProof.warnings] : [];
  const audit = {
    schema: BYTE_PROOF_AUDIT_SCHEMA,
    graphId: byteProof?.graphId || options.graphId || '<unknown-graph>',
    mode: byteProof?.mode || 'testOnly',
    rvmStraightPipeSubsetArtifactReady: byteProof?.artifactReady === true && byteProof?.artifactGenerated === true,
    rvmFullModelArtifactReady: byteProof?.artifactReady === true && blockedItems.length === 0 && deferredItems.length === 0,
    artifactGenerated: byteProof?.artifactGenerated === true,
    artifactBlocked: byteProof?.artifactBlocked === true,
    artifactByteLength: Number(byteProof?.artifactByteLength || 0),
    artifactChecksumPresent: typeof byteProof?.checksumSha256 === 'string' && /^[0-9a-f]{64}$/.test(byteProof.checksumSha256),
    byteHeaderPresent: typeof byteProof?.byteHeaderHex === 'string' && byteProof.byteHeaderHex.length > 0,
    sourceTraceCount: trace.length,
    tracedStraightPipeCount: trace.filter((entry) => entry.primitiveStatus === 'primitiveResolved' && entry.writerStatus === 'planned').length,
    tracedBlockedFlangeCount: trace.filter((entry) => entry.family === 'flange' && entry.artifactStatus === 'blocked').length,
    tracedBlockedValveCount: trace.filter((entry) => entry.family === 'valve' && entry.artifactStatus === 'blocked').length,
    tracedBlockedBendCount: trace.filter((entry) => entry.family === 'elbow' && entry.artifactStatus === 'blocked').length,
    tracedDeferredSupportCount: trace.filter((entry) => entry.family === 'support' && entry.artifactStatus === 'deferred').length,
    primitiveWriteCount: Number(byteProof?.primitiveCount || 0),
    cylinderWriteCount: Number(byteProof?.cylinderPrimitiveCount || 0),
    torusWriteCount: Number(byteProof?.torusPrimitiveCount || 0),
    boxWriteCount: Number(byteProof?.boxPrimitiveCount || 0),
    sphereWriteCount: Number(byteProof?.spherePrimitiveCount || 0),
    pyramidWriteCount: Number(byteProof?.pyramidPrimitiveCount || 0),
    supportWriteCount: 0,
    blockedFlangeCount: blockedItems.filter((entry) => entry.family === 'flange').length,
    blockedValveCount: blockedItems.filter((entry) => entry.family === 'valve').length,
    blockedBendCount: blockedItems.filter((entry) => entry.family === 'elbow').length,
    deferredSupportWriterCount: deferredItems.filter((entry) => entry.family === 'support').length,
    writerCallCount: byteProof?.artifactGenerated === true ? 1 : 0,
    rvmWriterCallCount: byteProof?.artifactGenerated === true ? 1 : 0,
    attWriterCallCount: 0,
    glbWriterCallCount: 0,
    binaryPayloadGenerated: byteProof?.artifactGenerated === true && Number(byteProof?.artifactByteLength || 0) > 0,
    attTextPayloadGenerated: false,
    glbPayloadGenerated: false,
    runtimeTouched: false,
    browserTouched: false,
    canvasTouched: false,
    objectUrlCount: forbiddenHits.filter((hit) => hit.field === 'objectUrl').length,
    downloadSideEffectCount: forbiddenHits.filter((hit) => hit.field === 'downloadUrl' || hit.field === 'userVisibleDownload').length,
    productionPathMutationCount: forbiddenHits.filter((hit) => hit.field === 'productionWrite' || hit.field === 'appStateMutation').length,
    cacheKeyMutationCount: forbiddenHits.filter((hit) => hit.field === 'cacheKeyMutation').length,
    hardErrorCount: errors.length,
    warningCount: warnings.length,
    ok: false,
    errors,
    warnings
  };
  audit.ok = validation.ok
    && writerAdapterAudit?.ok === true
    && testArtifactAudit?.ok === true
    && audit.hardErrorCount === 0
    && audit.rvmStraightPipeSubsetArtifactReady === true
    && audit.rvmFullModelArtifactReady === false
    && audit.artifactGenerated === true
    && audit.artifactByteLength > 0
    && audit.artifactChecksumPresent === true
    && audit.rvmWriterCallCount === 1
    && audit.attWriterCallCount === 0
    && audit.glbWriterCallCount === 0
    && audit.runtimeTouched === false
    && audit.browserTouched === false
    && audit.canvasTouched === false
    && audit.objectUrlCount === 0
    && audit.downloadSideEffectCount === 0
    && audit.productionPathMutationCount === 0
    && audit.cacheKeyMutationCount === 0;
  return audit;
}

function preflightErrorsForByteProof(rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit) {
  const errors = [];
  if (!rvmExportModel || rvmExportModel.schema !== 'RvmExportModel.v1') errors.push('RvmExportModel.v1 is required');
  if (rvmExportModel?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('RVM byte proof requires final-review-transform.v1');
  if (rvmExportModel?.transformApplied !== true) errors.push('RVM byte proof requires transformApplied true');
  if (!exportAudit || exportAudit.schema !== 'ExportModelCompilationAudit.v1' || exportAudit.ok !== true) errors.push('ExportModelCompilationAudit.v1 ok is required');
  if (!writerAdapterPlan || writerAdapterPlan.schema !== 'WriterAdapterPlan.v1' || writerAdapterPlan?.rvmAdapter?.writerReady !== true) errors.push('WriterAdapterPlan.v1 with RVM subset readiness is required');
  if (!writerAdapterAudit || writerAdapterAudit.schema !== 'WriterAdapterAudit.v1' || writerAdapterAudit.ok !== true) errors.push('WriterAdapterAudit.v1 ok is required');
  if (!testArtifactPlan || testArtifactPlan.schema !== 'TestArtifactAdapterPlan.v1') errors.push('TestArtifactAdapterPlan.v1 is required');
  if (!testArtifactAudit || testArtifactAudit.schema !== 'TestArtifactAdapterAudit.v1' || testArtifactAudit.ok !== true) errors.push('TestArtifactAdapterAudit.v1 ok is required');
  return errors;
}

function isWritableCylinderPrimitive(primitive) {
  return primitive?.primitiveKind === 'CYLINDER'
    && Number(primitive?.primitiveCode) === 8
    && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY
    && primitive?.basis === 'navis-review'
    && isPoint3(primitive?.center)
    && isPoint3(primitive?.axis)
    && isUnitVector(primitive.axis)
    && finitePositive(primitive?.lengthMm)
    && finitePositive(primitive?.radiusMm);
}

function buildStraightPipeWriterModel(rvmExportModel, primitives) {
  return {
    root: {
      name: 'RVM_TEST_BYTE_PROOF_ROOT',
      reviewName: 'RVM_TEST_BYTE_PROOF_ROOT',
      material: 0,
      attributes: { TYPE: 'ROOT', PHASE: '8C_TEST_ONLY' },
      primitives: [],
      children: [
        {
          name: 'STRAIGHT_PIPE_CYLINDER_SUBSET',
          reviewName: 'STRAIGHT_PIPE_CYLINDER_SUBSET',
          material: 0,
          attributes: { TYPE: 'GROUP', SOURCE_SCHEMA: rvmExportModel.schema },
          primitives: [],
          children: primitives.map((primitive, index) => ({
            name: safeName(`PIPE_${index + 1}_${primitive.sourceItemId || primitive.sourcePrimitiveId}`),
            reviewName: safeName(primitive.sourceItemId || primitive.sourcePrimitiveId || `PIPE_${index + 1}`),
            material: 1,
            attributes: {
              TYPE: 'COMPONENT',
              ENGINEERING_TYPE: 'PIPE',
              SOURCE_ITEM_ID: primitive.sourceItemId,
              SOURCE_PRIMITIVE_ID: primitive.sourcePrimitiveId
            },
            primitives: [
              {
                name: safeName(`PRIM_${primitive.sourcePrimitiveId || primitive.sourceItemId || index + 1}`),
                kind: 'cylinder',
                center: primitive.center,
                direction: primitive.axis,
                radius: primitive.radiusMm,
                length: primitive.lengthMm,
                material: 1,
                sourcePrimitiveId: primitive.sourcePrimitiveId,
                sourceItemId: primitive.sourceItemId
              }
            ],
            children: []
          }))
        }
      ]
    },
    audit: { primitiveCount: primitives.length, phase: '8C_TEST_ONLY' }
  };
}

function decodePrimitiveBodies(buffer) {
  const arrayBuffer = toArrayBuffer(buffer);
  const view = new DataView(arrayBuffer);
  const decoded = [];
  let offset = 0;
  while (offset + 24 <= arrayBuffer.byteLength) {
    const id = [0, 1, 2, 3].map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false))).join('');
    const nextOffset = view.getUint32(offset + 16, false);
    if (nextOffset <= offset || nextOffset > arrayBuffer.byteLength) break;
    if (id === 'PRIM') decoded.push(decodeRvmPrimitivePayload(arrayBuffer.slice(offset + 24, nextOffset)));
    offset = nextOffset;
    if (id === 'END:') break;
  }
  return decoded;
}

function primitiveCounts(decodedPrimitives) {
  return {
    primitiveCount: decodedPrimitives.length,
    cylinderPrimitiveCount: decodedPrimitives.filter((entry) => Number(entry.code) === 8).length,
    torusPrimitiveCount: decodedPrimitives.filter((entry) => Number(entry.code) === 4).length,
    boxPrimitiveCount: decodedPrimitives.filter((entry) => Number(entry.code) === 2).length,
    spherePrimitiveCount: decodedPrimitives.filter((entry) => Number(entry.code) === 9).length,
    pyramidPrimitiveCount: decodedPrimitives.filter((entry) => Number(entry.code) === 1).length
  };
}

function blockedProof(base, reason, errors = []) {
  return {
    ...base,
    artifactReady: false,
    artifactGenerated: false,
    artifactBlocked: true,
    artifactByteLength: 0,
    checksumSha256: '',
    primitiveCount: 0,
    cylinderPrimitiveCount: 0,
    torusPrimitiveCount: 0,
    boxPrimitiveCount: 0,
    spherePrimitiveCount: 0,
    pyramidPrimitiveCount: 0,
    warnings: [reason],
    errors
  };
}

function isPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

function isUnitVector(value) {
  return isPoint3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= AXIS_EPSILON;
}

function finitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map((entry) => ({ ...entry })) : [];
}

function safeName(value) {
  return String(value || 'UNNAMED').replace(/[^A-Za-z0-9_./:-]+/g, '_').slice(0, 80);
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  throw new Error('Expected ArrayBuffer or typed array from RVM writer');
}

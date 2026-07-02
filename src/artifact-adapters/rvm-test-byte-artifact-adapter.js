import { createHash } from 'node:crypto';
import { writeRvmTorusCode4TestBytes } from './rvm-code4-torus-test-byte-writer.js';
import { writeRvmFlangeCylinderTestBytes } from './rvm-flange-cylinder-test-byte-writer.js';
import { collectRvmTestArtifactByteProofForbiddenFieldHits, validateRvmTestArtifactByteProofContract } from '../contracts/index.js';

const BYTE_PROOF_SCHEMA = 'RvmTestArtifactByteProof.v1';
const BYTE_PROOF_AUDIT_SCHEMA = 'RvmTestArtifactByteProofAudit.v1';
const FINAL_REVIEW_TRANSFORM_POLICY = 'final-review-transform.v1';
const AXIS_EPSILON = 1e-6;
const FULL_MODEL_WARNING = 'RVM full model remains not ready because valves and supports remain blocked/deferred';
const COMPOSITE_BRIDGE = 'composite-pipe-bend-flange-test-byte-proof.v1';
const PIPE_BEND_BRIDGE = 'src/artifact-adapters/rvm-code4-torus-test-byte-writer.js';
const FLANGE_BRIDGE = 'src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js';
const SEGMENTED_BRIDGES = Object.freeze([PIPE_BEND_BRIDGE, FLANGE_BRIDGE]);

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
    writerBridge: COMPOSITE_BRIDGE,
    writerBridges: [...SEGMENTED_BRIDGES],
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

  const rawPipePrimitives = Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives : [];
  const rawTorusPrimitives = Array.isArray(rvmExportModel?.testByteEligiblePrimitives) ? rvmExportModel.testByteEligiblePrimitives : [];
  const rawFlangePrimitives = Array.isArray(rvmExportModel?.flangeTestByteEligiblePrimitives) ? rvmExportModel.flangeTestByteEligiblePrimitives : [];
  const cylinders = rawPipePrimitives.filter(isWritableCylinderPrimitive);
  const toruses = rawTorusPrimitives.filter(isWritableTorusPrimitive);
  const flanges = rawFlangePrimitives.filter(isWritableFlangePrimitive);
  const rejectedCount = rawPipePrimitives.length - cylinders.length;
  const rejectedTorusCount = rawTorusPrimitives.length - toruses.length;
  const rejectedFlangeCount = rawFlangePrimitives.length - flanges.length;
  if (rejectedCount > 0 || rejectedTorusCount > 0 || rejectedFlangeCount > 0) {
    return blockedProof(base, 'RVM test byte bridge accepts only transformed pipe CYLINDER/code8, eligible TORUS/code4, and eligible FLANGE_CYLINDER/code8 primitives', [`Rejected ${rejectedCount} pipe primitive plan(s), ${rejectedTorusCount} torus plan(s), ${rejectedFlangeCount} flange plan(s)`]);
  }
  if (cylinders.length === 0) return blockedProof(base, 'RVM test byte bridge requires at least one transformed pipe CYLINDER/code8 primitive', ['No writable pipe cylinder primitives']);

  try {
    const pipeBendResult = writeRvmTorusCode4TestBytes(rvmExportModel, { mode: 'testOnly' });
    const pipeBendMeta = pipeBendResult.metadata;
    const flangeResult = flanges.length ? writeRvmFlangeCylinderTestBytes(flangeOnlyModel(rvmExportModel, flanges), { mode: 'testOnly' }) : null;
    const flangeMeta = flangeResult?.metadata || zeroFlangeMeta();
    const errors = [];
    if (pipeBendMeta.primitiveCount !== cylinders.length + toruses.length) errors.push(`Pipe/bend decoded PRIM count mismatch: expected ${cylinders.length + toruses.length}, got ${pipeBendMeta.primitiveCount}`);
    if (pipeBendMeta.cylinderCount !== cylinders.length) errors.push(`Decoded pipe cylinder count mismatch: expected ${cylinders.length}, got ${pipeBendMeta.cylinderCount}`);
    if (pipeBendMeta.torusCount !== toruses.length) errors.push(`Decoded torus count mismatch: expected ${toruses.length}, got ${pipeBendMeta.torusCount}`);
    if (flangeMeta.flangeCylinderCount !== flanges.length) errors.push(`Decoded flange cylinder count mismatch: expected ${flanges.length}, got ${flangeMeta.flangeCylinderCount}`);
    if (pipeBendMeta.boxCount || pipeBendMeta.sphereCount || pipeBendMeta.pyramidCount || flangeMeta.boxCount || flangeMeta.sphereCount || flangeMeta.pyramidCount) errors.push('Decoded byte proof contains fallback primitive codes');
    const checksum = combinedChecksum(pipeBendResult.data, flangeResult?.data);
    const artifactSegments = [
      { segmentKind: 'pipe-bend', writerBridge: PIPE_BEND_BRIDGE, byteLength: pipeBendMeta.byteLength, checksumSha256: pipeBendMeta.checksumSha256 },
      ...(flangeResult ? [{ segmentKind: 'flange', writerBridge: FLANGE_BRIDGE, byteLength: flangeMeta.byteLength, checksumSha256: flangeMeta.checksumSha256 }] : [])
    ];
    return {
      ...base,
      sourceTrace: markByteProven(sourceTrace),
      artifactReady: errors.length === 0,
      artifactGenerated: errors.length === 0,
      artifactBlocked: errors.length > 0,
      artifactByteLength: pipeBendMeta.byteLength + flangeMeta.byteLength,
      checksumSha256: errors.length === 0 ? checksum : '',
      byteHeaderHex: errors.length === 0 ? pipeBendMeta.byteHeaderHex : '',
      primitiveCount: pipeBendMeta.primitiveCount + flangeMeta.primitiveCount,
      cylinderPrimitiveCount: pipeBendMeta.cylinderCount,
      torusPrimitiveCount: pipeBendMeta.torusCount,
      flangePrimitiveCount: flangeMeta.flangeCylinderCount,
      boxPrimitiveCount: pipeBendMeta.boxCount + flangeMeta.boxCount,
      spherePrimitiveCount: pipeBendMeta.sphereCount + flangeMeta.sphereCount,
      pyramidPrimitiveCount: pipeBendMeta.pyramidCount + flangeMeta.pyramidCount,
      supportPrimitiveCount: 0,
      decodedPrimitiveCount: pipeBendMeta.primitiveCount + flangeMeta.primitiveCount,
      decodedCylinderCount: pipeBendMeta.cylinderCount + flangeMeta.flangeCylinderCount,
      decodedPipeCylinderCount: pipeBendMeta.cylinderCount,
      decodedFlangeCylinderCount: flangeMeta.flangeCylinderCount,
      decodedTorusCount: pipeBendMeta.torusCount,
      decodedBoxCount: pipeBendMeta.boxCount + flangeMeta.boxCount,
      decodedSphereCount: pipeBendMeta.sphereCount + flangeMeta.sphereCount,
      decodedPyramidCount: pipeBendMeta.pyramidCount + flangeMeta.pyramidCount,
      artifactSegments,
      warnings: blockedArtifactItems.length || deferredArtifactItems.length ? [FULL_MODEL_WARNING] : [],
      errors
    };
  } catch (error) {
    return blockedProof(base, 'RVM pipe/bend/flange test byte bridge failed closed', [error instanceof Error ? error.message : String(error)]);
  }
}

export function buildRvmTestArtifactByteProofAudit(byteProof, exportModels, writerAdapterPlan, writerAdapterAudit, testArtifactAudit, options = {}) {
  const validation = validateRvmTestArtifactByteProofContract(byteProof);
  const forbiddenHits = collectRvmTestArtifactByteProofForbiddenFieldHits(byteProof);
  const errors = [...validation.errors];
  if (!writerAdapterAudit || writerAdapterAudit.schema !== 'WriterAdapterAudit.v1') errors.push('WriterAdapterAudit.v1 is required');
  if (writerAdapterAudit?.ok !== true) errors.push('WriterAdapterAudit.ok must be true before RVM byte proof');
  if (!testArtifactAudit || testArtifactAudit.schema !== 'TestArtifactAdapterAudit.v1') errors.push('TestArtifactAdapterAudit.v1 is required');
  if (testArtifactAudit?.ok !== true) errors.push('TestArtifactAudit.ok must be true before RVM byte proof');
  const trace = Array.isArray(byteProof?.sourceTrace) ? byteProof.sourceTrace : [];
  const blockedItems = Array.isArray(byteProof?.blockedArtifactItems) ? byteProof.blockedArtifactItems : [];
  const deferredItems = Array.isArray(byteProof?.deferredArtifactItems) ? byteProof.deferredArtifactItems : [];
  const warnings = Array.isArray(byteProof?.warnings) ? [...byteProof.warnings] : [];
  const audit = {
    schema: BYTE_PROOF_AUDIT_SCHEMA,
    graphId: byteProof?.graphId || options.graphId || '<unknown-graph>',
    mode: byteProof?.mode || 'testOnly',
    rvmPipeBendSubsetArtifactReady: byteProof?.artifactReady === true && Number(byteProof?.torusPrimitiveCount || 0) > 0,
    rvmStraightPipeSubsetArtifactReady: byteProof?.artifactReady === true && Number(byteProof?.cylinderPrimitiveCount || 0) > 0,
    rvmBendTorusSubsetArtifactReady: byteProof?.artifactReady === true && Number(byteProof?.torusPrimitiveCount || 0) > 0,
    rvmFlangeSubsetArtifactReady: byteProof?.artifactReady === true && Number(byteProof?.flangePrimitiveCount || 0) > 0,
    rvmFullModelArtifactReady: byteProof?.artifactReady === true && blockedItems.length === 0 && deferredItems.length === 0,
    artifactGenerated: byteProof?.artifactGenerated === true,
    artifactBlocked: byteProof?.artifactBlocked === true,
    artifactByteLength: Number(byteProof?.artifactByteLength || 0),
    artifactChecksumPresent: typeof byteProof?.checksumSha256 === 'string' && /^[0-9a-f]{64}$/.test(byteProof.checksumSha256),
    byteHeaderPresent: typeof byteProof?.byteHeaderHex === 'string' && byteProof.byteHeaderHex.length > 0,
    sourceTraceCount: trace.length,
    tracedStraightPipeCount: trace.filter((entry) => entry.primitiveStatus === 'primitiveResolved' && ['planned', 'byteProven'].includes(entry.writerStatus) && entry.primitiveKind !== 'FLANGE_CYLINDER').length,
    tracedBendTorusPrimitiveResolvedCount: trace.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS' && entry.primitiveStatus === 'primitiveResolved').length,
    tracedBendTorusWriterDeferredCount: trace.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS' && entry.writerStatus === 'deferred').length,
    tracedBendTorusWriterByteProvenCount: trace.filter((entry) => entry.family === 'elbow' && entry.primitiveKind === 'TORUS' && entry.writerStatus === 'byteProven').length,
    tracedFlangePrimitiveResolvedCount: trace.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.primitiveStatus === 'primitiveResolved').length,
    tracedFlangeWriterDeferredCount: trace.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.writerStatus === 'deferred').length,
    tracedFlangeWriterByteProvenCount: trace.filter((entry) => entry.family === 'flange' && entry.primitiveKind === 'FLANGE_CYLINDER' && entry.writerStatus === 'byteProven').length,
    tracedBlockedFlangeCount: trace.filter((entry) => entry.family === 'flange' && entry.artifactStatus === 'blocked').length,
    tracedBlockedValveCount: trace.filter((entry) => entry.family === 'valve' && entry.artifactStatus === 'blocked').length,
    tracedBlockedBendCount: trace.filter((entry) => entry.family === 'elbow' && entry.artifactStatus === 'blocked').length,
    tracedDeferredSupportCount: trace.filter((entry) => entry.family === 'support' && entry.artifactStatus === 'deferred').length,
    primitiveWriteCount: Number(byteProof?.primitiveCount || 0),
    cylinderWriteCount: Number(byteProof?.cylinderPrimitiveCount || 0),
    torusWriteCount: Number(byteProof?.torusPrimitiveCount || 0),
    flangeWriteCount: Number(byteProof?.flangePrimitiveCount || 0),
    boxWriteCount: Number(byteProof?.boxPrimitiveCount || 0),
    sphereWriteCount: Number(byteProof?.spherePrimitiveCount || 0),
    pyramidWriteCount: Number(byteProof?.pyramidPrimitiveCount || 0),
    supportWriteCount: Number(byteProof?.supportPrimitiveCount || 0),
    decodedPrimitiveCount: Number(byteProof?.decodedPrimitiveCount || 0),
    decodedCylinderCount: Number(byteProof?.decodedCylinderCount || 0),
    decodedPipeCylinderCount: Number(byteProof?.decodedPipeCylinderCount || 0),
    decodedFlangeCylinderCount: Number(byteProof?.decodedFlangeCylinderCount || 0),
    decodedTorusCount: Number(byteProof?.decodedTorusCount || 0),
    decodedBoxCount: Number(byteProof?.decodedBoxCount || 0),
    decodedSphereCount: Number(byteProof?.decodedSphereCount || 0),
    decodedPyramidCount: Number(byteProof?.decodedPyramidCount || 0),
    blockedFlangeCount: blockedItems.filter((entry) => entry.family === 'flange').length,
    blockedValveCount: blockedItems.filter((entry) => entry.family === 'valve').length,
    blockedBendCount: blockedItems.filter((entry) => entry.family === 'elbow').length,
    deferredFlangeWriterCount: Number(writerAdapterAudit?.deferredFlangeWriterCount || 0),
    deferredSupportWriterCount: deferredItems.filter((entry) => entry.family === 'support').length,
    writerCallCount: byteProof?.artifactGenerated === true ? (Number(byteProof?.flangePrimitiveCount || 0) > 0 ? 2 : 1) : 0,
    rvmWriterCallCount: byteProof?.artifactGenerated === true ? (Number(byteProof?.flangePrimitiveCount || 0) > 0 ? 2 : 1) : 0,
    torusTestWriterCallCount: byteProof?.artifactGenerated === true && Number(byteProof?.torusPrimitiveCount || 0) > 0 ? 1 : 0,
    flangeTestWriterCallCount: byteProof?.artifactGenerated === true && Number(byteProof?.flangePrimitiveCount || 0) > 0 ? 1 : 0,
    productionWriterCallCount: 0,
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
  audit.ok = validation.ok && writerAdapterAudit?.ok === true && testArtifactAudit?.ok === true && audit.hardErrorCount === 0 && audit.rvmPipeBendSubsetArtifactReady === true && audit.rvmFlangeSubsetArtifactReady === true && audit.rvmFullModelArtifactReady === false && audit.artifactGenerated === true && audit.artifactByteLength > 0 && audit.artifactChecksumPresent === true && audit.cylinderWriteCount > 0 && audit.torusWriteCount > 0 && audit.flangeWriteCount > 0 && audit.decodedPipeCylinderCount === audit.cylinderWriteCount && audit.decodedFlangeCylinderCount === audit.flangeWriteCount && audit.boxWriteCount === 0 && audit.sphereWriteCount === 0 && audit.pyramidWriteCount === 0 && audit.productionWriterCallCount === 0 && audit.attWriterCallCount === 0 && audit.glbWriterCallCount === 0 && audit.runtimeTouched === false && audit.browserTouched === false && audit.canvasTouched === false && audit.objectUrlCount === 0 && audit.downloadSideEffectCount === 0 && audit.productionPathMutationCount === 0 && audit.cacheKeyMutationCount === 0;
  return audit;
}

function preflightErrorsForByteProof(rvmExportModel, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit) {
  const errors = [];
  if (!rvmExportModel || rvmExportModel.schema !== 'RvmExportModel.v1') errors.push('RvmExportModel.v1 is required');
  if (rvmExportModel?.transformPolicy !== FINAL_REVIEW_TRANSFORM_POLICY) errors.push('final-review-transform.v1 is required');
  if (rvmExportModel?.transformApplied !== true) errors.push('transformApplied must be true');
  if (!exportAudit || exportAudit.schema !== 'ExportModelCompilationAudit.v1') errors.push('ExportModelCompilationAudit.v1 is required');
  if (exportAudit?.ok !== true) errors.push('ExportModelCompilationAudit.ok must be true before RVM byte proof');
  if (!writerAdapterPlan || writerAdapterPlan.schema !== 'WriterAdapterPlan.v1') errors.push('WriterAdapterPlan.v1 is required');
  if (!writerAdapterAudit || writerAdapterAudit.schema !== 'WriterAdapterAudit.v1') errors.push('WriterAdapterAudit.v1 is required');
  if (writerAdapterAudit?.ok !== true) errors.push('WriterAdapterAudit.ok must be true before RVM byte proof');
  if (!testArtifactPlan || testArtifactPlan.schema !== 'TestArtifactAdapterPlan.v1') errors.push('TestArtifactAdapterPlan.v1 is required');
  if (!testArtifactAudit || testArtifactAudit.schema !== 'TestArtifactAdapterAudit.v1') errors.push('TestArtifactAdapterAudit.v1 is required');
  if (testArtifactAudit?.ok !== true) errors.push('TestArtifactAdapterAudit.ok must be true before RVM byte proof');
  return errors;
}
function isWritableCylinderPrimitive(primitive) { return primitive?.primitiveKind === 'CYLINDER' && Number(primitive?.primitiveCode) === 8 && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY && primitive?.basis === 'navis-review' && isPoint3(primitive?.center) && isPoint3(primitive?.axis) && isUnitVector(primitive.axis) && ['lengthMm', 'radiusMm'].every((key) => finitePositive(primitive[key])); }
function isWritableTorusPrimitive(primitive) { return primitive?.primitiveKind === 'TORUS' && Number(primitive?.primitiveCode) === 4 && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY && primitive?.basis === 'navis-review' && primitive?.testByteEligible === true && primitive?.writerReady === false && isPoint3(primitive?.center) && ['normal', 'startTangent', 'endTangent'].every((key) => isPoint3(primitive?.[key]) && isUnitVector(primitive[key])) && ['majorRadiusMm', 'tubeRadiusMm', 'bendAngleDeg', 'sweepAngleDeg'].every((key) => finitePositive(primitive[key])) && primitive?.evidence?.centerSource !== 'inputxml-chord-midpoint-not-arc-center'; }
function isWritableFlangePrimitive(primitive) { return primitive?.primitiveKind === 'FLANGE_CYLINDER' && Number(primitive?.primitiveCode) === 8 && primitive?.family === 'flange' && primitive?.resolver === 'flangeCylinderPrimitive.v1' && primitive?.geometryStatus === 'primitiveResolved' && primitive?.transformPolicy === FINAL_REVIEW_TRANSFORM_POLICY && primitive?.transformApplied === true && primitive?.basis === 'navis-review' && primitive?.testByteEligible === true && primitive?.writerReady === false && primitive?.byteBridge === 'test-only-phase-11c-b' && isPoint3(primitive?.center) && isPoint3(primitive?.axis) && isUnitVector(primitive.axis) && ['lengthMm', 'outerRadiusMm', 'boreRadiusMm'].every((key) => finitePositive(primitive[key])) && Number(primitive.outerRadiusMm) > Number(primitive.boreRadiusMm) && Boolean(primitive.catalogueItemId) && Boolean(primitive.catalogueRef) && primitive?.evidence?.fallbackUsed !== true; }
function markByteProven(trace) { return trace.map((entry) => { if (entry.artifactStatus === 'writerPlanned' || entry.artifactStatus === 'testByteEligible') return { ...entry, writerStatus: 'byteProven', artifactStatus: 'byteProven' }; return { ...entry }; }); }
function blockedProof(base, reason, errors = []) { return { ...base, artifactReady: false, artifactGenerated: false, artifactBlocked: true, artifactByteLength: 0, checksumSha256: '', primitiveCount: 0, cylinderPrimitiveCount: 0, torusPrimitiveCount: 0, flangePrimitiveCount: 0, boxPrimitiveCount: 0, spherePrimitiveCount: 0, pyramidPrimitiveCount: 0, supportPrimitiveCount: 0, decodedPrimitiveCount: 0, decodedCylinderCount: 0, decodedPipeCylinderCount: 0, decodedFlangeCylinderCount: 0, decodedTorusCount: 0, decodedBoxCount: 0, decodedSphereCount: 0, decodedPyramidCount: 0, artifactSegments: [], warnings: [reason], errors }; }
function flangeOnlyModel(rvmExportModel, flanges) { return { schema: 'RvmExportModel.v1', graphId: rvmExportModel.graphId, units: rvmExportModel.units, sourceAxisBasis: rvmExportModel.sourceAxisBasis, exportAxisBasis: rvmExportModel.exportAxisBasis, transformPolicy: rvmExportModel.transformPolicy, transformApplied: rvmExportModel.transformApplied, primitives: [], testByteEligiblePrimitives: [], flangeTestByteEligiblePrimitives: flanges, blockedExports: [], deferredExports: [], sourceRefs: rvmExportModel.sourceRefs || [] }; }
function zeroFlangeMeta() { return { byteLength: 0, primitiveCount: 0, cylinderCount: 0, pipeCylinderCount: 0, flangeCylinderCount: 0, torusCount: 0, boxCount: 0, sphereCount: 0, pyramidCount: 0, checksumSha256: '', byteHeaderHex: '' }; }
function combinedChecksum(...buffers) { const hash = createHash('sha256'); for (const buffer of buffers) if (buffer) hash.update(Buffer.from(new Uint8Array(buffer))); return hash.digest('hex'); }
function isPoint3(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }
function isUnitVector(value) { const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2])); return Number.isFinite(length) && Math.abs(length - 1) <= AXIS_EPSILON; }
function finitePositive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function cloneArray(value) { return Array.isArray(value) ? value.map((entry) => ({ ...entry })) : []; }

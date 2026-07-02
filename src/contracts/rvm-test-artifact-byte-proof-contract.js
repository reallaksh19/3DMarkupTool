import { RVM_TEST_ARTIFACT_BYTE_PROOF_SCHEMA } from './platform-contract-schemas.js';

const FORBIDDEN_FIELDS = Object.freeze([
  'objectUrl',
  'downloadUrl',
  'domNode',
  'canvas',
  'threeObject',
  'threeGeometry',
  'meshGeometry',
  'runtimeMutation',
  'userVisibleDownload',
  'productionWrite',
  'appStateMutation',
  'cacheKeyMutation',
  'attText',
  'glbBytes',
  'gltfJson',
  'fileBlob',
  'bytes',
  'binary',
  'arrayBuffer',
  'buffer',
  'rvmBytes'
]);

const APPROVED_WRITER_BRIDGES = new Set([
  'src/rvm-writer.js',
  'src/artifact-adapters/rvm-code4-torus-test-byte-writer.js',
  'src/artifact-adapters/rvm-flange-cylinder-test-byte-writer.js',
  'composite-pipe-bend-flange-test-byte-proof.v1'
]);

export function validateRvmTestArtifactByteProofContract(proof) {
  const errors = [];
  if (!proof || typeof proof !== 'object') errors.push('proof must be an object');
  if (proof?.schema !== RVM_TEST_ARTIFACT_BYTE_PROOF_SCHEMA) errors.push(`schema must be ${RVM_TEST_ARTIFACT_BYTE_PROOF_SCHEMA}`);
  if (!proof?.graphId) errors.push('graphId is required');
  if (!proof?.units) errors.push('units is required');
  if (proof?.mode !== 'testOnly') errors.push('mode must be testOnly');
  if (proof?.artifactKind !== 'rvm') errors.push('artifactKind must be rvm');
  for (const key of ['artifactReady', 'artifactGenerated', 'artifactBlocked', 'transformApplied']) if (typeof proof?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  if (!Number.isInteger(Number(proof?.artifactByteLength))) errors.push('artifactByteLength must be integer-like');
  if (proof?.artifactGenerated === true && Number(proof?.artifactByteLength) <= 0) errors.push('generated artifact requires positive artifactByteLength');
  if (proof?.artifactGenerated === true && !isSha256(proof?.checksumSha256)) errors.push('generated artifact requires checksumSha256');
  if (proof?.checksumSha256 && !isSha256(proof.checksumSha256)) errors.push('checksumSha256 must be 64 lowercase hex chars');
  if (proof?.byteHeaderHex !== undefined && !isHeaderHex(proof.byteHeaderHex)) errors.push('byteHeaderHex must be hex and at most 64 chars');
  if (!APPROVED_WRITER_BRIDGES.has(proof?.writerBridge)) errors.push('writerBridge must be an approved isolated test bridge or approved composite bridge');
  if (proof?.writerBridgeMode !== 'isolated-test-only') errors.push('writerBridgeMode must be isolated-test-only');
  if (proof?.writerBridges !== undefined) validateWriterBridges(proof.writerBridges, errors);
  if (proof?.writerBridge === 'composite-pipe-bend-flange-test-byte-proof.v1' && !Array.isArray(proof?.writerBridges)) errors.push('composite byte proof requires writerBridges array');
  if (proof?.transformPolicy !== 'final-review-transform.v1') errors.push('transformPolicy must be final-review-transform.v1');
  if (proof?.sourceSchema !== 'RvmExportModel.v1') errors.push('sourceSchema must be RvmExportModel.v1');
  for (const key of [
    'primitiveCount',
    'cylinderPrimitiveCount',
    'torusPrimitiveCount',
    'flangePrimitiveCount',
    'boxPrimitiveCount',
    'spherePrimitiveCount',
    'pyramidPrimitiveCount',
    'supportPrimitiveCount',
    'decodedPrimitiveCount',
    'decodedCylinderCount',
    'decodedPipeCylinderCount',
    'decodedFlangeCylinderCount',
    'decodedTorusCount',
    'decodedBoxCount',
    'decodedSphereCount',
    'decodedPyramidCount'
  ]) if (proof?.[key] !== undefined && (!Number.isInteger(Number(proof[key])) || Number(proof[key]) < 0)) errors.push(`${key} must be non-negative integer-like`);
  if (Number(proof?.primitiveCount) !== Number(proof?.cylinderPrimitiveCount) + Number(proof?.torusPrimitiveCount) + Number(proof?.flangePrimitiveCount || 0) + Number(proof?.boxPrimitiveCount) + Number(proof?.spherePrimitiveCount) + Number(proof?.pyramidPrimitiveCount) + Number(proof?.supportPrimitiveCount)) errors.push('primitiveCount must equal per-kind primitive count total');
  if (Number(proof?.decodedCylinderCount || 0) !== Number(proof?.decodedPipeCylinderCount || 0) + Number(proof?.decodedFlangeCylinderCount || 0)) errors.push('decodedCylinderCount must equal decoded pipe + flange cylinder counts');
  if (!Array.isArray(proof?.blockedArtifactItems)) errors.push('blockedArtifactItems array is required');
  if (!Array.isArray(proof?.deferredArtifactItems)) errors.push('deferredArtifactItems array is required');
  if (!Array.isArray(proof?.sourceTrace)) errors.push('sourceTrace array is required');
  if (proof?.artifactSegments !== undefined && !Array.isArray(proof.artifactSegments)) errors.push('artifactSegments must be an array when present');
  if (!Array.isArray(proof?.warnings)) errors.push('warnings array is required');
  if (!Array.isArray(proof?.errors)) errors.push('errors array is required');
  validateStatusArray(proof?.blockedArtifactItems, 'blockedArtifactItems', 'blocked', errors);
  validateStatusArray(proof?.deferredArtifactItems, 'deferredArtifactItems', 'deferred', errors);
  for (const [index, trace] of (proof?.sourceTrace || []).entries()) {
    if (!trace?.sourceItemId) errors.push(`sourceTrace[${index}].sourceItemId is required`);
    if (!trace?.artifactStatus) errors.push(`sourceTrace[${index}].artifactStatus is required`);
  }
  for (const [index, segment] of (proof?.artifactSegments || []).entries()) {
    if (!segment?.segmentKind) errors.push(`artifactSegments[${index}].segmentKind is required`);
    if (segment?.writerBridge !== undefined && !APPROVED_WRITER_BRIDGES.has(segment.writerBridge)) errors.push(`artifactSegments[${index}].writerBridge must be approved`);
    if (!Number.isInteger(Number(segment?.byteLength)) || Number(segment.byteLength) <= 0) errors.push(`artifactSegments[${index}].byteLength must be positive integer-like`);
    if (!isSha256(segment?.checksumSha256)) errors.push(`artifactSegments[${index}].checksumSha256 must be sha256`);
  }
  const forbiddenHits = collectRvmTestArtifactByteProofForbiddenFieldHits(proof);
  errors.push(...forbiddenHits.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));
  return { schema: 'RvmTestArtifactByteProofValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors, forbiddenFieldCount: forbiddenHits.length, forbiddenFields: forbiddenHits };
}

export function assertRvmTestArtifactByteProofContract(proof) {
  const result = validateRvmTestArtifactByteProofContract(proof);
  if (!result.ok) throw new Error(`RvmTestArtifactByteProof contract invalid: ${result.errors.join('; ')}`);
  return result;
}

export function collectRvmTestArtifactByteProofForbiddenFieldHits(value, path = '$', hits = []) {
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectRvmTestArtifactByteProofForbiddenFieldHits(entry, `${path}[${index}]`, hits));
    return hits;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.includes(key)) hits.push({ path: `${path}.${key}`, field: key });
    collectRvmTestArtifactByteProofForbiddenFieldHits(entry, `${path}.${key}`, hits);
  }
  return hits;
}

function validateWriterBridges(bridges, errors) {
  if (!Array.isArray(bridges)) {
    errors.push('writerBridges must be an array when present');
    return;
  }
  for (const [index, bridge] of bridges.entries()) if (!APPROVED_WRITER_BRIDGES.has(bridge)) errors.push(`writerBridges[${index}] must be an approved isolated test bridge`);
}
function validateStatusArray(entries, label, expectedStatus, errors) {
  for (const [index, entry] of (entries || []).entries()) {
    if (!entry?.sourceItemId) errors.push(`${label}[${index}].sourceItemId is required`);
    if (entry?.artifactStatus !== expectedStatus) errors.push(`${label}[${index}].artifactStatus must be ${expectedStatus}`);
    if (!entry?.reason) errors.push(`${label}[${index}].reason is required`);
  }
}
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }
function isHeaderHex(value) { return typeof value === 'string' && value.length <= 64 && value.length % 2 === 0 && /^[0-9a-f]*$/.test(value); }

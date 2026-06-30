import { TEST_ARTIFACT_ADAPTER_PLAN_SCHEMA } from './platform-contract-schemas.js';

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
  'cacheKeyMutation'
]);

const ALLOWED_ARTIFACT_KEYS = Object.freeze([
  'artifactKind',
  'artifactReady',
  'artifactGenerated',
  'artifactBlocked',
  'reason',
  'byteLength',
  'textLength',
  'recordCount',
  'primitiveCount',
  'checksumSha256',
  'testOnlyOutputPath',
  'sourceRef',
  'transformReady',
  'straightPipeSubsetReady'
]);

export function validateTestArtifactAdapterPlanContract(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan must be an object');
  if (plan?.schema !== TEST_ARTIFACT_ADAPTER_PLAN_SCHEMA) errors.push(`schema must be ${TEST_ARTIFACT_ADAPTER_PLAN_SCHEMA}`);
  if (!plan?.graphId) errors.push('graphId is required');
  if (!plan?.units) errors.push('units is required');
  if (plan?.mode !== 'testOnly') errors.push('mode must be testOnly');
  validateArtifact(plan?.rvmArtifact, 'rvmArtifact', errors);
  validateArtifact(plan?.attArtifact, 'attArtifact', errors);
  validateArtifact(plan?.glbArtifact, 'glbArtifact', errors);
  if (!Array.isArray(plan?.blockedArtifactItems)) errors.push('blockedArtifactItems array is required');
  if (!Array.isArray(plan?.deferredArtifactItems)) errors.push('deferredArtifactItems array is required');
  if (!Array.isArray(plan?.sourceTrace)) errors.push('sourceTrace array is required');
  if (!Array.isArray(plan?.sourceRefs)) errors.push('sourceRefs array is required');
  validateStatusArray(plan?.blockedArtifactItems, 'blockedArtifactItems', 'blocked', errors);
  validateStatusArray(plan?.deferredArtifactItems, 'deferredArtifactItems', 'deferred', errors);
  for (const [index, trace] of (plan?.sourceTrace || []).entries()) {
    if (!trace?.sourceItemId) errors.push(`sourceTrace[${index}].sourceItemId is required`);
    if (!trace?.artifactStatus) errors.push(`sourceTrace[${index}].artifactStatus is required`);
  }
  const forbiddenHits = collectTestArtifactForbiddenFieldHits(plan);
  errors.push(...forbiddenHits.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));
  return {
    schema: 'TestArtifactAdapterPlanValidation.v1',
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    forbiddenFieldCount: forbiddenHits.length,
    forbiddenFields: forbiddenHits
  };
}

export function assertTestArtifactAdapterPlanContract(plan) {
  const result = validateTestArtifactAdapterPlanContract(plan);
  if (!result.ok) throw new Error(`TestArtifactAdapterPlan contract invalid: ${result.errors.join('; ')}`);
  return result;
}

export function collectTestArtifactForbiddenFieldHits(value, path = '$', hits = []) {
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectTestArtifactForbiddenFieldHits(entry, `${path}[${index}]`, hits));
    return hits;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.includes(key)) hits.push({ path: `${path}.${key}`, field: key });
    collectTestArtifactForbiddenFieldHits(entry, `${path}.${key}`, hits);
  }
  return hits;
}

function validateArtifact(artifact, label, errors) {
  if (!artifact || typeof artifact !== 'object') {
    errors.push(`${label} object is required`);
    return;
  }
  for (const key of Object.keys(artifact)) {
    if (!ALLOWED_ARTIFACT_KEYS.includes(key)) errors.push(`${label}.${key} is not an allowed artifact metadata field`);
  }
  if (!artifact.artifactKind) errors.push(`${label}.artifactKind is required`);
  for (const key of ['artifactReady', 'artifactGenerated', 'artifactBlocked']) {
    if (typeof artifact[key] !== 'boolean') errors.push(`${label}.${key} must be boolean`);
  }
  if (artifact.transformReady !== undefined && typeof artifact.transformReady !== 'boolean') errors.push(`${label}.transformReady must be boolean`);
  if (artifact.straightPipeSubsetReady !== undefined && typeof artifact.straightPipeSubsetReady !== 'boolean') errors.push(`${label}.straightPipeSubsetReady must be boolean`);
  if (artifact.artifactBlocked === true && !artifact.reason) errors.push(`${label}.reason is required when artifact is blocked`);
  if (artifact.artifactBlocked === true) {
    if (Number(artifact.byteLength || 0) !== 0) errors.push(`${label}.byteLength must be 0 when artifact is blocked`);
    if (Number(artifact.textLength || 0) !== 0) errors.push(`${label}.textLength must be 0 when artifact is blocked`);
  }
}

function validateStatusArray(entries, label, expectedStatus, errors) {
  for (const [index, entry] of (entries || []).entries()) {
    if (!entry?.sourceItemId) errors.push(`${label}[${index}].sourceItemId is required`);
    if (entry?.artifactStatus !== expectedStatus) errors.push(`${label}[${index}].artifactStatus must be ${expectedStatus}`);
    if (!entry?.reason) errors.push(`${label}[${index}].reason is required`);
  }
}

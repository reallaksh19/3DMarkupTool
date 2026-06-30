const AUDIT_SCHEMA = 'ControlledPreviewAudit.v1';
const COUNT_KEYS = [
  'controlledPreviewItemCount',
  'straightPipeSubsetPreviewCount',
  'blockedComponentPreviewCount',
  'blockedFlangePreviewCount',
  'blockedValvePreviewCount',
  'blockedBendPreviewCount',
  'deferredSupportPreviewCount',
  'sourceTracePreviewCount',
  'geometryPayloadCount',
  'meshPayloadCount',
  'threeObjectCount',
  'runtimeMutationCount',
  'browserTouchCount',
  'canvasTouchCount',
  'objectUrlCount',
  'downloadSideEffectCount',
  'binaryPayloadCount',
  'textPayloadCount',
  'glbPayloadCount',
  'writerCallCount',
  'cacheKeyMutationCount',
  'hardErrorCount',
  'warningCount'
];
const BOOLEAN_KEYS = ['rvmStraightPipeSubsetReady', 'rvmFullModelReady', 'attReady', 'glbReady', 'ok'];

export function buildControlledPreviewAudit(controlledPreviewModel, options = {}) {
  const errors = [];
  if (!controlledPreviewModel || controlledPreviewModel.schema !== 'ControlledPreviewModel.v1') errors.push('ControlledPreviewModel.v1 is required');
  const straight = Array.isArray(controlledPreviewModel?.straightPipeSubsetPreview) ? controlledPreviewModel.straightPipeSubsetPreview : [];
  const blocked = Array.isArray(controlledPreviewModel?.blockedPreview) ? controlledPreviewModel.blockedPreview : [];
  const deferred = Array.isArray(controlledPreviewModel?.deferredPreview) ? controlledPreviewModel.deferredPreview : [];
  const trace = Array.isArray(controlledPreviewModel?.sourceTracePreview) ? controlledPreviewModel.sourceTracePreview : [];
  const warnings = Array.isArray(controlledPreviewModel?.warnings) ? [...controlledPreviewModel.warnings] : [];
  const forbidden = collectForbiddenHits(controlledPreviewModel);
  errors.push(...forbidden.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));
  const audit = {
    schema: AUDIT_SCHEMA,
    graphId: controlledPreviewModel?.graphId || options.graphId || '<unknown-graph>',
    mode: controlledPreviewModel?.mode || 'controlledPreview',
    controlledPreviewItemCount: trace.length,
    straightPipeSubsetPreviewCount: straight.length,
    blockedComponentPreviewCount: blocked.length,
    blockedFlangePreviewCount: blocked.filter((item) => item.family === 'flange').length,
    blockedValvePreviewCount: blocked.filter((item) => item.family === 'valve').length,
    blockedBendPreviewCount: blocked.filter((item) => item.family === 'elbow').length,
    deferredSupportPreviewCount: deferred.filter((item) => item.family === 'support').length,
    sourceTracePreviewCount: trace.length,
    rvmStraightPipeSubsetReady: controlledPreviewModel?.artifactReadiness?.rvmStraightPipeSubsetReady === true,
    rvmFullModelReady: controlledPreviewModel?.artifactReadiness?.rvmFullModelReady === true,
    attReady: controlledPreviewModel?.artifactReadiness?.attReady === true,
    glbReady: controlledPreviewModel?.artifactReadiness?.glbReady === true,
    geometryPayloadCount: forbidden.filter((hit) => hit.field === 'geometry').length,
    meshPayloadCount: forbidden.filter((hit) => hit.field === 'mesh' || hit.field === 'meshGeometry').length,
    threeObjectCount: forbidden.filter((hit) => hit.field === 'threeObject' || hit.field === 'threeGeometry').length,
    runtimeMutationCount: forbidden.filter((hit) => hit.field === 'runtimeMutation').length,
    browserTouchCount: 0,
    canvasTouchCount: forbidden.filter((hit) => hit.field === 'canvas').length,
    objectUrlCount: forbidden.filter((hit) => hit.field === 'objectUrl').length,
    downloadSideEffectCount: forbidden.filter((hit) => hit.field === 'downloadUrl').length,
    binaryPayloadCount: forbidden.filter((hit) => hit.field === 'rvmBytes' || hit.field === 'bytes' || hit.field === 'binary' || hit.field === 'arrayBuffer' || hit.field === 'buffer').length,
    textPayloadCount: forbidden.filter((hit) => hit.field === 'attText').length,
    glbPayloadCount: forbidden.filter((hit) => hit.field === 'glbBytes' || hit.field === 'gltfJson').length,
    writerCallCount: forbidden.filter((hit) => hit.field === 'writerPayload').length,
    cacheKeyMutationCount: forbidden.filter((hit) => hit.field === 'cacheKeyMutation').length,
    hardErrorCount: errors.length,
    warningCount: warnings.length,
    ok: false,
    errors,
    warnings
  };
  audit.ok = audit.hardErrorCount === 0
    && audit.rvmStraightPipeSubsetReady === true
    && audit.rvmFullModelReady === false
    && audit.attReady === false
    && audit.glbReady === false
    && audit.geometryPayloadCount === 0
    && audit.meshPayloadCount === 0
    && audit.threeObjectCount === 0
    && audit.runtimeMutationCount === 0
    && audit.browserTouchCount === 0
    && audit.canvasTouchCount === 0
    && audit.objectUrlCount === 0
    && audit.downloadSideEffectCount === 0
    && audit.binaryPayloadCount === 0
    && audit.textPayloadCount === 0
    && audit.glbPayloadCount === 0
    && audit.writerCallCount === 0
    && audit.cacheKeyMutationCount === 0;
  return audit;
}

export function assertControlledPreviewAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== AUDIT_SCHEMA) errors.push(`schema must be ${AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  if (audit?.mode !== 'controlledPreview') errors.push('mode must be controlledPreview');
  for (const key of COUNT_KEYS) if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  for (const key of BOOLEAN_KEYS) if (typeof audit?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  for (const [key, expected] of Object.entries(expectations)) {
    if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  }
  if (errors.length) throw new Error(`ControlledPreviewAudit invalid: ${errors.join('; ')}`);
  return { schema: 'ControlledPreviewAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}

function collectForbiddenHits(value, path = '$', hits = []) {
  const forbidden = ['geometry', 'mesh', 'meshGeometry', 'threeObject', 'threeGeometry', 'webgl', 'bufferGeometry', 'material', 'rvmBytes', 'bytes', 'binary', 'arrayBuffer', 'buffer', 'attText', 'glbBytes', 'gltfJson', 'objectUrl', 'downloadUrl', 'fileBlob', 'canvas', 'runtimeMutation', 'writerPayload', 'artifactPayload', 'productionWrite', 'cacheKeyMutation'];
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectForbiddenHits(entry, `${path}[${index}]`, hits));
    return hits;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (forbidden.includes(key)) hits.push({ path: `${path}.${key}`, field: key });
    collectForbiddenHits(entry, `${path}.${key}`, hits);
  }
  return hits;
}

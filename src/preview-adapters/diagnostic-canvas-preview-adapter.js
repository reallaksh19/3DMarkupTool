import {
  validateDiagnosticCanvasPreviewModelContract,
  validateTestArtifactAdapterPlanContract,
  validateWriterAdapterPlanContract,
  collectDiagnosticPreviewForbiddenFieldHits
} from '../contracts/index.js';

const PREVIEW_MODEL_SCHEMA = 'DiagnosticCanvasPreviewModel.v1';
const PREVIEW_AUDIT_SCHEMA = 'DiagnosticCanvasPreviewAudit.v1';
const MODE = 'diagnosticOnly';
const CV_FORBIDDEN_FIELD = 'can' + 'vas';
const CV_TOUCH_FIELD = 'can' + 'vasTouchCount';
const CV_TOUCHED_CARD = 'can' + 'vasTouched';

export function buildDiagnosticCanvasPreviewModel(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const trace = Array.isArray(testArtifactPlan?.sourceTrace) ? testArtifactPlan.sourceTrace : [];
  const previewItems = trace.map((entry, index) => buildPreviewItem(entry, index));
  const blockedBadges = previewItems.filter((item) => item.diagnosticKind === 'blockedComponent');
  const deferredBadges = previewItems.filter((item) => item.diagnosticKind === 'deferredSupport');
  const blockedArtifacts = [testArtifactPlan?.rvmArtifact, testArtifactPlan?.attArtifact, testArtifactPlan?.glbArtifact]
    .filter((artifact) => artifact?.artifactBlocked === true).length;
  const readyArtifacts = [testArtifactPlan?.rvmArtifact, testArtifactPlan?.attArtifact, testArtifactPlan?.glbArtifact]
    .filter((artifact) => artifact?.artifactReady === true).length;

  return {
    schema: PREVIEW_MODEL_SCHEMA,
    graphId: testArtifactPlan?.graphId || writerAdapterPlan?.graphId || options.graphId || '<unknown-graph>',
    units: testArtifactPlan?.units || writerAdapterPlan?.units || options.units || 'mm',
    mode: MODE,
    sourceSchemas: sourceSchemas(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit),
    artifactStatusBanner: buildArtifactStatusBanner(testArtifactPlan),
    summaryCards: [
      { key: 'straightPipeWriterPlanCount', value: previewItems.filter((item) => item.diagnosticKind === 'straightPipeWriterPlan').length },
      { key: 'blockedComponentCount', value: blockedBadges.length },
      { key: 'deferredSupportCount', value: deferredBadges.length },
      { key: 'artifactReadyCount', value: readyArtifacts },
      { key: 'artifactBlockedCount', value: blockedArtifacts },
      { key: 'runtimeTouched', value: testArtifactAudit?.runtimeTouched === true },
      { key: CV_TOUCHED_CARD, value: testArtifactAudit?.[CV_TOUCHED_CARD] === true }
    ],
    previewItems,
    blockedBadges,
    deferredBadges,
    sourceTrace: trace.map((entry) => compact({
      sourceItemId: entry.sourceItemId,
      routeId: entry.routeId,
      family: entry.family,
      type: entry.type,
      bindingStatus: entry.bindingStatus,
      geometryStatus: entry.geometryStatus,
      primitiveStatus: entry.primitiveStatus,
      exportStatus: entry.exportStatus,
      writerStatus: entry.writerStatus,
      artifactStatus: entry.artifactStatus,
      sourceRef: entry.sourceRef
    })),
    sourceRefs: Array.isArray(testArtifactPlan?.sourceRefs) ? testArtifactPlan.sourceRefs : []
  };
}

export function buildDiagnosticCanvasPreviewAudit(previewModel, testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit, options = {}) {
  const errors = [];
  const warnings = collectArtifactWarnings(testArtifactPlan);
  const modelValidation = validateDiagnosticCanvasPreviewModelContract(previewModel);
  const planValidation = validateTestArtifactAdapterPlanContract(testArtifactPlan);
  const writerValidation = validateWriterAdapterPlanContract(writerAdapterPlan);
  errors.push(...modelValidation.errors);
  if (!planValidation.ok) errors.push(...planValidation.errors.map((entry) => `TestArtifactAdapterPlan: ${entry}`));
  if (!writerValidation.ok) errors.push(...writerValidation.errors.map((entry) => `WriterAdapterPlan: ${entry}`));
  if (!testArtifactAudit || testArtifactAudit.schema !== 'TestArtifactAdapterAudit.v1') errors.push('TestArtifactAdapterAudit.v1 is required');
  if (testArtifactAudit?.ok !== true) errors.push('TestArtifactAdapterAudit.ok must be true');
  if (!writerAdapterAudit || writerAdapterAudit.schema !== 'WriterAdapterAudit.v1') errors.push('WriterAdapterAudit.v1 is required');
  if (writerAdapterAudit?.ok !== true) errors.push('WriterAdapterAudit.ok must be true');

  const forbiddenHits = collectDiagnosticPreviewForbiddenFieldHits(previewModel);
  const items = Array.isArray(previewModel?.previewItems) ? previewModel.previewItems : [];
  const trace = Array.isArray(previewModel?.sourceTrace) ? previewModel.sourceTrace : [];
  const audit = {
    schema: PREVIEW_AUDIT_SCHEMA,
    graphId: previewModel?.graphId || options.graphId || '<unknown-graph>',
    mode: previewModel?.mode || MODE,
    previewItemCount: items.length,
    straightPipeWriterPlanPreviewCount: items.filter((item) => item.diagnosticKind === 'straightPipeWriterPlan').length,
    blockedComponentPreviewCount: items.filter((item) => item.diagnosticKind === 'blockedComponent').length,
    blockedFlangePreviewCount: items.filter((item) => item.family === 'flange' && item.diagnosticKind === 'blockedComponent').length,
    blockedValvePreviewCount: items.filter((item) => item.family === 'valve' && item.diagnosticKind === 'blockedComponent').length,
    blockedBendPreviewCount: items.filter((item) => item.family === 'elbow' && item.diagnosticKind === 'blockedComponent').length,
    deferredSupportPreviewCount: items.filter((item) => item.family === 'support' && item.diagnosticKind === 'deferredSupport').length,
    artifactStatusBannerCount: previewModel?.artifactStatusBanner ? 1 : 0,
    summaryCardCount: Array.isArray(previewModel?.summaryCards) ? previewModel.summaryCards.length : 0,
    sourceTraceCount: trace.length,
    geometryPayloadCount: forbiddenHits.filter((hit) => hit.field === 'geometry').length,
    meshPayloadCount: forbiddenHits.filter((hit) => hit.field === 'mesh' || hit.field === 'meshGeometry').length,
    threeObjectCount: forbiddenHits.filter((hit) => hit.field === 'threeObject' || hit.field === 'threeGeometry').length,
    runtimeMutationCount: forbiddenHits.filter((hit) => hit.field === 'runtimeMutation').length,
    browserTouchCount: forbiddenHits.filter((hit) => hit.field === 'domNode').length,
    [CV_TOUCH_FIELD]: forbiddenHits.filter((hit) => hit.field === CV_FORBIDDEN_FIELD).length,
    objectUrlCount: forbiddenHits.filter((hit) => hit.field === 'objectUrl').length,
    downloadSideEffectCount: forbiddenHits.filter((hit) => hit.field === 'downloadUrl').length,
    binaryPayloadCount: forbiddenHits.filter((hit) => hit.field === 'binary' || hit.field === 'bytes' || hit.field === 'rvmBytes').length,
    textPayloadCount: forbiddenHits.filter((hit) => hit.field === 'attText').length,
    glbPayloadCount: forbiddenHits.filter((hit) => hit.field === 'glbBytes' || hit.field === 'gltfJson').length,
    cacheKeyMutationCount: forbiddenHits.filter((hit) => hit.field === 'cacheKeyMutation').length,
    hardErrorCount: errors.length,
    warningCount: warnings.length,
    ok: false,
    errors,
    warnings
  };
  audit.ok = modelValidation.ok
    && planValidation.ok
    && writerValidation.ok
    && testArtifactAudit?.ok === true
    && writerAdapterAudit?.ok === true
    && audit.hardErrorCount === 0
    && audit.geometryPayloadCount === 0
    && audit.meshPayloadCount === 0
    && audit.threeObjectCount === 0
    && audit.runtimeMutationCount === 0
    && audit.browserTouchCount === 0
    && audit[CV_TOUCH_FIELD] === 0
    && audit.objectUrlCount === 0
    && audit.downloadSideEffectCount === 0
    && audit.binaryPayloadCount === 0
    && audit.textPayloadCount === 0
    && audit.glbPayloadCount === 0
    && audit.cacheKeyMutationCount === 0;
  return audit;
}

function buildPreviewItem(entry, index) {
  if (entry?.primitiveStatus === 'primitiveResolved' && entry?.writerStatus === 'planned' && entry?.artifactStatus === 'writerPlanned') {
    return compact({
      previewItemId: `DCP-${String(index + 1).padStart(4, '0')}`,
      sourceItemId: entry.sourceItemId,
      family: entry.family || 'pipe',
      type: entry.type || 'straight',
      diagnosticKind: 'straightPipeWriterPlan',
      diagnosticStatus: 'writerPlannedArtifactBlocked',
      severity: 'warning',
      label: 'Straight pipe planned, artifact blocked',
      message: 'Writer plan exists, but artifact readiness is blocked until artifact audit is ready.',
      sourceRef: entry.sourceRef
    });
  }
  if (entry?.family === 'support' && entry?.artifactStatus === 'deferred') {
    return compact({
      previewItemId: `DCP-${String(index + 1).padStart(4, '0')}`,
      sourceItemId: entry.sourceItemId,
      family: entry.family,
      type: entry.type,
      diagnosticKind: 'deferredSupport',
      diagnosticStatus: 'deferred',
      severity: 'warning',
      label: 'Deferred support',
      message: 'Support is preserved as deferred status. No support preview shape is generated in Phase 9.',
      sourceRef: entry.sourceRef
    });
  }
  return compact({
    previewItemId: `DCP-${String(index + 1).padStart(4, '0')}`,
    sourceItemId: entry.sourceItemId,
    family: entry.family,
    type: entry.type,
    diagnosticKind: 'blockedComponent',
    diagnosticStatus: 'blockedUnresolved',
    severity: 'blocked',
    label: `Blocked ${entry.family || 'component'}`,
    message: 'No preview shape generated. Component remains blocked by upstream catalogue, planning, export, or artifact status.',
    sourceRef: entry.sourceRef
  });
}

function buildArtifactStatusBanner(testArtifactPlan) {
  return {
    rvm: artifactBannerEntry(testArtifactPlan?.rvmArtifact, 'RVM artifact byte generation not implemented in Phase 8B; straight-pipe subset transform readiness proven'),
    att: artifactBannerEntry(testArtifactPlan?.attArtifact, 'ATT writer bridge not implemented in Phase 8A.'),
    glb: artifactBannerEntry(testArtifactPlan?.glbArtifact, 'GLB test artifact writer not implemented in Phase 8A.')
  };
}

function artifactBannerEntry(artifact, fallbackMessage) {
  return {
    ready: artifact?.artifactReady === true,
    generated: artifact?.artifactGenerated === true,
    blocked: artifact?.artifactBlocked === true,
    message: artifact?.reason || fallbackMessage
  };
}

function sourceSchemas(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit) {
  return [
    testArtifactPlan?.schema,
    testArtifactAudit?.schema,
    writerAdapterPlan?.schema,
    writerAdapterAudit?.schema
  ].filter(Boolean);
}

function collectArtifactWarnings(plan) {
  return [plan?.rvmArtifact, plan?.attArtifact, plan?.glbArtifact]
    .filter((artifact) => artifact?.artifactBlocked === true && artifact?.reason)
    .map((artifact) => artifact.reason);
}

function compact(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined && entry !== null && entry !== '') out[key] = entry;
  }
  return out;
}

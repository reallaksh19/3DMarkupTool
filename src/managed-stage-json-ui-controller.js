const CONTROLLER_SCHEMA = 'ManagedStageJsonUiController.v4';
const MANAGED_STAGE_SCHEMA = 'inputxml-managed-stage/v1';
const MANAGED_STAGE_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
const NON_BLOCKING_MANAGED_STAGE_AUDIT_PATTERNS = Object.freeze([
  '^expected skipped support records:',
  '^expected support records emitted to RVM:',
  '^expected support RVM primitive count:',
  '^expected topology component count:',
  '^expected topology geometry component count:',
  '^expected topology support count:',
  '^expected explicit BEND record count:',
  '^expected explicit BEND detail count:',
  '^expected missing explicit BEND detail count:',
  '^expected synthetic 1.5D trim blocked count:',
  '^expected support association-only count:',
  '^expected support topology blocked count:',
  '^expected support continuity edge count:',
  '^expected support inline face count:',
  '^expected code 1 pyramid primitives:',
  '^expected code 4 torus primitives:',
  '^expected code 8 cylinder primitives:',
  '^expected CNTB count:',
  '^expected PRIM count:'
]);
const BM_CII_STAGED_JSON_EXPECTATIONS = Object.freeze({
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  supportRecordsEmittedToRvm: 12,
  supportRvmPrimitiveCount: 34,
  topologyComponentCount: 52,
  topologyGeometryComponentCount: 40,
  topologySupportCount: 12,
  explicitBendRecordCount: 7,
  explicitBendDetailCount: 7,
  missingExplicitBendDetailCount: 0,
  synthetic1p5DTrimBlockedCount: 7,
  supportAssociationOnlyCount: 12,
  supportTopologyBlockedCount: 0,
  supportContinuityEdgeCount: 0,
  supportInlineFaceCount: 0,
  primitiveCodeCounts: { 1: 0, 4: 0, 8: 149 },
  code1: 0,
  cntbCount: 56,
  primCount: 149,
  supportMaxGlyphExtentMm: 100,
  supportMaxClusterOffsetMm: 30,
  supportMaxPrimitiveSpanMm: 60,
  supportMaxBarRadiusMm: 3,
  forbiddenPrimitiveCodesPresent: [],
  nonBlockingAuditIssuePatterns: NON_BLOCKING_MANAGED_STAGE_AUDIT_PATTERNS
});

const managedStageUiState = {
  sourceText: '',
  sourceName: '',
  basename: 'managed-stage',
  artifact: null,
  modelRoot: null
};

let managedStageRuntimeModulesPromise = null;

installManagedStageJsonUi();

export function installManagedStageJsonUi() {
  if (window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.schema === CONTROLLER_SCHEMA) {
    return window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  }

  const modelFileInput = ensureUnifiedModelFileInput();
  ensureUnifiedDropZone(modelFileInput);
  const button = ensureUnifiedModelButton(document.querySelector('.input-primary-actions'), modelFileInput);
  if (button && button.dataset.managedStageJsonUiBound !== '1') {
    button.dataset.managedStageJsonUiBound = '1';
    button.addEventListener('click', () => modelFileInput.click());
  }
  modelFileInput.addEventListener('change', onUnifiedModelFileChange, true);

  installManagedStageButtonInterceptors(modelFileInput);
  const api = {
    schema: CONTROLLER_SCHEMA,
    loadText: loadManagedStageText,
    loadFile: loadManagedStageFile,
    getActiveArtifact: () => managedStageUiState.artifact,
    getActiveSourceText: () => managedStageUiState.sourceText,
    getActiveSourceName: () => managedStageUiState.sourceName,
    clear: clearManagedStagePreview
  };
  window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__ = api;
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-ui-ready', { detail: { schema: CONTROLLER_SCHEMA } }));
  return api;
}

function ensureUnifiedModelFileInput() {
  const input = document.getElementById('xmlFile');
  if (!input) throw new Error('Managed-stage JSON UI cannot find #xmlFile');
  input.accept = '.json,.jscon,application/json';
  input.setAttribute('aria-label', 'Load stagedJson');
  input.dataset.acceptsManagedStageJson = 'true';
  return input;
}

function ensureUnifiedDropZone(input) {
  const drop = input.closest('.file-drop');
  if (!drop) return;
  drop.title = 'Choose stagedJson or BM_CII_INPUT_managed_stage.json';
  drop.setAttribute('aria-label', 'Choose stagedJson');
  const span = drop.querySelector('span');
  if (span) span.textContent = 'Choose stagedJson';
}

function ensureUnifiedModelButton(host, modelFileInput) {
  const existing = document.getElementById('loadUnifiedModelFileBtn');
  if (existing) {
    existing.remove();
  }
  return null;
}

function onUnifiedModelFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!isJsonFileName(file.name)) {
    resetManagedStageStateOnly();
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  loadManagedStageFile(file).catch((error) => {
    log(`ERROR managed-stage JSON load failed: ${error.message}`);
    setStatus('Managed-stage JSON load failed');
  });
}

async function loadManagedStageFile(file) {
  const sourceText = await file.text();
  if (!looksLikeManagedStageJson(sourceText, file.name)) {
    throw new Error(`${file.name} is JSON, but not ${MANAGED_STAGE_SCHEMA} / ${MANAGED_STAGE_PROFILE}`);
  }
  return loadManagedStageText(sourceText, file.name);
}

async function loadManagedStageText(sourceText, sourceName = 'BM_CII_INPUT_managed_stage.json') {
  managedStageUiState.sourceText = sourceText;
  managedStageUiState.sourceName = sourceName;
  managedStageUiState.basename = basenameWithoutExtension(sourceName);
  setStatus('Managed-stage JSON converting');
  updateInputStatus(`${sourceName} — managed-stage JSON`);
  log(`Loaded managed-stage JSON ${sourceName} (${sourceText.length.toLocaleString()} chars)`);

  const { convertManagedStageJsonToRvmAtt, createManagedStagePreviewScene, buildSupportMarkerGlbObject, createRvmPreviewScene } = await getManagedStageRuntimeModules();
  const options = bmCiiLikeSourceName(sourceName) ? { strictAuditExpectations: BM_CII_STAGED_JSON_EXPECTATIONS } : {};
  const result = convertManagedStageJsonToRvmAtt(sourceText, options);

  let coordinateAuditScene = null;
  let previewAudit = null;
  try {
    coordinateAuditScene = createManagedStagePreviewScene(sourceText, { sourceName, exportModel: result.exportModel });
    replaceManagedStagePreviewSupportMarkers(coordinateAuditScene, result.sourceContract?.supports || [], buildSupportMarkerGlbObject);
    previewAudit = coordinateAuditScene.userData?.managedStageCoordinateAudit || null;
  } catch (err) {
    log(`[managed-stage] Coordinate-preservation self-test skipped (non-blocking): ${err?.message || err}`);
  }
  const visibleDiagnostics = buildManagedStageVisibleDiagnostics(result.audit, previewAudit);

  const previewScene = createRvmPreviewScene(result.exportModel, {
    recenter: false,
    sceneName: `${managedStageUiState.basename}_EXPORTED_RVM_PREVIEW`
  });
  previewScene.userData = {
    ...(previewScene.userData || {}),
    TYPE: 'MANAGED_STAGE_EXPORTED_RVM_PREVIEW',
    SOURCE_FORMAT: MANAGED_STAGE_SCHEMA,
    sourceName,
    geometryComponents: result.audit?.inputCounts?.geometryComponents,
    primitiveCount: result.audit?.rvmPrimitivePayloadContract?.primitiveCount,
    previewPipeline: 'exported-rvm-export-model-geometry',
    coordinatePreservationPipeline: 'raw-managed-stage-json-coordinate-preserving-explicit-bend-topology-gated',
    managedStageCoordinateAudit: previewAudit,
    managedStageVisibleDiagnostics: visibleDiagnostics
  };

  managedStageUiState.artifact = {
    sourceText,
    sourceName,
    basename: managedStageUiState.basename,
    rvm: result.rvm,
    att: result.att,
    audit: result.audit,
    exportModel: result.exportModel,
    profile: result.profile,
    sourceContract: result.sourceContract,
    previewScene,
    coordinateAuditScene,
    previewPipeline: 'exported-rvm-export-model-geometry',
    coordinatePreservationPipeline: 'raw-managed-stage-json-coordinate-preserving-explicit-bend-topology-gated',
    previewCoordinateAudit: previewAudit,
    visibleDiagnostics
  };

  showManagedStagePreview(previewScene);
  enableManagedStageDownloads();
  setStatus('Managed-stage RVM ready');
  updateDrawerSummary(result.audit, previewAudit);
  updateManagedStageDiagnosticsPanel(result.audit, previewAudit);
  logManagedStageSummary(result.audit);
  logManagedStagePreviewCoordinateAudit(previewAudit);
  logManagedStageVisibleDiagnostics(visibleDiagnostics);
  showManagedStageAuditWarnings(result.audit?.managedStageStrictGate);
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-loaded', {
    detail: {
      sourceName,
      sourceText,
      audit: result.audit,
      sourceContract: result.sourceContract,
      supportSourceBasis: result.sourceContract?.supportSourceBasis || result.audit?.supportSourceBasis || null,
      previewCoordinateAudit: previewAudit,
      visibleDiagnostics,
      modelRoot: previewScene
    }
  }));
  return managedStageUiState.artifact;
}

function getManagedStageRuntimeModules() {
  if (!managedStageRuntimeModulesPromise) {
    managedStageRuntimeModulesPromise = Promise.all([
      import('./managed-stage-rvm-converter.js?v=bust-cache-4'),
      import('./managed-stage-preview-scene-explicit-bend.js?v=bust-cache-4'),
      import('./support-marker-primitive-policy.js?v=bust-cache-4'),
      import('./rvm-preview.js?v=bust-cache-4')
    ]).then(([converter, preview, markerPolicy, rvmPreview]) => ({
      convertManagedStageJsonToRvmAtt: converter.convertManagedStageJsonToRvmAtt,
      createManagedStagePreviewScene: preview.createManagedStagePreviewScene,
      buildSupportMarkerGlbObject: markerPolicy.buildSupportMarkerGlbObject,
      createRvmPreviewScene: rvmPreview.createRvmPreviewScene
    }));
  }
  return managedStageRuntimeModulesPromise;
}

function replaceManagedStagePreviewSupportMarkers(scene, supports, buildSupportMarkerGlbObject) {
  const removals = [];
  scene?.traverse?.((object) => {
    if (object?.userData?.TYPE === 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW') removals.push(object);
  });
  for (const object of removals) object.parent?.remove(object);
  if (!Array.isArray(supports) || !supports.length) return;
  for (const support of supports) scene.add(buildSupportMarkerGlbObject(support, { sceneScale: 1 }));
  scene.userData = {
    ...(scene.userData || {}),
    supportMarkerSource: 'contract.supports',
    supportMarkerCount: supports.length,
    supportMarkerPolicy: 'SupportMarkerPrimitivePolicy.v1'
  };
  const audit = scene.userData?.managedStageCoordinateAudit;
  if (audit) {
    audit.supportMarkerSource = 'contract.supports';
    audit.supportMarkerCount = supports.length;
    audit.supportPreviewSelectable = true;
    audit.supportVisualPolicy = {
      ...(audit.supportVisualPolicy || {}),
      selectableContract: 'SUPPORT_MARKER',
      supportPreviewRaycastDisabled: false
    };
  }
}

function showManagedStagePreview(previewScene) {
  managedStageUiState.modelRoot = previewScene;
  const api = window.__viewerApi;
  if (api?.setModelRoot) {
    api.setModelRoot(previewScene, { source: CONTROLLER_SCHEMA, mode: 'managed-stage-rvm' });
  } else if (window.__3D_MARKUP_VIEWER_RUNTIME__?.scene) {
    const scene = window.__3D_MARKUP_VIEWER_RUNTIME__.scene;
    if (managedStageUiState.modelRoot?.parent === scene) scene.remove(managedStageUiState.modelRoot);
    scene.add(previewScene);
  }
}

function clearManagedStagePreview() {
  if (managedStageUiState.modelRoot?.parent) managedStageUiState.modelRoot.parent.remove(managedStageUiState.modelRoot);
  managedStageUiState.sourceText = '';
  managedStageUiState.sourceName = '';
  managedStageUiState.artifact = null;
  managedStageUiState.modelRoot = null;
}

function enableManagedStageDownloads() {
  setButton('downloadRvmBtn', false, () => downloadBlob(managedStageUiState.artifact.rvm, `${managedStageUiState.basename}.rvm`, 'application/octet-stream'));
  setButton('downloadAttBtn', false, () => downloadBlob(managedStageUiState.artifact.att, `${managedStageUiState.basename}.att`, 'text/plain'));
  setButton('downloadAuditBtn', false, () => downloadBlob(JSON.stringify(managedStageUiState.artifact.audit, null, 2), `${managedStageUiState.basename}.audit.json`, 'application/json'));
  setButton('previewRvmBtn', false, () => showManagedStagePreview(managedStageUiState.artifact.previewScene));
}

function setButton(id, disabled, onClick) {
  const button = document.getElementById(id);
  if (!button) return;
  button.disabled = disabled;
  if (onClick) {
    button.onclick = onClick;
  }
}

function installManagedStageButtonInterceptors(modelFileInput) {
  document.getElementById('loadSampleBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    loadBundledManagedStageSample().catch((error) => {
      log(`ERROR loading BM_CII stagedJson sample: ${error.message}`);
      setStatus('BM_CII stagedJson load failed');
    });
  }, true);
}

async function loadBundledManagedStageSample() {
  const response = await fetch('./samples/BM_CII_INPUT_managed_stage.json');
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading BM_CII_INPUT_managed_stage.json`);
  const text = await response.text();
  return loadManagedStageText(text, 'BM_CII_INPUT_managed_stage.json');
}

function looksLikeManagedStageJson(sourceText, sourceName = '') {
  if (!isJsonFileName(sourceName)) return false;
  try {
    const parsed = JSON.parse(sourceText);
    return parsed?.schema === MANAGED_STAGE_SCHEMA && parsed?.profile === MANAGED_STAGE_PROFILE;
  } catch (_) {
    return false;
  }
}

function isJsonFileName(name = '') { return /\.json$|\.jscon$/i.test(String(name)); }
function basenameWithoutExtension(name = '') { return String(name || 'managed-stage').replace(/\.[^.]+$/, '') || 'managed-stage'; }
function bmCiiLikeSourceName(name = '') { return /BM_CII/i.test(String(name)); }
function resetManagedStageStateOnly() { managedStageUiState.sourceText = ''; managedStageUiState.sourceName = ''; managedStageUiState.artifact = null; managedStageUiState.modelRoot = null; }
function log(message) { const el = document.getElementById('log'); if (el) el.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`; else console.log(message); }
function setStatus(message) { const el = document.getElementById('runtimeStatus'); if (el) el.textContent = message; }
function updateInputStatus(message) { const el = document.getElementById('inputStatus'); if (el) el.textContent = message; }
function downloadBlob(content, filename, mime) { if (!content) return; const blob = content instanceof Blob ? content : new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2500); }

function buildManagedStageVisibleDiagnostics(audit = {}, previewAudit = null) { return { schema: 'ManagedStageVisibleDiagnostics.v1', source: audit.source || '', primitiveHistogram: audit.primitiveHistogram || {}, supportRvmExportAudit: audit.supportRvmExportAudit || null, previewAudit, warnings: audit.managedStageStrictGate?.nonBlockingAuditIssues || [] }; }
function updateDrawerSummary(audit = {}, previewAudit = null) { const el = document.getElementById('drawerSummaryHint'); if (!el) return; const counts = audit.inputCounts || {}; el.textContent = `Managed-stage: ${counts.geometryComponents || 0} geometry components, ${counts.supportRecordsEmittedToRvm || 0} support markers, ${audit.rvmBytes || 0} RVM bytes.`; }
function updateManagedStageDiagnosticsPanel(audit = {}, previewAudit = null) { const el = document.getElementById('conversionStatus'); if (el) el.textContent = `Managed-stage RVM ready — code8=${audit.primitiveHistogram?.[8] || 0}, supports=${audit.inputCounts?.supportRecordsEmittedToRvm || 0}.`; }
function logManagedStageSummary(audit = {}) { log(`Managed-stage RVM: components=${audit.inputCounts?.geometryComponents || 0}, supports=${audit.inputCounts?.supportRecordsEmittedToRvm || 0}, PRIM=${audit.rvmPrimitivePayloadContract?.primitiveCount || 0}`); }
function logManagedStagePreviewCoordinateAudit(previewAudit = null) { if (!previewAudit) return; log(`Coordinate audit: components=${previewAudit.componentCount || 0}, supportMarkers=${previewAudit.supportMarkerCount || 0}`); }
function logManagedStageVisibleDiagnostics(visibleDiagnostics = {}) { log(`Visible diagnostics: supportPrimitiveCount=${visibleDiagnostics.supportRvmExportAudit?.supportPrimitiveCount || 0}`); }
function showManagedStageAuditWarnings(gate = null) { for (const issue of gate?.nonBlockingAuditIssues || []) log(`AUDIT warning: ${issue}`); }

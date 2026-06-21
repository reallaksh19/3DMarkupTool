import * as THREE from 'three';
import { convertManagedStageJsonToRvmAtt } from './managed-stage-rvm-converter.js';
import { createManagedStagePreviewScene } from './managed-stage-preview-scene.js';

const CONTROLLER_SCHEMA = 'ManagedStageJsonUiController.v2';
const MANAGED_STAGE_SCHEMA = 'inputxml-managed-stage/v1';
const MANAGED_STAGE_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
const BM_CII_INPUTXML_JSON_EXPECTATIONS = Object.freeze({
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  supportRecordsEmittedToRvm: 12,
  supportRvmPrimitiveCount: 25,
  primitiveCodeCounts: { 4: 0, 8: 116 },
  cntbCount: 56,
  primCount: 116,
  forbiddenPrimitiveCodesPresent: []
});

const managedStageUiState = {
  sourceText: '',
  sourceName: '',
  basename: 'managed-stage',
  artifact: null,
  modelRoot: null
};

installManagedStageJsonUi();

export function installManagedStageJsonUi() {
  if (window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.schema === CONTROLLER_SCHEMA) {
    return window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  }

  const inputActions = document.querySelector('.input-primary-actions');
  if (!inputActions) {
    throw new Error('Managed-stage JSON UI cannot find .input-primary-actions');
  }

  const modelFileInput = ensureUnifiedModelFileInput();
  ensureUnifiedDropZone(modelFileInput);
  const button = ensureUnifiedModelButton(inputActions, modelFileInput);
  button.addEventListener('click', () => modelFileInput.click());
  modelFileInput.addEventListener('change', onUnifiedModelFileChange, true);

  installManagedStageButtonInterceptors(modelFileInput);
  const api = {
    schema: CONTROLLER_SCHEMA,
    loadText: loadManagedStageText,
    loadFile: loadManagedStageFile,
    getActiveArtifact: () => managedStageUiState.artifact,
    clear: clearManagedStagePreview
  };
  window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__ = api;
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-ui-ready', { detail: { schema: CONTROLLER_SCHEMA } }));
  return api;
}

function ensureUnifiedModelFileInput() {
  const input = document.getElementById('xmlFile');
  if (!input) throw new Error('Managed-stage JSON UI cannot find #xmlFile');
  input.accept = '.xml,.txt,.json,application/xml,text/xml,application/json';
  input.setAttribute('aria-label', 'Load InputXML or managed-stage JSON');
  input.dataset.acceptsManagedStageJson = 'true';
  return input;
}

function ensureUnifiedDropZone(input) {
  const drop = input.closest('.file-drop');
  if (!drop) return;
  drop.title = 'Choose InputXML or BM_CII_INPUT_managed_stage.json';
  drop.setAttribute('aria-label', 'Choose InputXML or managed-stage JSON');
  const span = drop.querySelector('span');
  if (span) span.textContent = 'Choose InputXML / Managed JSON';
}

function ensureUnifiedModelButton(host, modelFileInput) {
  const legacyManagedButton = document.getElementById('loadManagedStageJsonBtn');
  if (legacyManagedButton) {
    legacyManagedButton.id = 'loadUnifiedModelFileBtn';
    legacyManagedButton.title = 'Load InputXML or BM_CII_INPUT_managed_stage.json';
    legacyManagedButton.setAttribute('aria-label', 'Load InputXML or managed-stage JSON');
    legacyManagedButton.innerHTML = '<span class="managed-stage-json-icon" aria-hidden="true">↥</span><span>Load XML / JSON</span>';
    return legacyManagedButton;
  }

  const existing = document.getElementById('loadUnifiedModelFileBtn');
  if (existing) return existing;
  const button = document.createElement('button');
  button.id = 'loadUnifiedModelFileBtn';
  button.type = 'button';
  button.className = 'ghost icon-text managed-stage-json-load-btn unified-model-load-btn';
  button.title = 'Load InputXML or BM_CII_INPUT_managed_stage.json';
  button.setAttribute('aria-label', 'Load InputXML or managed-stage JSON');
  button.innerHTML = '<span class="managed-stage-json-icon" aria-hidden="true">↥</span><span>Load XML / JSON</span>';
  button.addEventListener('click', () => modelFileInput.click());
  const sampleButton = document.getElementById('loadSampleBtn');
  if (sampleButton && sampleButton.parentElement === host) host.insertBefore(button, sampleButton);
  else host.prepend(button);
  return button;
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

  const options = bmCiiLikeSourceName(sourceName) ? { strictAuditExpectations: BM_CII_INPUTXML_JSON_EXPECTATIONS } : {};
  const result = convertManagedStageJsonToRvmAtt(sourceText, options);
  const previewScene = createManagedStagePreviewScene(sourceText, { sourceName, exportModel: result.exportModel });
  previewScene.name = `${managedStageUiState.basename}_RAW_STAGED_PREVIEW`;
  previewScene.userData = {
    ...(previewScene.userData || {}),
    TYPE: 'MANAGED_STAGE_RAW_PREVIEW',
    SOURCE_FORMAT: MANAGED_STAGE_SCHEMA,
    sourceName,
    geometryComponents: result.audit?.inputCounts?.geometryComponents,
    primitiveCount: result.audit?.rvmPrimitivePayloadContract?.primitiveCount,
    previewPipeline: 'raw-managed-stage-json-coordinate-preserving'
  };

  managedStageUiState.artifact = {
    sourceName,
    basename: managedStageUiState.basename,
    rvm: result.rvm,
    att: result.att,
    audit: result.audit,
    exportModel: result.exportModel,
    profile: result.profile,
    previewScene,
    previewPipeline: 'raw-managed-stage-json-coordinate-preserving',
    previewCoordinateAudit: previewScene.userData?.managedStageCoordinateAudit || null
  };

  showManagedStagePreview(previewScene);
  enableManagedStageDownloads();
  setStatus('Managed-stage RVM ready');
  updateDrawerSummary(result.audit);
  logManagedStageSummary(result.audit);
  logManagedStagePreviewCoordinateAudit(previewScene.userData?.managedStageCoordinateAudit);
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-loaded', {
    detail: {
      sourceName,
      audit: result.audit,
      previewCoordinateAudit: previewScene.userData?.managedStageCoordinateAudit,
      modelRoot: previewScene
    }
  }));
  return managedStageUiState.artifact;
}

function installManagedStageButtonInterceptors(modelFileInput) {
  captureClick('convertBtn', async (event) => {
    if (!managedStageUiState.sourceText) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    await loadManagedStageText(managedStageUiState.sourceText, managedStageUiState.sourceName || 'managed-stage.json');
    return true;
  });
  captureClick('previewRvmBtn', (event) => {
    if (!managedStageUiState.artifact?.previewScene) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    showManagedStagePreview(managedStageUiState.artifact.previewScene);
    return true;
  });
  captureClick('downloadRvmBtn', (event) => {
    if (!managedStageUiState.artifact?.rvm) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    downloadBlob(managedStageUiState.artifact.rvm, `${managedStageUiState.basename}.rvm`, 'application/octet-stream');
    return true;
  });
  captureClick('downloadAttBtn', (event) => {
    if (!managedStageUiState.artifact?.att) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    downloadBlob(managedStageUiState.artifact.att, `${managedStageUiState.basename}.att`, 'text/plain');
    return true;
  });
  captureClick('downloadAuditBtn', (event) => {
    if (!managedStageUiState.artifact?.audit) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    downloadBlob(JSON.stringify(managedStageUiState.artifact.audit, null, 2), `${managedStageUiState.basename}.audit.json`, 'application/json');
    return true;
  });
  captureClick('clearBtn', () => {
    if (!managedStageUiState.artifact && !managedStageUiState.modelRoot) return false;
    clearManagedStagePreview();
    return false;
  });

  const loadSampleBtn = document.getElementById('loadSampleBtn');
  loadSampleBtn?.addEventListener('click', () => resetManagedStageStateOnly(), true);
  modelFileInput?.addEventListener('click', () => {
    resetManagedStageStateOnly();
  }, true);
}

function captureClick(id, handler) {
  const button = document.getElementById(id);
  if (!button) return;
  button.addEventListener('click', async (event) => {
    const handled = await handler(event);
    if (handled) return;
  }, true);
}

function showManagedStagePreview(modelRoot) {
  const viewer = getViewerApi();
  if (!viewer?.setModelRoot) throw new Error('Viewer API unavailable for managed-stage preview');
  const previous = managedStageUiState.modelRoot;
  managedStageUiState.modelRoot = modelRoot;
  viewer.setModelRoot(modelRoot, { source: 'managed-stage-json' });
  if (previous && previous !== modelRoot) disposeObject(previous);
}

function clearManagedStagePreview() {
  const viewer = getViewerApi();
  if (viewer?.clearModelRoot) viewer.clearModelRoot({ source: 'managed-stage-json' });
  disposeObject(managedStageUiState.modelRoot);
  managedStageUiState.sourceText = '';
  managedStageUiState.sourceName = '';
  managedStageUiState.basename = 'managed-stage';
  managedStageUiState.artifact = null;
  managedStageUiState.modelRoot = null;
  setStatus('Ready');
}

function resetManagedStageStateOnly() {
  managedStageUiState.sourceText = '';
  managedStageUiState.sourceName = '';
  managedStageUiState.basename = 'managed-stage';
  managedStageUiState.artifact = null;
}

function enableManagedStageDownloads() {
  for (const id of ['downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn', 'previewRvmBtn']) {
    const button = document.getElementById(id);
    if (button) button.disabled = false;
  }
}

function updateDrawerSummary(audit) {
  const drawer = document.getElementById('conversionDrawer');
  if (!drawer) return;
  drawer.dataset.managedStageJsonLoaded = 'true';
  drawer.dataset.managedStagePrimitiveCount = String(audit?.rvmPrimitivePayloadContract?.primitiveCount || 0);
  drawer.dataset.managedStageGeometryComponents = String(audit?.inputCounts?.geometryComponents || 0);
}

function logManagedStageSummary(audit) {
  const histogram = audit?.primitiveHistogram || {};
  log(`Managed-stage RVM ready: geometry=${audit?.inputCounts?.geometryComponents || 0}, support skipped=${audit?.inputCounts?.supportRecordsSkippedFromGeometry || 0}, support exported=${audit?.inputCounts?.supportRecordsEmittedToRvm || 0}, PRIM=${audit?.rvmPrimitivePayloadContract?.primitiveCount || 0}, code4=${histogram[4] || 0}, code8=${histogram[8] || 0}`);
}

function logManagedStagePreviewCoordinateAudit(audit) {
  if (!audit) return;
  const failures = Array.isArray(audit.failures) ? audit.failures : [];
  log(`Managed-stage preview audit: sourceLines=${audit.sourceLineCount || 0}, supports=${audit.supportPreviewOnlyCount || 0}, bends=${audit.bendSourceLineCount || 0}, elbowCues=${audit.elbowCueCount || 0}, failures=${failures.length}`);
  for (const failure of failures.slice(0, 10)) log(`Managed-stage preview audit issue: ${failure.recordName || failure.name || 'unknown'} — ${failure.reason || failure.status || 'failed'}`);
}

function getViewerApi() {
  return window.__THREED_MARKUP_VIEWER__ || window.__viewerApi || null;
}

function looksLikeManagedStageJson(text, name = '') {
  if (!isJsonFileName(name) && !/^\s*[{[]/.test(text || '')) return false;
  return text.includes(MANAGED_STAGE_SCHEMA) || text.includes(MANAGED_STAGE_PROFILE);
}

function isJsonFileName(name = '') {
  return /\.json$/i.test(name || '');
}

function bmCiiLikeSourceName(name = '') {
  return /BM_CII_INPUT_managed_stage/i.test(name || '');
}

function basenameWithoutExtension(name = '') {
  const clean = String(name || 'managed-stage').split(/[\\/]/).pop() || 'managed-stage';
  return clean.replace(/\.[^.]+$/, '') || 'managed-stage';
}

function downloadBlob(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = text;
}

function updateInputStatus(text) {
  const status = document.getElementById('inputStatusText');
  if (status) status.textContent = text;
}

function log(message) {
  if (window.appendLog) window.appendLog(message);
  else console.info(`[3DMarkupTool] ${message}`);
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

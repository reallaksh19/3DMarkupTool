import * as THREE from 'three';
import { convertManagedStageJsonToRvmAtt } from './managed-stage-rvm-converter.js';
import { createRvmPreviewScene } from './rvm-preview.js';

const CONTROLLER_SCHEMA = 'ManagedStageJsonUiController.v2';
const MANAGED_STAGE_SCHEMA = 'inputxml-managed-stage/v1';
const MANAGED_STAGE_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
const BM_CII_INPUTXML_JSON_EXPECTATIONS = Object.freeze({
  geometryComponents: 40,
  supportRecordsSkippedFromGeometry: 12,
  primitiveCodeCounts: { 4: 0, 8: 91 },
  cntbCount: 43,
  primCount: 91,
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
  const previewScene = createRvmPreviewScene(result.exportModel);
  previewScene.name = `${managedStageUiState.basename}_RVM_PREVIEW`;
  previewScene.userData = {
    ...(previewScene.userData || {}),
    TYPE: 'MANAGED_STAGE_RVM_PREVIEW',
    SOURCE_FORMAT: MANAGED_STAGE_SCHEMA,
    sourceName,
    geometryComponents: result.audit?.inputCounts?.geometryComponents,
    primitiveCount: result.audit?.rvmPrimitivePayloadContract?.primitiveCount
  };

  managedStageUiState.artifact = {
    sourceName,
    basename: managedStageUiState.basename,
    rvm: result.rvm,
    att: result.att,
    audit: result.audit,
    exportModel: result.exportModel,
    profile: result.profile,
    previewScene
  };

  showManagedStagePreview(previewScene);
  enableManagedStageDownloads();
  setStatus('Managed-stage RVM ready');
  updateDrawerSummary(result.audit);
  logManagedStageSummary(result.audit);
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-loaded', {
    detail: {
      sourceName,
      audit: result.audit,
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
    modelFileInput.value = '';
  });
}

function captureClick(id, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.addEventListener('click', (event) => {
    const handled = handler(event);
    if (handled && typeof handled.catch === 'function') handled.catch((error) => {
      log(`ERROR managed-stage action failed: ${error.message}`);
      setStatus('Managed-stage action failed');
    });
  }, true);
}

function showManagedStagePreview(modelRoot) {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
  if (!runtime?.scene || !runtime?.camera || !runtime?.controls) {
    throw new Error('Viewer runtime is not ready for managed-stage JSON preview');
  }

  if (managedStageUiState.modelRoot?.parent) {
    managedStageUiState.modelRoot.parent.remove(managedStageUiState.modelRoot);
  }
  if (runtime.modelRoot && runtime.modelRoot !== runtime.scene && runtime.modelRoot.parent === runtime.scene) {
    runtime.scene.remove(runtime.modelRoot);
  }

  managedStageUiState.modelRoot = modelRoot;
  runtime.scene.add(modelRoot);
  runtime.modelRoot = modelRoot;
  runtime.source = 'managed-stage-json-preview';
  setPreviewModeButtons();
  fitRuntimeToObject(runtime, modelRoot);
  updateStatusBarFromAudit(managedStageUiState.artifact?.audit);
  runtime.renderOnce?.('managed-stage-json-preview');
  window.dispatchEvent(new CustomEvent('viewer:model-loaded', {
    detail: { mode: 'rvm', modelRoot, rendererReady: Boolean(runtime.renderer), source: 'managed-stage-json' }
  }));
}

function fitRuntimeToObject(runtime, object) {
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x)) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  runtime.controls.target.copy(center);
  runtime.camera.position.set(center.x + radius * 1.4, center.y + radius * 0.9, center.z + radius * 1.4);
  runtime.camera.near = Math.max(0.1, radius / 10000);
  runtime.camera.far = Math.max(1000, radius * 20);
  runtime.camera.updateProjectionMatrix();
  runtime.controls.update();
}

function setPreviewModeButtons() {
  for (const id of ['downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn', 'previewRvmBtn']) {
    document.getElementById(id)?.removeAttribute('disabled');
  }
  document.getElementById('downloadGlbBtn')?.setAttribute('disabled', 'disabled');
}

function enableManagedStageDownloads() {
  for (const id of ['downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn', 'previewRvmBtn']) {
    document.getElementById(id)?.removeAttribute('disabled');
  }
}

function updateDrawerSummary(audit = {}) {
  const status = document.getElementById('conversionStatus');
  if (status) {
    status.textContent = `Managed-stage RVM ready — components ${audit.inputCounts?.geometryComponents || 0}, PRIM ${audit.rvmPrimitivePayloadContract?.primitiveCount || 0}`;
  }
  const stats = document.getElementById('modelStats');
  if (stats) {
    stats.textContent = `Managed JSON · CNTB ${audit.chunkHierarchy?.cntbCount || 0} · PRIM ${audit.chunkHierarchy?.primCount || 0}`;
  }
}

function updateStatusBarFromAudit(audit = {}) {
  const status = document.getElementById('status');
  if (status) status.textContent = `Managed-stage JSON · PRIM ${audit.chunkHierarchy?.primCount || 0}`;
}

function logManagedStageSummary(audit = {}) {
  const histogram = audit.primitiveHistogram || {};
  log(`Managed-stage geometry ready: components=${audit.inputCounts?.geometryComponents || 0}, supportsSkipped=${audit.inputCounts?.supportRecordsSkippedFromGeometry || 0}, code4=${histogram[4] || 0}, code8=${histogram[8] || 0}`);
  log(`Managed-stage RVM bytes=${formatBytes(audit.rvmBytes || 0)}, ATT bytes=${formatBytes(audit.attBytes || 0)}`);
}

function clearManagedStagePreview() {
  if (managedStageUiState.modelRoot?.parent) managedStageUiState.modelRoot.parent.remove(managedStageUiState.modelRoot);
  managedStageUiState.modelRoot = null;
  managedStageUiState.artifact = null;
  managedStageUiState.sourceText = '';
  managedStageUiState.sourceName = '';
}

function resetManagedStageStateOnly() {
  managedStageUiState.artifact = null;
  managedStageUiState.sourceText = '';
  managedStageUiState.sourceName = '';
}

function looksLikeManagedStageJson(sourceText, sourceName) {
  if (!isJsonFileName(sourceName)) return false;
  try {
    const parsed = JSON.parse(sourceText);
    return parsed?.schema === MANAGED_STAGE_SCHEMA && parsed?.profile === MANAGED_STAGE_PROFILE;
  } catch {
    return false;
  }
}

function isJsonFileName(fileName = '') {
  return fileName.toLowerCase().endsWith('.json');
}

function bmCiiLikeSourceName(sourceName = '') {
  return /bm[_-]?cii.*managed[_-]?stage/i.test(sourceName) || /BM_CII_INPUT_managed_stage\.json/i.test(sourceName);
}

function basenameWithoutExtension(fileName = '') {
  return String(fileName).replace(/\.[^.]+$/, '') || 'managed-stage';
}

function downloadBlob(data, fileName, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function formatBytes(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function setStatus(message) {
  if (window.setStatus) window.setStatus(message);
  const status = document.getElementById('status');
  if (status) status.textContent = message;
}

function updateInputStatus(message) {
  const target = document.getElementById('inputStatus');
  if (target) target.textContent = message;
}

function log(message) {
  if (window.addLog) window.addLog(message);
  else console.info(message);
}

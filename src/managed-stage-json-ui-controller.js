import * as THREE from 'three';
import { convertManagedStageJsonToRvmAtt } from './managed-stage-rvm-converter.js';
import { createManagedStagePreviewScene } from './managed-stage-preview-scene-explicit-bend.js';

const CONTROLLER_SCHEMA = 'ManagedStageJsonUiController.v2';
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
  supportRvmPrimitiveCount: 42,
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
  primitiveCodeCounts: { 1: 0, 4: 0, 8: 157 },
  code1: 0,
  cntbCount: 56,
  primCount: 157,
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
  const legacyManagedButton = document.getElementById('loadManagedStageJsonBtn');
  if (legacyManagedButton) {
    legacyManagedButton.id = 'loadUnifiedModelFileBtn';
    legacyManagedButton.title = 'Load stagedJson or BM_CII_INPUT_managed_stage.json';
    legacyManagedButton.setAttribute('aria-label', 'Load stagedJson');
    legacyManagedButton.innerHTML = '<span class="managed-stage-json-icon" aria-hidden="true">↥</span><span>Load stagedJson</span>';
    return legacyManagedButton;
  }

  const existing = document.getElementById('loadUnifiedModelFileBtn');
  if (existing) return existing;
  const button = document.createElement('button');
  button.id = 'loadUnifiedModelFileBtn';
  button.type = 'button';
  button.className = 'ghost icon-text managed-stage-json-load-btn unified-model-load-btn';
  button.title = 'Load stagedJson or BM_CII_INPUT_managed_stage.json';
  button.setAttribute('aria-label', 'Load stagedJson');
  button.innerHTML = '<span class="managed-stage-json-icon" aria-hidden="true">↥</span><span>Load stagedJson</span>';
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

  const options = bmCiiLikeSourceName(sourceName) ? { strictAuditExpectations: BM_CII_STAGED_JSON_EXPECTATIONS } : {};
  const result = convertManagedStageJsonToRvmAtt(sourceText, options);
  const previewScene = createManagedStagePreviewScene(sourceText, { sourceName, exportModel: result.exportModel });
  const previewAudit = previewScene.userData?.managedStageCoordinateAudit || null;
  const visibleDiagnostics = buildManagedStageVisibleDiagnostics(result.audit, previewAudit);
  previewScene.name = `${managedStageUiState.basename}_RAW_STAGED_PREVIEW`;
  previewScene.userData = {
    ...(previewScene.userData || {}),
    TYPE: 'MANAGED_STAGE_RAW_PREVIEW',
    SOURCE_FORMAT: MANAGED_STAGE_SCHEMA,
    sourceName,
    geometryComponents: result.audit?.inputCounts?.geometryComponents,
    primitiveCount: result.audit?.rvmPrimitivePayloadContract?.primitiveCount,
    previewPipeline: 'raw-managed-stage-json-coordinate-preserving-explicit-bend-topology-gated',
    managedStageVisibleDiagnostics: visibleDiagnostics
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
    previewPipeline: 'raw-managed-stage-json-coordinate-preserving-explicit-bend-topology-gated',
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
      audit: result.audit,
      previewCoordinateAudit: previewAudit,
      visibleDiagnostics,
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
}

function captureClick(id, handler) {
  const button = document.getElementById(id);
  if (!button) return;
  button.addEventListener('click', async (event) => {
    const handled = await handler(event);
    if (handled) return;
  }, true);
}

function showManagedStagePreview(root) {
  const api = window.__THREED_MARKUP_VIEWER__ || window.__viewerApi;
  if (!api?.setModelRoot) throw new Error('Viewer API unavailable for managed-stage preview');
  clearManagedStagePreview();
  managedStageUiState.modelRoot = root;
  api.setModelRoot(root, { source: 'managed-stage-json', sourceName: managedStageUiState.sourceName || root?.name || '' });
}

function clearManagedStagePreview() {
  if (!managedStageUiState.modelRoot) return;
  const api = window.__THREED_MARKUP_VIEWER__ || window.__viewerApi;
  if (api?.clearModelRoot) api.clearModelRoot({ source: 'managed-stage-json', sourceName: managedStageUiState.sourceName || '', previousModelRootName: managedStageUiState.modelRoot?.name || '' });
  managedStageUiState.modelRoot = null;
}

function enableManagedStageDownloads() {
  for (const id of ['downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn', 'previewRvmBtn']) {
    const button = document.getElementById(id);
    if (button) button.disabled = false;
  }
}

function updateDrawerSummary(audit, previewAudit = null) {
  const target = document.getElementById('conversionSummary') || document.getElementById('conversionStatus');
  if (!target || !audit) return;
  const counts = audit.inputCounts || {};
  const histogram = audit.primitiveHistogram || {};
  const diagnostics = buildManagedStageVisibleDiagnostics(audit, previewAudit);
  target.textContent = `Managed JSON: ${counts.geometryComponents || 0} geometry, ${counts.supportRecordsSkippedFromGeometry || 0} supports, RVM primitives ${audit.rvmPrimitivePayloadContract?.primitiveCount || audit.chunkHierarchy?.primCount || 0} (code8=${histogram[8] || 0}, code1=${histogram[1] || 0}); topology=${diagnostics.topologyProofGateOk ? 'PASS' : 'FAIL'}, BEND details=${diagnostics.explicitBendDetailCount}/${diagnostics.explicitBendRecordCount}, support topology=${diagnostics.supportTopologyGatePass ? 'PASS' : 'FAIL'}`;
}

function updateManagedStageDiagnosticsPanel(audit, previewAudit = null) {
  const status = document.getElementById('conversionStatus') || document.getElementById('runtimeStatus');
  if (!status || !audit) return;
  const panel = ensureManagedStageDiagnosticsPanel(status);
  const diagnostics = buildManagedStageVisibleDiagnostics(audit, previewAudit);
  panel.textContent = renderManagedStageVisibleDiagnostics(diagnostics);
  panel.dataset.schema = diagnostics.schema;
  panel.dataset.topologyProofGateOk = String(diagnostics.topologyProofGateOk);
  panel.dataset.explicitBendRecordCount = String(diagnostics.explicitBendRecordCount);
  panel.dataset.explicitBendDetailCount = String(diagnostics.explicitBendDetailCount);
  panel.dataset.supportAssociationOnlyCount = String(diagnostics.supportAssociationOnlyCount);
  panel.dataset.supportContinuityEdgeCount = String(diagnostics.supportContinuityEdgeCount);
}

function ensureManagedStageDiagnosticsPanel(anchor) {
  const existing = document.getElementById('managedStageTopologyDiagnostics');
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = 'managedStageTopologyDiagnostics';
  panel.className = 'conversion-status managed-stage-topology-diagnostics';
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-label', 'Managed-stage topology proof diagnostics');
  anchor.insertAdjacentElement('afterend', panel);
  return panel;
}

function buildManagedStageVisibleDiagnostics(audit = {}, previewAudit = null) {
  const proof = audit.managedStageTopologyProofGate || {};
  const topologySummary = audit.supportTopologyAudit?.summary || previewAudit?.topologySummary || {};
  const supportExport = audit.supportRvmExportAudit || {};
  return {
    schema: 'ManagedStageVisibleDiagnostics.v1',
    topologyProofGateOk: proof.ok === true,
    strictGateOk: audit.managedStageStrictGate?.ok === true,
    previewTopologyAuditOk: previewAudit?.topologyAuditOk === true,
    explicitBendRecordCount: numberOrZero(proof.explicitBendRecordCount ?? topologySummary.explicitBendRecordCount ?? previewAudit?.explicitBendRecordCount),
    explicitBendDetailCount: numberOrZero(proof.explicitBendDetailCount ?? topologySummary.explicitBendDetailCount ?? previewAudit?.explicitBendDetailCount),
    missingExplicitBendDetailCount: numberOrZero(proof.missingExplicitBendDetailCount ?? topologySummary.missingExplicitBendDetailCount),
    synthetic1p5DTrimBlockedCount: numberOrZero(proof.synthetic1p5DTrimBlockedCount ?? topologySummary.synthetic1p5DTrimBlockedCount ?? previewAudit?.explicitBendTrimBlockedCount),
    supportAssociationOnlyCount: numberOrZero(proof.supportAssociationOnlyCount ?? supportExport.supportAssociationOnlyCount ?? previewAudit?.supportAssociationOnlyCount),
    supportTopologyBlockedCount: numberOrZero(proof.supportTopologyBlockedCount ?? supportExport.supportTopologyBlockedCount ?? previewAudit?.supportTopologyBlockedCount),
    supportContinuityEdgeCount: numberOrZero(proof.supportContinuityEdgeCount ?? supportExport.supportContinuityEdgeCount ?? previewAudit?.supportContinuityEdgeCount),
    supportInlineFaceCount: numberOrZero(proof.supportInlineFaceCount ?? supportExport.supportInlineFaceCount ?? previewAudit?.supportInlineFaceCount),
    supportTopologyGatePass: (proof.supportTopologyGatePass ?? supportExport.supportTopologyGatePass ?? previewAudit?.supportTopologyGatePass) === true
  };
}

function renderManagedStageVisibleDiagnostics(diagnostics) {
  return `Topology proof: ${diagnostics.topologyProofGateOk ? 'PASS' : 'FAIL'} | Explicit BEND details: ${diagnostics.explicitBendDetailCount}/${diagnostics.explicitBendRecordCount}, missing ${diagnostics.missingExplicitBendDetailCount}, synthetic trim blocked ${diagnostics.synthetic1p5DTrimBlockedCount} | Support topology: ${diagnostics.supportTopologyGatePass ? 'PASS' : 'FAIL'}, association-only ${diagnostics.supportAssociationOnlyCount}, blocked ${diagnostics.supportTopologyBlockedCount}, continuity edges ${diagnostics.supportContinuityEdgeCount}, inline faces ${diagnostics.supportInlineFaceCount}`;
}

function showManagedStageAuditWarnings(gate = {}) {
  const warnings = gate?.nonBlockingAuditIssues || [];
  if (!warnings.length) return;
  const text = `Managed-stage audit warning: ${warnings.length} non-geometry mismatch${warnings.length === 1 ? '' : 'es'}; export continued.`;
  log(`${text} ${warnings.join('; ')}`);
  showToast(text);
}

function showToast(text) {
  const toast = document.createElement('div');
  toast.className = 'managed-stage-audit-toast';
  toast.textContent = text;
  toast.style.cssText = 'position:fixed;right:16px;bottom:16px;max-width:360px;padding:10px 12px;border-radius:10px;background:rgba(20,29,43,.92);color:#f5d78a;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.28);z-index:99999;pointer-events:none;';
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 6500);
}

function logManagedStageSummary(audit) {
  if (!audit) return;
  const counts = audit.inputCounts || {};
  const histogram = audit.primitiveHistogram || {};
  log(`Managed-stage RVM: geometry=${counts.geometryComponents || 0}, supports=${counts.supportRecordsSkippedFromGeometry || 0}, emittedSupports=${counts.emittedSupports || counts.supportRecordsEmittedToRvm || 0}, PRIM=${audit.chunkHierarchy?.primCount || 0}, code1=${histogram[1] || 0}, code8=${histogram[8] || 0}`);
}

function logManagedStagePreviewCoordinateAudit(audit) {
  if (!audit) return;
  log(`Managed-stage preview audit: sourceLines=${audit.sourceLineCount}, supports=${audit.supportPreviewOnlyCount}, explicitBends=${audit.explicitBendRecordCount || 0}, trimmedBends=${audit.trimmedBendSourceLineCount || 0}, topologyGate=${audit.supportTopologyGatePass ? 'PASS' : 'FAIL'}, supportContinuityEdges=${audit.supportContinuityEdgeCount || 0}, supportInlineFaces=${audit.supportInlineFaceCount || 0}, unexplainedNonBendDelta=${audit.unexplainedNonBendDeltaCount || 0}`);
}

function logManagedStageVisibleDiagnostics(diagnostics) {
  if (!diagnostics) return;
  log(`Managed-stage topology proof diagnostics: ${renderManagedStageVisibleDiagnostics(diagnostics)}`);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function looksLikeManagedStageJson(text, name = '') {
  if (!isJsonFileName(name)) return false;
  try {
    const json = JSON.parse(text);
    return json?.schema === MANAGED_STAGE_SCHEMA && json?.profile === MANAGED_STAGE_PROFILE;
  } catch {
    return false;
  }
}

function isJsonFileName(name = '') { return /\.(json|jscon)$/i.test(String(name)); }
function bmCiiLikeSourceName(name = '') { return /BM_CII_INPUT_managed_stage/i.test(String(name)); }
function basenameWithoutExtension(name = '') { return String(name || 'managed-stage').replace(/\.[^.]+$/, '') || 'managed-stage'; }
function resetManagedStageStateOnly() { managedStageUiState.sourceText = ''; managedStageUiState.sourceName = ''; managedStageUiState.basename = 'managed-stage'; managedStageUiState.artifact = null; }
function updateInputStatus(text) { const status = document.getElementById('inputStatus'); if (status) status.textContent = text; }
function setStatus(text) { const status = document.getElementById('runtimeStatus') || document.getElementById('conversionStatus'); if (status) status.textContent = text; }
function log(message) { const logEl = document.getElementById('log'); const line = `[${new Date().toLocaleTimeString()}] ${message}`; if (logEl) logEl.textContent += `${line}\n`; else console.log(line); }

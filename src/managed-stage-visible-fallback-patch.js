import { appendManagedStageVisibleFallback } from './managed-stage-visible-fallback.js?v=bust-cache-4';

const PATCH_SCHEMA = 'ManagedStageVisibleFallbackPatch.v1';
let lastJsonSourcePromise = null;

installManagedStageVisibleFallbackPatch();

export function installManagedStageVisibleFallbackPatch() {
  captureUnifiedJsonInputSource();
  patchWhenReady();
  window.addEventListener('viewer:managed-stage-json-ui-ready', () => patchWhenReady(), { once: false });
  window.addEventListener('viewer:managed-stage-json-loaded', (event) => {
    applyFallbackFromCapturedInput(event?.detail).catch((error) => console.warn('[3DMarkupTool] Managed-stage visible fallback skipped.', error));
  });
}

function patchWhenReady() {
  const api = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  if (!api || api.__visibleFallbackPatch === PATCH_SCHEMA) return;
  const originalLoadText = api.loadText?.bind(api);
  const originalLoadFile = api.loadFile?.bind(api);
  if (typeof originalLoadText === 'function') {
    api.loadText = async function patchedManagedStageLoadText(sourceText, sourceName) {
      const artifact = await originalLoadText(sourceText, sourceName);
      applyVisibleFallbackToArtifact(artifact, sourceText);
      return artifact;
    };
  }
  if (typeof originalLoadFile === 'function') {
    api.loadFile = async function patchedManagedStageLoadFile(file) {
      const sourceText = await file.text();
      lastJsonSourcePromise = Promise.resolve({ name: file.name, sourceText });
      if (typeof api.loadText === 'function') return api.loadText(sourceText, file.name);
      const artifact = await originalLoadFile(file);
      applyVisibleFallbackToArtifact(artifact, sourceText);
      return artifact;
    };
  }
  api.__visibleFallbackPatch = PATCH_SCHEMA;
  window.__3D_MARKUP_MANAGED_STAGE_VISIBLE_FALLBACK_PATCH__ = { schema: PATCH_SCHEMA };
}

function captureUnifiedJsonInputSource() {
  const input = document.getElementById('xmlFile');
  if (!input || input.__managedStageVisibleFallbackCapture) return;
  input.__managedStageVisibleFallbackCapture = true;
  input.addEventListener('change', (event) => {
    const file = event.target?.files?.[0];
    if (!file || !/\.json$/i.test(String(file.name || ''))) return;
    lastJsonSourcePromise = file.text().then((sourceText) => ({ name: file.name, sourceText }));
  }, true);
}

async function applyFallbackFromCapturedInput(detail) {
  if (!detail?.modelRoot || !lastJsonSourcePromise) return;
  const captured = await lastJsonSourcePromise;
  if (!captured?.sourceText) return;
  if (detail.sourceName && captured.name && detail.sourceName !== captured.name) return;
  const artifact = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.getActiveArtifact?.();
  applyVisibleFallbackToArtifact({ ...artifact, previewScene: detail.modelRoot }, captured.sourceText);
}

function applyVisibleFallbackToArtifact(artifact, sourceText) {
  const scene = artifact?.previewScene;
  if (!scene || !sourceText || scene.userData?.managedStageVisibleFallback?.schema === 'ManagedStageVisibleFallback.v1') return null;
  const visibleFallback = appendManagedStageVisibleFallback(scene, sourceText);
  if (!visibleFallback?.meshCount) return visibleFallback;
  if (artifact) artifact.visibleFallback = visibleFallback;
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
  runtime?.renderOnce?.('managed-stage-visible-fallback');
  logVisibleFallback(visibleFallback);
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-visible-fallback-applied', { detail: { visibleFallback, modelRoot: scene } }));
  return visibleFallback;
}

function logVisibleFallback(visibleFallback) {
  const target = document.getElementById('log');
  if (!target) return;
  const ts = new Date().toLocaleTimeString();
  target.textContent += `[${ts}] Managed-stage visible fallback overlay: previewOnly=${visibleFallback.meshCount}, supports=${visibleFallback.supportMarkerCount || 0}, rawFallback=${visibleFallback.rawGeometryFallbackCount || 0}\n`;
  target.scrollTop = target.scrollHeight;
}

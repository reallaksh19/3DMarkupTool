import * as THREE from 'three';

const BRIDGE_SCHEMA = 'ManagedStageViewerApiBridge.v1';
const ACTIVE_ROOT_KEY = '__3D_MARKUP_MANAGED_STAGE_ACTIVE_MODEL_ROOT__';
const API_KEY = '__THREED_MARKUP_VIEWER__';
const LEGACY_API_KEY = '__viewerApi';
const DEFAULT_VIEW = new THREE.Vector3(1.1, 0.78, 1.12);

installManagedStageViewerApiBridge();

export function installManagedStageViewerApiBridge() {
  const existing = window[API_KEY];
  if (existing?.schema === BRIDGE_SCHEMA) return existing;

  const api = {
    schema: BRIDGE_SCHEMA,
    source: 'managed-stage-viewer-api-bridge',
    setModelRoot,
    clearModelRoot,
    getModelRoot,
    renderOnce(reason = 'managed-stage-viewer-api-bridge') {
      const runtime = getRuntime();
      return renderRuntime(runtime, reason);
    }
  };

  window[API_KEY] = api;
  if (!window[LEGACY_API_KEY] || window[LEGACY_API_KEY]?.schema === BRIDGE_SCHEMA) {
    window[LEGACY_API_KEY] = api;
  }

  patchRuntimeApi(getRuntime(), api);
  window.addEventListener('viewer:runtime-context', (event) => {
    patchRuntimeApi(event.detail || getRuntime(), api);
  });

  window.dispatchEvent(new CustomEvent('viewer:managed-stage-viewer-api-ready', {
    detail: { schema: BRIDGE_SCHEMA, source: 'managed-stage-viewer-api-bridge' }
  }));
  return api;
}

function setModelRoot(modelRoot, meta = {}) {
  if (!modelRoot) return false;
  const runtime = getRuntime();
  if (!runtime?.scene || !runtime?.camera || !runtime?.renderer) return false;

  const previous = getActiveManagedStageRoot(runtime);
  if (previous && previous !== modelRoot && previous.parent === runtime.scene) {
    runtime.scene.remove(previous);
  }

  const currentRuntimeRoot = runtime.modelRoot;
  if (currentRuntimeRoot && currentRuntimeRoot !== modelRoot && currentRuntimeRoot !== runtime.scene && currentRuntimeRoot.parent === runtime.scene) {
    runtime.scene.remove(currentRuntimeRoot);
  }

  if (modelRoot.parent !== runtime.scene) runtime.scene.add(modelRoot);
  window[ACTIVE_ROOT_KEY] = modelRoot;
  runtime.modelRoot = modelRoot;
  runtime.getModelRoot = () => window[ACTIVE_ROOT_KEY] || runtime.modelRoot || null;

  fitRuntimeModel(runtime, modelRoot);
  renderRuntime(runtime, meta.source || 'managed-stage-json');
  window.dispatchEvent(new CustomEvent('viewer:model-loaded', {
    detail: {
      mode: meta.mode || 'managed-stage-json',
      source: meta.source || 'managed-stage-json',
      modelRoot,
      rendererReady: Boolean(runtime.renderer),
      bridged: true
    }
  }));
  window.dispatchEvent(new CustomEvent('viewer:request-render', {
    detail: { source: meta.source || 'managed-stage-json', reason: 'managed-stage-viewer-api-bridge:setModelRoot' }
  }));
  return true;
}

function clearModelRoot(meta = {}) {
  const runtime = getRuntime();
  const active = getActiveManagedStageRoot(runtime);
  if (active?.parent) active.parent.remove(active);
  window[ACTIVE_ROOT_KEY] = null;
  if (runtime) {
    runtime.modelRoot = runtime.scene || null;
    runtime.getModelRoot = () => window[ACTIVE_ROOT_KEY] || runtime.modelRoot || null;
  }
  renderRuntime(runtime, meta.source || 'managed-stage-json-clear');
  window.dispatchEvent(new CustomEvent('viewer:model-cleared', {
    detail: { source: meta.source || 'managed-stage-json', bridged: true }
  }));
  window.dispatchEvent(new CustomEvent('viewer:request-render', {
    detail: { source: meta.source || 'managed-stage-json', reason: 'managed-stage-viewer-api-bridge:clearModelRoot' }
  }));
  return true;
}

function getModelRoot() {
  const runtime = getRuntime();
  return getActiveManagedStageRoot(runtime) || runtime?.modelRoot || null;
}

function patchRuntimeApi(runtime, api) {
  if (!runtime || typeof runtime !== 'object') return false;
  runtime.setModelRoot = api.setModelRoot;
  runtime.clearModelRoot = api.clearModelRoot;
  runtime.getModelRoot = api.getModelRoot;
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
  return true;
}

function getRuntime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function getActiveManagedStageRoot(runtime) {
  return window[ACTIVE_ROOT_KEY] || runtime?.modelRoot || null;
}

function fitRuntimeModel(runtime, modelRoot) {
  const box = new THREE.Box3().setFromObject(modelRoot);
  if (!Number.isFinite(box.min.x)) return false;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  const direction = DEFAULT_VIEW.clone().normalize();
  runtime.camera.position.copy(center).add(direction.multiplyScalar(radius * 1.18));
  runtime.camera.near = Math.max(0.01, radius / 1200);
  runtime.camera.far = Math.max(1000, radius * 20);
  runtime.camera.updateProjectionMatrix?.();
  runtime.controls?.target?.copy?.(center);
  runtime.controls?.update?.();
  return true;
}

function renderRuntime(runtime, reason = 'managed-stage-viewer-api-bridge') {
  if (!runtime?.renderer || !runtime?.scene || !runtime?.camera) return false;
  runtime.controls?.update?.();
  runtime.renderer.render(runtime.scene, runtime.camera);
  runtime.source = reason;
  return true;
}

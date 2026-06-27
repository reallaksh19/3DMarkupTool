import * as THREE from 'three';

const HELPER_NAME_PATTERNS = [
  /helper/i,
  /measure/i,
  /clip_plane_preview/i,
  /clip_box/i,
  /selection_box/i,
  /model_tree_selection/i
];

const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

Object.assign(runtime, {
  renderer: runtime.renderer || null,
  scene: runtime.scene || null,
  camera: runtime.camera || null,
  controls: runtime.controls || null,
  modelRoot: runtime.modelRoot || null,
  selectedObject: runtime.selectedObject || window.__3D_MARKUP_SELECTED_OBJECT__ || null,
  selectedData: runtime.selectedData || window.__3D_MARKUP_SELECTED_DATA__ || null,
  clippingPlanes: runtime.clippingPlanes || [],
  clippingMode: runtime.clippingMode || 'none',
  version: 'ui-runtime-cleanup-20260618',
  refresh,
  getRenderer: () => refresh().renderer,
  getScene: () => refresh().scene,
  getCamera: () => refresh().camera,
  getControls: () => refresh().controls,
  getModelRoot: () => refresh().modelRoot,
  getSelectedObject: () => window.__3D_MARKUP_SELECTED_OBJECT__ || refresh().selectedObject || null,
  getSelectedData: () => window.__3D_MARKUP_SELECTED_DATA__ || refresh().selectedData || null,
  getBounds,
  selectObject,
  clearSelection,
  applyClipping,
  clearClipping,
  publish
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initRuntimeBridge, { once: true });
} else {
  initRuntimeBridge();
}

window.addEventListener('markup:render-context', (event) => {
  const detail = event.detail || {};
  if (detail.renderer) runtime.renderer = detail.renderer;
  if (detail.scene) runtime.scene = detail.scene;
  if (detail.camera) runtime.camera = detail.camera;
  if (detail.controls) runtime.controls = detail.controls;
  if (detail.modelRoot) runtime.modelRoot = detail.modelRoot;
  publish('markup:render-context');
});

window.addEventListener('markup:selected-object-changed', (event) => {
  runtime.selectedObject = event.detail?.object || null;
  runtime.selectedData = event.detail?.data || null;
  window.__3D_MARKUP_SELECTED_OBJECT__ = runtime.selectedObject;
  window.__3D_MARKUP_SELECTED_DATA__ = runtime.selectedData;
  publish('selection-changed');
});

window.addEventListener('markup:selected-object-cleared', () => {
  runtime.selectedObject = null;
  runtime.selectedData = null;
  window.__3D_MARKUP_SELECTED_OBJECT__ = null;
  window.__3D_MARKUP_SELECTED_DATA__ = null;
  publish('selection-cleared');
});

function initRuntimeBridge() {
  refresh();
  publish('init');

  document.getElementById('viewer')?.addEventListener('pointerup', () => {
    window.setTimeout(() => publish('viewer-pointerup'), 0);
  }, true);

  document.getElementById('convertBtn')?.addEventListener('click', () => {
    window.setTimeout(() => publish('conversion-started'), 0);
    window.setTimeout(() => publish('conversion-settle'), 400);
    window.setTimeout(() => publish('conversion-settle-late'), 1200);
  }, true);

  document.getElementById('clearBtn')?.addEventListener('click', () => {
    window.setTimeout(() => publish('clear'), 0);
  }, true);

  window.addEventListener('resize', () => publish('resize'), { passive: true });
}

function refresh() {
  const legacy = window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  if (legacy !== runtime) {
    if (legacy.renderer && !runtime.renderer) runtime.renderer = legacy.renderer;
    if (legacy.scene && !runtime.scene) runtime.scene = legacy.scene;
    if (legacy.camera && !runtime.camera) runtime.camera = legacy.camera;
    if (legacy.controls && !runtime.controls) runtime.controls = legacy.controls;
  }

  runtime.selectedObject = window.__3D_MARKUP_SELECTED_OBJECT__ || runtime.selectedObject || null;
  runtime.selectedData = window.__3D_MARKUP_SELECTED_DATA__ || runtime.selectedData || null;
  runtime.modelRoot = findModelRoot(runtime.scene) || runtime.modelRoot || null;
  return runtime;
}

function publish(source = 'runtime') {
  refresh();
  runtime.frame = (runtime.frame || 0) + 1;

  const detail = {
    renderer: runtime.renderer,
    scene: runtime.scene,
    camera: runtime.camera,
    controls: runtime.controls,
    modelRoot: runtime.modelRoot,
    selectedObject: runtime.selectedObject,
    selectedData: runtime.selectedData,
    clippingPlanes: runtime.clippingPlanes,
    clippingMode: runtime.clippingMode,
    source,
    frame: runtime.frame
  };

  window.dispatchEvent(new CustomEvent('viewer:runtime-ready', { detail }));
  window.dispatchEvent(new CustomEvent('viewer:runtime-context', { detail }));

  if (runtime.modelRoot) {
    window.dispatchEvent(new CustomEvent('viewer:model-loaded', { detail }));
  }

  if (runtime.selectedObject || source.includes('selection')) {
    window.dispatchEvent(new CustomEvent('viewer:selection-changed', { detail }));
  }

  return runtime;
}

function selectObject(object, data = {}, options = {}) {
  if (!object) return false;

  window.dispatchEvent(new CustomEvent('markup:request-select-object', {
    detail: {
      object,
      data,
      source: options.source || 'runtime'
    }
  }));

  runtime.selectedObject = object;
  runtime.selectedData = data;
  window.__3D_MARKUP_SELECTED_OBJECT__ = object;
  window.__3D_MARKUP_SELECTED_DATA__ = data;
  publish('selection-request');
  return true;
}

function clearSelection() {
  window.dispatchEvent(new CustomEvent('markup:request-clear-selection', {
    detail: { source: 'runtime' }
  }));

  runtime.selectedObject = null;
  runtime.selectedData = null;
  window.__3D_MARKUP_SELECTED_OBJECT__ = null;
  window.__3D_MARKUP_SELECTED_DATA__ = null;
  publish('selection-clear-request');
}

function applyClipping(planes = [], options = {}) {
  const renderer = refresh().renderer;
  if (!renderer) return false;

  const normalizedPlanes = Array.isArray(planes) ? planes.filter(Boolean) : [];
  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = normalizedPlanes;
  runtime.clippingPlanes = normalizedPlanes;
  runtime.clippingMode = options.mode || (normalizedPlanes.length ? 'custom' : 'none');

  const detail = {
    renderer,
    planes: normalizedPlanes,
    mode: runtime.clippingMode,
    source: options.source || 'runtime'
  };
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail }));
  window.dispatchEvent(new CustomEvent('markup:clipping-changed', { detail }));
  publish('clipping');
  return true;
}

function clearClipping(options = {}) {
  return applyClipping([], { ...options, mode: 'none' });
}

function getBounds(object = null) {
  const target = object || runtime.getSelectedObject?.() || runtime.getModelRoot?.();
  if (!target) return null;

  const box = new THREE.Box3().setFromObject(target);
  return isValidBox(box) ? box : null;
}

function findModelRoot(scene) {
  if (!scene) return null;

  let best = null;
  let bestScore = -Infinity;
  const box = new THREE.Box3();

  for (const child of scene.children || []) {
    if (shouldSkip(child)) continue;

    let meshCount = 0;
    let dataCount = 0;
    child.traverse?.((object) => {
      if (shouldSkip(object)) return;
      if (object.isMesh) meshCount += 1;
      if (object.userData && Object.keys(object.userData).length) dataCount += 1;
    });

    if (!meshCount && !dataCount) continue;
    box.setFromObject(child);
    const size = isValidBox(box) ? box.getSize(new THREE.Vector3()).length() : 0;
    const score = meshCount * 8 + dataCount * 3 + size * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = child;
    }
  }

  return best;
}

function shouldSkip(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;

  const name = String(object.name || '').toLowerCase();
  if (name === 'grid' || name === 'axes') return true;
  return HELPER_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function isValidBox(box) {
  return Boolean(box)
    && Number.isFinite(box.min.x)
    && Number.isFinite(box.min.y)
    && Number.isFinite(box.min.z)
    && Number.isFinite(box.max.x)
    && Number.isFinite(box.max.y)
    && Number.isFinite(box.max.z);
}

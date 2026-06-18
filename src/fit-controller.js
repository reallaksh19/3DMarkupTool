import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEFAULT_VIEW = new THREE.Vector3(1.1, 0.78, 1.12).normalize();
const SKIP_NAME_PATTERNS = [
  'grid',
  'axes',
  'helper',
  'measure',
  'clip_plane_preview',
  'canvas_axis',
  'viewcube'
];

const SELECTION_HELPER_NAMES = new Set([
  'SELECTION_BOX_HELPER',
  'MODEL_TREE_SELECTION_HELPER'
]);

const state = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  lastFitAt: 0
};

patchOrbitControlsCapture();
bindRenderContext();

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initFitController, { once: true });
} else {
  initFitController();
}

function patchOrbitControlsCapture() {
  const proto = OrbitControls?.prototype;
  if (!proto || proto.__MARKUP_FIT_CAPTURE__) return;

  const originalUpdate = proto.update;
  proto.update = function markupFitCaptureUpdate(...args) {
    state.controls = this;
    return originalUpdate.apply(this, args);
  };

  Object.defineProperty(proto, '__MARKUP_FIT_CAPTURE__', {
    value: true,
    configurable: false
  });
}

function bindRenderContext() {
  window.addEventListener('markup:render-context', (event) => {
    const { renderer, scene, camera } = event.detail || {};
    if (renderer) state.renderer = renderer;
    if (scene) state.scene = scene;
    if (camera) state.camera = camera;
  });

  window.addEventListener('markup:selected-object-changed', () => {
    setStatus('Selection synced');
  });

  const runtime = getRuntime();
  if (runtime?.renderer) state.renderer = runtime.renderer;
  if (runtime?.scene) state.scene = runtime.scene;
  if (runtime?.camera) state.camera = runtime.camera;
}

function initFitController() {
  bindButton('resetCameraBtn', fitAllVisible);
  bindButton('fitSelectionBtn', fitSelectionOrVisible);

  window.addEventListener('keydown', (event) => {
    if (isInputFocused()) return;
    const key = event.key?.toLowerCase();
    if (key !== 'h' && key !== 'f') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === 'h') fitAllVisible();
    if (key === 'f') fitSelectionOrVisible();
  }, true);
}

function bindButton(id, handler) {
  const button = document.getElementById(id);
  if (!button || button.dataset.fitControllerBound === 'true') return;

  button.dataset.fitControllerBound = 'true';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    handler();
  }, true);
}

function fitAllVisible() {
  const context = getContext();
  if (!context) return;

  const box = collectVisibleModelBounds(context.scene);
  if (!box) {
    setStatus('Fit All: no visible model');
    return;
  }

  fitBox(box, context, 'Fit All');
}

function fitSelectionOrVisible() {
  const context = getContext();
  if (!context) return;

  const selectionBox = collectSelectionBounds(context.scene);
  if (selectionBox) {
    fitBox(selectionBox, context, 'Fit Selection');
    return;
  }

  const visibleBox = collectVisibleModelBounds(context.scene);
  if (!visibleBox) {
    setStatus('Fit Selection: no selection');
    return;
  }

  fitBox(visibleBox, context, 'Fit Selection: no selection, fit all');
}

function getContext() {
  const runtime = getRuntime();
  const renderer = state.renderer || runtime?.renderer || null;
  const scene = state.scene || runtime?.scene || null;
  const camera = state.camera || runtime?.camera || null;
  const controls = state.controls || null;

  if (!renderer || !scene || !camera) {
    setStatus('Fit unavailable: viewer not ready');
    return null;
  }

  return { renderer, scene, camera, controls };
}

function getRuntime() {
  return window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function collectSelectionBounds(scene) {
  const syncedObject = window.__3D_MARKUP_SELECTED_OBJECT__ || null;
  if (syncedObject?.visible !== false) {
    const syncedBox = new THREE.Box3().setFromObject(syncedObject);
    if (isValidBox(syncedBox)) return syncedBox;
  }

  let selectionHelper = null;
  scene?.traverse?.((object) => {
    const name = String(object.name || '').toUpperCase();
    if (!selectionHelper && SELECTION_HELPER_NAMES.has(name)) selectionHelper = object;
  });

  if (!selectionHelper || selectionHelper.visible === false) return null;

  const box = new THREE.Box3().setFromObject(selectionHelper);
  return isValidBox(box) ? box : null;
}

function collectVisibleModelBounds(scene) {
  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  let count = 0;

  scene?.updateMatrixWorld?.(true);
  scene?.traverse?.((object) => {
    if (shouldSkipObject(object)) return;
    if (!object.geometry) return;

    scratch.setFromObject(object);
    if (!isValidBox(scratch)) return;

    box.union(scratch);
    count += 1;
  });

  if (!count || !isValidBox(box)) return null;
  return box;
}

function shouldSkipObject(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;

  const name = String(object.name || '').toLowerCase();
  if (SKIP_NAME_PATTERNS.some((pattern) => name.includes(pattern))) return true;

  let parent = object.parent;
  while (parent) {
    const parentName = String(parent.name || '').toLowerCase();
    if (SKIP_NAME_PATTERNS.some((pattern) => parentName.includes(pattern))) return true;
    parent = parent.parent;
  }

  return false;
}

function fitBox(box, context, label) {
  const now = performance.now();
  if (now - state.lastFitAt < 60) return;
  state.lastFitAt = now;

  const { renderer, camera, controls } = context;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 0.001);

  const rect = renderer.domElement.getBoundingClientRect();
  const aspect = rect.width && rect.height ? rect.width / rect.height : camera.aspect || 1;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov || 48);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const controllingFov = Math.max(Math.min(verticalFov, horizontalFov), THREE.MathUtils.degToRad(10));
  const distance = Math.max(radius / Math.sin(controllingFov / 2), radius * 2.4) * 1.08;

  let direction = resolveViewDirection(camera, controls, center);

  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.near = Math.max(0.01, distance / 5000);
  camera.far = Math.max(1000, distance + radius * 12);
  camera.updateProjectionMatrix();

  if (controls?.target?.copy) {
    controls.target.copy(center);
    controls.update?.();
  } else {
    camera.lookAt(center);
  }

  setStatus(label);
}

function resolveViewDirection(camera, controls, center) {
  const currentTarget = controls?.target?.clone?.() || center.clone();
  let direction = camera.position.clone().sub(currentTarget);

  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 1e-8) {
    direction = camera.position.clone().sub(center);
  }

  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 1e-8) {
    direction = DEFAULT_VIEW.clone();
  }

  return direction.normalize();
}

function isValidBox(box) {
  return Boolean(box) && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);
}

function isInputFocused() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function setStatus(message) {
  const pill = document.getElementById('runtimeStatus');
  if (pill) pill.textContent = message;
}

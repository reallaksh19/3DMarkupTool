import * as THREE from 'three';

// Phase 1 recovery controller: navigation smoothness only.
// Rules: no startup scene traversal, no setInterval, no ribbon relocation.
const NAVIGATION_SMOOTHNESS_VERSION = 'navigation-smoothness-20260619';
const FIT_PADDING = 1.22;
const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(1.1, 0.78, 1.12);
const VIEW_DIRECTIONS = {
  iso: DEFAULT_VIEW_DIRECTION,
  top: new THREE.Vector3(0, 1, 0.001),
  front: new THREE.Vector3(0, 0.08, 1),
  side: new THREE.Vector3(1, 0.08, 0)
};

let lastRuntime = null;
let listenersInstalled = false;

applyNavigationPreset('module-load');
installUiHooks();
window.addEventListener('markup:app-ready', () => applyNavigationPreset('markup:app-ready'), { once: true });
window.addEventListener('viewer:runtime-context', (event) => applyNavigationPreset(event.detail || 'viewer:runtime-context'));
window.addEventListener('viewer:model-loaded', () => applyNavigationPreset('viewer:model-loaded'));

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function applyNavigationPreset(reason = 'manual') {
  const ctx = runtime();
  if (!ctx?.camera || !ctx?.controls) return false;
  lastRuntime = ctx;
  const controls = ctx.controls;

  controls.enableDamping = true;
  controls.dampingFactor = 0.045;
  controls.rotateSpeed = 0.52;
  controls.zoomSpeed = 0.42;
  controls.panSpeed = 0.62;
  controls.screenSpacePanning = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.minDistance = 0.001;
  controls.maxDistance = 100000000;
  controls.zoomToCursor = true;

  ctx.camera.near = Math.max(0.001, ctx.camera.near || 0.01);
  ctx.camera.far = Math.max(ctx.camera.far || 1000, 1000);
  ctx.camera.updateProjectionMatrix?.();
  controls.update?.();

  window.__3D_MARKUP_NAVIGATION_SMOOTHNESS_LAST_REASON__ = reason;
  return true;
}

function installUiHooks() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  const onReady = () => {
    bindFitButton('resetCameraBtn', () => fitModel(VIEW_DIRECTIONS.iso, 'fit-all'));
    bindFitButton('fitSelectionBtn', () => fitSelected('fit-selected'));
    bindFitButton('viewIsoBtn', () => fitModel(VIEW_DIRECTIONS.iso, 'view-iso'));
    bindFitButton('viewTopBtn', () => fitModel(VIEW_DIRECTIONS.top, 'view-top'));
    bindFitButton('viewFrontBtn', () => fitModel(VIEW_DIRECTIONS.front, 'view-front'));
    bindFitButton('viewSideBtn', () => fitModel(VIEW_DIRECTIONS.side, 'view-side'));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();
}

function bindFitButton(id, handler) {
  const button = document.getElementById(id);
  if (!button || button.dataset.navigationSmoothnessBound === '1') return;
  button.dataset.navigationSmoothnessBound = '1';
  button.addEventListener('click', (event) => {
    const ctx = runtime();
    if (!ctx?.camera || !ctx?.controls) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handler();
  }, true);
}

function fitModel(direction = VIEW_DIRECTIONS.iso, source = 'fit-model') {
  const ctx = runtime();
  const root = ctx?.getModelRoot?.() || ctx?.modelRoot;
  if (!root || root === ctx?.scene) return false;
  const box = new THREE.Box3().setFromObject(root);
  return fitBox(box, direction, source);
}

function fitSelected(source = 'fit-selected') {
  const ctx = runtime();
  const selected = ctx?.selectedObject;
  if (!selected) return fitModel(VIEW_DIRECTIONS.iso, source);
  const box = new THREE.Box3().setFromObject(selected);
  if (!isValidBox(box)) return fitModel(VIEW_DIRECTIONS.iso, source);
  return fitBox(box, VIEW_DIRECTIONS.iso, source);
}

function fitBox(box, direction = VIEW_DIRECTIONS.iso, source = 'fit-box') {
  const ctx = runtime();
  if (!ctx?.camera || !ctx?.controls || !isValidBox(box)) return false;
  applyNavigationPreset(source);

  const camera = ctx.camera;
  const controls = ctx.controls;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, Math.max(size.x, size.y, size.z) * 0.5, 0.001);
  const fov = THREE.MathUtils.degToRad(camera.fov || 48);
  const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;
  const verticalDistance = size.y / (2 * Math.tan(fov / 2));
  const horizontalDistance = size.x / (2 * Math.tan(fov / 2) * aspect);
  const sphereDistance = radius / Math.sin(fov / 2);
  const distance = Math.max(verticalDistance, horizontalDistance, sphereDistance, radius * 2.2, 1) * FIT_PADDING;
  const dir = direction.clone().normalize();

  controls.target.copy(center);
  camera.position.copy(center).add(dir.multiplyScalar(distance));
  camera.near = Math.max(distance / 10000, radius / 5000, 0.001);
  camera.far = Math.max(distance + radius * 8, distance * 8, 1000);
  camera.updateProjectionMatrix();
  controls.update();
  ctx.renderOnce?.(`navigation-smoothness:${source}`);
  window.dispatchEvent(new CustomEvent('viewer:navigation-smoothness', {
    detail: { source, center: center.toArray(), radius, distance, version: NAVIGATION_SMOOTHNESS_VERSION }
  }));
  return true;
}

function isValidBox(box) {
  return Boolean(box)
    && Number.isFinite(box.min?.x)
    && Number.isFinite(box.min?.y)
    && Number.isFinite(box.min?.z)
    && Number.isFinite(box.max?.x)
    && Number.isFinite(box.max?.y)
    && Number.isFinite(box.max?.z);
}

function checklist() {
  const ctx = runtime();
  const controls = ctx?.controls || lastRuntime?.controls;
  return {
    version: NAVIGATION_SMOOTHNESS_VERSION,
    hasRuntime: Boolean(ctx || lastRuntime),
    noIntervalPolling: true,
    noStartupSceneTraversal: true,
    damping: controls?.enableDamping === true,
    dampingFactor: controls?.dampingFactor,
    rotateSpeed: controls?.rotateSpeed,
    zoomSpeed: controls?.zoomSpeed,
    panSpeed: controls?.panSpeed,
    zoomToCursor: controls?.zoomToCursor === true,
    hasFitApi: true
  };
}

window.__3D_MARKUP_NAVIGATION_SMOOTHNESS__ = {
  version: NAVIGATION_SMOOTHNESS_VERSION,
  apply: applyNavigationPreset,
  fitModel,
  fitSelected,
  checklist
};

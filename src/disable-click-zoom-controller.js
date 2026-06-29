const DISABLE_CLICK_ZOOM_SCHEMA = 'DisableClickZoomController.v4';
const CLICK_TOLERANCE_PX = 5;

let pointerSnapshot = null;
let lastWheelMs = 0;
let enforceTimer = null;

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installDisableClickZoomController, { once: true });
} else {
  installDisableClickZoomController();
}

export function installDisableClickZoomController() {
  if (window.__3D_MARKUP_DISABLE_CLICK_ZOOM__?.schema === DISABLE_CLICK_ZOOM_SCHEMA) return window.__3D_MARKUP_DISABLE_CLICK_ZOOM__;
  const api = { schema: DISABLE_CLICK_ZOOM_SCHEMA, enabled: true, install: attachGuards, enforce: enforceSelectModeNavigationPolicy };
  window.__3D_MARKUP_DISABLE_CLICK_ZOOM__ = api;
  attachGuards();
  startEnforcementLoop();
  enforceSelectModeNavigationPolicy('install');
  window.addEventListener('markup:app-ready', () => { attachGuards(); enforceSelectModeNavigationPolicy('markup:app-ready'); });
  window.addEventListener('viewer:runtime-context', () => { attachGuards(); enforceSelectModeNavigationPolicy('viewer:runtime-context'); });
  window.addEventListener('viewer:app-module-loaded', () => setTimeout(() => enforceSelectModeNavigationPolicy('app-module-loaded'), 0));
  window.addEventListener('viewer:app-bundle-ready', () => setTimeout(() => enforceSelectModeNavigationPolicy('app-bundle-ready'), 0));
  window.addEventListener('click', (event) => {
    if (event.target?.closest?.('#selectToolBtn')) setTimeout(() => enforceSelectModeNavigationPolicy('select-tool-click'), 0);
  }, true);
  return api;
}

function attachGuards() {
  const targets = new Set([
    document.getElementById('viewer'),
    document.querySelector('#viewer canvas'),
    window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer?.domElement
  ].filter(Boolean));
  for (const target of targets) {
    if (target.__disableClickZoomInstalledV4) continue;
    target.__disableClickZoomInstalledV4 = true;
    target.addEventListener('pointerdown', snapshotCameraForClick, true);
    target.addEventListener('pointerup', restoreCameraAfterSelectionClick, true);
    target.addEventListener('wheel', () => { lastWheelMs = performance.now(); }, true);
    target.addEventListener('dblclick', suppressClickZoom, true);
    target.addEventListener('click', suppressMultiClickZoom, true);
  }
}

function startEnforcementLoop() {
  if (enforceTimer) return;
  enforceTimer = setInterval(() => {
    attachGuards();
    enforceSelectModeNavigationPolicy('interval');
  }, 500);
}

function snapshotCameraForClick(event) {
  if (!isViewerEvent(event) || event.button !== 0) return;
  enforceSelectModeNavigationPolicy('pointerdown-capture');
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  const camera = runtime.camera;
  const target = runtime.controls?.target;
  if (!camera || !target) return;
  pointerSnapshot = {
    x: event.clientX,
    y: event.clientY,
    button: event.button,
    time: performance.now(),
    cameraPosition: camera.position.clone(),
    cameraZoom: camera.zoom,
    cameraQuaternion: camera.quaternion.clone(),
    target: target.clone()
  };
}

function restoreCameraAfterSelectionClick(event) {
  if (!isViewerEvent(event) || !pointerSnapshot || pointerSnapshot.button !== 0) return;
  const dx = Math.abs(event.clientX - pointerSnapshot.x);
  const dy = Math.abs(event.clientY - pointerSnapshot.y);
  const isClick = dx <= CLICK_TOLERANCE_PX && dy <= CLICK_TOLERANCE_PX;
  const snapshot = pointerSnapshot;
  pointerSnapshot = null;
  if (!isClick) return;
  if (performance.now() - lastWheelMs < 350) return;
  for (const delay of [0, 50, 160, 320, 640]) {
    setTimeout(() => restoreIfCameraMovedFromClick(snapshot, event, delay), delay);
  }
}

function restoreIfCameraMovedFromClick(snapshot, event, delay) {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  const camera = runtime.camera;
  const controls = runtime.controls;
  if (!camera || !controls?.target) return;
  const moved = camera.position.distanceTo(snapshot.cameraPosition) > 1e-6
    || controls.target.distanceTo(snapshot.target) > 1e-6
    || Math.abs((camera.zoom || 1) - (snapshot.cameraZoom || 1)) > 1e-6;
  if (!moved) return;
  camera.position.copy(snapshot.cameraPosition);
  camera.quaternion.copy(snapshot.cameraQuaternion);
  camera.zoom = snapshot.cameraZoom;
  camera.updateProjectionMatrix?.();
  controls.target.copy(snapshot.target);
  controls.update?.();
  enforceSelectModeNavigationPolicy(`restore-${delay}`);
  runtime.renderOnce?.('disable-click-zoom:restore-selection-click');
  publishBlocked(event, `selection-click-camera-restore-${delay}`);
}

function enforceSelectModeNavigationPolicy(source = 'enforce') {
  if (!isSelectModeActive()) return false;
  const controls = window.__3D_MARKUP_VIEWER_RUNTIME__?.controls;
  if (!controls) return false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.mouseButtons = {
    ...(controls.mouseButtons || {}),
    LEFT: undefined
  };
  controls.update?.();
  window.__3D_MARKUP_DISABLE_CLICK_ZOOM_LAST_ENFORCED__ = { schema: DISABLE_CLICK_ZOOM_SCHEMA, source, at: new Date().toISOString() };
  return true;
}

function isSelectModeActive() {
  const orbitButton = document.getElementById('orbitToolBtn');
  const panButton = document.getElementById('panToolBtn');
  if (orbitButton?.classList.contains('tool-active') || orbitButton?.classList.contains('active')) return false;
  if (panButton?.classList.contains('tool-active') || panButton?.classList.contains('active')) return false;
  return true;
}

function suppressClickZoom(event) {
  if (!isViewerEvent(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation?.();
  publishBlocked(event, 'dblclick');
}

function suppressMultiClickZoom(event) {
  if (!isViewerEvent(event)) return;
  if (Number(event.detail || 0) < 2) return;
  event.preventDefault();
  event.stopImmediatePropagation?.();
  publishBlocked(event, 'multi-click');
}

function isViewerEvent(event) {
  const viewer = document.getElementById('viewer');
  return Boolean(viewer && event?.target && viewer.contains(event.target));
}

function publishBlocked(event, source) {
  window.dispatchEvent(new CustomEvent('viewer:click-zoom-disabled', {
    detail: {
      schema: DISABLE_CLICK_ZOOM_SCHEMA,
      source,
      x: event.clientX,
      y: event.clientY,
      message: 'Click-to-zoom disabled; use mouse wheel, Fit All, or Fit Selection.'
    }
  }));
}

const DISABLE_CLICK_ZOOM_SCHEMA = 'DisableClickZoomController.v2';
const CLICK_TOLERANCE_PX = 5;

let pointerSnapshot = null;
let lastWheelMs = 0;

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installDisableClickZoomController, { once: true });
} else {
  installDisableClickZoomController();
}

export function installDisableClickZoomController() {
  if (window.__3D_MARKUP_DISABLE_CLICK_ZOOM__?.schema === DISABLE_CLICK_ZOOM_SCHEMA) return window.__3D_MARKUP_DISABLE_CLICK_ZOOM__;
  const api = { schema: DISABLE_CLICK_ZOOM_SCHEMA, enabled: true, install: attachGuards };
  window.__3D_MARKUP_DISABLE_CLICK_ZOOM__ = api;
  attachGuards();
  window.addEventListener('markup:app-ready', attachGuards);
  window.addEventListener('viewer:runtime-context', attachGuards);
  return api;
}

function attachGuards() {
  const targets = new Set([
    document.getElementById('viewer'),
    document.querySelector('#viewer canvas'),
    window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer?.domElement
  ].filter(Boolean));
  for (const target of targets) {
    if (target.__disableClickZoomInstalledV2) continue;
    target.__disableClickZoomInstalledV2 = true;
    target.addEventListener('pointerdown', snapshotCameraForClick, true);
    target.addEventListener('pointerup', restoreCameraAfterSelectionClick, true);
    target.addEventListener('wheel', () => { lastWheelMs = performance.now(); }, true);
    target.addEventListener('dblclick', suppressClickZoom, true);
    target.addEventListener('click', suppressMultiClickZoom, true);
  }
}

function snapshotCameraForClick(event) {
  if (!isViewerEvent(event) || event.button !== 0) return;
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
  for (const delay of [0, 50, 160]) {
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
  runtime.renderOnce?.('disable-click-zoom:restore-selection-click');
  publishBlocked(event, `selection-click-camera-restore-${delay}`);
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

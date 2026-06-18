import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SKIP_PATTERNS = ['grid', 'axes', 'helper', 'measure', 'clip_plane_preview', 'canvas_axis', 'viewcube', 'legend', 'tag_markup', 'navis_tag'];
const state = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  active: false,
  dragging: false,
  start: null,
  rectEl: null,
  button: null
};

captureControls();

function captureControls() {
  const proto = OrbitControls?.prototype;
  if (!proto || proto.__MARKUP_MARQUEE_CAPTURE__) return;
  const originalUpdate = proto.update;
  proto.update = function markupMarqueeCaptureUpdate(...args) {
    state.controls = this;
    return originalUpdate.apply(this, args);
  };
  Object.defineProperty(proto, '__MARKUP_MARQUEE_CAPTURE__', { value: true, configurable: false });
}

function runtime() {
  return window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function bindContext() {
  window.addEventListener('markup:render-context', (event) => {
    const detail = event.detail || {};
    state.renderer = detail.renderer || state.renderer;
    state.scene = detail.scene || state.scene;
    state.camera = detail.camera || state.camera;
  });
  const rt = runtime();
  state.renderer = state.renderer || rt.renderer;
  state.scene = state.scene || rt.scene;
  state.camera = state.camera || rt.camera;
}

function byId(id) {
  return document.getElementById(id);
}

function installStyles() {
  if (byId('marqueeZoomStyles')) return;
  const style = document.createElement('style');
  style.id = 'marqueeZoomStyles';
  style.textContent = `
    .marquee-zoom-active #viewer canvas { cursor: crosshair !important; }
    .marquee-zoom-rect {
      position: absolute;
      z-index: 7900;
      display: none;
      border: 1px solid #ffd166;
      background: rgba(255, 209, 102, 0.16);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.25), inset 0 0 18px rgba(255,209,102,0.12);
      pointer-events: none;
    }
    #marqueeZoomBtn.active, #marqueeZoomBtn[aria-pressed="true"] {
      border-color: rgba(255, 209, 102, 0.9) !important;
      background: rgba(255, 178, 54, 0.2) !important;
      color: #fff2c6 !important;
    }
  `;
  document.head.appendChild(style);
}

function ensureButton() {
  let button = byId('marqueeZoomBtn');
  if (button) return button;

  button = document.createElement('button');
  button.id = 'marqueeZoomBtn';
  button.type = 'button';
  button.className = 'tool-btn icon-text';
  button.title = 'Marquee zoom: drag a rectangle (Z)';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<span aria-hidden="true">▣</span><span>Marquee</span>';

  const anchor = byId('fitSelectionBtn') || byId('resetCameraBtn');
  anchor?.insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => setActive(!state.active));
  state.button = button;
  return button;
}

function ensureRect() {
  if (state.rectEl) return state.rectEl;
  const viewer = byId('viewer');
  const rect = document.createElement('div');
  rect.className = 'marquee-zoom-rect';
  viewer?.appendChild(rect);
  state.rectEl = rect;
  return rect;
}

function setActive(active) {
  state.active = Boolean(active);
  document.body.classList.toggle('marquee-zoom-active', state.active);
  const button = ensureButton();
  button.classList.toggle('active', state.active);
  button.setAttribute('aria-pressed', String(state.active));
  setStatus(state.active ? 'Marquee Zoom: drag window' : 'Select mode');
}

function initMarqueeZoom() {
  installStyles();
  bindContext();
  ensureButton();
  ensureRect();

  window.addEventListener('keydown', (event) => {
    if (isInputFocused()) return;
    if (event.key?.toLowerCase() !== 'z') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setActive(!state.active);
  }, true);

  const attach = () => {
    const canvas = state.renderer?.domElement || runtime().renderer?.domElement;
    if (!canvas || canvas.dataset.marqueeZoomBound === 'true') return;
    canvas.dataset.marqueeZoomBound = 'true';
    canvas.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', cancelDrag, true);
  };

  window.addEventListener('markup:render-context', attach);
  attach();
}

function onPointerDown(event) {
  if (!state.active || event.button !== 0) return;
  const context = getContext();
  if (!context) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  state.dragging = true;
  state.start = pointFromEvent(event, context.renderer.domElement);
  context.controls && (context.controls.enabled = false);
  drawRect(state.start, state.start);
  context.renderer.domElement.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (!state.dragging) return;
  const context = getContext();
  if (!context) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  drawRect(state.start, pointFromEvent(event, context.renderer.domElement));
}

function onPointerUp(event) {
  if (!state.dragging) return;
  const context = getContext();
  if (!context) return cancelDrag();

  event.preventDefault();
  event.stopImmediatePropagation();
  const end = pointFromEvent(event, context.renderer.domElement);
  const rect = normalizeRect(state.start, end);
  cancelDrag(false);

  if (rect.width < 8 || rect.height < 8) {
    setStatus('Marquee Zoom cancelled');
    setActive(false);
    return;
  }

  const box = collectObjectsInsideRect(context, rect);
  if (box) {
    fitBox(box, context, 'Marquee Zoom');
  } else {
    zoomTowardRect(context, rect);
  }
  setActive(false);
}

function cancelDrag(resetStatus = true) {
  state.dragging = false;
  state.start = null;
  if (state.rectEl) state.rectEl.style.display = 'none';
  const controls = state.controls;
  if (controls) controls.enabled = true;
  if (resetStatus && state.active) setStatus('Marquee Zoom: drag window');
}

function pointFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function drawRect(a, b) {
  const viewer = byId('viewer');
  const canvas = state.renderer?.domElement || runtime().renderer?.domElement;
  if (!viewer || !canvas || !state.rectEl) return;
  const canvasRect = canvas.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();
  const r = normalizeRect(a, b);
  Object.assign(state.rectEl.style, {
    display: 'block',
    left: `${canvasRect.left - viewerRect.left + r.left}px`,
    top: `${canvasRect.top - viewerRect.top + r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`
  });
}

function normalizeRect(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function getContext() {
  const rt = runtime();
  const renderer = state.renderer || rt.renderer;
  const scene = state.scene || rt.scene;
  const camera = state.camera || rt.camera;
  const controls = state.controls;
  if (!renderer || !scene || !camera) {
    setStatus('Marquee Zoom unavailable: viewer not ready');
    return null;
  }
  return { renderer, scene, camera, controls };
}

function collectObjectsInsideRect(context, rect) {
  const { scene, camera, renderer } = context;
  const canvasRect = renderer.domElement.getBoundingClientRect();
  const selectedBox = new THREE.Box3();
  const objectBox = new THREE.Box3();
  let count = 0;

  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (shouldSkipObject(object)) return;
    objectBox.setFromObject(object);
    if (!isValidBox(objectBox)) return;
    if (!boxProjectsIntoRect(objectBox, camera, canvasRect, rect)) return;
    selectedBox.union(objectBox);
    count += 1;
  });

  return count && isValidBox(selectedBox) ? selectedBox : null;
}

function boxProjectsIntoRect(box, camera, canvasRect, rect) {
  const points = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z), new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z), new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z), new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z), new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    box.getCenter(new THREE.Vector3())
  ];
  return points.some((point) => {
    const projected = point.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return false;
    const x = (projected.x * 0.5 + 0.5) * canvasRect.width;
    const y = (-projected.y * 0.5 + 0.5) * canvasRect.height;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
}

function shouldSkipObject(object) {
  if (!object || object.visible === false || !object.geometry) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.material?.map) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;
  let cur = object;
  while (cur) {
    const name = String(cur.name || '').toLowerCase();
    if (SKIP_PATTERNS.some((pattern) => name.includes(pattern))) return true;
    cur = cur.parent;
  }
  return false;
}

function fitBox(box, context, label) {
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
  const direction = resolveViewDirection(camera, controls, center);

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

function zoomTowardRect(context, rect) {
  const { renderer, camera, controls } = context;
  const canvasRect = renderer.domElement.getBoundingClientRect();
  const centerNdc = new THREE.Vector2(
    ((rect.left + rect.width / 2) / canvasRect.width) * 2 - 1,
    -(((rect.top + rect.height / 2) / canvasRect.height) * 2 - 1)
  );
  const target = controls?.target?.clone?.() || camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));
  const worldRay = new THREE.Vector3(centerNdc.x, centerNdc.y, 0.5).unproject(camera).sub(camera.position).normalize();
  const distance = Math.max(camera.position.distanceTo(target) * 0.62, 0.5);
  const newTarget = camera.position.clone().add(worldRay.multiplyScalar(distance));
  const direction = camera.position.clone().sub(target).normalize();
  camera.position.copy(newTarget).add(direction.multiplyScalar(distance));
  if (controls?.target?.copy) {
    controls.target.copy(newTarget);
    controls.update?.();
  } else {
    camera.lookAt(newTarget);
  }
  setStatus('Marquee Zoom: no enclosed object, zoomed to window');
}

function resolveViewDirection(camera, controls, center) {
  const currentTarget = controls?.target?.clone?.() || center.clone();
  let direction = camera.position.clone().sub(currentTarget);
  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 1e-8) direction = camera.position.clone().sub(center);
  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 1e-8) direction = new THREE.Vector3(1.1, 0.78, 1.12);
  return direction.normalize();
}

function isValidBox(box) {
  return Boolean(box) && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);
}

function isInputFocused() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function setStatus(message) {
  const pill = byId('runtimeStatus');
  if (pill) pill.textContent = message;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarqueeZoom, { once: true });
} else {
  initMarqueeZoom();
}

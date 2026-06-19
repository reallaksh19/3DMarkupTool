import * as THREE from 'three';

// Adds a compact in-canvas Area Select tool without touching src/app.js.
// Tool: AS = drag a screen window and highlight/select all component roots inside it.

const VERSION = 'area-select-viewpad-20260619';
const STYLE_ID = 'static-area-select-style';
const TOOL_VIEW = 'areaSelect';
const TOOL_LABEL = 'AS';
const TOOL_TITLE = 'Area Select: drag a window to select visible components';
const MIN_DRAG_PX = 10;
const HIGHLIGHT_COLOR = 0x37d8ff;

let active = false;
let drag = null;
let overlay = null;
let button = null;
let selectedRoots = [];
let highlightHelpers = [];

installAreaSelectTool();

function installAreaSelectTool() {
  const start = () => {
    injectStyles();
    ensureButton();
    attachCanvasListeners();
    installApi();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function ensureButton() {
  const pad = document.querySelector('.view-pad');
  if (!pad) return;
  pad.classList.add('view-pad-with-area-select');

  button = pad.querySelector(`[data-view="${TOOL_VIEW}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = TOOL_VIEW;
    button.className = 'viewpad-area-select-btn';
    button.textContent = TOOL_LABEL;
    const anchor = pad.querySelector('[data-view="marqueeZoom"]')
      || pad.querySelector('[data-view="viewPrevious"]')
      || pad.querySelector('[data-view="zoom"]')
      || null;
    pad.insertBefore(button, anchor);
  }

  button.title = TOOL_TITLE;
  button.setAttribute('aria-label', TOOL_TITLE);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  if (!button.__areaSelectClickBound) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      active ? deactivate('Area select off') : activate();
    });
    button.__areaSelectClickBound = true;
  }
}

function attachCanvasListeners() {
  const canvas = runtimeCanvas();
  if (!canvas || canvas.__areaSelectAttached) return;
  canvas.__areaSelectAttached = true;
  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointermove', onPointerMove, true);
  canvas.addEventListener('pointerup', onPointerUp, true);
  canvas.addEventListener('pointercancel', onPointerCancel, true);
  window.addEventListener('keydown', onKeyDown, true);
}

function installApi() {
  window.__3D_MARKUP_AREA_SELECT__ = {
    version: VERSION,
    activate,
    deactivate,
    clear: clearSelectionHighlights,
    isActive: () => active,
    selectedIds: () => selectedRoots.map((root) => objectId(root)).filter(Boolean),
    selectInClientRect,
    debug: () => ({
      version: VERSION,
      active,
      selectedCount: selectedRoots.length,
      selectedIds: selectedRoots.map((root) => objectId(root)).filter(Boolean),
      helperCount: highlightHelpers.length,
      hasRuntime: Boolean(runtime()?.camera)
    })
  };
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function getModelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
}

function activate() {
  active = true;
  document.body.classList.add('area-select-active');
  if (button) {
    button.classList.add('tool-active');
    button.setAttribute('aria-pressed', 'true');
  }
  setStatus('Area select: drag a window in the canvas');
}

function deactivate(message = '') {
  active = false;
  drag = null;
  removeOverlay();
  document.body.classList.remove('area-select-active');
  if (button) {
    button.classList.remove('tool-active');
    button.setAttribute('aria-pressed', 'false');
  }
  if (message) setStatus(message);
}

function onPointerDown(event) {
  if (!active || event.button !== 0) return;
  const rt = runtime();
  if (!rt?.camera || !getModelRoot(rt)) {
    setStatus('Area select unavailable: viewer runtime/model missing');
    deactivate();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY
  };

  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
  createOverlay();
}

function onPointerMove(event) {
  if (!active || !drag) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  drag.currentX = event.clientX;
  drag.currentY = event.clientY;
  updateOverlay();
}

function onPointerUp(event) {
  if (!active || !drag) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const rect = normalizedClientRect(drag.startX, drag.startY, event.clientX, event.clientY);
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  runtimeCanvas()?.releasePointerCapture?.(drag.pointerId);
  removeOverlay();
  drag = null;

  if (width < MIN_DRAG_PX || height < MIN_DRAG_PX) {
    deactivate('Area select canceled');
    return;
  }

  const selected = selectInClientRect(rect, { source: 'viewpad-area-select' });
  deactivate(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
}

function onPointerCancel(event) {
  if (!active) return;
  runtimeCanvas()?.releasePointerCapture?.(event.pointerId);
  deactivate('Area select canceled');
}

function onKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (active) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    deactivate('Area select canceled');
    return;
  }
  if (selectedRoots.length) {
    clearSelectionHighlights({ source: 'escape' });
  }
}

function selectInClientRect(clientRect, { source = 'area-select' } = {}) {
  const rt = runtime();
  const root = getModelRoot(rt);
  const camera = rt?.camera;
  const viewer = document.getElementById('viewer');
  if (!root || !camera || !viewer) return [];

  const viewport = viewer.getBoundingClientRect();
  const rect = clampRectToViewport(clientRect, viewport);
  const candidates = componentRoots(root);
  const selected = [];

  for (const candidate of candidates) {
    const projected = projectedObjectRect(candidate, camera, viewport);
    if (!projected) continue;
    if (rectsIntersect(rect, projected)) selected.push(candidate);
  }

  applySelectionHighlights(selected, rt);
  const ids = selected.map((object) => objectId(object)).filter(Boolean);
  setStatus(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:area-select', {
    detail: {
      action: 'select',
      source,
      selectedCount: selected.length,
      selectedIds: ids,
      rect: rectSummary(rect)
    }
  }));
  return selected;
}

function componentRoots(root) {
  const roots = [];
  root.traverse?.((object) => {
    if (!object || object === root || object.userData?.areaSelectHelper) return;
    if (!isComponentNode(object)) return;
    if (hasComponentAncestor(object, root)) return;
    roots.push(object);
  });
  return roots;
}

function isComponentNode(object) {
  const data = object?.userData || {};
  return Boolean(data.ID || data.id || data.componentId || data.componentClass || data.TYPE === 'COMPONENT');
}

function hasComponentAncestor(object, root) {
  let cursor = object.parent;
  while (cursor && cursor !== root && cursor.type !== 'Scene') {
    if (isComponentNode(cursor)) return true;
    cursor = cursor.parent;
  }
  return false;
}

function projectedObjectRect(object, camera, viewport) {
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  if (!isValidBox(box)) return null;

  const corners = boxCorners(box);
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let anyFinite = false;

  for (const corner of corners) {
    const projected = corner.project(camera);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || !Number.isFinite(projected.z)) continue;
    if (projected.z < -1 || projected.z > 1) continue;
    const x = viewport.left + ((projected.x + 1) / 2) * viewport.width;
    const y = viewport.top + ((1 - projected.y) / 2) * viewport.height;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
    anyFinite = true;
  }

  return anyFinite ? { left, top, right, bottom } : null;
}

function applySelectionHighlights(selected, rt = runtime()) {
  clearSelectionHighlights({ source: 'replace', silent: true });
  selectedRoots = selected.slice();
  const helperRoot = rt?.scene || getModelRoot(rt)?.parent || getModelRoot(rt);
  for (const object of selectedRoots) {
    const helper = new THREE.BoxHelper(object, HIGHLIGHT_COLOR);
    helper.name = `AREA_SELECT_${objectId(object) || object.uuid || 'OBJECT'}`;
    helper.userData = {
      areaSelectHelper: true,
      TYPE: 'AREA_SELECT_HELPER',
      selectedId: objectId(object),
      source: 'viewpad-area-select'
    };
    helperRoot?.add?.(helper);
    highlightHelpers.push(helper);
  }
  rt?.renderOnce?.('area-select');
}

function clearSelectionHighlights({ source = 'area-select-clear', silent = false } = {}) {
  for (const helper of highlightHelpers) {
    helper.parent?.remove?.(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  }
  highlightHelpers = [];
  selectedRoots = [];
  runtime()?.renderOnce?.('area-select-clear');
  if (!silent) {
    setStatus('Area selection cleared');
    window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'clear', source } }));
  }
  return true;
}

function boxCorners(box) {
  const min = box.min;
  const max = box.max;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];
}

function isValidBox(box) {
  return Boolean(box)
    && Number.isFinite(box.min?.x)
    && Number.isFinite(box.min?.y)
    && Number.isFinite(box.min?.z)
    && Number.isFinite(box.max?.x)
    && Number.isFinite(box.max?.y)
    && Number.isFinite(box.max?.z)
    && box.max.x >= box.min.x
    && box.max.y >= box.min.y
    && box.max.z >= box.min.z;
}

function normalizedClientRect(x1, y1, x2, y2) {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2)
  };
}

function clampRectToViewport(rect, viewport) {
  return {
    left: Math.min(Math.max(rect.left, viewport.left), viewport.right),
    top: Math.min(Math.max(rect.top, viewport.top), viewport.bottom),
    right: Math.min(Math.max(rect.right, viewport.left), viewport.right),
    bottom: Math.min(Math.max(rect.bottom, viewport.top), viewport.bottom)
  };
}

function rectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function rectSummary(rect) {
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.right - rect.left),
    height: Math.round(rect.bottom - rect.top)
  };
}

function objectId(object) {
  const data = object?.userData || {};
  return data.ID || data.id || data.componentId || data.NAME || object?.name || '';
}

function createOverlay() {
  removeOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  overlay = document.createElement('div');
  overlay.className = 'area-select-rect';
  viewer.appendChild(overlay);
  updateOverlay();
}

function updateOverlay() {
  if (!overlay || !drag) return;
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  const viewport = viewer.getBoundingClientRect();
  const rect = normalizedClientRect(drag.startX, drag.startY, drag.currentX, drag.currentY);
  const clamped = clampRectToViewport(rect, viewport);
  overlay.style.left = `${clamped.left - viewport.left}px`;
  overlay.style.top = `${clamped.top - viewport.top}px`;
  overlay.style.width = `${Math.max(clamped.right - clamped.left, 1)}px`;
  overlay.style.height = `${Math.max(clamped.bottom - clamped.top, 1)}px`;
}

function removeOverlay() {
  overlay?.remove?.();
  overlay = null;
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('runtimeStatus');
  if (status && message) status.textContent = message;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .view-pad-with-area-select .viewpad-area-select-btn {
      border: 1px solid rgba(61, 220, 151, 0.78);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(15, 88, 64, 0.98), rgba(7, 44, 34, 0.98));
      color: #dfffee;
      font-size: 10px;
      font-weight: 950;
      min-width: 44px;
      min-height: 34px;
      padding: 0 6px;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .view-pad-with-area-select .viewpad-area-select-btn:hover,
    .view-pad-with-area-select .viewpad-area-select-btn:focus-visible,
    .view-pad-with-area-select .viewpad-area-select-btn.tool-active {
      border-color: rgba(114, 255, 198, 1);
      background: linear-gradient(180deg, rgba(20, 128, 89, 0.98), rgba(8, 67, 49, 0.98));
      outline: none;
    }
    body.area-select-active #viewer canvas {
      cursor: crosshair !important;
    }
    .area-select-rect {
      position: absolute;
      z-index: 33;
      pointer-events: none;
      border: 2px solid rgba(61, 220, 151, .98);
      border-radius: 4px;
      background: rgba(61, 220, 151, .14);
      box-shadow: 0 0 0 1px rgba(4, 12, 23, .7), 0 10px 30px rgba(0, 0, 0, .26);
    }
  `;
  document.head.appendChild(style);
}

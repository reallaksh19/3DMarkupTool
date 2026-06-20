import * as THREE from 'three';
import { objectId, resolveSafeHideTarget } from './static-selection-resolver.js';

// Adds a compact in-canvas Section Box tool without touching src/app.js.
// Tool: SB = Section Box from selected component. It writes renderer clipping planes
// through the shared viewer runtime and remains independent of the fresh clip toolbar.
// Phase 6: component-only bounds, explicit Esc clear, no startup scene traversal.

const VERSION = 'section-box-phase6-20260620';
const STYLE_ID = 'static-section-box-from-selection-style';
const TOOL_VIEW = 'sectionBoxSelected';
const TOOL_LABEL = 'SB';
const TOOL_TITLE = 'Section Box from selected component';
const MIN_PADDING = 1;
const PADDING_RATIO = 0.05;

const STATE = {
  active: false,
  lastAction: 'idle',
  lastSource: 'init',
  lastReason: '',
  lastSelectedId: '',
  lastPlaneCount: 0
};

installSectionBoxTool();

function installSectionBoxTool() {
  const start = () => {
    injectStyles();
    ensureButton();
    bindEscClear();
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
  pad.classList.add('view-pad-with-section-box');

  let button = pad.querySelector(`[data-view="${TOOL_VIEW}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = TOOL_VIEW;
    button.className = 'viewpad-section-box-btn';
    button.textContent = TOOL_LABEL;
    const anchor = pad.querySelector('[data-view="marqueeZoom"]')
      || pad.querySelector('[data-view="viewPrevious"]')
      || pad.querySelector('[data-view="zoom"]')
      || null;
    pad.insertBefore(button, anchor);
  }

  button.title = TOOL_TITLE;
  button.setAttribute('aria-label', TOOL_TITLE);
  if (!button.__sectionBoxClickBound) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      applySectionBoxFromSelection({ source: 'viewpad-section-box' });
    });
    button.__sectionBoxClickBound = true;
  }
}

function bindEscClear() {
  if (window.__3D_MARKUP_SECTION_BOX_ESC_BOUND__) return;
  window.__3D_MARKUP_SECTION_BOX_ESC_BOUND__ = true;
  window.addEventListener('keydown', (event) => {
    if (!STATE.active) return;
    if (hasInputFocus()) return;
    if (event.key !== 'Escape') return;
    clearSectionBox({ source: 'escape' });
  }, true);
}

function installApi() {
  window.__3D_MARKUP_SECTION_BOX__ = {
    version: VERSION,
    state: STATE,
    apply: () => applySectionBoxFromSelection({ source: 'api-section-box' }),
    clear: () => clearSectionBox({ source: 'api-clear-section-box' }),
    debug: () => debugSnapshot()
  };
}

function applySectionBoxFromSelection({ source = 'section-box' } = {}) {
  const rt = runtime();
  const renderer = rt?.renderer;
  const selected = resolveSafeHideTarget(undefined, { runtime: rt });
  if (!selected) {
    setStatus('Select a component/part before Section Box');
    remember('fail', source, 'missing-safe-selection', '', 0);
    dispatchSectionBox('fail', { source, reason: 'missing-safe-selection', resolver: 'shared-selection-resolver' });
    return false;
  }

  const selectedId = objectId(selected);
  const box = boundsForObject(selected);
  if (!isValidBox(box)) {
    setStatus('Section Box failed: selected component has no valid bounds');
    remember('fail', source, 'invalid-bounds', selectedId, 0);
    dispatchSectionBox('fail', { source, reason: 'invalid-bounds', selectedId });
    return false;
  }

  if (!renderer && typeof rt?.applyClipping !== 'function') {
    setStatus('Section Box failed: renderer not ready');
    remember('fail', source, 'renderer-missing', selectedId, 0);
    dispatchSectionBox('fail', {
      source,
      reason: 'renderer-missing',
      selectedId,
      runtimeKeys: Object.keys(rt || {})
    });
    return false;
  }

  const expandedBox = expandedSectionBox(box);
  const planes = planesForBox(expandedBox);
  const meta = {
    mode: 'box',
    source: 'viewpad-section-box',
    trigger: source,
    resolver: 'shared-selection-resolver',
    selectedId,
    padding: sectionPadding(box),
    box: boxSummary(expandedBox)
  };

  if (typeof rt.applyClipping === 'function') {
    rt.applyClipping(planes, meta);
  }
  if (renderer) {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = planes;
  }
  rt.clippingPlanes = planes;
  rt.clippingMode = 'box';
  rt.source = 'viewpad-section-box';
  window.__3D_MARKUP_VIEWER_RUNTIME__ = rt;
  window.__3D_MARKUP_CLIP_RUNTIME__ = rt;

  requestRender(rt, 'section-box-selected');
  remember('apply', source, '', selectedId, planes.length);
  setStatus(`Section Box: ${selectedId || 'selected component'}`);
  dispatchSectionBox('apply', {
    ...meta,
    rendererReady: Boolean(renderer),
    rendererPlaneCount: Array.isArray(renderer?.clippingPlanes) ? renderer.clippingPlanes.length : planes.length
  });
  return true;
}

function clearSectionBox({ source = 'section-box-clear' } = {}) {
  const rt = runtime();
  const renderer = rt?.renderer;
  if (typeof rt?.clearClipping === 'function') {
    rt.clearClipping({ source: 'viewpad-section-box-clear', trigger: source });
  } else if (renderer) {
    renderer.localClippingEnabled = false;
    renderer.clippingPlanes = [];
    rt.clippingPlanes = [];
    rt.clippingMode = 'none';
  }
  requestRender(rt, 'section-box-clear');
  remember('clear', source, '', '', 0);
  setStatus('Section Box cleared');
  dispatchSectionBox('clear', { source, rendererReady: Boolean(renderer) });
  return true;
}

function remember(action, source, reason = '', selectedId = '', planeCount = 0) {
  STATE.active = action === 'apply';
  STATE.lastAction = action;
  STATE.lastSource = source;
  STATE.lastReason = reason;
  STATE.lastSelectedId = selectedId;
  STATE.lastPlaneCount = planeCount;
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function boundsForObject(object) {
  object?.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return isValidBox(box) ? box : null;
}

function sectionPadding(box) {
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxSize = Math.max(size.x, size.y, size.z, 0);
  return Math.max(MIN_PADDING, maxSize * PADDING_RATIO);
}

function expandedSectionBox(box) {
  return box.clone().expandByScalar(sectionPadding(box));
}

function planesForBox(box) {
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min.z),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max.z)
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

function boxSummary(box) {
  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
    size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)]
  };
}

function requestRender(rt, reason) {
  if (typeof rt?.renderOnce === 'function') {
    rt.renderOnce(reason);
    return;
  }
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { source: reason } }));
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('runtimeStatus');
  if (status && message) status.textContent = message;
}

function dispatchSectionBox(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:section-box', {
    detail: { action, ...detail }
  }));
}

function debugSnapshot() {
  const rt = runtime();
  const renderer = rt?.renderer;
  const selected = resolveSafeHideTarget(undefined, { runtime: rt });
  return {
    version: VERSION,
    state: { ...STATE },
    hasRenderer: Boolean(renderer),
    rendererLocalClipping: Boolean(renderer?.localClippingEnabled),
    rendererPlaneCount: Array.isArray(renderer?.clippingPlanes) ? renderer.clippingPlanes.length : 0,
    selectedId: objectId(selected),
    hasSelected: Boolean(selected),
    runtimeKeys: Object.keys(rt || {}),
    resolver: 'shared-selection-resolver',
    escapeClears: true
  };
}

function hasInputFocus() {
  const tag = document.activeElement?.tagName;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .view-pad-with-section-box .viewpad-section-box-btn {
      border: 1px solid rgba(247, 183, 92, 0.8);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(84, 58, 19, 0.98), rgba(41, 27, 8, 0.98));
      color: #fff0cc;
      font-size: 10px;
      font-weight: 950;
      min-width: 44px;
      min-height: 34px;
      padding: 0 6px;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .view-pad-with-section-box .viewpad-section-box-btn:hover,
    .view-pad-with-section-box .viewpad-section-box-btn:focus-visible {
      border-color: rgba(255, 211, 128, 1);
      background: linear-gradient(180deg, rgba(130, 85, 24, 0.98), rgba(64, 41, 10, 0.98));
      outline: none;
    }
  `;
  document.head.appendChild(style);
}

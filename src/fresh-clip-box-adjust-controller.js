import * as THREE from 'three';

// BOX-mode extension for the fresh renderer clipping controller.
// Keeps Plane adjustment as X/Y/Z, but changes Box adjustment to a uniform BOX size control.

const VERSION = 'fresh-clip-box-adjust-20260619';
const LOG_PREFIX = '[3DMarkupTool:fresh-clip-box-adjust]';
const BOX_AXIS_VALUE = 'box';
const BOX_ORIGINAL_PERCENT = 50;
const BOX_MIN_PERCENT = 0;
const BOX_MAX_PERCENT = 500;
const BOX_STEP = 5;

runWhenDomReady(() => waitForFreshClip(initBoxAdjust));

function runWhenDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function waitForFreshClip(callback) {
  if (window.__3D_MARKUP_FRESH_CLIP__?.state) {
    callback();
    return;
  }
  let done = false;
  const start = () => {
    if (done) return;
    if (!window.__3D_MARKUP_FRESH_CLIP__?.state) return;
    done = true;
    callback();
  };
  window.addEventListener('viewer:fresh-clip-ready', start);
  window.setTimeout(start, 300);
  window.setTimeout(start, 900);
  window.setTimeout(start, 1800);
}

function initBoxAdjust() {
  installStyles();
  installControlInterceptors();
  installApiPatch();
  refreshBoxUi('init');

  window.addEventListener('viewer:clipping-changed', (event) => {
    const detail = event.detail || {};
    if (detail.mode === 'box' || getState().mode === 'box') {
      refreshBoxUi('clipping-changed');
    }
  });
  window.addEventListener('viewer:runtime-context', () => refreshBoxUi('runtime-context'));
  window.addEventListener('viewer:selection-changed', () => refreshBoxUi('selection-changed'));

  window.__3D_MARKUP_FRESH_BOX_ADJUST__ = {
    version: VERSION,
    apply: () => applyAdjustedBox({ source: 'api-box-adjust' }),
    reset: () => resetBoxSize('api-box-reset'),
    debug: () => debugSnapshot()
  };

  console.info(LOG_PREFIX, { event: 'ready', version: VERSION, maxPercent: BOX_MAX_PERCENT });
}

function installStyles() {
  if (document.getElementById('freshClipBoxAdjustStyles')) return;
  const style = document.createElement('style');
  style.id = 'freshClipBoxAdjustStyles';
  style.textContent = `
    #freshClipPanel[data-clip-mode='box'] #freshClipAxisSelect {
      pointer-events: none;
      color: #ffe5ad;
      border-color: rgba(247, 183, 92, .65);
      font-weight: 950;
    }
    #freshClipPanel[data-clip-mode='box'] .fresh-clip-check {
      visibility: hidden;
    }
    #freshClipPanel[data-clip-mode='box'] #freshClipSlider {
      accent-color: #f7b75c;
    }
  `;
  document.head.appendChild(style);
}

function installControlInterceptors() {
  bindCapture('freshClipBoxBtn', 'click', () => prepareBoxMode('toolbar-box'));
  bindCapture('freshClipApplyBoxBtn', 'click', () => prepareBoxMode('panel-box'));
  bindCapture('freshClipPlaneBtn', 'click', () => preparePlaneMode('toolbar-plane'));
  bindCapture('freshClipApplyPlaneBtn', 'click', () => preparePlaneMode('panel-plane'));

  bindCapture('freshClipSlider', 'input', (event) => handleBoxPercentInput(event, 'slider'));
  bindCapture('freshClipOffsetInput', 'input', (event) => handleBoxPercentInput(event, 'number'));
  bindCapture('freshClipStepDownBtn', 'click', (event) => stepBox(event, -BOX_STEP));
  bindCapture('freshClipStepUpBtn', 'click', (event) => stepBox(event, BOX_STEP));
  bindCapture('freshClipAxisSelect', 'change', (event) => {
    if (!isBoxMode()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    getState().axis = BOX_AXIS_VALUE;
    refreshBoxUi('axis-lock');
  });
}

function installApiPatch() {
  const api = window.__3D_MARKUP_FRESH_CLIP__;
  if (!api || api.__boxAdjustPatched) return;
  const originalBox = typeof api.box === 'function' ? api.box.bind(api) : null;
  const originalPlane = typeof api.plane === 'function' ? api.plane.bind(api) : null;

  api.box = () => {
    prepareBoxMode('api-box');
    const result = originalBox ? originalBox() : false;
    window.setTimeout(() => refreshBoxUi('api-box-after'), 0);
    return result;
  };

  api.plane = () => {
    preparePlaneMode('api-plane');
    const result = originalPlane ? originalPlane() : false;
    window.setTimeout(() => refreshBoxUi('api-plane-after'), 0);
    return result;
  };

  api.__boxAdjustPatched = true;
}

function bindCapture(id, eventName, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  const key = `__freshClipBoxAdjust_${eventName}`;
  if (element[key]) return;
  element.addEventListener(eventName, handler, true);
  element[key] = true;
}

function prepareBoxMode(source) {
  const state = getState();
  state.axis = BOX_AXIS_VALUE;
  state.percent = BOX_ORIGINAL_PERCENT;
  state.boxPercent = BOX_ORIGINAL_PERCENT;
  state.lastSource = source;
  window.setTimeout(() => refreshBoxUi(`${source}-prepared`), 0);
}

function preparePlaneMode(source) {
  const state = getState();
  if (state.axis === BOX_AXIS_VALUE) state.axis = 'x';
  if (!['x', 'y', 'z'].includes(state.axis)) state.axis = 'x';
  state.lastSource = source;
  window.setTimeout(() => refreshBoxUi(`${source}-prepared`), 0);
}

function handleBoxPercentInput(event, source) {
  if (!isBoxMode()) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const state = getState();
  const percent = clampBoxPercent(Number(event.target?.value));
  state.percent = percent;
  state.boxPercent = percent;
  state.axis = BOX_AXIS_VALUE;
  syncPercentControls(percent, event.target?.id || '');
  applyAdjustedBox({ source: `box-${source}` });
}

function stepBox(event, delta) {
  if (!isBoxMode()) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const state = getState();
  const percent = clampBoxPercent(Number(state.boxPercent ?? state.percent ?? BOX_ORIGINAL_PERCENT) + delta);
  state.percent = percent;
  state.boxPercent = percent;
  state.axis = BOX_AXIS_VALUE;
  syncPercentControls(percent);
  applyAdjustedBox({ source: delta < 0 ? 'box-step-down' : 'box-step-up' });
}

function resetBoxSize(source = 'box-reset') {
  const state = getState();
  state.percent = BOX_ORIGINAL_PERCENT;
  state.boxPercent = BOX_ORIGINAL_PERCENT;
  state.axis = BOX_AXIS_VALUE;
  syncPercentControls(BOX_ORIGINAL_PERCENT);
  return applyAdjustedBox({ source });
}

function applyAdjustedBox({ source = 'box-adjust' } = {}) {
  const state = getState();
  if (!isBoxMode() || !isValidBox(state.baselineBox)) {
    refreshBoxUi(`${source}-skip`);
    return false;
  }

  const runtime = getRuntime();
  const renderer = runtime.renderer;
  if (!renderer) {
    state.lastError = 'Renderer is not ready.';
    refreshBoxUi(`${source}-renderer-missing`);
    return false;
  }

  const percent = clampBoxPercent(Number(state.boxPercent ?? state.percent ?? BOX_ORIGINAL_PERCENT));
  state.percent = percent;
  state.boxPercent = percent;
  state.axis = BOX_AXIS_VALUE;

  const adjustedBox = adjustedBoxFromPercent(state.baselineBox, percent);
  const planes = planesForBox(adjustedBox);
  const meta = {
    mode: 'box',
    source: 'fresh-clip-box-adjust',
    trigger: source,
    baselineLabel: state.baselineLabel,
    boxPercent: percent,
    baselineBox: boxSummary(state.baselineBox),
    adjustedBox: boxSummary(adjustedBox)
  };

  if (typeof runtime.applyClipping === 'function') {
    runtime.applyClipping(planes, meta);
  }
  renderer.localClippingEnabled = planes.length > 0;
  renderer.clippingPlanes = planes;
  runtime.clippingPlanes = planes;
  runtime.clippingMode = 'box';
  runtime.source = 'fresh-clip-box-adjust';
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
  requestRender(runtime, 'fresh-clip-box-adjust');

  state.mode = 'box';
  state.active = true;
  state.lastError = '';
  state.lastSource = source;
  setStatus(`Box clip: ${state.baselineLabel || 'selected component'} · size ${percent}%`);

  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', {
    detail: {
      ...meta,
      planes,
      rendererReady: true,
      rendererPlaneCount: renderer.clippingPlanes.length,
      rendererLocalClipping: renderer.localClippingEnabled
    }
  }));

  refreshBoxUi(source);
  return true;
}

function adjustedBoxFromPercent(box, percent) {
  const base = box.clone();
  const size = new THREE.Vector3();
  base.getSize(size);

  // 50 = exact selected-object bounds. 0 shrinks to the center.
  // Values above 100 continue expanding the box beyond 2x selected-object size.
  const factor = (percent - BOX_ORIGINAL_PERCENT) / BOX_ORIGINAL_PERCENT;
  const delta = new THREE.Vector3(
    Math.max(size.x, 0.000001) * 0.5 * factor,
    Math.max(size.y, 0.000001) * 0.5 * factor,
    Math.max(size.z, 0.000001) * 0.5 * factor
  );

  const adjusted = base.clone().expandByVector(delta);
  if (isValidBox(adjusted)) return adjusted;

  const center = new THREE.Vector3();
  base.getCenter(center);
  return new THREE.Box3(center.clone(), center.clone());
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

function refreshBoxUi(reason = 'ui') {
  const state = getState();
  const panel = document.getElementById('freshClipPanel');
  const mode = document.getElementById('freshClipMode');
  const axisLabel = document.querySelector('label[for="freshClipAxisSelect"]');
  const axis = document.getElementById('freshClipAxisSelect');
  const invert = document.getElementById('freshClipInvertCheck');
  const positionLabel = document.querySelector('label[for="freshClipSlider"]');
  const readout = document.getElementById('freshClipReadout');

  if (panel) panel.dataset.clipMode = isBoxMode() ? 'box' : (state.mode || 'none');

  if (isBoxMode()) {
    state.axis = BOX_AXIS_VALUE;
    ensureBoxAxisOption(axis);
    syncPercentControls(Number(state.boxPercent ?? state.percent ?? BOX_ORIGINAL_PERCENT));
    if (axisLabel) axisLabel.textContent = 'Mode';
    if (axis) {
      axis.value = BOX_AXIS_VALUE;
      axis.title = 'BOX mode uses six planes; use Box Size to shrink or expand all faces.';
      axis.setAttribute('aria-label', 'Box clipping mode');
    }
    if (invert) {
      invert.checked = false;
      invert.disabled = true;
    }
    if (positionLabel) positionLabel.textContent = `Box Size (0-${BOX_MAX_PERCENT})`;
    if (mode) mode.textContent = 'BOX';
    if (readout) readout.textContent = boxReadoutText();
  } else {
    ensurePlaneAxisOptions(axis);
    if (axisLabel) axisLabel.textContent = 'Axis';
    if (axis) {
      if (!['x', 'y', 'z'].includes(state.axis)) state.axis = 'x';
      axis.value = state.axis;
      axis.title = 'Clip plane axis';
      axis.setAttribute('aria-label', 'Clip plane axis');
    }
    if (invert) invert.disabled = false;
    if (positionLabel) positionLabel.textContent = 'Position';
  }

  return reason;
}

function ensureBoxAxisOption(axis) {
  if (!axis) return;
  if (axis.options.length !== 1 || axis.options[0]?.value !== BOX_AXIS_VALUE) {
    axis.innerHTML = '<option value="box">BOX</option>';
  }
}

function ensurePlaneAxisOptions(axis) {
  if (!axis) return;
  const hasPlaneOptions = axis.options.length === 3
    && axis.options[0]?.value === 'x'
    && axis.options[1]?.value === 'y'
    && axis.options[2]?.value === 'z';
  if (!hasPlaneOptions) {
    axis.innerHTML = '<option value="x">X</option><option value="y">Y</option><option value="z">Z</option>';
  }
}

function syncPercentControls(percent, changedId = '') {
  const value = String(clampBoxPercent(Number(percent)));
  const slider = document.getElementById('freshClipSlider');
  const input = document.getElementById('freshClipOffsetInput');
  if (slider) {
    slider.min = String(BOX_MIN_PERCENT);
    slider.max = String(BOX_MAX_PERCENT);
    slider.step = String(BOX_STEP);
    if (changedId !== 'freshClipSlider') slider.value = value;
  }
  if (input) {
    input.min = String(BOX_MIN_PERCENT);
    input.max = String(BOX_MAX_PERCENT);
    input.step = String(BOX_STEP);
    if (changedId !== 'freshClipOffsetInput') input.value = value;
  }
}

function boxReadoutText() {
  const state = getState();
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  const planeCount = Array.isArray(renderer?.clippingPlanes) ? renderer.clippingPlanes.length : 0;
  const percent = clampBoxPercent(Number(state.boxPercent ?? state.percent ?? BOX_ORIGINAL_PERCENT));
  if (state.lastError) return state.lastError;
  return `Box clip active. Mode BOX, box size ${percent}% where 50% = selected bounds. Renderer planes: ${planeCount}.`;
}

function isBoxMode() {
  const state = getState();
  return state.active === true && state.mode === 'box';
}

function getState() {
  return window.__3D_MARKUP_FRESH_CLIP__?.state || {};
}

function getRuntime() {
  const primary = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  const alias = window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  return primary === alias ? primary : { ...alias, ...primary };
}

function requestRender(runtime, reason) {
  if (typeof runtime?.renderOnce === 'function') {
    runtime.renderOnce(reason);
    return;
  }
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { source: reason } }));
}

function setStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = text;
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
  if (!isValidBox(box)) return null;
  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
    size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)]
  };
}

function debugSnapshot() {
  const state = getState();
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  return {
    version: VERSION,
    mode: state.mode,
    axis: state.axis,
    boxPercent: state.boxPercent,
    boxMinPercent: BOX_MIN_PERCENT,
    boxMaxPercent: BOX_MAX_PERCENT,
    baselineLabel: state.baselineLabel,
    baselineBox: boxSummary(state.baselineBox),
    rendererPlaneCount: Array.isArray(renderer?.clippingPlanes) ? renderer.clippingPlanes.length : 0,
    rendererLocalClipping: Boolean(renderer?.localClippingEnabled)
  };
}

function clampBoxPercent(value) {
  return clamp(value, BOX_MIN_PERCENT, BOX_MAX_PERCENT);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(5)) : null;
}

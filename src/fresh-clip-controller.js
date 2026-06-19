import * as THREE from 'three';

// Fresh clipping controller.
// This intentionally avoids the older clip-adjuster / static-clipbox / material-fallback stack.
// It uses only the shared app runtime and writes directly to WebGLRenderer.clippingPlanes.

const VERSION = 'fresh-clip-controller-20260619';
const LOG_PREFIX = '[3DMarkupTool:fresh-clip]';
const AXIS_NORMALS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};

const STATE = {
  mode: 'none',
  active: false,
  panelOpen: false,
  baselineBox: null,
  baselineLabel: '',
  axis: 'x',
  percent: 50,
  invert: false,
  lastError: '',
  lastSource: 'idle'
};

runWhenDomReady(() => waitForAppReady(initFreshClip));

function runWhenDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function waitForAppReady(callback) {
  if (window.__3D_MARKUP_APP_READY__) {
    callback();
    return;
  }
  let done = false;
  const start = () => {
    if (done) return;
    done = true;
    callback();
  };
  window.addEventListener('markup:app-ready', start, { once: true });
  window.setTimeout(start, 1500);
}

function initFreshClip() {
  ensureStyles();
  ensureToolbar();
  ensurePanel();
  bindEvents();
  installApi();
  updateUi('init');
  window.setTimeout(() => updateUi('late-pass'), 300);
  window.dispatchEvent(new CustomEvent('viewer:fresh-clip-ready', { detail: { version: VERSION } }));
  log('ready', { version: VERSION });
}

function ensureStyles() {
  if (document.getElementById('freshClipStyles')) return;
  const style = document.createElement('style');
  style.id = 'freshClipStyles';
  style.textContent = `
    #clipBtn[hidden], #clipAdjustPanel[hidden] { display: none !important; }
    .fresh-clip-btn .fresh-clip-glyph {
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      margin-right: 6px;
      border-radius: 6px;
      border: 1px solid rgba(129, 190, 255, .45);
      color: #d8ecff;
      font-size: 12px;
      line-height: 1;
      font-weight: 950;
    }
    .fresh-clip-btn.tool-active .fresh-clip-glyph,
    .fresh-clip-btn.active .fresh-clip-glyph {
      border-color: rgba(247, 183, 92, .9);
      color: #ffe5ad;
      box-shadow: 0 0 0 1px rgba(247, 183, 92, .16) inset;
    }
    .fresh-clip-panel {
      position: absolute;
      z-index: 26;
      left: 18px;
      bottom: 72px;
      width: min(390px, calc(100% - 36px));
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(125, 172, 222, .42);
      border-radius: 14px;
      background: rgba(5, 15, 29, .96);
      color: #e9f4ff;
      box-shadow: 0 18px 44px rgba(0, 0, 0, .44);
      backdrop-filter: blur(10px);
      font-size: 12px;
    }
    .fresh-clip-panel[hidden] { display: none !important; }
    .fresh-clip-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .fresh-clip-title {
      font-size: 12px;
      font-weight: 950;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .fresh-clip-mode {
      margin-left: auto;
      padding: 3px 8px;
      border: 1px solid rgba(247, 183, 92, .45);
      border-radius: 999px;
      color: #ffe5ad;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .fresh-clip-close {
      width: 28px;
      min-width: 28px;
      height: 28px;
      min-height: 28px;
      padding: 0;
      border-radius: 8px;
    }
    .fresh-clip-ref {
      min-height: 30px;
      padding: 8px 9px;
      border-radius: 10px;
      background: rgba(12, 28, 45, .74);
      color: #bcd1e6;
      line-height: 1.35;
    }
    .fresh-clip-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .fresh-clip-actions button,
    .fresh-clip-row button {
      min-height: 32px;
      border-radius: 9px;
      font-size: 11px;
      font-weight: 950;
    }
    .fresh-clip-row {
      display: grid;
      grid-template-columns: 72px 1fr 64px;
      gap: 8px;
      align-items: center;
    }
    .fresh-clip-row label {
      color: #9fc4e8;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .fresh-clip-row select,
    .fresh-clip-row input[type='number'] {
      width: 100%;
      min-height: 30px;
      border-radius: 8px;
      border: 1px solid rgba(125, 172, 222, .35);
      background: rgba(9, 23, 37, .92);
      color: #f1f7ff;
      padding: 3px 7px;
      box-sizing: border-box;
    }
    .fresh-clip-row input[type='range'] { width: 100%; }
    .fresh-clip-check {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d7e8f8;
      font-size: 11px;
      font-weight: 850;
    }
    .fresh-clip-readout {
      min-height: 34px;
      padding-top: 7px;
      border-top: 1px solid rgba(255, 255, 255, .08);
      color: #a9bed4;
      font-size: 10.5px;
      line-height: 1.38;
    }
    @media (max-width: 760px) {
      .fresh-clip-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .fresh-clip-row { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function ensureToolbar() {
  const group = document.querySelector('[data-group="display"]') || document.querySelector('.two-row-command-group') || document.querySelector('.main-ribbon');
  if (!group) return;

  const legacyClip = document.getElementById('clipBtn');
  if (legacyClip) {
    legacyClip.hidden = true;
    legacyClip.tabIndex = -1;
    legacyClip.setAttribute('aria-hidden', 'true');
    legacyClip.title = 'Legacy clip disabled; fresh clipping is active';
  }

  const clearSelection = document.getElementById('clearSelectionBtn');
  const insertBefore = clearSelection && clearSelection.parentElement === group ? clearSelection : null;
  const planeButton = ensureToolbarButton(group, insertBefore, 'freshClipPlaneBtn', '◧', 'Plane', 'Clip selected geometry with a single adjustable plane');
  const boxButton = ensureToolbarButton(group, insertBefore, 'freshClipBoxBtn', '▣', 'Box', 'Clip to selected geometry bounds with six renderer planes');
  const clearButton = ensureToolbarButton(group, insertBefore, 'freshClipClearBtn', '×', 'Clear Clip', 'Clear renderer clipping planes');

  bindOnce(planeButton, 'click', () => {
    openPanel();
    if (captureBaseline({ required: true, source: 'toolbar-plane' })) applyPlane({ source: 'toolbar-plane', capture: false });
  });
  bindOnce(boxButton, 'click', () => {
    openPanel();
    if (captureBaseline({ required: true, source: 'toolbar-box' })) applyBox({ source: 'toolbar-box', capture: false });
  });
  bindOnce(clearButton, 'click', () => clearClip({ source: 'toolbar-clear' }));
}

function ensureToolbarButton(group, beforeNode, id, glyph, label, title) {
  let button = document.getElementById(id);
  if (!button) {
    button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'tool-btn fresh-clip-btn';
    if (beforeNode) group.insertBefore(button, beforeNode);
    else group.appendChild(button);
  }
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = `<span class="fresh-clip-glyph" aria-hidden="true">${glyph}</span><span>${label}</span>`;
  return button;
}

function ensurePanel() {
  const legacyPanel = document.getElementById('clipAdjustPanel');
  if (legacyPanel) {
    legacyPanel.hidden = true;
    legacyPanel.style.display = 'none';
    legacyPanel.setAttribute('aria-hidden', 'true');
  }

  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  let panel = document.getElementById('freshClipPanel');
  if (panel) return;

  panel = document.createElement('section');
  panel.id = 'freshClipPanel';
  panel.className = 'fresh-clip-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Fresh renderer clipping controls');
  panel.innerHTML = `
    <div class="fresh-clip-head">
      <span class="fresh-clip-title">Fresh Clip</span>
      <span id="freshClipMode" class="fresh-clip-mode">Off</span>
      <button id="freshClipCloseBtn" type="button" class="fresh-clip-close" title="Close fresh clip panel">×</button>
    </div>
    <div id="freshClipRef" class="fresh-clip-ref">Select one component, then use Plane or Box.</div>
    <div class="fresh-clip-actions">
      <button id="freshClipBaselineBtn" type="button" title="Use current selection as the clipping reference">Base selected</button>
      <button id="freshClipApplyPlaneBtn" type="button" title="Apply one renderer clipping plane">Apply Plane</button>
      <button id="freshClipApplyBoxBtn" type="button" title="Apply six renderer clipping planes around selected bounds">Apply Box</button>
      <button id="freshClipPanelClearBtn" type="button" title="Clear renderer clipping">Clear</button>
    </div>
    <div class="fresh-clip-row">
      <label for="freshClipAxisSelect">Axis</label>
      <select id="freshClipAxisSelect" aria-label="Clip plane axis">
        <option value="x">X</option>
        <option value="y">Y</option>
        <option value="z">Z</option>
      </select>
      <label class="fresh-clip-check"><input id="freshClipInvertCheck" type="checkbox" />Invert</label>
    </div>
    <div class="fresh-clip-row">
      <label for="freshClipSlider">Position</label>
      <input id="freshClipSlider" type="range" min="0" max="100" step="1" value="50" />
      <input id="freshClipOffsetInput" type="number" min="0" max="100" step="1" value="50" aria-label="Clip plane percent" />
    </div>
    <div class="fresh-clip-row">
      <span></span>
      <button id="freshClipStepDownBtn" type="button" title="Move clip backward">−</button>
      <button id="freshClipStepUpBtn" type="button" title="Move clip forward">+</button>
    </div>
    <div id="freshClipReadout" class="fresh-clip-readout">No clipping active.</div>
  `;
  viewer.appendChild(panel);

  bindOnce(document.getElementById('freshClipCloseBtn'), 'click', closePanel);
  bindOnce(document.getElementById('freshClipBaselineBtn'), 'click', () => captureBaseline({ required: true, source: 'panel-baseline' }));
  bindOnce(document.getElementById('freshClipApplyPlaneBtn'), 'click', () => applyPlane({ source: 'panel-plane', capture: true }));
  bindOnce(document.getElementById('freshClipApplyBoxBtn'), 'click', () => applyBox({ source: 'panel-box', capture: true }));
  bindOnce(document.getElementById('freshClipPanelClearBtn'), 'click', () => clearClip({ source: 'panel-clear' }));

  bindOnce(document.getElementById('freshClipAxisSelect'), 'change', (event) => {
    STATE.axis = event.target.value || 'x';
    if (STATE.mode === 'plane' && STATE.active) applyPlane({ source: 'axis-change', capture: false });
    updateUi('axis-change');
  });
  bindOnce(document.getElementById('freshClipInvertCheck'), 'change', (event) => {
    STATE.invert = Boolean(event.target.checked);
    if (STATE.mode === 'plane' && STATE.active) applyPlane({ source: 'invert-change', capture: false });
    updateUi('invert-change');
  });
  ['freshClipSlider', 'freshClipOffsetInput'].forEach((id) => {
    bindOnce(document.getElementById(id), 'input', (event) => {
      STATE.percent = clamp(Number(event.target.value), 0, 100);
      syncInputs(id);
      if (STATE.mode === 'plane' && STATE.active) applyPlane({ source: 'position-input', capture: false });
      updateUi('position-input');
    });
  });
  bindOnce(document.getElementById('freshClipStepDownBtn'), 'click', () => stepPlane(-2));
  bindOnce(document.getElementById('freshClipStepUpBtn'), 'click', () => stepPlane(2));
}

function bindEvents() {
  window.addEventListener('viewer:selection-changed', () => updateUi('selection-changed'));
  window.addEventListener('viewer:runtime-context', () => updateUi('runtime-context'));
  window.addEventListener('viewer:model-loaded', () => {
    STATE.baselineBox = null;
    STATE.baselineLabel = '';
    if (STATE.active) clearClip({ source: 'model-loaded' });
    updateUi('model-loaded');
  });

  document.addEventListener('click', (event) => {
    const clipPad = event.target?.closest?.('.view-pad button[data-view="clip"]');
    if (!clipPad) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPanel();
    if (captureBaseline({ required: true, source: 'view-pad' })) applyPlane({ source: 'view-pad', capture: false });
  }, true);

  window.addEventListener('keydown', (event) => {
    if (hasInputFocus()) return;
    if (event.key?.toLowerCase?.() !== 'c') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPanel();
    if (captureBaseline({ required: true, source: 'shortcut-c' })) applyPlane({ source: 'shortcut-c', capture: false });
  }, true);
}

function bindOnce(element, eventName, handler) {
  if (!element) return;
  const key = `__freshClip_${eventName}`;
  if (element[key]) return;
  element.addEventListener(eventName, handler);
  element[key] = true;
}

function installApi() {
  window.__3D_MARKUP_FRESH_CLIP__ = {
    version: VERSION,
    state: STATE,
    open: openPanel,
    close: closePanel,
    baseline: () => captureBaseline({ required: true, source: 'api-baseline' }),
    plane: () => applyPlane({ source: 'api-plane', capture: true }),
    box: () => applyBox({ source: 'api-box', capture: true }),
    clear: () => clearClip({ source: 'api-clear' }),
    debug: () => debugSnapshot()
  };
}

function openPanel() {
  STATE.panelOpen = true;
  updateUi('open');
}

function closePanel() {
  STATE.panelOpen = false;
  updateUi('close');
}

function captureBaseline({ required = false, source = 'baseline' } = {}) {
  const object = selectedObject();
  const box = object ? boundsForObject(object) : null;
  if (!isValidBox(box)) {
    STATE.lastError = object ? 'Selected object has no valid bounds.' : 'Select one component before clipping.';
    STATE.lastSource = 'baseline-missing';
    if (required) setStatus(`Clip failed: ${STATE.lastError}`);
    log('baseline.fail', { source, selected: labelForObject(object), hasObject: Boolean(object) }, 'warn');
    updateUi('baseline-fail');
    return false;
  }
  STATE.baselineBox = box.clone();
  STATE.baselineLabel = labelForObject(object);
  STATE.lastError = '';
  STATE.lastSource = source;
  setStatus(`Clip baseline: ${STATE.baselineLabel}`);
  log('baseline.ok', { source, label: STATE.baselineLabel, box: boxSummary(box) });
  updateUi('baseline-ok');
  return true;
}

function applyPlane({ source = 'plane', capture = false } = {}) {
  if (capture || !isValidBox(STATE.baselineBox)) {
    if (!captureBaseline({ required: true, source })) return false;
  }
  const axis = STATE.axis in AXIS_NORMALS ? STATE.axis : 'x';
  const coordinate = lerp(STATE.baselineBox.min[axis], STATE.baselineBox.max[axis], STATE.percent / 100);
  const normal = AXIS_NORMALS[axis].clone();
  let constant = -coordinate;
  if (STATE.invert) {
    normal.negate();
    constant = coordinate;
  }
  const plane = new THREE.Plane(normal, constant);
  const ok = applyRendererClipping([plane], {
    mode: 'plane',
    source: 'fresh-clip-plane',
    axis,
    percent: STATE.percent,
    invert: STATE.invert,
    baselineLabel: STATE.baselineLabel,
    trigger: source
  });
  if (ok) {
    STATE.mode = 'plane';
    STATE.active = true;
    STATE.lastError = '';
    STATE.lastSource = source;
    setStatus(`Plane clip: ${STATE.baselineLabel} ${axis.toUpperCase()} ${STATE.percent}%`);
  }
  updateUi('apply-plane');
  return ok;
}

function applyBox({ source = 'box', capture = false } = {}) {
  if (capture || !isValidBox(STATE.baselineBox)) {
    if (!captureBaseline({ required: true, source })) return false;
  }
  const planes = planesForBox(STATE.baselineBox);
  const ok = applyRendererClipping(planes, {
    mode: 'box',
    source: 'fresh-clip-box',
    baselineLabel: STATE.baselineLabel,
    trigger: source
  });
  if (ok) {
    STATE.mode = 'box';
    STATE.active = true;
    STATE.lastError = '';
    STATE.lastSource = source;
    setStatus(`Box clip: ${STATE.baselineLabel}`);
  }
  updateUi('apply-box');
  return ok;
}

function clearClip({ source = 'clear' } = {}) {
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  if (typeof runtime.clearClipping === 'function') {
    runtime.clearClipping({ source: 'fresh-clip-clear', trigger: source });
  } else if (renderer) {
    renderer.clippingPlanes = [];
    renderer.localClippingEnabled = false;
    runtime.clippingPlanes = [];
    runtime.clippingMode = 'none';
    requestRender(runtime, 'fresh-clip-clear');
    window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail: { mode: 'none', source: 'fresh-clip-clear', planes: [], rendererReady: true } }));
  }
  STATE.mode = 'none';
  STATE.active = false;
  STATE.lastError = '';
  STATE.lastSource = source;
  setStatus('Clip cleared');
  updateUi('clear');
  return true;
}

function applyRendererClipping(planes, meta) {
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  if (!renderer) {
    STATE.lastError = 'Renderer is not ready.';
    STATE.lastSource = 'renderer-missing';
    log('apply.fail.renderer', {
      ...meta,
      runtimeKeys: Object.keys(runtime || {}),
      hasViewerRenderer: Boolean(window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer),
      hasClipRenderer: Boolean(window.__3D_MARKUP_CLIP_RUNTIME__?.renderer),
      selectedId: labelForObject(selectedObject()),
      hasObject: Boolean(selectedObject())
    }, 'error');
    setStatus('Clip failed: renderer not ready');
    updateUi('renderer-missing');
    return false;
  }

  const safePlanes = Array.isArray(planes) ? planes : [];
  if (typeof runtime.applyClipping === 'function') {
    runtime.applyClipping(safePlanes, meta);
  }
  renderer.localClippingEnabled = safePlanes.length > 0;
  renderer.clippingPlanes = safePlanes;
  runtime.clippingPlanes = safePlanes;
  runtime.clippingMode = meta.mode || (safePlanes.length ? 'custom' : 'none');
  runtime.source = meta.source || 'fresh-clip';
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
  requestRender(runtime, meta.source || 'fresh-clip');
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', {
    detail: {
      ...meta,
      planes: safePlanes,
      rendererReady: true,
      rendererPlaneCount: Array.isArray(renderer.clippingPlanes) ? renderer.clippingPlanes.length : 0,
      rendererLocalClipping: renderer.localClippingEnabled
    }
  }));
  log('apply.ok', {
    ...meta,
    rendererPlaneCount: renderer.clippingPlanes.length,
    rendererLocalClipping: renderer.localClippingEnabled
  });
  return true;
}

function selectedObject() {
  const runtime = getRuntime();
  const object = runtime.selectedObject || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject || window.__3D_MARKUP_TREE__?.state?.selectedObject || null;
  if (!object || object.isScene) return null;
  return object;
}

function boundsForObject(object) {
  if (!object || object.isScene) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return isValidBox(box) ? box : null;
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

function updateUi(reason = 'ui') {
  ensureToolbar();
  ensurePanel();
  syncInputs();

  const panel = document.getElementById('freshClipPanel');
  if (panel) panel.hidden = !STATE.panelOpen;

  const planeButton = document.getElementById('freshClipPlaneBtn');
  const boxButton = document.getElementById('freshClipBoxBtn');
  const clearButton = document.getElementById('freshClipClearBtn');
  if (planeButton) planeButton.classList.toggle('tool-active', STATE.active && STATE.mode === 'plane');
  if (boxButton) boxButton.classList.toggle('tool-active', STATE.active && STATE.mode === 'box');
  if (clearButton) clearButton.classList.toggle('tool-active', false);

  const mode = document.getElementById('freshClipMode');
  if (mode) mode.textContent = STATE.active ? STATE.mode : 'Off';

  const ref = document.getElementById('freshClipRef');
  if (ref) ref.textContent = referenceText();

  const readout = document.getElementById('freshClipReadout');
  if (readout) readout.textContent = readoutText();

  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
  return reason;
}

function syncInputs(changedId = '') {
  const axis = document.getElementById('freshClipAxisSelect');
  const invert = document.getElementById('freshClipInvertCheck');
  const slider = document.getElementById('freshClipSlider');
  const input = document.getElementById('freshClipOffsetInput');
  if (axis && axis.value !== STATE.axis) axis.value = STATE.axis;
  if (invert && invert.checked !== STATE.invert) invert.checked = STATE.invert;
  if (slider && changedId !== 'freshClipSlider') slider.value = String(STATE.percent);
  if (input && changedId !== 'freshClipOffsetInput') input.value = String(STATE.percent);
}

function stepPlane(delta) {
  STATE.percent = clamp(STATE.percent + delta, 0, 100);
  syncInputs();
  if (STATE.mode === 'plane' && STATE.active) applyPlane({ source: 'step', capture: false });
  updateUi('step');
}

function referenceText() {
  if (STATE.lastError) return STATE.lastError;
  if (isValidBox(STATE.baselineBox)) return `Reference: ${STATE.baselineLabel}. Selection-first clipping; no scene-wide fallback and no ghost/helper box.`;
  return 'Reference: none. Select one component, then click Plane, Box, or Base selected.';
}

function readoutText() {
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  const planeCount = renderer && Array.isArray(renderer.clippingPlanes) ? renderer.clippingPlanes.length : 0;
  if (STATE.lastError) return STATE.lastError;
  if (!STATE.active) return `No clipping active. Renderer planes: ${planeCount}.`;
  if (STATE.mode === 'plane') return `Plane clip active. Axis ${STATE.axis.toUpperCase()}, position ${STATE.percent}%, invert ${STATE.invert ? 'on' : 'off'}. Renderer planes: ${planeCount}.`;
  if (STATE.mode === 'box') return `Box clip active. Six renderer planes expected. Renderer planes: ${planeCount}.`;
  return `Clip active. Renderer planes: ${planeCount}.`;
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

function hasInputFocus() {
  const tag = document.activeElement?.tagName;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
}

function labelForObject(object) {
  const raw = object?.userData || {};
  return raw.ID || raw.id || raw.REF_NO || raw.refNo || raw.LABEL || raw.label || object?.name || 'selected component';
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
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  return {
    version: VERSION,
    state: { ...STATE, baselineBox: boxSummary(STATE.baselineBox) },
    runtimeKeys: Object.keys(runtime || {}),
    hasRenderer: Boolean(renderer),
    rendererLocalClipping: Boolean(renderer?.localClippingEnabled),
    rendererPlaneCount: Array.isArray(renderer?.clippingPlanes) ? renderer.clippingPlanes.length : 0,
    selectedId: labelForObject(selectedObject()),
    hasObject: Boolean(selectedObject())
  };
}

function log(event, detail = {}, level = 'info') {
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  console[method](LOG_PREFIX, { event, ...detail });
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(5)) : null;
}

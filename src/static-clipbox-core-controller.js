import * as THREE from 'three';

// Static/core Clip Box.
// Selection-baseline only: no ghost/helper geometry and no model/scene fallback.
// Select geometry, click Base line, and current ranges are applied relative to that selected bounds.

const VERSION = 'static-core-clip-box-runtime-merge-20260619';
const LOG_PREFIX = '[3DMarkupTool:clipbox]';
const STATE = {
  open: false,
  enabled: false,
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 100,
  zMin: 0,
  zMax: 100,
  baselineBox: null,
  baselineLabel: '',
  lastSource: 'idle',
  lastError: ''
};

runWhenReady(initStaticClipBoxCore);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initStaticClipBoxCore() {
  ensureStyles();
  ensureButton();
  ensurePanel();
  bindRuntimeEvents();
  installApi();
  updateUi();
  clipLog('ready', { version: VERSION });
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
  window.dispatchEvent(new CustomEvent('viewer:static-clipbox-ready', { detail: { version: VERSION } }));
}

function ensureStyles() {
  if (document.getElementById('staticClipBoxCoreStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticClipBoxCoreStyles';
  style.textContent = `
    .static-clipbox-toggle.tool-active,
    .static-clipbox-toggle.active {
      border-color: rgba(247, 183, 92, .8) !important;
      background: linear-gradient(180deg, #7a4d11, #3d2d10) !important;
      color: #fff4d6 !important;
    }
    .static-clipbox-panel {
      position: absolute;
      z-index: 17;
      left: 16px;
      bottom: 72px;
      width: min(332px, calc(100% - 32px));
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid rgba(247, 183, 92, .38);
      border-radius: 14px;
      background: rgba(5, 15, 29, .96);
      box-shadow: 0 18px 44px rgba(0,0,0,.4);
      color: #e9f4ff;
      backdrop-filter: blur(10px);
    }
    .static-clipbox-panel[hidden] { display: none; }
    .static-clipbox-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      font-weight: 950;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .static-clipbox-close {
      width: 28px;
      min-width: 28px;
      height: 28px;
      min-height: 28px;
      padding: 0;
      border-radius: 8px;
    }
    .static-clipbox-axis {
      display: grid;
      grid-template-columns: 24px 1fr 1fr;
      gap: 7px;
      align-items: center;
      font-size: 11px;
      font-weight: 900;
      color: #9fc4e8;
    }
    .static-clipbox-axis input {
      min-height: 30px !important;
      width: 100%;
      border-radius: 8px;
      border: 1px solid rgba(125, 172, 222, .35);
      background: rgba(9, 23, 37, .92);
      color: #f1f7ff;
      padding: 3px 7px;
      box-sizing: border-box;
    }
    .static-clipbox-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .static-clipbox-actions button {
      min-height: 32px;
      border-radius: 9px;
      font-size: 11px;
      font-weight: 950;
    }
    .static-clipbox-actions .baseline-active {
      border-color: rgba(247, 183, 92, .76);
      color: #ffe5ad;
    }
    .static-clipbox-readout {
      min-height: 32px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,.08);
      color: #a9bed4;
      font-size: 10.5px;
      line-height: 1.38;
    }
  `;
  document.head.appendChild(style);
}

function ensureButton() {
  let button = document.getElementById('clipBoxToggleBtn');
  if (button) {
    normalizeButton(button);
    if (!button.__staticClipBoxBound) {
      button.addEventListener('click', togglePanel);
      button.__staticClipBoxBound = true;
    }
    return button;
  }

  const displayGroup = document.querySelector('[data-group="display"]') || document.querySelector('.two-row-command-group') || document.querySelector('.main-ribbon');
  if (!displayGroup) return null;

  const clearButton = document.getElementById('clearSelectionBtn');
  button = document.createElement('button');
  button.id = 'clipBoxToggleBtn';
  button.type = 'button';
  button.className = 'tool-btn static-clipbox-toggle';
  normalizeButton(button);

  if (clearButton?.parentElement === displayGroup) displayGroup.insertBefore(button, clearButton);
  else displayGroup.appendChild(button);

  button.addEventListener('click', togglePanel);
  button.__staticClipBoxBound = true;
  if (window.lucide?.createIcons) {
    try { window.lucide.createIcons(); } catch { /* text fallback */ }
  }
  return button;
}

function normalizeButton(button) {
  button.title = 'Show 3D Clip Box controls';
  button.setAttribute('aria-label', 'Show 3D Clip Box controls');
  button.innerHTML = '<i data-lucide="box-select"></i><span>Clip Box</span>';
}

function ensurePanel() {
  const viewer = document.getElementById('viewer');
  if (!viewer) return null;
  let panel = document.getElementById('staticClipBoxPanel');
  if (panel) return panel;

  panel = document.createElement('section');
  panel.id = 'staticClipBoxPanel';
  panel.className = 'static-clipbox-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', '3D Clip Box');
  panel.innerHTML = `
    <div class="static-clipbox-head">
      <span>3D Clip Box</span>
      <button id="staticClipBoxCloseBtn" type="button" class="static-clipbox-close" title="Close clip box">×</button>
    </div>
    ${axisRow('x', 'X')}
    ${axisRow('y', 'Y')}
    ${axisRow('z', 'Z')}
    <div class="static-clipbox-actions">
      <button id="staticClipBoxBaselineBtn" type="button" title="Use selected geometry as clip box baseline and apply current range">Base line</button>
      <button id="staticClipBoxApplyBtn" type="button" title="Apply box clipping relative to baseline">Apply</button>
      <button id="staticClipBoxResetBtn" type="button">Reset</button>
    </div>
    <div id="staticClipBoxReadout" class="static-clipbox-readout">Select geometry and click Base line. No ghost/helper box is drawn.</div>
  `;
  viewer.appendChild(panel);

  panel.querySelector('#staticClipBoxCloseBtn')?.addEventListener('click', closePanel);
  panel.querySelector('#staticClipBoxBaselineBtn')?.addEventListener('click', captureBaselineAndApply);
  panel.querySelector('#staticClipBoxApplyBtn')?.addEventListener('click', () => {
    readInputs();
    STATE.enabled = true;
    applyClipBox('apply-button');
    updateUi();
  });
  panel.querySelector('#staticClipBoxResetBtn')?.addEventListener('click', resetClipBox);
  panel.querySelectorAll('input[data-clipbox-axis]').forEach((input) => {
    input.addEventListener('input', () => {
      readInputs();
      if (STATE.enabled) applyClipBox('input');
      updateUi();
    });
    input.addEventListener('change', () => {
      readInputs();
      if (STATE.enabled) applyClipBox('change');
      updateUi();
    });
  });

  return panel;
}

function axisRow(axis, label) {
  return `<div class="static-clipbox-axis">
    <span>${label}</span>
    <input id="staticClipBox_${axis}Min" data-clipbox-axis="${axis}" data-edge="min" type="number" min="0" max="100" step="1" value="0" aria-label="${label} minimum percent" />
    <input id="staticClipBox_${axis}Max" data-clipbox-axis="${axis}" data-edge="max" type="number" min="0" max="100" step="1" value="100" aria-label="${label} maximum percent" />
  </div>`;
}

function bindRuntimeEvents() {
  ['markup:render-context', 'viewer:runtime-context', 'viewer:selection-changed', 'viewer:static-tree-refreshed'].forEach((name) => {
    window.addEventListener(name, updateUi);
  });
}

function installApi() {
  window.__3D_MARKUP_STATIC_CLIPBOX__ = {
    version: VERSION,
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    apply: () => { STATE.enabled = true; applyClipBox('api'); updateUi(); },
    reset: resetClipBox,
    baseline: captureBaselineAndApply,
    state: STATE
  };
}

function togglePanel() { STATE.open ? closePanel() : openPanel(); }

function openPanel() {
  const panel = ensurePanel();
  if (!panel) return;
  STATE.open = true;
  panel.hidden = false;
  readInputs();
  updateUi();
}

function closePanel() {
  const panel = document.getElementById('staticClipBoxPanel');
  STATE.open = false;
  if (panel) panel.hidden = true;
  updateUi();
}

function resetClipBox() {
  Object.assign(STATE, {
    enabled: false,
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    zMin: 0,
    zMax: 100,
    baselineBox: null,
    baselineLabel: '',
    lastSource: 'idle',
    lastError: ''
  });
  clearRendererClipping();
  writeInputs();
  updateUi();
  reportStatus('Clip Box reset');
}

function captureBaselineAndApply() {
  readInputs();
  const selected = selectedObject();
  const box = selected ? objectBounds(selected) : null;
  clipLog('baseline.capture', { selected: objectLabel(selected), hasObject: Boolean(selected), box: boxSummary(box) });
  if (!isValidBox(box)) {
    STATE.lastSource = 'baseline-missing';
    STATE.lastError = selected ? 'Selected object has no valid bounds.' : 'No selected object found.';
    reportStatus(`Clip Box baseline failed: ${STATE.lastError}`);
    updateUi();
    return false;
  }
  STATE.baselineBox = box.clone();
  STATE.baselineLabel = objectLabel(selected);
  STATE.lastSource = 'baseline';
  STATE.lastError = '';
  STATE.enabled = true;
  const applied = applyClipBox('baseline');
  updateUi();
  return applied;
}

function readInputs() {
  ['x', 'y', 'z'].forEach((axis) => {
    const min = clamp(Number(document.getElementById(`staticClipBox_${axis}Min`)?.value), 0, 100);
    const max = clamp(Number(document.getElementById(`staticClipBox_${axis}Max`)?.value), 0, 100);
    STATE[`${axis}Min`] = Math.min(min, max);
    STATE[`${axis}Max`] = Math.max(min, max);
  });
}

function writeInputs() {
  ['x', 'y', 'z'].forEach((axis) => {
    const minInput = document.getElementById(`staticClipBox_${axis}Min`);
    const maxInput = document.getElementById(`staticClipBox_${axis}Max`);
    if (minInput) minInput.value = String(STATE[`${axis}Min`]);
    if (maxInput) maxInput.value = String(STATE[`${axis}Max`]);
  });
}

function applyClipBox(source = 'apply') {
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  const baseBox = resolveBounds();

  if (!baseBox) {
    STATE.enabled = false;
    STATE.lastSource = 'baseline-missing';
    STATE.lastError = 'No valid baseline/selected bounds.';
    clipLog('apply.fail.bounds', { source, selected: objectLabel(selectedObject()), ranges: rangeState() }, 'warn');
    reportStatus(`Clip Box apply failed: ${STATE.lastError}`);
    return false;
  }

  if (!renderer) {
    const selected = selectedObject();
    STATE.enabled = false;
    STATE.lastSource = 'renderer-missing';
    STATE.lastError = 'Renderer is not ready.';
    clipLog('apply.fail.renderer', {
      source,
      runtimeKeys: Object.keys(runtime || {}),
      hasViewerRenderer: Boolean(window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer),
      hasClipRenderer: Boolean(window.__3D_MARKUP_CLIP_RUNTIME__?.renderer),
      selectedId: objectLabel(selected),
      hasObject: Boolean(selected),
      ranges: rangeState()
    }, 'error');
    reportStatus(`Clip Box apply failed: ${STATE.lastError}`);
    return false;
  }

  const box = percentBox(baseBox);
  if (!isValidBox(box)) {
    STATE.enabled = false;
    STATE.lastSource = 'box-invalid';
    STATE.lastError = 'Calculated clip box is invalid.';
    clipLog('apply.fail.box-invalid', { source, baseBox: boxSummary(baseBox), box: boxSummary(box), ranges: rangeState() }, 'warn');
    reportStatus(`Clip Box apply failed: ${STATE.lastError}`);
    return false;
  }

  const planes = planesForBox(box);
  STATE.enabled = true;
  STATE.lastSource = isValidBox(STATE.baselineBox) ? 'baseline' : 'selected';
  STATE.lastError = '';

  if (typeof runtime.applyClipping === 'function') {
    runtime.applyClipping(planes, { mode: 'box', source: 'static-clipbox' });
  } else {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = planes;
    runtime.clippingPlanes = planes;
    runtime.clippingMode = 'box';
    window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail: { mode: 'box', source: 'static-clipbox', planes } }));
  }
  renderer.localClippingEnabled = true;
  requestRender(runtime);
  const detail = {
    source,
    reference: STATE.lastSource,
    label: STATE.baselineLabel || objectLabel(selectedObject()),
    baseBox: boxSummary(baseBox),
    clipBox: boxSummary(box),
    planes: planes.map((plane) => ({ normal: plane.normal.toArray(), constant: plane.constant })),
    rendererLocalClipping: renderer.localClippingEnabled,
    rendererPlaneCount: Array.isArray(renderer.clippingPlanes) ? renderer.clippingPlanes.length : 0,
    ranges: rangeState()
  };
  clipLog('apply.success', detail);
  reportStatus(`Clip Box active: ${detail.label} X ${STATE.xMin}-${STATE.xMax}%, Y ${STATE.yMin}-${STATE.yMax}%, Z ${STATE.zMin}-${STATE.zMax}%`);
  return true;
}

function clearRendererClipping() {
  const runtime = getRuntime();
  if (typeof runtime.clearClipping === 'function') {
    runtime.clearClipping({ source: 'static-clipbox' });
    return;
  }
  const renderer = runtime.renderer;
  if (renderer) renderer.clippingPlanes = [];
  runtime.clippingPlanes = [];
  runtime.clippingMode = 'none';
  publishRuntime(runtime);
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail: { mode: 'none', source: 'static-clipbox' } }));
  requestRender(runtime);
}

function resolveBounds() {
  if (isValidBox(STATE.baselineBox)) return STATE.baselineBox.clone();
  const selected = selectedObject();
  const selectedBox = selected ? objectBounds(selected) : null;
  return isValidBox(selectedBox) ? selectedBox : null;
}

function selectedObject() {
  const diagnosticsSelected = window.__3D_MARKUP_CLIP_DIAGNOSTICS__?.selectedObject?.();
  if (diagnosticsSelected && !diagnosticsSelected.isScene) return diagnosticsSelected;
  const runtime = getRuntime();
  return runtime.selectedObject || window.__3D_MARKUP_TREE__?.state?.selectedObject || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject || null;
}

function objectBounds(object) {
  if (!object || object.isScene || shouldSkip(object)) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return isValidBox(box) ? box : null;
}

function percentBox(base) {
  const min = base.min;
  const max = base.max;
  return new THREE.Box3(
    new THREE.Vector3(
      lerp(min.x, max.x, STATE.xMin / 100),
      lerp(min.y, max.y, STATE.yMin / 100),
      lerp(min.z, max.z, STATE.zMin / 100)
    ),
    new THREE.Vector3(
      lerp(min.x, max.x, STATE.xMax / 100),
      lerp(min.y, max.y, STATE.yMax / 100),
      lerp(min.z, max.z, STATE.zMax / 100)
    )
  );
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

function updateUi() {
  const button = document.getElementById('clipBoxToggleBtn');
  if (button) {
    button.classList.toggle('active', STATE.open);
    button.classList.toggle('tool-active', STATE.enabled);
    button.setAttribute('aria-pressed', STATE.enabled ? 'true' : 'false');
  }
  const baseline = document.getElementById('staticClipBoxBaselineBtn');
  if (baseline) baseline.classList.toggle('baseline-active', isValidBox(STATE.baselineBox));
  const readout = document.getElementById('staticClipBoxReadout');
  if (readout) readout.textContent = readoutText();
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}

function readoutText() {
  if (STATE.lastError) return STATE.lastError;
  if (STATE.lastSource === 'idle') return 'Select geometry and click Base line. Clip Box uses selection bounds only; no ghost/helper box is drawn.';
  if (STATE.lastSource === 'baseline-missing') return 'Select geometry first, then click Base line or Apply.';
  if (STATE.lastSource === 'renderer-missing') return 'Renderer is not ready yet. Check console for runtime keys.';
  if (STATE.lastSource === 'box-invalid') return 'Calculated clip box is invalid. Check min/max ranges.';
  const scope = STATE.lastSource === 'baseline'
    ? `baseline: ${STATE.baselineLabel || 'selected geometry'}`
    : 'selected object bounds';
  const mode = STATE.enabled ? 'Box clipping applied' : 'Baseline captured';
  return `${mode}. Reference is ${scope}: X ${STATE.xMin}-${STATE.xMax}%, Y ${STATE.yMin}-${STATE.yMax}%, Z ${STATE.zMin}-${STATE.zMax}%.`;
}

function shouldSkip(object) {
  if (!object || object.visible === false || object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;
  const name = String(object.name || '').toLowerCase();
  return name === 'grid'
    || name === 'axes'
    || name.includes('helper')
    || name.includes('measure')
    || name.includes('clip_box')
    || name.includes('selection');
}

function getRuntime() {
  const primary = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  const legacy = window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const runtime = primary === legacy ? primary : { ...legacy, ...primary };
  runtime.renderer = primary.renderer || legacy.renderer || runtime.renderer || null;
  runtime.scene = primary.scene || legacy.scene || runtime.scene || null;
  runtime.camera = primary.camera || legacy.camera || runtime.camera || null;
  runtime.controls = primary.controls || legacy.controls || runtime.controls || null;
  runtime.modelRoot = primary.modelRoot || legacy.modelRoot || runtime.modelRoot || null;
  runtime.selectedObject = primary.selectedObject || legacy.selectedObject || runtime.selectedObject || window.__3D_MARKUP_TREE__?.state?.selectedObject || null;
  runtime.selectedData = primary.selectedData || legacy.selectedData || runtime.selectedData || null;
  runtime.applyClipping = primary.applyClipping || legacy.applyClipping || runtime.applyClipping;
  runtime.clearClipping = primary.clearClipping || legacy.clearClipping || runtime.clearClipping;
  runtime.clippingPlanes = primary.clippingPlanes || legacy.clippingPlanes || runtime.clippingPlanes || [];
  runtime.clippingMode = primary.clippingMode || legacy.clippingMode || runtime.clippingMode || 'none';
  publishRuntime(runtime);
  return runtime;
}

function publishRuntime(runtime) {
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
}

function requestRender(runtime) {
  if (typeof runtime?.renderOnce === 'function') {
    runtime.renderOnce('static-clipbox');
    return;
  }
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { source: 'static-clipbox' } }));
}

function reportStatus(text) {
  window.__3D_MARKUP_CLIP_DIAGNOSTICS__?.setStatus?.(text);
}

function clipLog(event, detail = {}, level = 'info') {
  const payload = { event, ...detail };
  const method = level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'info';
  console[method](LOG_PREFIX, payload);
  window.__3D_MARKUP_CLIP_DIAGNOSTICS__?.log?.(`clipbox.${event}`, detail, level);
}

function boxSummary(box) {
  if (!isValidBox(box)) return null;
  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
    size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)]
  };
}

function rangeState() {
  return {
    x: [STATE.xMin, STATE.xMax],
    y: [STATE.yMin, STATE.yMax],
    z: [STATE.zMin, STATE.zMax]
  };
}

function objectLabel(object) {
  const raw = object?.userData || {};
  return raw.ID || raw.id || raw.REF_NO || raw.refNo || raw.LABEL || raw.label || object?.name || object?.uuid || '';
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
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

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function lerp(min, max, t) {
  return min + (max - min) * clamp(t, 0, 1);
}

import * as THREE from 'three';

// Static/core Clip Box.
// This is deliberately separate from the old advanced clip-box controller stack.
// It adds one Box button, one compact viewer panel, and applies renderer clipping
// planes directly through the lightweight runtime bridge.

const VERSION = 'static-core-clip-box-20260618';
const HELPER_NAME = 'STATIC_CLIP_BOX_HELPER';
const STATE = {
  open: false,
  enabled: false,
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 100,
  zMin: 0,
  zMax: 100,
  helper: null,
  lastSource: 'none'
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
      width: min(312px, calc(100% - 32px));
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
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .static-clipbox-actions button {
      min-height: 32px;
      border-radius: 9px;
      font-size: 11px;
      font-weight: 950;
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
  if (button) return button;

  const displayGroup = document.querySelector('[data-group="display"]') || document.querySelector('.two-row-command-group') || document.querySelector('.main-ribbon');
  if (!displayGroup) return null;

  const clearButton = document.getElementById('clearSelectionBtn');
  button = document.createElement('button');
  button.id = 'clipBoxToggleBtn';
  button.type = 'button';
  button.className = 'tool-btn static-clipbox-toggle';
  button.title = 'Show 3D Clip Box controls';
  button.innerHTML = '<i data-lucide="box-select"></i><span>Box</span>';

  if (clearButton?.parentElement === displayGroup) displayGroup.insertBefore(button, clearButton);
  else displayGroup.appendChild(button);

  button.addEventListener('click', togglePanel);
  if (window.lucide?.createIcons) {
    try { window.lucide.createIcons(); } catch { /* text fallback */ }
  }
  return button;
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
      <button id="staticClipBoxApplyBtn" type="button">Apply</button>
      <button id="staticClipBoxResetBtn" type="button">Reset</button>
    </div>
    <div id="staticClipBoxReadout" class="static-clipbox-readout">Clip Box is off.</div>
  `;
  viewer.appendChild(panel);

  panel.querySelector('#staticClipBoxCloseBtn')?.addEventListener('click', closePanel);
  panel.querySelector('#staticClipBoxApplyBtn')?.addEventListener('click', () => {
    readInputs();
    STATE.enabled = true;
    applyClipBox();
    updateUi();
  });
  panel.querySelector('#staticClipBoxResetBtn')?.addEventListener('click', resetClipBox);
  panel.querySelectorAll('input[data-clipbox-axis]').forEach((input) => {
    input.addEventListener('change', () => {
      readInputs();
      if (STATE.enabled) applyClipBox();
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
    window.addEventListener(name, () => {
      if (STATE.enabled) applyClipBox();
      updateUi();
    });
  });
}

function installApi() {
  window.__3D_MARKUP_STATIC_CLIPBOX__ = {
    version: VERSION,
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    apply: () => { STATE.enabled = true; applyClipBox(); updateUi(); },
    reset: resetClipBox,
    state: STATE
  };
}

function togglePanel() {
  STATE.open ? closePanel() : openPanel();
}

function openPanel() {
  const panel = ensurePanel();
  if (!panel) return;
  STATE.open = true;
  panel.hidden = false;
  updateUi();
}

function closePanel() {
  const panel = document.getElementById('staticClipBoxPanel');
  STATE.open = false;
  if (panel) panel.hidden = true;
  updateUi();
}

function resetClipBox() {
  Object.assign(STATE, { enabled: false, xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 100, lastSource: 'none' });
  clearHelper();
  clearRendererClipping();
  writeInputs();
  updateUi();
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

function applyClipBox() {
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  const scene = runtime.scene;
  if (!renderer || !scene) {
    STATE.lastSource = 'renderer-missing';
    return false;
  }

  const resolved = resolveBounds(runtime, scene);
  if (!resolved?.box) {
    STATE.lastSource = 'model-missing';
    clearHelper();
    return false;
  }

  const box = percentBox(resolved.box);
  const planes = planesForBox(box);
  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = planes;
  runtime.clippingPlanes = planes;
  runtime.clippingMode = 'box';
  STATE.lastSource = resolved.source;
  showHelper(scene, box, resolved.source);
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail: { mode: 'box', source: 'static-clipbox', planes } }));
  return true;
}

function clearRendererClipping() {
  const runtime = getRuntime();
  const renderer = runtime.renderer;
  if (renderer) renderer.clippingPlanes = [];
  runtime.clippingPlanes = [];
  runtime.clippingMode = 'none';
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail: { mode: 'none', source: 'static-clipbox' } }));
}

function resolveBounds(runtime, scene) {
  const selected = runtime.selectedObject;
  const selectedBox = selected ? objectBounds(selected) : null;
  if (isValidBox(selectedBox)) return { box: selectedBox, source: 'selected' };

  const sceneBox = sceneBounds(scene);
  if (isValidBox(sceneBox)) return { box: sceneBox, source: 'model' };
  return null;
}

function sceneBounds(scene) {
  const box = new THREE.Box3();
  const temp = new THREE.Box3();
  let count = 0;
  scene?.traverse?.((object) => {
    if (shouldSkip(object) || !object.geometry) return;
    temp.setFromObject(object);
    if (!isValidBox(temp)) return;
    box.union(temp);
    count += 1;
  });
  return count ? box : null;
}

function objectBounds(object) {
  if (!object || shouldSkip(object)) return null;
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

function showHelper(scene, box, source) {
  clearHelper();
  const helper = new THREE.Box3Helper(box, source === 'selected' ? 0xf7b75c : 0x65d5ff);
  helper.name = HELPER_NAME;
  helper.renderOrder = 1500;
  helper.userData = { isDisplayHelper: true, ignoreBounds: true };
  if (helper.material) {
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.92;
  }
  scene.add(helper);
  STATE.helper = helper;
}

function clearHelper() {
  if (!STATE.helper) return;
  STATE.helper.parent?.remove?.(STATE.helper);
  STATE.helper.geometry?.dispose?.();
  STATE.helper.material?.dispose?.();
  STATE.helper = null;
}

function updateUi() {
  const button = document.getElementById('clipBoxToggleBtn');
  if (button) {
    button.classList.toggle('active', STATE.open);
    button.classList.toggle('tool-active', STATE.enabled);
    button.setAttribute('aria-pressed', STATE.enabled ? 'true' : 'false');
  }
  const readout = document.getElementById('staticClipBoxReadout');
  if (readout) readout.textContent = readoutText();
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}

function readoutText() {
  if (!STATE.enabled) return 'Clip Box is off. Set range and Apply to show a 3D helper box.';
  if (STATE.lastSource === 'renderer-missing') return 'Renderer context is not ready yet.';
  if (STATE.lastSource === 'model-missing') return 'Load or convert a model first.';
  const scope = STATE.lastSource === 'selected' ? 'selected object bounds' : 'full model bounds';
  return `Using ${scope}: X ${STATE.xMin}-${STATE.xMax}%, Y ${STATE.yMin}-${STATE.yMax}%, Z ${STATE.zMin}-${STATE.zMax}%.`;
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
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
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

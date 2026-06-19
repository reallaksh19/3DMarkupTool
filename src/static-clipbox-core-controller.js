import * as THREE from 'three';

// Static/core Clip Box.
// This is deliberately separate from the old advanced clip-box controller stack.
// It adds one Clip Box button, one compact viewer panel, a visible live ghost helper,
// and applies renderer clipping planes through the lightweight runtime bridge.

const VERSION = 'static-core-clip-box-live-preview-20260618';
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
  baselineBox: null,
  baselineLabel: '',
  lastSource: 'none',
  previewVisible: false
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
      <button id="staticClipBoxBaselineBtn" type="button" title="Use selected geometry as clip box baseline">Base line</button>
      <button id="staticClipBoxApplyBtn" type="button" title="Apply clipping to the live ghost box">Apply</button>
      <button id="staticClipBoxResetBtn" type="button">Reset</button>
    </div>
    <div id="staticClipBoxReadout" class="static-clipbox-readout">Open Clip Box to preview a ghost helper.</div>
  `;
  viewer.appendChild(panel);

  panel.querySelector('#staticClipBoxCloseBtn')?.addEventListener('click', closePanel);
  panel.querySelector('#staticClipBoxBaselineBtn')?.addEventListener('click', captureBaseline);
  panel.querySelector('#staticClipBoxApplyBtn')?.addEventListener('click', () => {
    readInputs();
    STATE.enabled = true;
    applyClipBox();
    updateUi();
  });
  panel.querySelector('#staticClipBoxResetBtn')?.addEventListener('click', resetClipBox);
  panel.querySelectorAll('input[data-clipbox-axis]').forEach((input) => {
    input.addEventListener('input', () => {
      readInputs();
      if (STATE.enabled) applyClipBox();
      else previewClipBox();
      updateUi();
    });
    input.addEventListener('change', () => {
      readInputs();
      if (STATE.enabled) applyClipBox();
      else previewClipBox();
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
      if (STATE.open && !STATE.enabled) previewClipBox();
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
    preview: previewClipBox,
    reset: resetClipBox,
    baseline: captureBaseline,
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
  readInputs();
  if (STATE.enabled) applyClipBox();
  else previewClipBox();
  updateUi();
}

function closePanel() {
  const panel = document.getElementById('staticClipBoxPanel');
  STATE.open = false;
  if (panel) panel.hidden = true;
  if (!STATE.enabled) clearHelper();
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
    lastSource: 'none',
    previewVisible: false
  });
  clearHelper();
  clearRendererClipping();
  writeInputs();
  if (STATE.open) previewClipBox();
  updateUi();
}

function captureBaseline() {
  const runtime = getRuntime();
  const selected = runtime.selectedObject || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject || null;
  const box = selected ? objectBounds(selected) : null;
  if (!isValidBox(box)) {
    STATE.lastSource = 'baseline-missing';
    previewClipBox();
    updateUi();
    return false;
  }
  STATE.baselineBox = box.clone();
  STATE.baselineLabel = selected?.name || selected?.userData?.ID || selected?.userData?.id || 'selected geometry';
  if (STATE.enabled) applyClipBox();
  else previewClipBox();
  updateUi();
  return true;
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

function previewClipBox() {
  const runtime = getRuntime();
  const scene = runtime.scene || runtime.modelRoot?.parent || null;
  const resolved = resolveBounds(runtime, scene);
  if (!resolved?.box || !scene) {
    STATE.lastSource = 'model-missing';
    STATE.previewVisible = false;
    clearHelper();
    return false;
  }
  const box = percentBox(resolved.box);
  STATE.lastSource = resolved.source;
  STATE.previewVisible = true;
  showHelper(scene, box, resolved.source, { preview: true });
  requestRender(runtime);
  return true;
}

function applyClipBox() {
  const runtime = getRuntime();
  const scene = runtime.scene || runtime.modelRoot?.parent || null;
  const renderer = runtime.renderer;
  const resolved = resolveBounds(runtime, scene);

  if (!resolved?.box) {
    STATE.lastSource = 'model-missing';
    clearHelper();
    return false;
  }

  const box = percentBox(resolved.box);
  STATE.lastSource = resolved.source;
  STATE.previewVisible = true;
  if (scene) showHelper(scene, box, resolved.source, { preview: false });

  if (!renderer) {
    requestRender(runtime);
    return false;
  }

  const planes = planesForBox(box);
  if (typeof runtime.applyClipping === 'function') {
    runtime.applyClipping(planes, { mode: 'box', source: 'static-clipbox' });
  } else {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = planes;
    runtime.clippingPlanes = planes;
    runtime.clippingMode = 'box';
    window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail: { mode: 'box', source: 'static-clipbox', planes } }));
  }
  requestRender(runtime);
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
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', { detail: { mode: 'none', source: 'static-clipbox' } }));
  requestRender(runtime);
}

function resolveBounds(runtime, scene) {
  if (isValidBox(STATE.baselineBox)) return { box: STATE.baselineBox.clone(), source: 'baseline' };

  const selected = runtime.selectedObject || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject || null;
  const selectedBox = selected ? objectBounds(selected) : null;
  if (isValidBox(selectedBox)) return { box: selectedBox, source: 'selected' };

  const modelRoot = runtime.getModelRoot?.() || runtime.modelRoot || null;
  const modelBox = modelRoot ? objectBounds(modelRoot) : null;
  if (isValidBox(modelBox)) return { box: modelBox, source: 'model' };

  const sceneBox = sceneBounds(scene || runtime.scene);
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

function showHelper(scene, box, source, options = {}) {
  clearHelper();
  const color = source === 'baseline' || source === 'selected' ? 0xffb84d : 0x65d5ff;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const group = new THREE.Group();
  group.name = HELPER_NAME;
  group.renderOrder = 100000;
  group.userData = { isDisplayHelper: true, ignoreBounds: true };

  const safeSize = new THREE.Vector3(Math.max(size.x, 1e-6), Math.max(size.y, 1e-6), Math.max(size.z, 1e-6));
  const fillGeometry = new THREE.BoxGeometry(safeSize.x, safeSize.y, safeSize.z);
  const fillMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: options.preview ? 0.18 : 0.24,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const fill = new THREE.Mesh(fillGeometry, fillMaterial);
  fill.name = `${HELPER_NAME}_GHOST`;
  fill.renderOrder = group.renderOrder;

  const edgeGeometry = new THREE.EdgesGeometry(fillGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.name = `${HELPER_NAME}_EDGES`;
  edges.renderOrder = group.renderOrder + 1;

  group.add(fill);
  group.add(edges);
  addCornerMarkers(group, safeSize, color);
  group.position.copy(center);
  scene.add(group);
  STATE.helper = group;
}

function addCornerMarkers(group, size, color) {
  const radius = Math.max(Math.min(size.x, size.y, size.z) * 0.018, 0.025);
  const markerGeometry = new THREE.SphereGeometry(radius, 10, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false
  });
  const hx = size.x / 2;
  const hy = size.y / 2;
  const hz = size.z / 2;
  [-1, 1].forEach((x) => [-1, 1].forEach((y) => [-1, 1].forEach((z) => {
    const marker = new THREE.Mesh(markerGeometry.clone(), markerMaterial.clone());
    marker.name = `${HELPER_NAME}_CORNER`;
    marker.position.set(x * hx, y * hy, z * hz);
    marker.renderOrder = group.renderOrder + 2;
    group.add(marker);
  })));
}

function clearHelper() {
  if (!STATE.helper) return;
  STATE.helper.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
    else object.material?.dispose?.();
  });
  STATE.helper.parent?.remove?.(STATE.helper);
  STATE.helper = null;
  STATE.previewVisible = false;
}

function updateUi() {
  const button = document.getElementById('clipBoxToggleBtn');
  if (button) {
    button.classList.toggle('active', STATE.open);
    button.classList.toggle('tool-active', STATE.enabled || STATE.previewVisible);
    button.setAttribute('aria-pressed', STATE.enabled ? 'true' : 'false');
  }
  const baseline = document.getElementById('staticClipBoxBaselineBtn');
  if (baseline) baseline.classList.toggle('baseline-active', isValidBox(STATE.baselineBox));
  const readout = document.getElementById('staticClipBoxReadout');
  if (readout) readout.textContent = readoutText();
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}

function readoutText() {
  if (STATE.lastSource === 'baseline-missing') return 'Select geometry first, then click Base line.';
  if (STATE.lastSource === 'model-missing') return 'Load or convert a model first.';
  const scope = STATE.lastSource === 'baseline'
    ? `baseline: ${STATE.baselineLabel || 'selected geometry'}`
    : STATE.lastSource === 'selected'
      ? 'selected object bounds'
      : STATE.lastSource === 'model'
        ? 'full model bounds'
        : 'clip bounds';
  const mode = STATE.enabled ? 'Clipping applied' : 'Preview only';
  return `${mode}. Ghost box uses ${scope}: X ${STATE.xMin}-${STATE.xMax}%, Y ${STATE.yMin}-${STATE.yMax}%, Z ${STATE.zMin}-${STATE.zMax}%.`;
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
  const primary = window.__3D_MARKUP_VIEWER_RUNTIME__;
  const legacy = window.__3D_MARKUP_CLIP_RUNTIME__;
  if (primary?.renderer || primary?.scene || primary?.modelRoot) return primary;
  if (legacy?.renderer || legacy?.scene || legacy?.modelRoot) return legacy;
  return primary || legacy || {};
}

function requestRender(runtime) {
  if (typeof runtime?.renderOnce === 'function') {
    runtime.renderOnce('static-clipbox');
    return;
  }
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { source: 'static-clipbox' } }));
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

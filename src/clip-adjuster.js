import * as THREE from 'three';

const AXES = {
  x: { label: 'X', vector: new THREE.Vector3(1, 0, 0) },
  y: { label: 'Y', vector: new THREE.Vector3(0, 1, 0) },
  z: { label: 'Z', vector: new THREE.Vector3(0, 0, 1) }
};

const managedPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

const state = {
  axis: 'x',
  normalized: 0.5,
  inverted: false,
  forceActive: false,
  active: false,
  bounds: null,
  baselineBox: null,
  baselineLabel: '',
  lastRenderer: runtime()?.renderer || null,
  lastScene: runtime()?.scene || null,
  lastSignature: '',
  uiReady: false,
  lastError: null,
  applyingRuntimeClip: false
};

const ui = {};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initClipUi, { once: true });
} else {
  initClipUi();
}

window.addEventListener('markup:render-context', handleRuntimeContext);
window.addEventListener('viewer:runtime-context', handleRuntimeContext);
window.addEventListener('viewer:model-loaded', handleRuntimeContext);
window.addEventListener('viewer:selection-changed', () => syncUi(true));

function handleRuntimeContext(event) {
  if (state.applyingRuntimeClip) return;

  const detail = event.detail || {};
  const renderer = detail.renderer || runtime()?.renderer;
  const scene = detail.modelRoot || detail.scene || runtime()?.getModelRoot?.() || runtime()?.modelRoot || runtime()?.scene;

  if (!renderer && !scene) return;

  try {
    if (renderer) state.lastRenderer = renderer;
    if (scene) state.lastScene = scene;
    if (renderer) renderer.localClippingEnabled = true;
    updateBounds(scene);
    if (renderer) applyClipToRenderer(renderer);
    syncUi();
  } catch (error) {
    state.lastError = error;
    safeReadout(`Clip controller paused: ${error?.message || 'unknown error'}`);
  }
}

function initClipUi() {
  ui.panel = document.getElementById('clipAdjustPanel');
  ui.axis = byId('clipAxisSelect');
  ui.range = byId('clipPositionRange', 'clipSlider');
  ui.position = byId('clipPositionInput', 'clipOffsetInput');
  ui.invert = byId('clipInvert', 'clipInvertCheck');
  ui.minus = byId('clipStepMinus', 'clipStepDownBtn');
  ui.plus = byId('clipStepPlus', 'clipStepUpBtn');
  ui.reset = byId('clipResetBtn', 'clipCenterBtn');
  ui.readout = byId('clipReadout', 'clipAdjustHint');
  ui.toggle = byId('clipPanelToggleBtn', 'clipAdjustToggleBtn');

  if (!ui.panel || !ui.axis || !ui.range || !ui.position || !ui.invert || !ui.minus || !ui.plus || !ui.reset || !ui.readout) {
    console.warn('[3DMarkupTool] Clip plane UI not initialized: missing control IDs.');
    return;
  }

  ui.baseline = ensureBaselineButton();

  if (!ui.toggle) {
    ui.toggle = document.createElement('button');
    ui.toggle.type = 'button';
    ui.toggle.id = 'clipPanelToggleBtn';
    ui.toggle.className = 'clip-panel-toggle';
    ui.toggle.title = 'Turn clipping on or off';
    const header = ui.panel.querySelector('.clip-adjust-head');
    header?.appendChild(ui.toggle);
  }

  ui.axis.value = state.axis;
  writeRangeValue();
  ui.position.value = '50.0';
  ui.invert.checked = state.inverted;

  ui.baseline?.addEventListener('click', captureBaseline);
  ui.toggle.addEventListener('click', () => setClipEnabled(!state.active));
  ui.axis.addEventListener('change', () => {
    state.axis = ui.axis.value in AXES ? ui.axis.value : 'x';
    applyNow();
  });
  ui.range.addEventListener('input', () => {
    state.normalized = readRangeValue();
    applyNow();
  });
  ui.position.addEventListener('change', () => {
    state.normalized = clamp(Number(ui.position.value) / 100, 0, 1);
    applyNow();
  });
  ui.invert.addEventListener('change', () => {
    state.inverted = Boolean(ui.invert.checked);
    applyNow();
  });
  ui.minus.addEventListener('click', () => stepClip(-0.05));
  ui.plus.addEventListener('click', () => stepClip(0.05));
  ui.reset.addEventListener('click', () => {
    state.normalized = 0.5;
    applyNow();
  });

  window.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (event.key === '[') {
      stepClip(-0.05);
      event.preventDefault();
    }
    if (event.key === ']') {
      stepClip(0.05);
      event.preventDefault();
    }
  });

  state.uiReady = true;
  updateBounds(currentModelRoot());
  const renderer = state.lastRenderer || runtime()?.renderer;
  if (renderer) applyClipToRenderer(renderer);
  syncUi(true);
}

function ensureBaselineButton() {
  let button = document.getElementById('clipPlaneBaselineBtn');
  if (button) return button;
  const header = ui.panel?.querySelector('.clip-adjust-head');
  if (!header) return null;
  button = document.createElement('button');
  button.id = 'clipPlaneBaselineBtn';
  button.type = 'button';
  button.className = 'clip-panel-toggle clip-baseline-toggle';
  button.title = 'Use selected geometry as clip plane baseline';
  button.textContent = 'Base line';
  header.insertBefore(button, ui.toggle || null);
  return button;
}

function captureBaseline() {
  const box = selectedReferenceBounds();
  if (!isValidBox(box)) {
    safeReadout('Select geometry first, then click Base line.');
    return false;
  }
  state.baselineBox = box.clone();
  state.baselineLabel = selectedReferenceLabel();
  state.lastSignature = '';
  updateBounds(currentModelRoot());
  state.forceActive = true;
  applyNow();
  return true;
}

function setClipEnabled(enabled) {
  const desired = Boolean(enabled);
  const clipButton = document.getElementById('clipBtn');
  const toolbarActive = isToolbarClipActive();

  if (clipButton && toolbarActive !== desired) {
    clipButton.click();
  }

  state.forceActive = desired;
  applyNow();
}

function applyNow() {
  const currentRuntime = runtime();
  const renderer = state.lastRenderer || currentRuntime?.renderer;
  const root = currentModelRoot();

  updateBounds(root);
  if (renderer) applyClipToRenderer(renderer);
  syncUi(true);
}

function stepClip(delta) {
  state.normalized = clamp(state.normalized + delta, 0, 1);
  applyNow();
}

function applyClipToRenderer(renderer) {
  if (!renderer) return;

  const api = runtime();
  const active = isToolbarClipActive() || state.forceActive;
  renderer.localClippingEnabled = true;

  if (!active) {
    if (!clipAdjusterOwnsRuntimeClip(api, renderer)) {
      state.active = false;
      return;
    }

    state.applyingRuntimeClip = true;
    try {
      if (typeof api?.clearClipping === 'function') {
        api.clearClipping({ source: 'clip-adjuster' });
      } else {
        renderer.clippingPlanes = [];
      }
    } finally {
      state.applyingRuntimeClip = false;
    }
    state.active = false;
    return;
  }

  applyPlane(managedPlane);
  const planes = [managedPlane];

  state.applyingRuntimeClip = true;
  try {
    if (typeof api?.applyClipping === 'function') {
      api.applyClipping(planes, { mode: 'plane', source: 'clip-adjuster' });
    } else {
      renderer.clippingPlanes = planes;
    }
  } finally {
    state.applyingRuntimeClip = false;
  }

  state.active = true;
}

function clipAdjusterOwnsRuntimeClip(api = runtime(), renderer = state.lastRenderer || api?.renderer) {
  const mode = String(api?.clippingMode || '').toLowerCase();
  const source = String(api?.source || '').toLowerCase();
  if (mode === 'plane' || source === 'clip-adjuster' || source === 'app-toolbar') return true;
  const planes = renderer?.clippingPlanes;
  return Array.isArray(planes) && planes.length === 1 && planes[0] === managedPlane;
}

function isToolbarClipActive() {
  const clipButton = document.getElementById('clipBtn');
  if (!clipButton) return false;
  return clipButton.classList.contains('tool-active') || /clip\s+on|plane\s+on/i.test(clipButton.textContent || '');
}

function updateBounds(root) {
  if (isValidBox(state.baselineBox)) {
    const signature = ['x', 'y', 'z'].map((axis) => `${state.baselineBox.min[axis].toFixed(4)}:${state.baselineBox.max[axis].toFixed(4)}`).join('|');
    if (signature !== state.lastSignature) {
      state.bounds = state.baselineBox.clone();
      state.lastSignature = signature;
    }
    return;
  }

  // Keep the legacy model-wide plane behavior, but only for non-scene modelRoot.
  // Scene-wide traversal is deliberately avoided because it can freeze large scenes.
  if (!root || root.isScene) return;

  const box = objectBounds(root);
  if (!isValidBox(box)) return;

  const signature = ['x', 'y', 'z'].map((axis) => `${box.min[axis].toFixed(4)}:${box.max[axis].toFixed(4)}`).join('|');
  if (signature !== state.lastSignature) {
    state.bounds = box.clone();
    state.lastSignature = signature;
  }
}

function shouldSkip(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;

  const name = String(object.name || '').toLowerCase();
  if (name === 'grid' || name === 'axes') return true;
  if (name.includes('selection_box_helper')) return true;
  if (name.includes('model_tree_selection')) return true;
  if (name.includes('clip_box')) return true;
  if (name.includes('measure')) return true;
  if (name.includes('helper')) return true;

  let parent = object.parent;
  while (parent) {
    const parentName = String(parent.name || '').toLowerCase();
    if (parentName.includes('measure') || parentName.includes('selection_box_helper') || parentName.includes('model_tree_selection')) return true;
    parent = parent.parent;
  }

  return false;
}

function applyPlane(plane) {
  if (!state.bounds || !plane) return;
  const axis = state.axis in AXES ? state.axis : 'x';
  const min = state.bounds.min[axis];
  const max = state.bounds.max[axis];
  const position = min + Math.max(max - min, 1e-9) * state.normalized;
  const normal = AXES[axis].vector.clone().multiplyScalar(state.inverted ? 1 : -1);
  const point = new THREE.Vector3();
  point[axis] = position;
  plane.normal.copy(normal);
  plane.constant = -normal.dot(point);
}

function syncUi() {
  if (!state.uiReady) return;

  updateBounds(currentModelRoot());
  const api = runtime();
  const renderer = state.lastRenderer || api?.renderer;
  const planeActive = Boolean(renderer?.clippingPlanes?.length) && clipAdjusterOwnsRuntimeClip(api, renderer);
  state.active = isToolbarClipActive() || state.forceActive || planeActive;

  ui.panel.classList.toggle('clip-active', state.active);
  ui.axis.value = state.axis;
  writeRangeValue();
  ui.position.value = (state.normalized * 100).toFixed(1);
  ui.invert.checked = state.inverted;

  if (ui.toggle) {
    ui.toggle.textContent = state.active ? 'Disable Clip' : 'Enable Clip';
    ui.toggle.classList.toggle('clip-panel-toggle-active', state.active);
  }
  if (ui.baseline) ui.baseline.classList.toggle('clip-panel-toggle-active', isValidBox(state.baselineBox));

  const disabled = !state.bounds;
  [ui.axis, ui.range, ui.position, ui.invert, ui.minus, ui.plus, ui.reset].forEach((control) => {
    control.disabled = disabled;
  });

  if (!state.bounds) {
    ui.readout.textContent = 'Select geometry and click Base line to clip from local reference.';
    return;
  }

  if (!state.active) {
    ui.readout.textContent = isValidBox(state.baselineBox)
      ? `Clip plane ready — baseline: ${state.baselineLabel || 'selected geometry'}. Click Enable Clip.`
      : 'Clip plane ready — click Enable Clip or use C.';
    return;
  }

  const axis = state.axis in AXES ? state.axis : 'x';
  const min = state.bounds.min[axis];
  const max = state.bounds.max[axis];
  const position = min + (max - min) * state.normalized;
  const direction = state.inverted ? '+' : '-';
  const baselineText = isValidBox(state.baselineBox) ? ` baseline=${state.baselineLabel || 'selected'}` : '';
  ui.readout.textContent = `${AXES[axis].label} ${direction} @ ${formatNumber(position)} (${(state.normalized * 100).toFixed(1)}%)${baselineText}`;
}

function selectedReferenceBounds() {
  const selected = selectedObject();
  return selected ? objectBounds(selected) : null;
}

function selectedObject() {
  const api = runtime() || {};
  return api.selectedObject || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject || null;
}

function selectedReferenceLabel() {
  const api = runtime() || {};
  const selected = selectedObject();
  const data = api.selectedData || selected?.userData || {};
  return data.ID || data.id || data.REF_NO || data.refNo || data.LABEL || data.label || selected?.name || 'selected geometry';
}

function objectBounds(object) {
  if (!object || shouldSkip(object)) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return isValidBox(box) ? box : null;
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

function readRangeValue() {
  const max = Number(ui.range?.max || 100);
  const value = Number(ui.range?.value || 0);
  return clamp(value / (max > 100 ? 1000 : 100), 0, 1);
}

function writeRangeValue() {
  if (!ui.range) return;
  const max = Number(ui.range.max || 100);
  ui.range.value = String(Math.round(state.normalized * (max > 100 ? 1000 : 100)));
}

function currentModelRoot() {
  const api = runtime();
  return api?.getModelRoot?.() || api?.modelRoot || state.lastScene || api?.scene || null;
}

function byId(...ids) {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node) return node;
  }
  return null;
}

function runtime() {
  const primary = window.__3D_MARKUP_VIEWER_RUNTIME__;
  const legacy = window.__3D_MARKUP_CLIP_RUNTIME__;
  if (primary?.renderer || primary?.scene || primary?.modelRoot) return primary;
  if (legacy?.renderer || legacy?.scene || legacy?.modelRoot) return legacy;
  return primary || legacy || null;
}

function safeReadout(message) {
  if (ui.readout) ui.readout.textContent = message;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(2);
  return value.toFixed(4);
}

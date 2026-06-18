import * as THREE from 'three';

const AXIS_META = {
  x: { label: 'X', vector: new THREE.Vector3(1, 0, 0) },
  y: { label: 'Y', vector: new THREE.Vector3(0, 1, 0) },
  z: { label: 'Z', vector: new THREE.Vector3(0, 0, 1) }
};

const managedPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

const state = {
  axis: 'x',
  normalized: 0.5,
  inverted: false,
  active: false,
  forceActive: false,
  bounds: null,
  lastRenderer: null,
  lastScene: null,
  lastSignature: '',
  uiReady: false
};

const ui = {};
const originalRender = THREE.WebGLRenderer.prototype.render;

THREE.WebGLRenderer.prototype.render = function patchedRender(scene, camera) {
  state.lastRenderer = this;
  state.lastScene = scene;
  this.localClippingEnabled = true;

  updateBounds(scene);

  const toolbarActive = isToolbarClipActive();
  const desiredActive = toolbarActive || state.forceActive;
  let planes = Array.isArray(this.clippingPlanes) ? this.clippingPlanes : [];

  if (desiredActive && !planes.length) {
    this.clippingPlanes = [managedPlane];
    planes = this.clippingPlanes;
  }

  if (!desiredActive && planes[0] === managedPlane) {
    this.clippingPlanes = [];
    planes = this.clippingPlanes;
  }

  state.active = desiredActive || planes.length > 0;

  if (state.active && planes[0]) {
    applyAdjustableClipPlane(planes[0]);
  }

  syncUi();
  return originalRender.call(this, scene, camera);
};

window.addEventListener('DOMContentLoaded', initClipAdjusterUi);

function initClipAdjusterUi() {
  ui.panel = document.getElementById('clipAdjustPanel');
  ui.axis = document.getElementById('clipAxisSelect');
  ui.range = document.getElementById('clipPositionRange');
  ui.position = document.getElementById('clipPositionInput');
  ui.invert = document.getElementById('clipInvert');
  ui.minus = document.getElementById('clipStepMinus');
  ui.plus = document.getElementById('clipStepPlus');
  ui.reset = document.getElementById('clipResetBtn');
  ui.readout = document.getElementById('clipReadout');

  if (!ui.panel || !ui.axis || !ui.range || !ui.position || !ui.invert || !ui.minus || !ui.plus || !ui.reset || !ui.readout) {
    return;
  }

  ui.toggle = document.createElement('button');
  ui.toggle.type = 'button';
  ui.toggle.id = 'clipPanelToggleBtn';
  ui.toggle.className = 'clip-panel-toggle';
  ui.toggle.textContent = 'Clip On';
  ui.toggle.title = 'Turn clipping on or off';

  const header = ui.panel.querySelector('.clip-adjust-head');
  const title = header?.querySelector('strong');
  if (header && title && !document.getElementById('clipPanelToggleBtn')) {
    title.insertAdjacentElement('afterend', ui.toggle);
  }

  ui.axis.value = state.axis;
  ui.range.value = String(Math.round(state.normalized * 1000));
  ui.position.value = '50.0';
  ui.invert.checked = state.inverted;

  ui.toggle.addEventListener('click', () => setClipEnabled(!state.active));

  ui.axis.addEventListener('change', () => {
    state.axis = ui.axis.value in AXIS_META ? ui.axis.value : 'x';
    applyRendererClipState();
    syncUi(true);
  });

  ui.range.addEventListener('input', () => {
    state.normalized = clamp(Number(ui.range.value) / 1000, 0, 1);
    applyRendererClipState();
    syncUi(true);
  });

  ui.position.addEventListener('change', () => {
    state.normalized = clamp(Number(ui.position.value) / 100, 0, 1);
    applyRendererClipState();
    syncUi(true);
  });

  ui.invert.addEventListener('change', () => {
    state.inverted = Boolean(ui.invert.checked);
    applyRendererClipState();
    syncUi(true);
  });

  ui.minus.addEventListener('click', () => stepClip(-0.05));
  ui.plus.addEventListener('click', () => stepClip(0.05));
  ui.reset.addEventListener('click', () => {
    state.normalized = 0.5;
    applyRendererClipState();
    syncUi(true);
  });

  window.addEventListener('keydown', onClipShortcut);
  state.uiReady = true;
  syncUi(true);
}

function onClipShortcut(event) {
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
}

function stepClip(delta) {
  state.normalized = clamp(state.normalized + delta, 0, 1);
  applyRendererClipState();
  syncUi(true);
}

function setClipEnabled(enabled) {
  const desired = Boolean(enabled);
  const clipButton = document.getElementById('clipBtn');
  const toolbarActive = isToolbarClipActive();

  if (clipButton && toolbarActive !== desired) {
    clipButton.click();
    state.forceActive = false;
  } else if (!clipButton) {
    state.forceActive = desired;
  } else {
    state.forceActive = false;
  }

  applyRendererClipState();
  syncUi(true);
}

function isToolbarClipActive() {
  const clipButton = document.getElementById('clipBtn');
  if (!clipButton) return false;
  return Boolean(
    clipButton.classList.contains('tool-active') ||
    /clip\s+on/i.test(clipButton.textContent || '')
  );
}

function applyRendererClipState() {
  if (!state.lastRenderer) return;

  updateBounds(state.lastScene);

  const active = isToolbarClipActive() || state.forceActive;
  let planes = Array.isArray(state.lastRenderer.clippingPlanes) ? state.lastRenderer.clippingPlanes : [];
  state.lastRenderer.localClippingEnabled = true;

  if (active && !planes.length) {
    state.lastRenderer.clippingPlanes = [managedPlane];
    planes = state.lastRenderer.clippingPlanes;
  }

  if (active && planes[0]) {
    applyAdjustableClipPlane(planes[0]);
  }

  if (!active && planes[0] === managedPlane) {
    state.lastRenderer.clippingPlanes = [];
  }

  state.active = active || (Array.isArray(state.lastRenderer.clippingPlanes) && state.lastRenderer.clippingPlanes.length > 0);
}

function updateBounds(scene) {
  if (!scene) return;

  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  let renderableCount = 0;

  scene.updateMatrixWorld?.(true);

  scene.traverse((object) => {
    if (shouldSkipObject(object)) return;
    if (!isRenderableGeometry(object)) return;

    scratch.setFromObject(object);
    if (!Number.isFinite(scratch.min.x)) return;
    box.union(scratch);
    renderableCount += 1;
  });

  if (!renderableCount || !Number.isFinite(box.min.x)) {
    return;
  }

  const signature = ['x', 'y', 'z']
    .map((axis) => `${box.min[axis].toFixed(4)}:${box.max[axis].toFixed(4)}`)
    .join('|');

  if (signature !== state.lastSignature) {
    state.bounds = box.clone();
    state.lastSignature = signature;
  }
}

function shouldSkipObject(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;

  const name = String(object.name || '').toLowerCase();
  if (name === 'grid' || name === 'axes') return true;
  if (name.includes('selection_box_helper')) return true;
  if (name.includes('measure')) return true;
  if (name.includes('helper')) return true;

  let parent = object.parent;
  while (parent) {
    const parentName = String(parent.name || '').toLowerCase();
    if (parentName.includes('measure') || parentName.includes('selection_box_helper')) return true;
    parent = parent.parent;
  }

  return false;
}

function isRenderableGeometry(object) {
  if (!object?.geometry) return false;
  return Boolean(
    object.isMesh ||
    object.isLine ||
    object.isLineSegments ||
    object.isPoints ||
    object.type === 'Sprite'
  );
}

function applyAdjustableClipPlane(plane) {
  if (!state.bounds) return;

  const axis = state.axis in AXIS_META ? state.axis : 'x';
  const bounds = state.bounds;
  const min = bounds.min[axis];
  const max = bounds.max[axis];
  const span = Math.max(max - min, 1e-9);
  const position = min + span * state.normalized;
  const normal = AXIS_META[axis].vector.clone().multiplyScalar(state.inverted ? 1 : -1);
  const pointOnPlane = new THREE.Vector3();
  pointOnPlane[axis] = position;

  plane.normal.copy(normal);
  plane.constant = -normal.dot(pointOnPlane);
}

function syncUi(force = false) {
  if (!state.uiReady) return;

  updateBounds(state.lastScene);
  state.active = isToolbarClipActive() || state.forceActive || Boolean(state.lastRenderer?.clippingPlanes?.length);

  ui.panel.classList.toggle('clip-active', state.active);
  ui.axis.value = state.axis;
  ui.range.value = String(Math.round(state.normalized * 1000));
  ui.position.value = (state.normalized * 100).toFixed(1);
  ui.invert.checked = state.inverted;

  if (ui.toggle) {
    ui.toggle.textContent = state.active ? 'Clip Off' : 'Clip On';
    ui.toggle.classList.toggle('clip-panel-toggle-active', state.active);
  }

  const disabled = !state.bounds;
  [ui.axis, ui.range, ui.position, ui.invert, ui.minus, ui.plus, ui.reset].forEach((control) => {
    control.disabled = disabled;
  });

  if (!state.active) {
    ui.readout.textContent = state.bounds ? 'Clip is off — click Clip On here or use C.' : 'Clip is off — load/convert model first.';
    return;
  }

  if (!state.bounds) {
    ui.readout.textContent = 'Clip waiting for model bounds.';
    return;
  }

  const axis = state.axis in AXIS_META ? state.axis : 'x';
  const min = state.bounds.min[axis];
  const max = state.bounds.max[axis];
  const position = min + (max - min) * state.normalized;
  const direction = state.inverted ? '+' : '-';
  ui.readout.textContent = `${AXIS_META[axis].label} ${direction} @ ${formatNumber(position)} (${(state.normalized * 100).toFixed(1)}%)`;
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

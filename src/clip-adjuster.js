import * as THREE from 'three';

const AXIS_META = {
  x: { label: 'X', vector: new THREE.Vector3(1, 0, 0) },
  y: { label: 'Y', vector: new THREE.Vector3(0, 1, 0) },
  z: { label: 'Z', vector: new THREE.Vector3(0, 0, 1) }
};

const state = {
  axis: 'x',
  normalized: 0.5,
  inverted: false,
  active: false,
  bounds: null,
  lastSignature: '',
  uiReady: false
};

const ui = {};
const originalRender = THREE.WebGLRenderer.prototype.render;

THREE.WebGLRenderer.prototype.render = function patchedRender(scene, camera) {
  const planes = Array.isArray(this.clippingPlanes) ? this.clippingPlanes : [];
  state.active = planes.length > 0;

  if (state.active && planes[0]) {
    updateBounds(scene);
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

  ui.axis.value = state.axis;
  ui.range.value = String(Math.round(state.normalized * 1000));
  ui.position.value = '50.0';
  ui.invert.checked = state.inverted;

  ui.axis.addEventListener('change', () => {
    state.axis = ui.axis.value in AXIS_META ? ui.axis.value : 'x';
    syncUi(true);
  });

  ui.range.addEventListener('input', () => {
    state.normalized = clamp(Number(ui.range.value) / 1000, 0, 1);
    syncUi(true);
  });

  ui.position.addEventListener('change', () => {
    state.normalized = clamp(Number(ui.position.value) / 100, 0, 1);
    syncUi(true);
  });

  ui.invert.addEventListener('change', () => {
    state.inverted = Boolean(ui.invert.checked);
    syncUi(true);
  });

  ui.minus.addEventListener('click', () => stepClip(-0.05));
  ui.plus.addEventListener('click', () => stepClip(0.05));
  ui.reset.addEventListener('click', () => {
    state.normalized = 0.5;
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
  syncUi(true);
}

function updateBounds(scene) {
  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  let meshCount = 0;

  scene.traverse((object) => {
    if (!object.isMesh) return;
    if (object.name === 'SELECTION_BOX_HELPER') return;
    if (object.name && object.name.includes('MEASURE')) return;

    const data = object.userData || {};
    const hasEngineeringData = Object.keys(data).length > 0;
    const hasUsefulGeometry = object.geometry && !object.name?.toLowerCase().includes('grid');
    if (!hasEngineeringData && !hasUsefulGeometry) return;

    scratch.setFromObject(object);
    if (!Number.isFinite(scratch.min.x)) return;
    box.union(scratch);
    meshCount += 1;
  });

  if (!meshCount || !Number.isFinite(box.min.x)) return;

  const signature = ['x', 'y', 'z']
    .map((axis) => `${box.min[axis].toFixed(4)}:${box.max[axis].toFixed(4)}`)
    .join('|');

  if (signature !== state.lastSignature) {
    state.bounds = box.clone();
    state.lastSignature = signature;
  }
}

function applyAdjustableClipPlane(plane) {
  if (!state.bounds) return;

  const axis = state.axis in AXIS_META ? state.axis : 'x';
  const bounds = state.bounds;
  const min = bounds.min[axis];
  const max = bounds.max[axis];
  const position = min + (max - min) * state.normalized;
  const normal = AXIS_META[axis].vector.clone().multiplyScalar(state.inverted ? 1 : -1);
  const pointOnPlane = new THREE.Vector3();
  pointOnPlane[axis] = position;

  plane.normal.copy(normal);
  plane.constant = -normal.dot(pointOnPlane);
}

function syncUi(force = false) {
  if (!state.uiReady) return;

  ui.panel.classList.toggle('clip-active', state.active);
  ui.axis.value = state.axis;
  ui.range.value = String(Math.round(state.normalized * 1000));
  ui.position.value = (state.normalized * 100).toFixed(1);
  ui.invert.checked = state.inverted;

  const disabled = !state.bounds;
  [ui.axis, ui.range, ui.position, ui.invert, ui.minus, ui.plus, ui.reset].forEach((control) => {
    control.disabled = disabled;
  });

  if (!state.active) {
    ui.readout.textContent = 'Clip is off — use Clip button or C.';
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
  ui.readout.textContent = `${AXIS_META[axis].label} ${direction} @ ${(state.normalized * 100).toFixed(1)}% / scene ${formatSceneNumber(position)}`;
}

function formatSceneNumber(value) {
  if (!Number.isFinite(value)) return 'N/A';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(2);
  return value.toFixed(4);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

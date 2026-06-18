import * as THREE from 'three';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const AXIS_COLORS = {
  x: '#ff6b6b',
  y: '#65d46e',
  z: '#4aa3ff'
};

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  bounds: null,
  clipPreview: null,
  active: false,
  lastSignature: '',
  axis: 'x',
  normalized: 0.5,
  inverted: false,
  triad: null,
  triadLines: {},
  triadLabels: {}
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initOverlays, { once: true });
} else {
  initOverlays();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (!renderer || !scene) return;

  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera || state.camera;

  updateBounds(scene);
  syncFromClipUi();
  updateClipPlanePreview();
  updateAxisTriad();
});

function initOverlays() {
  ensureAxisTriad();

  ['clipAxisSelect', 'clipPositionRange', 'clipPositionInput', 'clipInvert', 'clipBtn', 'clipPanelToggleBtn'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', scheduleOverlayUpdate);
    document.getElementById(id)?.addEventListener('change', scheduleOverlayUpdate);
    document.getElementById(id)?.addEventListener('click', scheduleOverlayUpdate);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === '[' || event.key === ']' || event.key?.toLowerCase() === 'c') {
      scheduleOverlayUpdate();
    }
  });

  scheduleOverlayUpdate();
}

function scheduleOverlayUpdate() {
  window.requestAnimationFrame(() => {
    updateBounds(state.scene || runtime?.scene);
    syncFromClipUi();
    updateClipPlanePreview();
    updateAxisTriad();
  });
}

function syncFromClipUi() {
  const axisSelect = document.getElementById('clipAxisSelect');
  const range = document.getElementById('clipPositionRange');
  const position = document.getElementById('clipPositionInput');
  const invert = document.getElementById('clipInvert');

  const axis = axisSelect?.value;
  if (axis && AXES[axis]) state.axis = axis;

  if (range && Number.isFinite(Number(range.value))) {
    state.normalized = clamp(Number(range.value) / 1000, 0, 1);
  } else if (position && Number.isFinite(Number(position.value))) {
    state.normalized = clamp(Number(position.value) / 100, 0, 1);
  }

  state.inverted = Boolean(invert?.checked);
  state.active = isClipActive();
}

function isClipActive() {
  const rendererActive = Boolean((state.renderer || runtime?.renderer)?.clippingPlanes?.length);
  const panelActive = Boolean(document.getElementById('clipAdjustPanel')?.classList.contains('clip-active'));
  const toolbarActive = Boolean(document.getElementById('clipBtn')?.classList.contains('tool-active')) || /clip\s+on/i.test(document.getElementById('clipBtn')?.textContent || '');
  return rendererActive || panelActive || toolbarActive;
}

function updateClipPlanePreview() {
  const scene = state.scene || runtime?.scene;
  if (!scene || !state.bounds || !state.active) {
    if (state.clipPreview) state.clipPreview.visible = false;
    return;
  }

  const preview = ensureClipPreview(scene);
  const axis = AXES[state.axis] ? state.axis : 'x';
  const bounds = state.bounds;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const min = bounds.min[axis];
  const max = bounds.max[axis];
  const position = min + Math.max(max - min, 1e-9) * state.normalized;
  const margin = Math.max(size.length() * 0.08, 1);

  if (axis === 'x') {
    preview.scale.set(Math.max(size.z + margin, 1), Math.max(size.y + margin, 1), 1);
    preview.rotation.set(0, Math.PI / 2, 0);
    preview.position.set(position, center.y, center.z);
  } else if (axis === 'y') {
    preview.scale.set(Math.max(size.x + margin, 1), Math.max(size.z + margin, 1), 1);
    preview.rotation.set(-Math.PI / 2, 0, 0);
    preview.position.set(center.x, position, center.z);
  } else {
    preview.scale.set(Math.max(size.x + margin, 1), Math.max(size.y + margin, 1), 1);
    preview.rotation.set(0, 0, 0);
    preview.position.set(center.x, center.y, position);
  }

  preview.material.color.set(axis === 'x' ? AXIS_COLORS.x : axis === 'y' ? AXIS_COLORS.y : AXIS_COLORS.z);
  preview.material.opacity = 0.15;
  preview.visible = true;
  preview.updateMatrixWorld(true);
}

function ensureClipPreview(scene) {
  if (state.clipPreview && state.clipPreview.parent === scene) return state.clipPreview;

  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: AXIS_COLORS.x,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'clip_plane_preview_helper';
  mesh.renderOrder = 999;
  mesh.userData = { isDisplayHelper: true, ignoreBounds: true };
  scene.add(mesh);
  state.clipPreview = mesh;
  return mesh;
}

function ensureAxisTriad() {
  let triad = document.getElementById('canvasAxisTriad');
  if (!triad) {
    const host = document.querySelector('.viewer-stage') || document.body;
    triad = document.createElement('div');
    triad.id = 'canvasAxisTriad';
    triad.className = 'canvas-axis-triad';
    triad.setAttribute('aria-label', 'Canvas XYZ axis triad');
    triad.innerHTML = `
      <svg viewBox="0 0 100 100" role="img" aria-label="XYZ axes">
        <circle class="axis-origin" cx="50" cy="50" r="3"></circle>
        <line id="axisTriadX" class="axis-line axis-x" x1="50" y1="50" x2="82" y2="50"></line>
        <line id="axisTriadY" class="axis-line axis-y" x1="50" y1="50" x2="50" y2="18"></line>
        <line id="axisTriadZ" class="axis-line axis-z" x1="50" y1="50" x2="28" y2="72"></line>
        <text id="axisTriadXLabel" class="axis-label axis-x-text" x="87" y="53">X</text>
        <text id="axisTriadYLabel" class="axis-label axis-y-text" x="47" y="13">Y</text>
        <text id="axisTriadZLabel" class="axis-label axis-z-text" x="18" y="82">Z</text>
      </svg>`;
    host.appendChild(triad);
  }

  state.triad = triad;
  state.triadLines = {
    x: document.getElementById('axisTriadX'),
    y: document.getElementById('axisTriadY'),
    z: document.getElementById('axisTriadZ')
  };
  state.triadLabels = {
    x: document.getElementById('axisTriadXLabel'),
    y: document.getElementById('axisTriadYLabel'),
    z: document.getElementById('axisTriadZLabel')
  };
}

function updateAxisTriad() {
  ensureAxisTriad();
  const camera = state.camera || runtime?.camera;
  if (!camera) return;

  const inverseCamera = camera.quaternion.clone().invert();
  const origin = { x: 50, y: 50 };
  const length = 34;

  Object.entries(AXES).forEach(([axis, vector]) => {
    const projected = vector.clone().applyQuaternion(inverseCamera);
    const end = {
      x: origin.x + projected.x * length,
      y: origin.y - projected.y * length
    };

    const line = state.triadLines[axis];
    const label = state.triadLabels[axis];
    if (!line || !label) return;

    line.setAttribute('x1', String(origin.x));
    line.setAttribute('y1', String(origin.y));
    line.setAttribute('x2', end.x.toFixed(2));
    line.setAttribute('y2', end.y.toFixed(2));
    label.setAttribute('x', (end.x + Math.sign(projected.x || 1) * 7).toFixed(2));
    label.setAttribute('y', (end.y - Math.sign(projected.y || 1) * 7).toFixed(2));

    const depth = clamp((projected.z + 1) / 2, 0.35, 1);
    line.style.opacity = String(depth);
    label.style.opacity = String(depth);
  });
}

function updateBounds(root) {
  if (!root) return;

  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  let count = 0;

  root.updateMatrixWorld?.(true);
  root.traverse?.((object) => {
    if (shouldSkip(object)) return;
    if (!object.geometry) return;

    scratch.setFromObject(object);
    if (!Number.isFinite(scratch.min.x)) return;
    box.union(scratch);
    count += 1;
  });

  if (!count || !Number.isFinite(box.min.x)) return;

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
  if (name.includes('helper')) return true;
  if (name.includes('measure')) return true;
  if (name.includes('clip_plane_preview')) return true;

  let parent = object.parent;
  while (parent) {
    const parentName = String(parent.name || '').toLowerCase();
    if (parentName.includes('helper') || parentName.includes('measure')) return true;
    parent = parent.parent;
  }

  return false;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

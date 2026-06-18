import * as THREE from 'three';

const STYLE_ID = 'phase41TreeClipControlsStyles';
const CLIP_BOX_HELPER_NAME = 'PHASE41_CLIP_BOX_HELPER';
const CLIP_PLANE_PREVIEW_NAME = 'PHASE41_CLIP_PLANE_PREVIEW';
const managedPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

const AXIS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhase41TreeClipControls, { once: true });
} else {
  initPhase41TreeClipControls();
}

window.addEventListener('markup:safe-ui-status', () => scheduleApply(12));
window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleApply(12));
window.addEventListener('markup:render-context', () => scheduleApply(4));
window.addEventListener('resize', () => scheduleApply(3));

function initPhase41TreeClipControls() {
  injectStyles();
  scheduleApply(28);
}

function scheduleApply(remaining = 8) {
  window.requestAnimationFrame(() => {
    applyPhase41TreeClipControls();
    if (remaining > 0) window.setTimeout(() => scheduleApply(remaining - 1), 120);
  });
}

function applyPhase41TreeClipControls() {
  document.body.classList.add('phase41-tree-clip-ready');
  promoteTreeToggle();
  hideLegacyTreeToggle();
  bindClipPlaneUi();
  bindClipBoxUi();
}

function promoteTreeToggle() {
  const viewGroup = document.querySelector('.two-row-command-group[data-group="view"]');
  const treeToggle = document.getElementById('modelTreeToggle');
  if (!viewGroup || !treeToggle) return;

  treeToggle.type = 'button';
  treeToggle.classList.add('phase41-ribbon-tree-btn', 'two-row-icon-btn');
  treeToggle.title = 'Model Tree (T)';
  treeToggle.setAttribute('aria-label', 'Model Tree');
  treeToggle.innerHTML = `${svgIcon('<path d="M5 5h14v4H5z"/><path d="M7 9v10M17 9v10"/><path d="M7 13h10M7 17h10"/>')}<span class="two-row-vis-label">Tree</span>`;

  if (treeToggle.parentElement !== viewGroup) viewGroup.appendChild(treeToggle);
}

function hideLegacyTreeToggle() {
  const legacy = document.getElementById('treeToggleBtn');
  if (!legacy) return;
  legacy.hidden = true;
  legacy.setAttribute('aria-hidden', 'true');
  legacy.style.display = 'none';
  if (!legacy.dataset.phase41Bound) {
    legacy.dataset.phase41Bound = '1';
    legacy.addEventListener('click', () => document.getElementById('modelTreeToggle')?.click(), true);
  }
}

function bindClipPlaneUi() {
  const controls = clipPlaneControls();
  if (!controls.slider || !controls.readout) return;

  if (controls.slider.dataset.phase41ClipPlaneBound !== '1') {
    controls.slider.dataset.phase41ClipPlaneBound = '1';
    controls.slider.addEventListener('input', () => {
      enableToolbarClip();
      applyClipPlaneFromUi();
    });
  }

  ['axis', 'offset', 'invert', 'stepDown', 'stepUp', 'center'].forEach((key) => {
    const node = controls[key];
    if (!node || node.dataset.phase41ClipPlaneBound === '1') return;
    node.dataset.phase41ClipPlaneBound = '1';
    const eventName = node.tagName === 'SELECT' || node.type === 'checkbox' || node.type === 'number' ? 'change' : 'click';
    node.addEventListener(eventName, () => {
      window.setTimeout(() => {
        enableToolbarClip();
        applyClipPlaneFromUi();
      }, 0);
    });
  });
}

function applyClipPlaneFromUi() {
  const runtime = getRuntime();
  const renderer = runtime?.renderer;
  const scene = runtime?.scene;
  const controls = clipPlaneControls();
  if (!renderer || !scene || !controls.slider) {
    setClipReadout('Renderer/model context not ready. Load or convert a model first.');
    return;
  }

  const bounds = visibleModelBounds(scene);
  if (!bounds) {
    setClipReadout('Clip plane waiting for model bounds. Run conversion first.');
    return;
  }

  const axisKey = controls.axis?.value in AXIS ? controls.axis.value : 'x';
  const normalized = clamp(Number(controls.slider.value) / Number(controls.slider.max || 100), 0, 1);
  const invert = Boolean(controls.invert?.checked);
  const min = bounds.min[axisKey];
  const max = bounds.max[axisKey];
  const position = min + (max - min) * normalized;
  const normal = AXIS[axisKey].clone().multiplyScalar(invert ? 1 : -1);
  const point = new THREE.Vector3();
  point[axisKey] = position;
  managedPlane.normal.copy(normal);
  managedPlane.constant = -normal.dot(point);

  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = [managedPlane];
  if (controls.offset) controls.offset.value = (normalized * 100).toFixed(1);
  setClipReadout(`${axisKey.toUpperCase()} ${invert ? '+' : '-'} @ ${formatValue(position)} (${(normalized * 100).toFixed(1)}%)`);
  drawClipPlanePreview(scene, bounds, axisKey, position);
}

function enableToolbarClip() {
  const button = document.getElementById('clipBtn');
  if (!button) return;
  if (!button.classList.contains('tool-active') && !/clip\s+on/i.test(button.textContent || '')) {
    button.click();
  }
  button.classList.add('tool-active');
}

function clipPlaneControls() {
  return {
    axis: document.getElementById('clipAxisSelect'),
    slider: document.getElementById('clipSlider') || document.getElementById('clipPositionRange'),
    offset: document.getElementById('clipOffsetInput') || document.getElementById('clipPositionInput'),
    invert: document.getElementById('clipInvertCheck') || document.getElementById('clipInvert'),
    stepDown: document.getElementById('clipStepDownBtn') || document.getElementById('clipStepMinus'),
    stepUp: document.getElementById('clipStepUpBtn') || document.getElementById('clipStepPlus'),
    center: document.getElementById('clipCenterBtn') || document.getElementById('clipResetBtn'),
    readout: document.getElementById('clipAdjustHint') || document.getElementById('clipReadout')
  };
}

function setClipReadout(text) {
  const readout = clipPlaneControls().readout;
  if (readout) readout.textContent = text;
}

function bindClipBoxUi() {
  const boxMenu = document.getElementById('clipBoxMenu');
  if (!boxMenu) return;

  ['clipBoxEnable', 'clipBoxApplyBtn', 'clipBoxResetBtn'].forEach((id) => {
    const node = document.getElementById(id);
    if (!node || node.dataset.phase41ClipBoxBound === '1') return;
    node.dataset.phase41ClipBoxBound = '1';
    const eventName = node.type === 'checkbox' ? 'change' : 'click';
    node.addEventListener(eventName, () => window.setTimeout(syncVisibleClipBox, 0), true);
  });

  ['x', 'y', 'z'].forEach((axis) => {
    ['Min', 'Max'].forEach((suffix) => {
      const input = document.getElementById(`clipBox_${axis}${suffix}`);
      if (!input || input.dataset.phase41ClipBoxBound === '1') return;
      input.dataset.phase41ClipBoxBound = '1';
      input.addEventListener('change', () => window.setTimeout(syncVisibleClipBox, 0), true);
    });
  });
}

function syncVisibleClipBox() {
  const runtime = getRuntime();
  const renderer = runtime?.renderer;
  const scene = runtime?.scene;
  if (!renderer || !scene) {
    setClipBoxReadout('Renderer/model context not ready yet.');
    return;
  }

  const enabled = Boolean(document.getElementById('clipBoxEnable')?.checked);
  if (!enabled) {
    clearClipBox(scene, renderer);
    setClipBoxReadout('Clip Box is off. Select an object, then enable/apply to center box on it.');
    return;
  }

  const base = selectedBounds(scene) || visibleModelBounds(scene);
  if (!base) {
    setClipBoxReadout('No model bounds found. Run conversion first.');
    return;
  }

  const range = rangeBoxFromPercent(base, readClipBoxPercent());
  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = planesForBox(range);
  drawClipBoxHelper(scene, range);
  setClipBoxReadout(`${selectedBounds(scene) ? 'Selected object' : 'Model'} clip box active: ${formatBox(range)}`);
}

function readClipBoxPercent() {
  const read = (id, fallback) => clamp(Number(document.getElementById(id)?.value ?? fallback), 0, 100);
  const xMin = read('clipBox_xMin', 0);
  const xMax = read('clipBox_xMax', 100);
  const yMin = read('clipBox_yMin', 0);
  const yMax = read('clipBox_yMax', 100);
  const zMin = read('clipBox_zMin', 0);
  const zMax = read('clipBox_zMax', 100);
  return {
    xMin: Math.min(xMin, xMax),
    xMax: Math.max(xMin, xMax),
    yMin: Math.min(yMin, yMax),
    yMax: Math.max(yMin, yMax),
    zMin: Math.min(zMin, zMax),
    zMax: Math.max(zMin, zMax)
  };
}

function rangeBoxFromPercent(base, percent) {
  const box = new THREE.Box3();
  ['x', 'y', 'z'].forEach((axis) => {
    box.min[axis] = lerp(base.min[axis], base.max[axis], percent[`${axis}Min`] / 100);
    box.max[axis] = lerp(base.min[axis], base.max[axis], percent[`${axis}Max`] / 100);
  });
  return box;
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

function drawClipBoxHelper(scene, box) {
  removeNamedHelper(scene, CLIP_BOX_HELPER_NAME);
  const helper = new THREE.Box3Helper(box.clone(), 0x65d5ff);
  helper.name = CLIP_BOX_HELPER_NAME;
  helper.renderOrder = 1300;
  helper.userData = { isDisplayHelper: true, ignoreBounds: true };
  if (helper.material) {
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.95;
  }
  scene.add(helper);
}

function clearClipBox(scene, renderer) {
  if (renderer?.clippingPlanes?.length === 6) renderer.clippingPlanes = [];
  removeNamedHelper(scene, CLIP_BOX_HELPER_NAME);
}

function drawClipPlanePreview(scene, bounds, axisKey, position) {
  removeNamedHelper(scene, CLIP_PLANE_PREVIEW_NAME);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const width = Math.max(axisKey === 'x' ? size.z : size.x, 0.1);
  const height = Math.max(axisKey === 'y' ? size.z : size.y, 0.1);
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    color: 0x65d5ff,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.name = CLIP_PLANE_PREVIEW_NAME;
  plane.userData = { isDisplayHelper: true, ignoreBounds: true };
  plane.renderOrder = 1250;
  plane.position.copy(center);
  plane.position[axisKey] = position;
  if (axisKey === 'x') plane.rotation.y = Math.PI / 2;
  if (axisKey === 'y') plane.rotation.x = Math.PI / 2;
  scene.add(plane);
}

function selectedBounds(scene) {
  const helper = scene?.getObjectByName?.('SELECTION_BOX_HELPER');
  if (helper?.box && Number.isFinite(helper.box.min.x)) return helper.box.clone();
  return null;
}

function visibleModelBounds(root) {
  if (!root) return null;
  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  let count = 0;
  root.updateMatrixWorld?.(true);
  root.traverse?.((object) => {
    if (shouldSkipObject(object)) return;
    if (!object.geometry && !object.isMesh) return;
    scratch.setFromObject(object);
    if (!Number.isFinite(scratch.min.x)) return;
    box.union(scratch);
    count += 1;
  });
  return count && Number.isFinite(box.min.x) ? box : null;
}

function shouldSkipObject(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;
  const name = String(object.name || '').toLowerCase();
  return name === 'grid'
    || name === 'axes'
    || name.includes('helper')
    || name.includes('measure')
    || name.includes('clip_plane_preview')
    || name.includes('clip_box_helper')
    || name.includes('selection_box_helper');
}

function removeNamedHelper(scene, name) {
  const helper = scene?.getObjectByName?.(name);
  if (!helper) return;
  helper.parent?.remove?.(helper);
  helper.geometry?.dispose?.();
  helper.material?.dispose?.();
}

function setClipBoxReadout(text) {
  const readout = document.getElementById('clipBoxReadout');
  if (readout) readout.textContent = text;
}

function getRuntime() {
  return window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function svgIcon(paths) {
  return `<i class="two-row-svg" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></i>`;
}

function injectStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.phase41-tree-clip-ready #treeToggleBtn { display: none !important; }

    body.phase41-tree-clip-ready #modelTreeToggle.phase41-ribbon-tree-btn {
      position: static !important;
      left: auto !important;
      top: auto !important;
      transform: none !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      min-width: 46px !important;
      min-height: 38px !important;
      padding: 5px 8px !important;
      border-radius: 10px !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      letter-spacing: 0 !important;
    }

    body.phase41-tree-clip-ready #modelTreeToggle.phase41-ribbon-tree-btn .two-row-svg {
      width: 22px !important;
      height: 22px !important;
    }

    body.phase41-tree-clip-ready #clipAdjustPanel {
      min-width: 340px !important;
    }

    body.phase41-tree-clip-ready #clipSlider,
    body.phase41-tree-clip-ready #clipPositionRange {
      width: 100% !important;
      min-width: 260px !important;
      accent-color: #65d5ff;
    }

    body.phase41-tree-clip-ready .clip-adjust-row:has(#clipSlider) {
      grid-template-columns: 68px minmax(260px, 1fr) !important;
    }

    body.phase41-tree-clip-ready .phase38-clipbox-readout {
      color: #c6dcf0 !important;
    }
  `;
  document.head.appendChild(style);
}

function lerp(min, max, t) {
  return min + (max - min) * clamp(t, 0, 1);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatValue(value) {
  if (!Number.isFinite(value)) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(2);
  return value.toFixed(4);
}

function formatBox(box) {
  return `X ${formatValue(box.min.x)}..${formatValue(box.max.x)}, Y ${formatValue(box.min.y)}..${formatValue(box.max.y)}, Z ${formatValue(box.min.z)}..${formatValue(box.max.z)}`;
}

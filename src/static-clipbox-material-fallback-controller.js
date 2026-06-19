import * as THREE from 'three';

// Clip Box fallback for legacy recovery only.
// The normal path is renderer-based clipping from app.js runtime.
// When the real renderer is published, this module must not capture Clip Box clicks.

const VERSION = 'static-clipbox-material-fallback-20260619';
const LOG_PREFIX = '[3DMarkupTool:clipbox-fallback]';
const state = {
  baselineBox: null,
  baselineLabel: '',
  touchedMaterials: new Set(),
  active: false
};

install();

function install() {
  window.__3D_MARKUP_STATIC_CLIPBOX_MATERIAL_FALLBACK__ = { version: VERSION, apply, reset, disabled: rendererReady() };
  if (rendererReady()) {
    log('disabled.renderer-ready', { version: VERSION });
    return;
  }
  document.addEventListener('click', onClickCapture, true);
  log('ready', { version: VERSION });
}

function onClickCapture(event) {
  if (rendererReady()) return;
  const button = event.target?.closest?.('#staticClipBoxBaselineBtn, #staticClipBoxApplyBtn, #staticClipBoxResetBtn');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (button.id === 'staticClipBoxResetBtn') {
    reset('reset-button');
    return;
  }

  if (button.id === 'staticClipBoxBaselineBtn') {
    captureBaseline();
    apply('baseline-button');
    return;
  }

  apply('apply-button');
}

function captureBaseline() {
  const object = selectedObject();
  const box = object ? boundsOf(object) : null;
  if (!validBox(box)) {
    setReadout('Select geometry first. Baseline not captured.');
    setClipStatus('Clip Box baseline failed: no selected geometry');
    log('baseline.fail', { selectedId: selectedId(), hasObject: Boolean(object) }, 'warn');
    return false;
  }
  state.baselineBox = box.clone();
  state.baselineLabel = labelOf(object);
  setReadout(`Baseline captured: ${state.baselineLabel}. Click Apply or adjust ranges.`);
  setClipStatus(`Clip Box baseline: ${state.baselineLabel}`);
  log('baseline.success', { label: state.baselineLabel, box: boxSummary(box) });
  return true;
}

function apply(source = 'apply') {
  if (rendererReady()) return false;
  const object = selectedObject();
  const base = validBox(state.baselineBox) ? state.baselineBox.clone() : object ? boundsOf(object) : null;
  const ranges = readRanges();

  if (!validBox(base)) {
    setReadout('Select geometry first, then click Base line or Apply.');
    setClipStatus('Clip Box apply failed: no selected geometry');
    log('apply.fail.bounds', { source, selectedId: selectedId(), hasObject: Boolean(object), ranges }, 'warn');
    return false;
  }

  const clipBox = percentBox(base, ranges);
  if (!validBox(clipBox)) {
    setReadout('Calculated clip box is invalid. Check min/max ranges.');
    setClipStatus('Clip Box apply failed: invalid range');
    log('apply.fail.invalid-box', { source, base: boxSummary(base), clipBox: boxSummary(clipBox), ranges }, 'warn');
    return false;
  }

  const planes = planesForBox(clipBox);
  const root = targetRoot(object);
  const touched = applyToMaterials(root, planes);
  if (!touched) {
    setReadout('Clip Box could not find mesh materials to clip.');
    setClipStatus('Clip Box apply failed: no mesh materials');
    log('apply.fail.materials', { source, selectedId: selectedId(), hasRoot: Boolean(root), ranges }, 'error');
    return false;
  }

  state.active = true;
  const label = state.baselineLabel || labelOf(object);
  setPanelActive(true);
  setReadout(`Box clipping applied. Reference: ${label}. X ${ranges.x[0]}-${ranges.x[1]}%, Y ${ranges.y[0]}-${ranges.y[1]}%, Z ${ranges.z[0]}-${ranges.z[1]}%.`);
  setClipStatus(`Clip Box active: ${label} X ${ranges.x[0]}-${ranges.x[1]}%, Y ${ranges.y[0]}-${ranges.y[1]}%, Z ${ranges.z[0]}-${ranges.z[1]}%`);
  publishRuntime(planes);
  log('apply.success', {
    source,
    selectedId: selectedId(),
    label,
    appliedBy: 'material.clippingPlanes',
    materialCount: touched,
    baseBox: boxSummary(base),
    clipBox: boxSummary(clipBox),
    ranges
  });
  return true;
}

function reset(source = 'reset') {
  if (rendererReady()) return;
  clearMaterials();
  state.baselineBox = null;
  state.baselineLabel = '';
  state.active = false;
  setPanelActive(false);
  setClipStatus('Clip Box reset');
  setReadout('Clip Box reset. Select geometry and click Base line.');
  publishRuntime([]);
  log('reset', { source });
}

function applyToMaterials(root, planes) {
  if (!root?.traverse) return 0;
  clearMaterials();
  let count = 0;
  root.traverse((object) => {
    if (!object?.isMesh || !object.material || skip(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      material.clippingPlanes = planes;
      material.clipIntersection = false;
      material.needsUpdate = true;
      state.touchedMaterials.add(material);
      count += 1;
    });
  });
  return count;
}

function clearMaterials() {
  state.touchedMaterials.forEach((material) => {
    if (!material) return;
    material.clippingPlanes = null;
    material.needsUpdate = true;
  });
  state.touchedMaterials.clear();
}

function selectedObject() {
  const diag = window.__3D_MARKUP_CLIP_DIAGNOSTICS__?.selectedObject?.();
  if (diag && !diag.isScene) return diag;
  const runtime = mergedRuntime();
  return runtime.selectedObject || window.__3D_MARKUP_TREE__?.state?.selectedObject || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject || null;
}

function selectedId() {
  const text = String(document.getElementById('selectedStatus')?.textContent || '');
  return text.replace(/^Selected:\s*/i, '').trim();
}

function targetRoot(object) {
  const runtime = mergedRuntime();
  if (runtime.modelRoot?.traverse && !runtime.modelRoot.isScene) return runtime.modelRoot;
  let root = object;
  while (root?.parent && !root.parent.isScene) root = root.parent;
  return root?.traverse ? root : object;
}

function mergedRuntime() {
  const primary = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  const legacy = window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const runtime = primary === legacy ? primary : { ...legacy, ...primary };
  runtime.modelRoot = primary.modelRoot || legacy.modelRoot || runtime.modelRoot || null;
  runtime.scene = primary.scene || legacy.scene || runtime.scene || null;
  runtime.selectedObject = primary.selectedObject || legacy.selectedObject || runtime.selectedObject || null;
  runtime.selectedData = primary.selectedData || legacy.selectedData || runtime.selectedData || null;
  return runtime;
}

function publishRuntime(planes) {
  const runtime = mergedRuntime();
  runtime.clippingPlanes = planes;
  runtime.clippingMode = planes.length ? 'box-material' : 'none';
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', {
    detail: { mode: runtime.clippingMode, source: 'static-clipbox-material-fallback', planes }
  }));
}

function boundsOf(object) {
  if (!object || object.isScene || skip(object)) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return validBox(box) ? box : null;
}

function percentBox(base, ranges) {
  return new THREE.Box3(
    new THREE.Vector3(
      lerp(base.min.x, base.max.x, ranges.x[0] / 100),
      lerp(base.min.y, base.max.y, ranges.y[0] / 100),
      lerp(base.min.z, base.max.z, ranges.z[0] / 100)
    ),
    new THREE.Vector3(
      lerp(base.min.x, base.max.x, ranges.x[1] / 100),
      lerp(base.min.y, base.max.y, ranges.y[1] / 100),
      lerp(base.min.z, base.max.z, ranges.z[1] / 100)
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

function readRanges() {
  return {
    x: readAxis('x'),
    y: readAxis('y'),
    z: readAxis('z')
  };
}

function readAxis(axis) {
  const min = clamp(Number(document.getElementById(`staticClipBox_${axis}Min`)?.value), 0, 100);
  const max = clamp(Number(document.getElementById(`staticClipBox_${axis}Max`)?.value), 0, 100);
  return [Math.min(min, max), Math.max(min, max)];
}

function setPanelActive(active) {
  document.getElementById('clipBoxToggleBtn')?.classList.toggle('tool-active', active);
  document.getElementById('staticClipBoxBaselineBtn')?.classList.toggle('baseline-active', Boolean(state.baselineBox));
}

function setReadout(text) {
  const node = document.getElementById('staticClipBoxReadout');
  if (node) node.textContent = text;
}

function setClipStatus(text) {
  window.__3D_MARKUP_CLIP_DIAGNOSTICS__?.setStatus?.(text);
}

function labelOf(object) {
  const raw = object?.userData || {};
  return raw.ID || raw.id || raw.REF_NO || raw.refNo || raw.LABEL || raw.label || object?.name || selectedId() || 'selected geometry';
}

function boxSummary(box) {
  if (!validBox(box)) return null;
  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
    size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)]
  };
}

function skip(object) {
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

function validBox(box) {
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

function rendererReady() {
  return Boolean(window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer || window.__3D_MARKUP_CLIP_RUNTIME__?.renderer);
}

function lerp(min, max, t) {
  return min + (max - min) * clamp(t, 0, 1);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function log(event, detail = {}, level = 'info') {
  const method = level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'info';
  console[method](LOG_PREFIX, { event, ...detail });
  window.__3D_MARKUP_CLIP_DIAGNOSTICS__?.log?.(`clipbox-fallback.${event}`, detail, level);
}

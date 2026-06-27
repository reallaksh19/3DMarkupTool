import * as THREE from 'three';
import { getModelRoot, objectId, resolveSafeHideTarget } from './static-selection-resolver.js?v=bust-cache-4';

// Phase 16: deterministic canvas action dispatcher.
// Owns real canvas drag/click dispatch for Area Select, Section Box, Isolate, and Hide.
// UI-only: no parser/export/model data changes. Scene traversal is used only after a user action.

const VERSION = 'canvas-action-dispatch-phase16-20260620';
const AREA_CLASS = 'area-select-active';
const PICK_CLASS = 'canvas-review-pick-active';
const MIN_DRAG_PX = 10;
const PICK_TOLERANCE_PX = 6;
const AREA_COLOR = 0x37d8ff;
const SECTION_PADDING_RATIO = 0.05;
const SECTION_MIN_PADDING = 1;

const RUNTIME_EVENTS = [
  'viewer:runtime-context',
  'markup:render-context',
  'viewer:model-loaded',
  'viewer:app-module-loaded',
  'viewer:static-shell-bundle-ready',
  'viewer:static-shell-bundle-loaded',
  'viewer:review-ribbon-tools',
  'viewer:ui-controls-changed',
  'viewer:area-select',
  'viewer:section-box',
  'viewer:visibility-tools'
];

const state = {
  canvas: null,
  areaActive: false,
  areaDrag: null,
  areaOverlay: null,
  areaSelected: [],
  areaHelpers: [],
  pickMode: '',
  pickPointer: null,
  visibilityTouched: new Map(),
  visibilityActive: false,
  controlsSnapshot: null,
  patchedArea: false,
  patchedSectionBox: false,
  patchedViewpad: false,
  lastAction: 'init'
};

installCanvasActionDispatcher();

function installCanvasActionDispatcher() {
  if (window.__3D_MARKUP_CANVAS_ACTION_DISPATCH__?.version === VERSION) return;
  installApi();
  runWhenReady(() => refreshBindings('ready'));
  RUNTIME_EVENTS.forEach((eventName) => window.addEventListener(eventName, () => refreshBindings(eventName), { passive: true }));
  window.addEventListener('keydown', onGlobalKeyDown, true);
}

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function installApi() {
  window.__3D_MARKUP_CANVAS_ACTION_DISPATCH__ = {
    version: VERSION,
    refresh: refreshBindings,
    activateAreaSelect,
    deactivateAreaSelect,
    clearAreaSelection,
    startPickMode,
    cancelPickMode,
    selectedRoots: () => state.areaSelected.slice(),
    debug: () => ({
      version: VERSION,
      hasCanvas: Boolean(state.canvas),
      areaActive: state.areaActive,
      areaSelectedCount: state.areaSelected.length,
      areaHelperCount: state.areaHelpers.length,
      pickMode: state.pickMode,
      visibilityActive: state.visibilityActive,
      controlsLocked: Boolean(state.controlsSnapshot),
      patchedArea: state.patchedArea,
      patchedSectionBox: state.patchedSectionBox,
      patchedViewpad: state.patchedViewpad,
      noPolling: true,
      noMutationObserver: true,
      noStartupSceneTraversal: true,
      lastAction: state.lastAction
    })
  };
}

function refreshBindings(reason = 'refresh') {
  bindCanvas(runtimeCanvas());
  patchAreaSelectApi();
  patchSectionBoxApi();
  patchViewpadApi();
  state.lastAction = `refresh:${reason}`;
  return true;
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function bindCanvas(canvas) {
  if (!canvas || canvas.__canvasActionDispatchBound) return Boolean(canvas);
  canvas.__canvasActionDispatchBound = true;
  canvas.addEventListener('pointerdown', onCanvasPointerDown, true);
  canvas.addEventListener('pointermove', onCanvasPointerMove, true);
  canvas.addEventListener('pointerup', onCanvasPointerUp, true);
  canvas.addEventListener('pointercancel', onCanvasPointerCancel, true);
  state.canvas = canvas;
  return true;
}

function patchAreaSelectApi() {
  const api = window.__3D_MARKUP_AREA_SELECT__;
  if (!api || api.__canvasActionDispatchPatched === VERSION) return false;
  api.activate = () => activateAreaSelect();
  api.deactivate = (message = '') => deactivateAreaSelect(message);
  api.selectInClientRect = (rect, options = {}) => selectAreaInClientRect(rect, options);
  api.selectedRoots = () => state.areaSelected.slice();
  api.getSelectedRoots = () => state.areaSelected.slice();
  api.selectedIds = () => state.areaSelected.map((root) => objectId(root)).filter(Boolean);
  api.clearSelection = (options = {}) => clearAreaSelection({ ...options, source: options.source || 'api-clear' });
  api.clear = api.clearSelection;
  api.buildSelectedPropertiesCsv = () => buildAreaCsv();
  api.exportSelectedPropertiesCsv = () => exportAreaCsv();
  api.__canvasActionDispatchPatched = VERSION;
  state.patchedArea = true;
  return true;
}

function patchSectionBoxApi() {
  const api = window.__3D_MARKUP_SECTION_BOX__;
  if (!api || api.__canvasActionDispatchPatched === VERSION) return false;
  api.apply = () => runSectionBoxAction();
  api.__canvasActionDispatchPatched = VERSION;
  state.patchedSectionBox = true;
  return true;
}

function patchViewpadApi() {
  const api = window.__3D_MARKUP_VIEWPAD_TOOLS__;
  if (!api || api.__canvasActionDispatchPatched === VERSION) return false;
  const originalShowAll = typeof api.showAll === 'function' ? api.showAll.bind(api) : null;
  api.isolateSelected = () => runVisibilityAction('isolate');
  api.hideSelected = () => runVisibilityAction('hide');
  api.showAll = (reason = 'show-all') => {
    clearVisibility({ makeAllVisible: true, render: false });
    return originalShowAll ? originalShowAll(reason) : showAll(reason);
  };
  api.clearVisibility = api.showAll;
  api.__canvasActionDispatchPatched = VERSION;
  state.patchedViewpad = true;
  return true;
}

function activateAreaSelect() {
  refreshBindings('area-activate');
  if (!runtimeCanvas()) {
    setStatus('Area Select unavailable: viewer canvas is not ready');
    return false;
  }
  cancelPickMode('area-select', { quiet: true });
  state.areaActive = true;
  document.body.classList.add(AREA_CLASS);
  updateAreaButtons(true);
  lockControls('area-select');
  setStatus('Area Select: drag a rectangle in the canvas');
  state.lastAction = 'area-activate';
  return true;
}

function deactivateAreaSelect(message = '') {
  state.areaActive = false;
  state.areaDrag = null;
  removeAreaOverlay();
  document.body.classList.remove(AREA_CLASS);
  updateAreaButtons(false);
  restoreControls('area-deactivate');
  if (message) setStatus(message);
  state.lastAction = 'area-deactivate';
  return true;
}

function updateAreaButtons(active) {
  document.querySelectorAll('[data-review-tool="areaSelect"], .view-pad [data-view="areaSelect"]').forEach((button) => {
    button.classList.toggle('tool-active', Boolean(active));
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function runVisibilityAction(mode) {
  refreshBindings(`visibility:${mode}`);
  const targets = actionTargets();
  if (targets.length) return applyVisibility(mode, targets, 'existing-selection');
  return startPickMode(mode);
}

function runSectionBoxAction() {
  refreshBindings('section-box');
  const targets = actionTargets();
  if (targets.length) return applySectionBox(targets[0], 'existing-selection');
  return startPickMode('sectionBox');
}

function actionTargets() {
  const area = sanitizeTargets(state.areaSelected.length ? state.areaSelected : window.__3D_MARKUP_AREA_SELECTED_ROOTS__);
  if (area.length) return area;
  const selected = resolveSafeHideTarget(undefined, { runtime: runtime() });
  return selected && !isUnsafeRoot(selected) ? [selected] : [];
}

function startPickMode(mode) {
  refreshBindings(`pick:${mode}`);
  if (!runtimeCanvas()) {
    setStatus(`${labelForMode(mode)} unavailable: viewer canvas is not ready`);
    return false;
  }
  deactivateAreaSelect();
  cancelPickMode('switch-mode', { quiet: true });
  state.pickMode = mode;
  document.body.classList.add(PICK_CLASS, `${PICK_CLASS}--${mode}`);
  lockControls(`pick:${mode}`);
  setStatus(`${labelForMode(mode)}: click a component/part in the canvas`);
  state.lastAction = `pick-start:${mode}`;
  return true;
}

function cancelPickMode(reason = 'cancel', options = {}) {
  if (!state.pickMode && !state.pickPointer) return false;
  const mode = state.pickMode;
  state.pickMode = '';
  state.pickPointer = null;
  document.body.classList.remove(PICK_CLASS, `${PICK_CLASS}--sectionBox`, `${PICK_CLASS}--isolate`, `${PICK_CLASS}--hide`);
  restoreControls(`pick:${reason}`);
  if (!options.quiet) setStatus(`${labelForMode(mode)} canceled`);
  state.lastAction = `pick-cancel:${reason}`;
  return true;
}

function onCanvasPointerDown(event) {
  if (event.button !== 0) return;
  if (state.areaActive) return beginAreaDrag(event);
  if (state.pickMode) return beginPick(event);
}

function onCanvasPointerMove(event) {
  if (state.areaDrag) return updateAreaDrag(event);
  if (state.areaActive || state.pickMode) lockControls(`canvas:${state.areaActive ? 'area' : state.pickMode}:move`);
}

function onCanvasPointerUp(event) {
  if (state.areaDrag) return finishAreaDrag(event);
  if (state.pickPointer) return finishPick(event);
}

function onCanvasPointerCancel(event) {
  if (state.areaDrag) {
    runtimeCanvas()?.releasePointerCapture?.(state.areaDrag.pointerId);
    deactivateAreaSelect('Area Select canceled');
  }
  if (state.pickPointer) {
    runtimeCanvas()?.releasePointerCapture?.(state.pickPointer.pointerId);
    cancelPickMode('pointercancel');
  }
}

function beginAreaDrag(event) {
  const rt = runtime();
  if (!rt?.camera || !getModelRoot(rt)) {
    deactivateAreaSelect('Area Select unavailable: viewer runtime/model missing');
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  lockControls('area-select:pointerdown');
  state.areaDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY };
  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
  createAreaOverlay();
}

function updateAreaDrag(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  state.areaDrag.currentX = event.clientX;
  state.areaDrag.currentY = event.clientY;
  updateAreaOverlay();
}

function finishAreaDrag(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const drag = state.areaDrag;
  runtimeCanvas()?.releasePointerCapture?.(drag.pointerId);
  const rect = normalizedClientRect(drag.startX, drag.startY, event.clientX, event.clientY);
  state.areaDrag = null;
  removeAreaOverlay();
  if (rect.right - rect.left < MIN_DRAG_PX || rect.bottom - rect.top < MIN_DRAG_PX) {
    deactivateAreaSelect('Area Select canceled');
    return;
  }
  const selected = selectAreaInClientRect(rect, { source: 'phase16-drag' });
  deactivateAreaSelect(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
}

function beginPick(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  lockControls(`pick:${state.pickMode}:pointerdown`);
  state.pickPointer = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: state.pickMode };
  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
}

function finishPick(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const down = state.pickPointer;
  runtimeCanvas()?.releasePointerCapture?.(down.pointerId);
  state.pickPointer = null;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > PICK_TOLERANCE_PX) {
    setStatus(`${labelForMode(down.mode)}: click without dragging to pick a component`);
    return;
  }
  const target = pickSafeTarget(event);
  if (!target) {
    setStatus(`${labelForMode(down.mode)}: no component picked`);
    return;
  }
  cancelPickMode('picked', { quiet: true });
  if (down.mode === 'sectionBox') applySectionBox(target, 'canvas-pick');
  else applyVisibility(down.mode, [target], 'canvas-pick');
}

function selectAreaInClientRect(clientRect, { source = 'area-select' } = {}) {
  const rt = runtime();
  const root = getModelRoot(rt);
  const camera = rt?.camera;
  const viewer = document.getElementById('viewer');
  if (!root || !camera || !viewer) return [];
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRectToViewport(clientRect, viewport);
  const candidates = componentRoots(root);
  const selected = [];

  for (const candidate of candidates) {
    const point = projectedObjectCenter(candidate, camera, viewport);
    if (!point || !pointInRect(point, rect)) continue;
    selected.push(candidate);
  }

  applyAreaHighlights(selected, rt);
  const ids = selected.map((object) => objectId(object)).filter(Boolean);
  setStatus(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:area-select', {
    detail: { action: 'select', source, selectedCount: selected.length, selectedIds: ids, rect: rectSummary(rect), selectionRule: 'center-in-rect' }
  }));
  return selected;
}

function componentRoots(root) {
  const roots = [];
  root.traverse?.((object) => {
    if (!object || object === root || object.userData?.areaSelectHelper || object.userData?.isDisplayHelper) return;
    if (!isComponentNode(object)) return;
    if (hasComponentAncestor(object, root)) return;
    const safe = resolveSafeHideTarget(object, { runtime: runtime() });
    if (!safe || isUnsafeRoot(safe) || roots.includes(safe)) return;
    roots.push(safe);
  });
  return roots;
}

function isComponentNode(object) {
  const data = object?.userData || {};
  return Boolean(data.ID || data.id || data.componentId || data.componentClass || data.TYPE === 'COMPONENT' || data.type === 'COMPONENT');
}

function hasComponentAncestor(object, root) {
  let cursor = object.parent;
  while (cursor && cursor !== root && cursor.type !== 'Scene') {
    if (isComponentNode(cursor)) return true;
    cursor = cursor.parent;
  }
  return false;
}

function projectedObjectCenter(object, camera, viewport) {
  const box = validBoxFor(object);
  if (!box) return null;
  const center = box.getCenter(new THREE.Vector3()).project(camera);
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) return null;
  if (center.z < -1 || center.z > 1) return null;
  return { x: viewport.left + ((center.x + 1) / 2) * viewport.width, y: viewport.top + ((1 - center.y) / 2) * viewport.height };
}

function pointInRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function applyAreaHighlights(selected, rt = runtime()) {
  clearAreaSelection({ silent: true, source: 'replace' });
  state.areaSelected = selected.slice();
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = state.areaSelected.slice();
  const helperRoot = rt?.scene || getModelRoot(rt)?.parent || getModelRoot(rt);
  for (const object of state.areaSelected) {
    const helper = new THREE.BoxHelper(object, AREA_COLOR);
    helper.name = `AREA_SELECT_PHASE16_${objectId(object) || object.uuid || 'OBJECT'}`;
    helper.userData = { areaSelectHelper: true, isDisplayHelper: true, TYPE: 'AREA_SELECT_HELPER', selectedId: objectId(object), source: VERSION };
    helperRoot?.add?.(helper);
    state.areaHelpers.push(helper);
  }
  rt?.renderOnce?.('area-select-phase16');
}

function clearAreaSelection({ source = 'area-select-clear', silent = false } = {}) {
  for (const helper of state.areaHelpers) {
    helper.parent?.remove?.(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  }
  state.areaHelpers = [];
  state.areaSelected = [];
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = [];
  runtime()?.renderOnce?.('area-select-clear-phase16');
  if (!silent) {
    setStatus('Area selection cleared');
    window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'clear', source, selectedCount: 0, selectedIds: [] } }));
  }
  return true;
}

function pickSafeTarget(event) {
  const rt = runtime();
  const root = getModelRoot(rt);
  const canvas = runtimeCanvas();
  const camera = rt?.camera;
  if (!root || !canvas || !camera) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(root, true);
  for (const hit of hits) {
    const target = resolveSafeHideTarget(hit.object, { runtime: rt });
    if (target && !isUnsafeRoot(target)) return target;
  }
  return null;
}

function sanitizeTargets(targets) {
  const result = [];
  const seen = new Set();
  for (const target of targets || []) {
    const safe = resolveSafeHideTarget(target, { runtime: runtime() });
    if (!safe || isUnsafeRoot(safe) || seen.has(safe)) continue;
    seen.add(safe);
    result.push(safe);
  }
  return result;
}

function isUnsafeRoot(object) {
  const rt = runtime();
  const root = getModelRoot(rt);
  if (!object || !root || object === root || object.type === 'Scene' || object.isScene) return true;
  const data = object.userData || {};
  if (data.TYPE === 'MODEL' || data.TYPE === 'MODEL_ROOT' || data.isModelRoot || data.modelRoot) return true;
  if (/^(MODEL_ROOT|GLB_ROOT|RVM_ROOT)$/i.test(String(object.name || ''))) return true;
  const modelBox = validBoxFor(root);
  const objectBox = validBoxFor(object);
  if (!modelBox || !objectBox) return false;
  const modelSize = modelBox.getSize(new THREE.Vector3());
  const objectSize = objectBox.getSize(new THREE.Vector3());
  const ratios = ['x', 'y', 'z'].map((axis) => modelSize[axis] > 1e-9 ? objectSize[axis] / modelSize[axis] : 0);
  return ratios.filter((ratio) => ratio >= 0.96).length >= 2 && (object.children?.length || 0) > 1;
}

function applyVisibility(mode, targets, source = 'visibility') {
  const rt = runtime();
  const root = getModelRoot(rt);
  const safeTargets = sanitizeTargets(targets);
  if (!root || !safeTargets.length) {
    setStatus(`Select a component/part before ${mode === 'hide' ? 'Hide' : 'Isolate'}`);
    return false;
  }
  clearVisibility({ render: false });
  state.visibilityActive = true;
  if (mode === 'isolate') {
    root.traverse?.((object) => { if (object !== root) hideObject(object); });
    safeTargets.forEach((target) => showAncestryAndChildren(target, root));
  } else {
    safeTargets.forEach((target) => hideObject(target));
  }
  rt?.renderOnce?.(mode === 'hide' ? 'hide-selected-phase16' : 'isolate-selected-phase16');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', {
    detail: { action: mode, source, resolver: 'canvas-action-dispatch', selectedIds: safeTargets.map(objectId).filter(Boolean), selectedCount: safeTargets.length, active: true }
  }));
  setStatus(`${mode === 'hide' ? 'Hidden' : 'Isolated'} ${safeTargets.length} selected component${safeTargets.length === 1 ? '' : 's'} â€” Esc or Show All restores`);
  return true;
}

function showAll(reason = 'show-all') {
  return clearVisibility({ makeAllVisible: true, render: true, reason });
}

function clearVisibility({ makeAllVisible = false, render = true, reason = 'show-all' } = {}) {
  const rt = runtime();
  const root = getModelRoot(rt);
  if (makeAllVisible && root?.traverse) root.traverse((object) => { object.visible = true; });
  else for (const [object, wasVisible] of state.visibilityTouched.entries()) object.visible = wasVisible;
  state.visibilityTouched.clear();
  state.visibilityActive = false;
  if (render) rt?.renderOnce?.(reason === 'escape' ? 'show-all-escape-phase16' : reason);
  return true;
}

function hideObject(object) {
  if (!object || isUnsafeRoot(object)) return;
  recordVisibility(object);
  object.visible = false;
}

function showObject(object) {
  if (!object) return;
  recordVisibility(object);
  object.visible = true;
}

function recordVisibility(object) {
  if (!object || state.visibilityTouched.has(object)) return;
  state.visibilityTouched.set(object, object.visible !== false);
}

function showAncestryAndChildren(target, root) {
  let cursor = target;
  while (cursor && cursor !== root.parent) {
    showObject(cursor);
    if (cursor === root) break;
    cursor = cursor.parent;
  }
  target.traverse?.((object) => showObject(object));
}

function applySectionBox(target, source = 'section-box') {
  const rt = runtime();
  const renderer = rt?.renderer;
  const safeTarget = sanitizeTargets([target])[0];
  const box = validBoxFor(safeTarget);
  if (!box) {
    setStatus('Section Box failed: selected component has no valid bounds');
    return false;
  }
  const expanded = expandedSectionBox(box);
  const planes = planesForBox(expanded);
  const selectedId = objectId(safeTarget);
  const meta = { mode: 'box', source: 'canvas-action-dispatch-section-box', trigger: source, resolver: 'canvas-action-dispatch', selectedId, box: boxSummary(expanded) };
  if (typeof rt.applyClipping === 'function') rt.applyClipping(planes, meta);
  if (renderer) {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = planes;
  }
  rt.clippingPlanes = planes;
  rt.clippingMode = 'box';
  window.__3D_MARKUP_VIEWER_RUNTIME__ = rt;
  window.__3D_MARKUP_CLIP_RUNTIME__ = rt;
  rt?.renderOnce?.('section-box-phase16');
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'apply', ...meta, planeCount: planes.length } }));
  setStatus(`Section Box: ${selectedId || 'selected component'}`);
  return true;
}

function validBoxFor(object) {
  object?.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z)
    && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z)
    && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z
    ? box
    : null;
}

function expandedSectionBox(box) {
  const size = box.getSize(new THREE.Vector3());
  return box.clone().expandByScalar(Math.max(SECTION_MIN_PADDING, Math.max(size.x, size.y, size.z, 0) * SECTION_PADDING_RATIO));
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

function boxSummary(box) {
  return { min: [round(box.min.x), round(box.min.y), round(box.min.z)], max: [round(box.max.x), round(box.max.y), round(box.max.z)], size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)] };
}

function createAreaOverlay() {
  removeAreaOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  const overlay = document.createElement('div');
  overlay.className = 'area-select-rect area-select-rect--phase16';
  overlay.style.position = 'absolute';
  overlay.style.zIndex = '37';
  overlay.style.pointerEvents = 'none';
  overlay.style.border = '2px solid rgba(61, 220, 151, .98)';
  overlay.style.borderRadius = '4px';
  overlay.style.background = 'rgba(61, 220, 151, .14)';
  overlay.style.boxShadow = '0 0 0 1px rgba(4, 12, 23, .7), 0 10px 30px rgba(0, 0, 0, .26)';
  viewer.appendChild(overlay);
  state.areaOverlay = overlay;
  updateAreaOverlay();
}

function updateAreaOverlay() {
  const overlay = state.areaOverlay;
  const drag = state.areaDrag;
  const viewer = document.getElementById('viewer');
  if (!overlay || !drag || !viewer) return;
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRectToViewport(normalizedClientRect(drag.startX, drag.startY, drag.currentX, drag.currentY), viewport);
  overlay.style.left = `${rect.left - viewport.left}px`;
  overlay.style.top = `${rect.top - viewport.top}px`;
  overlay.style.width = `${Math.max(rect.right - rect.left, 1)}px`;
  overlay.style.height = `${Math.max(rect.bottom - rect.top, 1)}px`;
}

function removeAreaOverlay() {
  state.areaOverlay?.remove?.();
  state.areaOverlay = null;
}

function lockControls(reason = 'canvas-action-dispatch') {
  window.__3D_MARKUP_CANVAS_INTERACTION__?.lockOrbitControls?.(reason);
  const controls = runtime()?.controls;
  if (!controls) return false;
  if (!state.controlsSnapshot || state.controlsSnapshot.controls !== controls) {
    state.controlsSnapshot = { controls, enabled: controls.enabled, enableRotate: controls.enableRotate, enablePan: controls.enablePan, enableZoom: controls.enableZoom, mouseButtons: controls.mouseButtons ? { ...controls.mouseButtons } : null };
  }
  controls.enabled = false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = false;
  return true;
}

function restoreControls(reason = 'canvas-action-dispatch-release') {
  const snapshot = state.controlsSnapshot;
  if (snapshot?.controls) {
    const controls = snapshot.controls;
    controls.enabled = snapshot.enabled;
    controls.enableRotate = snapshot.enableRotate;
    controls.enablePan = snapshot.enablePan;
    controls.enableZoom = snapshot.enableZoom;
    if (snapshot.mouseButtons) controls.mouseButtons = { ...snapshot.mouseButtons };
    state.controlsSnapshot = null;
  }
  window.__3D_MARKUP_CANVAS_INTERACTION__?.restoreOrbitControls?.(reason);
  return true;
}

function onGlobalKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (state.areaActive || state.pickMode) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
  if (state.areaActive) deactivateAreaSelect('Area Select canceled');
  if (state.pickMode) cancelPickMode('escape');
  if (state.visibilityActive) clearVisibility({ makeAllVisible: true, render: true, reason: 'escape' });
}

function buildAreaCsv() {
  const rows = [['selected_index', 'object_id', 'object_name', 'object_type', 'property_key', 'property_value']];
  state.areaSelected.forEach((object, index) => {
    const data = object.userData || {};
    const entries = Object.entries(data).length ? Object.entries(data) : [['object_name', object.name || object.uuid || '']];
    entries.forEach(([key, value]) => rows.push([index + 1, objectId(object), object.name || '', data.TYPE || data.type || object.type || '', key, serialize(value)]));
  });
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

function exportAreaCsv() {
  if (!state.areaSelected.length) {
    setStatus('Area Select: no selected components to export');
    return '';
  }
  const csv = buildAreaCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `area-selected-properties-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`Exported ${state.areaSelected.length} selected component${state.areaSelected.length === 1 ? '' : 's'} to CSV`);
  return csv;
}

function normalizedClientRect(x1, y1, x2, y2) {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
}

function clampRectToViewport(rect, viewport) {
  return { left: Math.min(Math.max(rect.left, viewport.left), viewport.right), top: Math.min(Math.max(rect.top, viewport.top), viewport.bottom), right: Math.min(Math.max(rect.right, viewport.left), viewport.right), bottom: Math.min(Math.max(rect.bottom, viewport.top), viewport.bottom) };
}

function rectSummary(rect) {
  return { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.right - rect.left), height: Math.round(rect.bottom - rect.top) };
}

function labelForMode(mode) {
  if (mode === 'sectionBox') return 'Section Box';
  if (mode === 'hide') return 'Hide Selected';
  if (mode === 'isolate') return 'Isolate Selected';
  return 'Canvas action';
}

function setStatus(message) {
  const status = document.getElementById('runtimeStatus') || document.getElementById('statusText');
  if (status && message) status.textContent = message;
  window.dispatchEvent(new CustomEvent('viewer:status-message', { detail: { message, source: 'canvas-action-dispatch' } }));
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function serialize(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch (_) { return String(value); }
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

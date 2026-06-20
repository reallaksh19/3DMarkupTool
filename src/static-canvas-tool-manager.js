import * as THREE from 'three';
import { getModelRoot, objectId, resolveSafeHideTarget } from './static-selection-resolver.js';

const VERSION = 'canvas-tool-manager-20260620';
const AREA_CLASS = 'area-select-active';
const PICK_CLASS = 'canvas-review-pick-active';
const AREA_COLOR = 0x37d8ff;
const MIN_DRAG_PX = 10;
const PICK_TOLERANCE_PX = 6;
const SECTION_MIN_PADDING = 1;
const SECTION_PADDING_RATIO = 0.05;
const READY_EVENTS = [
  '3dmarkup:viewer-ready', 'viewer:runtime-context', 'markup:render-context', 'viewer:model-loaded',
  'viewer:app-module-loaded', 'viewer:static-shell-bundle-ready', 'viewer:static-shell-bundle-loaded',
  'viewer:review-ribbon-tools', 'viewer:area-select', 'viewer:section-box', 'viewer:visibility-tools'
];

const state = {
  canvas: null,
  mode: '',
  drag: null,
  pick: null,
  overlay: null,
  areaSelected: [],
  areaHelpers: [],
  controlsSnapshot: null,
  visibilityTouched: new Map(),
  visibilityActive: false,
  sectionBoxActive: false,
  readyCanvas: null,
  boundNodes: new WeakMap(),
  lastAction: 'init'
};

install();

function install() {
  if (window.__3D_MARKUP_CANVAS_TOOL_MANAGER__?.version === VERSION) return;
  installApi();
  runWhenReady(() => refresh('dom-ready'));
  READY_EVENTS.forEach((eventName) => window.addEventListener(eventName, () => refresh(eventName), { passive: true }));
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('click', onDocumentClickCapture, true);
}

function installApi() {
  const api = {
    version: VERSION,
    registerTool: () => true,
    activateTool,
    cancelActiveTool,
    activateSectionBoxDrag,
    getRuntimeCanvas: runtimeCanvas,
    getRuntimeCameraSceneControls,
    pickSafeComponentFromClientPoint,
    selectSafeComponentsInClientRect,
    clearAreaSelection,
    clearSectionBox,
    showAll,
    refresh,
    debug: () => ({
      version: VERSION,
      hasCanvas: Boolean(state.canvas),
      activeMode: state.mode,
      areaSelectedCount: state.areaSelected.length,
      controlsLocked: Boolean(state.controlsSnapshot),
      visibilityActive: state.visibilityActive,
      sectionBoxActive: state.sectionBoxActive,
      viewerReady: Boolean(window.__3D_MARKUP_VIEWER_READY__),
      noPolling: true,
      noMutationObserver: true,
      noStartupSceneTraversal: true,
      lastAction: state.lastAction
    })
  };
  window.__3D_MARKUP_CANVAS_TOOL_MANAGER__ = api;
  window.__3D_MARKUP_CANVAS_ACTION_DISPATCH__ = api;
}

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function getRuntimeCameraSceneControls() {
  const rt = runtime();
  return { runtime: rt, canvas: runtimeCanvas(), renderer: rt.renderer || null, scene: rt.scene || null, camera: rt.camera || null, controls: rt.controls || null, modelRoot: getModelRoot(rt) };
}

function refresh(reason = 'refresh') {
  publishViewerReadyIfPossible(reason);
  bindCanvas(runtimeCanvas());
  patchAreaSelectApi();
  patchSectionBoxApi();
  patchViewpadApi();
  patchGroupedMarkupButtons();
  patchReviewButtons();
  state.lastAction = `refresh:${reason}`;
  return true;
}

function publishViewerReadyIfPossible(reason = 'runtime') {
  const rt = runtime();
  const canvas = runtimeCanvas();
  if (!rt.renderer || !canvas || !rt.scene || !rt.camera || !rt.controls) return false;
  const detail = { renderer: rt.renderer, canvas, scene: rt.scene, camera: rt.camera, controls: rt.controls, modelRoot: getModelRoot(rt), reason, version: VERSION };
  window.__3D_MARKUP_VIEWER_READY__ = detail;
  if (state.readyCanvas !== canvas) {
    state.readyCanvas = canvas;
    window.dispatchEvent(new CustomEvent('3dmarkup:viewer-ready', { detail }));
  }
  return true;
}

function bindCanvas(canvas) {
  if (!canvas || canvas.__canvasToolManagerVersion === VERSION) return Boolean(canvas);
  if (state.canvas && state.canvas !== canvas) {
    state.canvas.removeEventListener('pointerdown', onCanvasPointerDown, true);
    state.canvas.removeEventListener('pointermove', onCanvasPointerMove, true);
    state.canvas.removeEventListener('pointerup', onCanvasPointerUp, true);
    state.canvas.removeEventListener('pointercancel', onCanvasPointerCancel, true);
  }
  state.canvas = canvas;
  canvas.__canvasToolManagerVersion = VERSION;
  canvas.addEventListener('pointerdown', onCanvasPointerDown, true);
  canvas.addEventListener('pointermove', onCanvasPointerMove, true);
  canvas.addEventListener('pointerup', onCanvasPointerUp, true);
  canvas.addEventListener('pointercancel', onCanvasPointerCancel, true);
  return true;
}

function patchAreaSelectApi() {
  const api = window.__3D_MARKUP_AREA_SELECT__ || {};
  if (api.__canvasToolManagerPatched === VERSION) return true;
  api.version = api.version || VERSION;
  api.activate = () => activateTool('areaSelect');
  api.deactivate = (message = '') => cancelActiveTool(message || 'area-select-deactivate');
  api.clearSelection = (options = {}) => clearAreaSelection({ ...options, source: options.source || 'area-api' });
  api.clear = api.clearSelection;
  api.selectedRoots = () => state.areaSelected.slice();
  api.getSelectedRoots = () => state.areaSelected.slice();
  api.selectedIds = () => state.areaSelected.map((root) => objectId(root)).filter(Boolean);
  api.selectInClientRect = (rect, options = {}) => selectSafeComponentsInClientRect(rect, options);
  api.getSelectionSummary = () => ({ active: state.mode === 'areaSelect', selectedCount: state.areaSelected.length, selectedIds: api.selectedIds() });
  api.buildSelectedPropertiesCsv = () => buildAreaCsv();
  api.exportSelectedPropertiesCsv = () => exportAreaCsv();
  api.__canvasToolManagerPatched = VERSION;
  window.__3D_MARKUP_AREA_SELECT__ = api;
  return true;
}

function patchSectionBoxApi() {
  const api = window.__3D_MARKUP_SECTION_BOX__ || {};
  if (api.__canvasToolManagerPatched === VERSION) return true;
  api.version = api.version || VERSION;
  api.apply = () => runSectionBoxAction();
  api.activateDrag = () => activateSectionBoxDrag();
  api.clear = () => clearSectionBox({ source: 'api-section-box-clear' });
  api.debug = () => ({ active: state.sectionBoxActive, version: VERSION, mode: runtime()?.clippingMode || 'none' });
  api.__canvasToolManagerPatched = VERSION;
  window.__3D_MARKUP_SECTION_BOX__ = api;
  return true;
}

function patchViewpadApi() {
  const api = window.__3D_MARKUP_VIEWPAD_TOOLS__ || {};
  if (api.__canvasToolManagerPatched === VERSION) return true;
  api.isolateSelected = () => runVisibilityAction('isolate');
  api.hideSelected = () => runVisibilityAction('hide');
  api.showAll = (reason = 'show-all') => showAll(reason);
  api.clearVisibility = api.showAll;
  api.visibility = () => ({ active: state.visibilityActive, touchedCount: state.visibilityTouched.size });
  api.__canvasToolManagerPatched = VERSION;
  window.__3D_MARKUP_VIEWPAD_TOOLS__ = api;
  return true;
}

function patchReviewButtons() {
  const actions = {
    areaSelect: () => activateTool('areaSelect'),
    clearAreaSelection: () => clearAreaSelection({ source: 'review-clear' }),
    exportAreaSelectionCsv: () => exportAreaCsv(),
    sectionBoxSelected: () => runSectionBoxAction(),
    isolateSelected: () => runVisibilityAction('isolate'),
    hideSelected: () => runVisibilityAction('hide'),
    showAll: () => showAll('review-show-all')
  };
  document.querySelectorAll('[data-review-tool], [data-review-menu-tool], .view-pad [data-view]').forEach((button) => {
    const key = button.dataset.reviewTool || button.dataset.reviewMenuTool || button.dataset.view;
    if (!actions[key]) return;
    bindCaptureOnce(button, `review-${key}`, (event) => captureAndRun(event, actions[key]));
  });
  const clearButton = document.getElementById('clearSelectionBtn');
  if (clearButton) bindCaptureOnce(clearButton, 'clear-selection-area', () => clearAreaSelection({ source: 'clear-selection-button', silent: true }));
}

function patchGroupedMarkupButtons() {
  const tagButton = document.getElementById('staticTagBtn');
  if (tagButton) bindCaptureOnce(tagButton, 'real-manual-tag', (event) => captureAndRun(event, () => { startRealManualTag(); closeStaticMarkupGroups(); }));
  const tagViewsButton = document.getElementById('staticTagViewsBtn');
  if (tagViewsButton) bindCaptureOnce(tagViewsButton, 'real-tag-views', (event) => {
    const real = document.getElementById('navisTagViewsBtn');
    if (!real) return;
    captureAndRun(event, () => { real.click(); closeStaticMarkupGroups(); });
  });
}

function bindCaptureOnce(node, key, handler) {
  const tokens = state.boundNodes.get(node) || new Set();
  if (tokens.has(key)) return;
  tokens.add(key);
  state.boundNodes.set(node, tokens);
  node.addEventListener('click', handler, true);
}

function onDocumentClickCapture(event) {
  const button = event.target?.closest?.('[data-review-tool], [data-review-menu-tool], .view-pad [data-view], #staticTagBtn, #staticTagViewsBtn, #clearSelectionBtn');
  if (!button) return;
  const key = button.dataset?.reviewTool || button.dataset?.reviewMenuTool || button.dataset?.view || button.id || '';
  const actions = {
    areaSelect: () => activateTool('areaSelect'),
    clearAreaSelection: () => clearAreaSelection({ source: 'document-capture-clear' }),
    exportAreaSelectionCsv: () => exportAreaCsv(),
    sectionBoxSelected: () => runSectionBoxAction(),
    isolateSelected: () => runVisibilityAction('isolate'),
    hideSelected: () => runVisibilityAction('hide'),
    showAll: () => showAll('document-capture-show-all'),
    staticTagBtn: () => { startRealManualTag(); closeStaticMarkupGroups(); },
    staticTagViewsBtn: () => {
      const real = document.getElementById('navisTagViewsBtn');
      if (real) real.click();
      closeStaticMarkupGroups();
    },
    clearSelectionBtn: () => clearAreaSelection({ source: 'clear-selection-button', silent: true })
  };
  if (actions[key]) return captureAndRun(event, actions[key]);
  window.queueMicrotask?.(() => refresh('tool-click'));
}

function captureAndRun(event, action) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  action();
  return true;
}

async function startRealManualTag() {
  refresh('manual-tag');
  let realButton = document.getElementById('navisTagBtn');
  if (!realButton) {
    try { await import('./navis-manual-tag-safe-controller.js?v=canvas-tool-manager-20260620'); }
    catch (error) { console.warn('[3DMarkupTool] Manual tag controller import failed', error); }
    realButton = document.getElementById('navisTagBtn');
  }
  if (realButton) {
    realButton.click();
    setStatus('Manual Tag: click leader/arrow point.');
    return true;
  }
  setStatus('Manual Tag unavailable: viewer runtime is not ready');
  return false;
}

function closeStaticMarkupGroups() {
  document.querySelectorAll('.static-markup-menu').forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll('.static-markup-group-toggle[aria-expanded="true"]').forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
}

function activateTool(id) {
  refresh(`activate:${id}`);
  if (id === 'areaSelect') return activateAreaSelect();
  if (id === 'sectionBox') return runSectionBoxAction();
  if (id === 'hide') return runVisibilityAction('hide');
  if (id === 'isolate') return runVisibilityAction('isolate');
  return false;
}

function cancelActiveTool(reason = 'cancel') {
  if (state.mode === 'areaSelect') deactivateAreaSelect(reason === 'escape' ? 'Area Select canceled' : '');
  if (state.mode === 'sectionBoxDrag') deactivateSectionBoxDrag(reason === 'escape' ? 'Section Box drag canceled' : '');
  if (state.mode === 'sectionBox' || state.mode === 'hide' || state.mode === 'isolate') cancelPickMode(reason);
  state.drag = null;
  state.pick = null;
  removeOverlay();
  restoreControls(reason);
  return true;
}

function activateAreaSelect() {
  const ctx = getRuntimeCameraSceneControls();
  if (!ctx.canvas || !ctx.camera || !ctx.modelRoot) {
    setStatus('Area Select unavailable: viewer canvas/model is not ready');
    return false;
  }
  cancelActiveTool('switch-area-select');
  state.mode = 'areaSelect';
  document.body.classList.add(AREA_CLASS);
  updateAreaButtons(true);
  lockControls('area-select');
  setStatus('Area Select: drag a rectangle in the canvas');
  return true;
}

function deactivateAreaSelect(message = '') {
  if (state.mode === 'areaSelect') state.mode = '';
  state.drag = null;
  removeOverlay();
  document.body.classList.remove(AREA_CLASS);
  updateAreaButtons(false);
  restoreControls('area-select-end');
  if (message) setStatus(message);
  return true;
}

function activateSectionBoxDrag() {
  const ctx = getRuntimeCameraSceneControls();
  if (!ctx.canvas || !ctx.camera || !ctx.modelRoot) {
    setStatus('Section Box unavailable: viewer canvas/model is not ready');
    return false;
  }
  cancelActiveTool('switch-sectionBoxDrag');
  state.mode = 'sectionBoxDrag';
  document.body.classList.add(AREA_CLASS, `${AREA_CLASS}--sectionBox`);
  lockControls('section-box-drag');
  setStatus('Section Box: drag a rectangle in the canvas to define the clipping region');
  return true;
}

function deactivateSectionBoxDrag(message = '') {
  if (state.mode === 'sectionBoxDrag') state.mode = '';
  state.drag = null;
  removeOverlay();
  document.body.classList.remove(AREA_CLASS, `${AREA_CLASS}--sectionBox`);
  restoreControls('section-box-drag-end');
  if (message) setStatus(message);
  return true;
}

function applySectionBoxToUnion(objects, source = 'section-box-union') {
  const unionBox = new THREE.Box3();
  for (const obj of objects) {
    const b = validBoxFor(obj);
    if (b) unionBox.union(b);
  }
  if (unionBox.isEmpty()) {
    setStatus('Section Box failed: could not compute bounding box for selected components');
    return false;
  }
  const rt = runtime();
  const renderer = rt.renderer;
  const expanded = unionBox.clone().expandByScalar(sectionPadding(unionBox));
  const planes = planesForBox(expanded);
  const ids = objects.map((o) => objectId(o)).filter(Boolean);
  const meta = { mode: 'box', source: 'canvas-tool-manager-section-box-union', trigger: source, resolver: 'canvas-tool-manager', selectedIds: ids, selectedCount: objects.length, box: boxSummary(expanded) };
  if (typeof rt.applyClipping === 'function') rt.applyClipping(planes, meta);
  if (renderer) { renderer.localClippingEnabled = true; renderer.clippingPlanes = planes; }
  rt.clippingPlanes = planes;
  rt.clippingMode = 'box';
  window.__3D_MARKUP_VIEWER_RUNTIME__ = rt;
  window.__3D_MARKUP_CLIP_RUNTIME__ = rt;
  state.sectionBoxActive = true;
  rt.renderOnce?.('section-box-union-manager');
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'apply', ...meta, planeCount: planes.length } }));
  setStatus(`Section Box applied to ${objects.length} component${objects.length === 1 ? '' : 's'}`);
  return true;
}

function updateAreaButtons(active) {
  document.querySelectorAll('[data-review-tool="areaSelect"], [data-review-menu-tool="areaSelect"], .view-pad [data-view="areaSelect"]').forEach((button) => {
    button.classList.toggle('tool-active', Boolean(active));
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function runSectionBoxAction() {
  refresh('section-box-action');
  const targets = actionTargets();
  if (targets.length) return applySectionBoxToUnion(targets, 'existing-selection');
  return activateSectionBoxDrag();
}

function runVisibilityAction(mode) {
  refresh(`visibility:${mode}`);
  const targets = actionTargets();
  if (targets.length) return applyVisibility(mode, targets, 'existing-selection');
  return startPickMode(mode);
}

function actionTargets() {
  const area = sanitizeTargets(state.areaSelected.length ? state.areaSelected : window.__3D_MARKUP_AREA_SELECTED_ROOTS__);
  if (area.length) return area;
  const selected = resolveSafeHideTarget(undefined, { runtime: runtime() });
  return selected ? sanitizeTargets([selected]) : [];
}

function startPickMode(mode) {
  const ctx = getRuntimeCameraSceneControls();
  if (!ctx.canvas || !ctx.camera || !ctx.modelRoot) {
    setStatus(`${labelForMode(mode)} unavailable: viewer canvas/model is not ready`);
    return false;
  }
  cancelActiveTool(`switch-${mode}`);
  state.mode = mode;
  document.body.classList.add(PICK_CLASS, `${PICK_CLASS}--${mode}`);
  lockControls(`pick:${mode}`);
  setStatus(`${labelForMode(mode)}: click a component/part in the canvas`);
  return true;
}

function cancelPickMode(reason = 'cancel') {
  const mode = state.mode;
  state.mode = '';
  state.pick = null;
  document.body.classList.remove(PICK_CLASS, `${PICK_CLASS}--sectionBox`, `${PICK_CLASS}--hide`, `${PICK_CLASS}--isolate`);
  restoreControls(`pick:${reason}`);
  if (mode && reason !== 'picked' && !String(reason).startsWith('switch')) setStatus(`${labelForMode(mode)} canceled`);
  return true;
}

function onCanvasPointerDown(event) {
  if (event.button !== 0) return;
  if (state.mode === 'areaSelect' || state.mode === 'sectionBoxDrag') return beginAreaDrag(event);
  if (state.mode === 'sectionBox' || state.mode === 'hide' || state.mode === 'isolate') return beginPick(event);
}

function onCanvasPointerMove(event) {
  if (state.drag) return updateAreaDrag(event);
  if (state.mode) lockControls(`canvas:${state.mode}:move`);
}

function onCanvasPointerUp(event) {
  if (state.drag) return finishAreaDrag(event);
  if (state.pick) return finishPick(event);
}

function onCanvasPointerCancel(event) {
  if (state.drag) runtimeCanvas()?.releasePointerCapture?.(state.drag.pointerId);
  if (state.pick) runtimeCanvas()?.releasePointerCapture?.(state.pick.pointerId);
  cancelActiveTool('pointercancel');
}

function beginAreaDrag(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  lockControls('area-select:pointerdown');
  state.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY };
  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
  createOverlay();
}

function updateAreaDrag(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  state.drag.currentX = event.clientX;
  state.drag.currentY = event.clientY;
  updateOverlay();
}

function finishAreaDrag(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const drag = state.drag;
  const modeSnapshot = state.mode;
  runtimeCanvas()?.releasePointerCapture?.(drag.pointerId);
  const rect = normalizedClientRect(drag.startX, drag.startY, event.clientX, event.clientY);
  state.drag = null;
  removeOverlay();
  if (modeSnapshot === 'sectionBoxDrag') {
    if (rect.right - rect.left < MIN_DRAG_PX || rect.bottom - rect.top < MIN_DRAG_PX) {
      deactivateSectionBoxDrag('Section Box: drag too small — try again');
      return false;
    }
    const selected = selectSafeComponentsInClientRect(rect, { source: 'section-box-drag' });
    deactivateSectionBoxDrag(selected.length ? '' : 'Section Box: no components found in rectangle');
    if (selected.length) return applySectionBoxToUnion(selected, 'drag-select');
    return false;
  }
  if (rect.right - rect.left < MIN_DRAG_PX || rect.bottom - rect.top < MIN_DRAG_PX) return deactivateAreaSelect('Area Select canceled');
  const selected = selectSafeComponentsInClientRect(rect, { source: 'canvas-tool-manager-drag' });
  return deactivateAreaSelect(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
}

function beginPick(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  lockControls(`pick:${state.mode}:pointerdown`);
  state.pick = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: state.mode };
  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
}

function finishPick(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const down = state.pick;
  runtimeCanvas()?.releasePointerCapture?.(down.pointerId);
  state.pick = null;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > PICK_TOLERANCE_PX) {
    setStatus(`${labelForMode(down.mode)}: click without dragging to pick a component`);
    return false;
  }
  const target = pickSafeComponentFromClientPoint(event.clientX, event.clientY);
  if (!target) {
    setStatus(`${labelForMode(down.mode)}: no component/part picked`);
    return false;
  }
  cancelPickMode('picked');
  return down.mode === 'sectionBox' ? applySectionBox(target, 'canvas-pick') : applyVisibility(down.mode, [target], 'canvas-pick');
}

function pickSafeComponentFromClientPoint(clientX, clientY) {
  const rt = runtime();
  const root = getModelRoot(rt);
  const canvas = runtimeCanvas();
  const camera = rt.camera;
  if (!root || !canvas || !camera) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(root, true);
  for (const hit of hits) {
    const target = resolveSafeComponentRoot(hit.object, rt);
    if (target) return target;
  }
  return null;
}

function selectSafeComponentsInClientRect(clientRect, { source = 'area-select' } = {}) {
  const rt = runtime();
  const root = getModelRoot(rt);
  const camera = rt.camera;
  const viewer = document.getElementById('viewer');
  if (!root || !camera || !viewer) return [];
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRectToViewport(clientRect, viewport);
  const selected = [];
  const seen = new Set();
  root.traverse?.((object) => {
    const safe = resolveSafeComponentRoot(object, rt);
    if (!safe || seen.has(safe)) return;
    seen.add(safe);
    const point = projectedObjectCenter(safe, camera, viewport);
    if (point && pointInRect(point, rect)) selected.push(safe);
  });
  const pruned = pruneDescendantSelections(selected);
  applyAreaHighlights(pruned, rt);
  const ids = pruned.map((object) => objectId(object)).filter(Boolean);
  setStatus(`Area selected ${pruned.length} component${pruned.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'select', source, selectedCount: pruned.length, selectedIds: ids, rect: rectSummary(rect), selectionRule: 'safe-root-center-in-rect', manager: VERSION } }));
  return pruned;
}

function resolveSafeComponentRoot(object, rt = runtime()) {
  const root = getModelRoot(rt);
  if (!object || !root) return null;
  const candidates = [];
  let cursor = object;
  while (cursor && cursor !== root && !isScene(cursor)) {
    if (isComponentCandidate(cursor)) candidates.push(cursor);
    cursor = cursor.parent;
  }
  for (const candidate of candidates.slice().reverse()) if (isSafeTarget(candidate, rt)) return candidate;
  for (const candidate of candidates) if (isSafeTarget(candidate, rt)) return candidate;
  return null;
}

function isComponentCandidate(object) {
  const data = object?.userData || {};
  const type = String(data.TYPE || data.type || '').toUpperCase();
  if (!object || isDisplayHelper(object)) return false;
  if (type === 'RVM_PRIMITIVE' || type === 'MODEL' || type === 'MODEL_ROOT' || type === 'AREA_SELECT_HELPER') return false;
  return type === 'COMPONENT' || type === 'SUPPORT_RESTRAINT' || type === 'NODE'
    || Boolean(data.ID || data.id || data.componentId || data.REF_NO || data.refNo || data.engineeringType || data.ENGINEERING_TYPE || data.componentType || data.PCF_COMPONENT || data.pipingComponent);
}

function isSafeTarget(object, rt = runtime()) {
  return Boolean(object && !isForbiddenRoot(object, rt) && !isDisplayHelper(object) && !coversMostOfModel(object, rt));
}

function isForbiddenRoot(object, rt = runtime()) {
  const root = getModelRoot(rt);
  if (!object || object === root || isScene(object)) return true;
  const data = object.userData || {};
  const type = String(data.TYPE || data.type || '').toUpperCase();
  const name = String(object.name || '');
  return data.isModelRoot === true || data.modelRoot === true || type === 'MODEL_ROOT' || type === 'MODEL' || /^\s*(MODEL_ROOT|GLB_ROOT|RVM_ROOT|SCENE_ROOT|ROOT)\s*$/i.test(name);
}

function isScene(object) {
  return Boolean(object?.isScene || object?.type === 'Scene');
}

function isDisplayHelper(object) {
  const data = object?.userData || {};
  return Boolean(data.isDisplayHelper || data.areaSelectHelper || data.ignoreBounds || object?.name === 'grid' || object?.name === 'axes' || String(data.TYPE || '').includes('HELPER'));
}

function coversMostOfModel(object, rt = runtime()) {
  const root = getModelRoot(rt);
  if (!root || object === root) return true;
  const modelBox = validBoxFor(root);
  const objectBox = validBoxFor(object);
  if (!modelBox || !objectBox) return false;
  const modelSize = modelBox.getSize(new THREE.Vector3());
  const objectSize = objectBox.getSize(new THREE.Vector3());
  const ratios = ['x', 'y', 'z'].map((axis) => modelSize[axis] > 1e-9 ? objectSize[axis] / modelSize[axis] : 0);
  return ratios.filter((ratio) => ratio >= 0.96).length >= 2 && (object.children?.length || 0) > 1;
}

function sanitizeTargets(targets) {
  const result = [];
  const seen = new Set();
  for (const target of targets || []) {
    const safe = resolveSafeComponentRoot(target, runtime()) || resolveSafeHideTarget(target, { runtime: runtime() });
    if (!safe || !isSafeTarget(safe, runtime()) || seen.has(safe)) continue;
    seen.add(safe);
    result.push(safe);
  }
  return pruneDescendantSelections(result);
}

function pruneDescendantSelections(objects) {
  const set = new Set(objects);
  return objects.filter((object) => {
    let cursor = object.parent;
    while (cursor) {
      if (set.has(cursor)) return false;
      cursor = cursor.parent;
    }
    return true;
  });
}

function projectedObjectCenter(object, camera, viewport) {
  const box = validBoxFor(object);
  if (!box) return null;
  const center = box.getCenter(new THREE.Vector3()).project(camera);
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z) || center.z < -1 || center.z > 1) return null;
  return { x: viewport.left + ((center.x + 1) / 2) * viewport.width, y: viewport.top + ((1 - center.y) / 2) * viewport.height };
}

function pointInRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function applyAreaHighlights(selected, rt = runtime()) {
  clearAreaSelection({ silent: true, source: 'replace' });
  state.areaSelected = selected.slice();
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = state.areaSelected.slice();
  const helperRoot = rt.scene || getModelRoot(rt)?.parent || getModelRoot(rt);
  for (const object of state.areaSelected) {
    const helper = new THREE.BoxHelper(object, AREA_COLOR);
    helper.name = `AREA_SELECT_${objectId(object) || object.uuid || 'OBJECT'}`;
    helper.userData = { areaSelectHelper: true, isDisplayHelper: true, TYPE: 'AREA_SELECT_HELPER', selectedId: objectId(object), source: VERSION };
    helperRoot?.add?.(helper);
    state.areaHelpers.push(helper);
  }
  rt.renderOnce?.('area-select-manager');
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
  runtime().renderOnce?.('area-select-clear-manager');
  if (!silent) {
    setStatus('Area selection cleared');
    window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'clear', source, selectedCount: 0, selectedIds: [], manager: VERSION } }));
  }
  return true;
}

function applySectionBox(target, source = 'section-box') {
  const rt = runtime();
  const renderer = rt.renderer;
  const safeTarget = sanitizeTargets([target])[0];
  const box = validBoxFor(safeTarget);
  if (!box) {
    setStatus('Section Box failed: select a component/part first');
    return false;
  }
  const expanded = box.clone().expandByScalar(sectionPadding(box));
  const planes = planesForBox(expanded);
  const selectedId = objectId(safeTarget);
  const meta = { mode: 'box', source: 'canvas-tool-manager-section-box', trigger: source, resolver: 'canvas-tool-manager', selectedId, box: boxSummary(expanded) };
  if (typeof rt.applyClipping === 'function') rt.applyClipping(planes, meta);
  if (renderer) {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = planes;
  }
  rt.clippingPlanes = planes;
  rt.clippingMode = 'box';
  window.__3D_MARKUP_VIEWER_RUNTIME__ = rt;
  window.__3D_MARKUP_CLIP_RUNTIME__ = rt;
  state.sectionBoxActive = true;
  rt.renderOnce?.('section-box-manager');
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'apply', ...meta, planeCount: planes.length } }));
  setStatus(`Section Box: ${selectedId || 'selected component'}`);
  return true;
}

function clearSectionBox({ source = 'section-box-clear' } = {}) {
  const rt = runtime();
  if (typeof rt.clearClipping === 'function') rt.clearClipping({ source: 'canvas-tool-manager-section-box-clear', trigger: source });
  else if (rt.renderer) {
    rt.renderer.localClippingEnabled = false;
    rt.renderer.clippingPlanes = [];
    rt.clippingPlanes = [];
    rt.clippingMode = 'none';
  }
  state.sectionBoxActive = false;
  rt.renderOnce?.('section-box-clear-manager');
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'clear', source, manager: VERSION } }));
  setStatus('Section Box cleared');
  return true;
}

function sectionPadding(box) {
  const size = box.getSize(new THREE.Vector3());
  return Math.max(SECTION_MIN_PADDING, Math.max(size.x, size.y, size.z, 0) * SECTION_PADDING_RATIO);
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

function applyVisibility(mode, targets, source = 'visibility') {
  const rt = runtime();
  const root = getModelRoot(rt);
  const safeTargets = sanitizeTargets(targets);
  if (!root || !safeTargets.length) {
    setStatus(`Select a component/part before ${mode === 'hide' ? 'Hide' : 'Isolate'}`);
    return false;
  }
  if (mode === 'isolate') clearVisibility({ render: false });
  state.visibilityActive = true;
  if (mode === 'isolate') {
    root.traverse?.((object) => { if (object !== root) hideObject(object); });
    safeTargets.forEach((target) => showAncestryAndChildren(target, root));
  } else {
    safeTargets.forEach((target) => hideObject(target));
  }
  rt.renderOnce?.(mode === 'hide' ? 'hide-selected-manager' : 'isolate-selected-manager');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: mode, source, resolver: 'canvas-tool-manager', selectedIds: safeTargets.map(objectId).filter(Boolean), selectedCount: safeTargets.length, active: true } }));
  setStatus(`${mode === 'hide' ? 'Hidden' : 'Isolated'} ${safeTargets.length} selected component${safeTargets.length === 1 ? '' : 's'} — Esc or Show All restores`);
  return true;
}

function showAll(reason = 'show-all') {
  clearVisibility({ makeAllVisible: true, render: true, reason });
  setStatus(reason === 'escape' ? 'Visibility restored' : 'All components shown');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'showAll', reason, active: false, manager: VERSION } }));
  return true;
}

function clearVisibility({ makeAllVisible = false, render = true, reason = 'show-all' } = {}) {
  const rt = runtime();
  const root = getModelRoot(rt);
  if (makeAllVisible && root?.traverse) root.traverse((object) => { object.visible = true; });
  else for (const [object, wasVisible] of state.visibilityTouched.entries()) object.visible = wasVisible;
  state.visibilityTouched.clear();
  state.visibilityActive = false;
  if (render) rt.renderOnce?.(reason === 'escape' ? 'show-all-escape-manager' : reason);
  return true;
}

function hideObject(object) {
  if (!object || isForbiddenRoot(object, runtime()) || isScene(object)) return;
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

function validBoxFor(object) {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z)
    && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z)
    && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z ? box : null;
}

function createOverlay() {
  removeOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  const overlay = document.createElement('div');
  overlay.className = 'area-select-rect area-select-rect--manager';
  overlay.style.position = 'absolute';
  overlay.style.zIndex = '38';
  overlay.style.pointerEvents = 'none';
  overlay.style.border = '2px solid rgba(61, 220, 151, .98)';
  overlay.style.borderRadius = '4px';
  overlay.style.background = 'rgba(61, 220, 151, .14)';
  viewer.appendChild(overlay);
  state.overlay = overlay;
  updateOverlay();
}

function updateOverlay() {
  const overlay = state.overlay;
  const drag = state.drag;
  const viewer = document.getElementById('viewer');
  if (!overlay || !drag || !viewer) return;
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRectToViewport(normalizedClientRect(drag.startX, drag.startY, drag.currentX, drag.currentY), viewport);
  overlay.style.left = `${rect.left - viewport.left}px`;
  overlay.style.top = `${rect.top - viewport.top}px`;
  overlay.style.width = `${Math.max(rect.right - rect.left, 1)}px`;
  overlay.style.height = `${Math.max(rect.bottom - rect.top, 1)}px`;
}

function removeOverlay() {
  state.overlay?.remove?.();
  state.overlay = null;
}

function lockControls(reason = 'canvas-tool-manager') {
  const controls = runtime().controls;
  if (!controls) return false;
  if (!state.controlsSnapshot || state.controlsSnapshot.controls !== controls) {
    state.controlsSnapshot = { controls, enabled: controls.enabled, enableRotate: controls.enableRotate, enablePan: controls.enablePan, enableZoom: controls.enableZoom, mouseButtons: controls.mouseButtons ? { ...controls.mouseButtons } : null };
  }
  controls.enabled = false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = false;
  state.lastAction = `controls-lock:${reason}`;
  return true;
}

function restoreControls(reason = 'canvas-tool-manager-release') {
  const snapshot = state.controlsSnapshot;
  if (!snapshot?.controls) return false;
  const controls = snapshot.controls;
  controls.enabled = snapshot.enabled;
  controls.enableRotate = snapshot.enableRotate;
  controls.enablePan = snapshot.enablePan;
  controls.enableZoom = snapshot.enableZoom;
  if (snapshot.mouseButtons) controls.mouseButtons = { ...snapshot.mouseButtons };
  state.controlsSnapshot = null;
  state.lastAction = `controls-restore:${reason}`;
  return true;
}

function onKeyDown(event) {
  if (event.key !== 'Escape' || hasInputFocus()) return;
  if (state.mode) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    cancelActiveTool('escape');
    return;
  }
  if (state.sectionBoxActive) {
    event.preventDefault();
    clearSectionBox({ source: 'escape' });
    return;
  }
  if (state.visibilityActive) {
    event.preventDefault();
    showAll('escape');
    return;
  }
  if (state.areaSelected.length) {
    event.preventDefault();
    clearAreaSelection({ source: 'escape' });
  }
}

function hasInputFocus() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function buildAreaCsv() {
  const rows = [['selected_index', 'object_id', 'object_name', 'object_type', 'property_key', 'property_value']];
  state.areaSelected.forEach((object, index) => {
    const data = object.userData || {};
    const entries = Object.entries(data).filter(([key]) => !/helper|ignoreBounds/i.test(key));
    const safeEntries = entries.length ? entries : [['object_name', object.name || object.uuid || '']];
    safeEntries.forEach(([key, value]) => rows.push([index + 1, objectId(object), object.name || '', data.TYPE || data.type || object.type || '', key, serialize(value)]));
  });
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
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

function boxSummary(box) {
  return { min: [round(box.min.x), round(box.min.y), round(box.min.z)], max: [round(box.max.x), round(box.max.y), round(box.max.z)], size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)] };
}

function labelForMode(mode) {
  if (mode === 'sectionBox') return 'Section Box';
  if (mode === 'hide') return 'Hide';
  if (mode === 'isolate') return 'Isolate';
  return 'Canvas tool';
}

function setStatus(message) {
  const status = document.getElementById('runtimeStatus') || document.getElementById('statusText');
  if (status && message) status.textContent = message;
  window.dispatchEvent(new CustomEvent('viewer:status-message', { detail: { message, source: VERSION } }));
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

import * as THREE from 'three';
import { getModelRoot, objectId, resolveSafeHideTarget } from './static-selection-resolver.js';

const VERSION = 'selection-first-tools-20260620';
const PICK_CLASS = 'canvas-review-pick-active';
const SELECT_CLASS = 'canvas-review-ctrl-select-active';
const SELECT_COLOR = 0xffcc5c;
const PICK_TOLERANCE_PX = 6;
const SECTION_MIN_PADDING = 1;
const SECTION_PADDING_RATIO = 0.05;

const state = {
  mode: '',
  pointer: null,
  controlsSnapshot: null,
  selectedRoots: [],
  helpers: [],
  visibilityTouched: new Map(),
  visibilityActive: false,
  sectionBoxActive: false,
  boundCanvas: null,
  lastAction: 'init'
};

install();

function install() {
  if (window.__3D_MARKUP_SELECTION_FIRST_TOOLS__?.version === VERSION) return;
  installApi();
  whenReady(() => refresh('dom-ready'));
  ['3dmarkup:viewer-ready', 'viewer:runtime-context', 'markup:render-context', 'viewer:model-loaded', 'viewer:static-shell-bundle-ready', 'viewer:area-select'].forEach((name) => {
    window.addEventListener(name, () => refresh(name), { passive: true });
  });
  window.addEventListener('click', onDocumentClickCapture, true);
  window.addEventListener('keydown', onKeyDown, true);
}

function installApi() {
  window.__3D_MARKUP_SELECTION_FIRST_TOOLS__ = {
    version: VERSION,
    refresh,
    runTool,
    resetAll,
    clearSelection,
    selectedRoots: currentSelectionRoots,
    debug: () => ({
      version: VERSION,
      activeMode: state.mode,
      selectedCount: currentSelectionRoots().length,
      visibilityActive: state.visibilityActive,
      sectionBoxActive: state.sectionBoxActive,
      controlsLocked: Boolean(state.controlsSnapshot),
      groupedMenusCapture: true,
      ctrlClickMultiselect: true,
      selectionFirstActions: true,
      resetRestoresVisibilityBoxCanvas: true,
      lastAction: state.lastAction
    })
  };
}

function whenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function refresh(reason = 'refresh') {
  bindCanvas(runtimeCanvas());
  state.lastAction = `refresh:${reason}`;
  return true;
}

function bindCanvas(canvas) {
  if (!canvas || state.boundCanvas === canvas) return Boolean(canvas);
  if (state.boundCanvas) {
    state.boundCanvas.removeEventListener('pointerdown', onCanvasPointerDown, true);
    state.boundCanvas.removeEventListener('pointermove', onCanvasPointerMove, true);
    state.boundCanvas.removeEventListener('pointerup', onCanvasPointerUp, true);
    state.boundCanvas.removeEventListener('pointercancel', onCanvasPointerCancel, true);
  }
  state.boundCanvas = canvas;
  canvas.addEventListener('pointerdown', onCanvasPointerDown, true);
  canvas.addEventListener('pointermove', onCanvasPointerMove, true);
  canvas.addEventListener('pointerup', onCanvasPointerUp, true);
  canvas.addEventListener('pointercancel', onCanvasPointerCancel, true);
  return true;
}

function onDocumentClickCapture(event) {
  const groupToggle = event.target?.closest?.('.static-markup-group-toggle');
  if (groupToggle) return capture(event, () => toggleStaticMarkupGroup(groupToggle));

  const button = event.target?.closest?.('[data-review-tool], [data-review-menu-tool], .view-pad [data-view], #clearSelectionBtn, #freshClipClearBtn');
  if (!button) return;
  const key = button.dataset?.reviewTool || button.dataset?.reviewMenuTool || button.dataset?.view || button.id || '';
  const captured = {
    sectionBoxSelected: () => runTool('sectionBox'),
    hideSelected: () => runTool('hide'),
    isolateSelected: () => runTool('isolate'),
    showAll: () => showAll('selection-first-show-all'),
    clearAreaSelection: () => clearSelection({ source: 'selection-first-clear' }),
    exportAreaSelectionCsv: () => exportSelectionCsv(),
    reassembleReview: () => resetAll('review-reset'),
    clearSelectionBtn: () => clearSelection({ source: 'clear-selection-button', clearSync: true }),
    freshClipClearBtn: () => clearSectionBox({ source: 'fresh-clear-clip' })
  };
  if (captured[key]) return capture(event, captured[key]);
}

function capture(event, action) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  action();
  return true;
}

function toggleStaticMarkupGroup(toggle) {
  const wrap = toggle.closest('.static-markup-group');
  const menu = wrap?.querySelector?.('.static-markup-menu');
  if (!wrap || !menu) {
    setStatus('Grouped menu is not ready yet');
    return false;
  }
  const willOpen = menu.hidden;
  closeStaticMarkupGroups();
  if (!willOpen) return true;
  menu.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  state.lastAction = `open-group:${wrap.id || wrap.dataset.markupGroup || 'group'}`;
  return true;
}

function closeStaticMarkupGroups() {
  document.querySelectorAll('.static-markup-menu').forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll('.static-markup-group-toggle[aria-expanded="true"]').forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
}

function runTool(mode) {
  refresh(`run:${mode}`);
  const targets = actionTargets();
  if (targets.length) {
    if (mode === 'sectionBox') return applySectionBox(targets, 'existing-selection');
    return applyVisibility(mode, targets, 'existing-selection');
  }
  if (mode === 'sectionBox') {
    if (window.__3D_MARKUP_CANVAS_TOOL_MANAGER__?.activateSectionBoxDrag?.()) return true;
  }
  return startPickMode(mode);
}

function actionTargets() {
  return sanitizeTargets([
    ...currentSelectionRoots(),
    resolveSafeHideTarget(undefined, { runtime: runtime() })
  ]);
}

function currentSelectionRoots() {
  const external = Array.isArray(window.__3D_MARKUP_AREA_SELECTED_ROOTS__) ? window.__3D_MARKUP_AREA_SELECTED_ROOTS__ : [];
  const managerRoots = safeCall(window.__3D_MARKUP_CANVAS_TOOL_MANAGER__?.selectedRoots, window.__3D_MARKUP_CANVAS_TOOL_MANAGER__) || [];
  const areaRoots = safeCall(window.__3D_MARKUP_AREA_SELECT__?.selectedRoots, window.__3D_MARKUP_AREA_SELECT__) || [];
  return sanitizeTargets([...state.selectedRoots, ...external, ...managerRoots, ...areaRoots]);
}

function startPickMode(mode) {
  const ctx = context();
  if (!ctx.canvas || !ctx.camera || !ctx.modelRoot) {
    setStatus(`${label(mode)} unavailable: viewer canvas/model is not ready`);
    return false;
  }
  cancelPickMode('switch');
  state.mode = mode;
  document.body.classList.add(PICK_CLASS, `${PICK_CLASS}--${mode}`);
  lockControls(`pick:${mode}`);
  setStatus(`${label(mode)}: click a component/part, or Ctrl+click first to build selection`);
  return true;
}

function cancelPickMode(reason = 'cancel') {
  const mode = state.mode;
  state.mode = '';
  state.pointer = null;
  document.body.classList.remove(PICK_CLASS, `${PICK_CLASS}--sectionBox`, `${PICK_CLASS}--hide`, `${PICK_CLASS}--isolate`, SELECT_CLASS);
  restoreControls(`pick:${reason}`);
  if (mode && reason !== 'picked' && !String(reason).startsWith('switch')) setStatus(`${label(mode)} canceled`);
  return true;
}

function onCanvasPointerDown(event) {
  if (event.button !== 0) return;
  if (event.ctrlKey || event.metaKey) return beginCtrlSelection(event);
  if (state.mode === 'sectionBox' || state.mode === 'hide' || state.mode === 'isolate') return beginPick(event);
}

function onCanvasPointerMove(event) {
  if (!state.pointer) return;
  if (state.pointer.kind === 'pick' || state.pointer.kind === 'ctrl-select') {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    lockControls(`pointer:${state.pointer.kind}`);
  }
}

function onCanvasPointerUp(event) {
  if (!state.pointer) return;
  const pointer = state.pointer;
  if (pointer.kind === 'ctrl-select') return finishCtrlSelection(event, pointer);
  if (pointer.kind === 'pick') return finishPick(event, pointer);
}

function onCanvasPointerCancel() {
  if (state.pointer) runtimeCanvas()?.releasePointerCapture?.(state.pointer.pointerId);
  cancelPickMode('pointercancel');
}

function beginCtrlSelection(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  lockControls('ctrl-click-select');
  document.body.classList.add(SELECT_CLASS);
  state.pointer = { kind: 'ctrl-select', pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
}

function finishCtrlSelection(event, pointer) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  runtimeCanvas()?.releasePointerCapture?.(pointer.pointerId);
  state.pointer = null;
  document.body.classList.remove(SELECT_CLASS);
  restoreControls('ctrl-click-select');
  if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > PICK_TOLERANCE_PX) return false;
  const target = pickSafeComponentFromClientPoint(event.clientX, event.clientY);
  if (!target) {
    setStatus('Ctrl Select: no safe component/part picked');
    return false;
  }
  toggleSelection(target);
  return true;
}

function beginPick(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  lockControls(`pick:${state.mode}:pointerdown`);
  state.pointer = { kind: 'pick', pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: state.mode };
  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
}

function finishPick(event, pointer) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  runtimeCanvas()?.releasePointerCapture?.(pointer.pointerId);
  state.pointer = null;
  if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > PICK_TOLERANCE_PX) {
    setStatus(`${label(pointer.mode)}: click without dragging to pick a component`);
    return false;
  }
  const target = pickSafeComponentFromClientPoint(event.clientX, event.clientY);
  if (!target) {
    setStatus(`${label(pointer.mode)}: no safe component/part picked`);
    return false;
  }
  setSelection([target], { source: `${pointer.mode}-pick` });
  cancelPickMode('picked');
  return pointer.mode === 'sectionBox' ? applySectionBox([target], 'canvas-pick') : applyVisibility(pointer.mode, [target], 'canvas-pick');
}

function toggleSelection(target) {
  const safe = sanitizeTargets([target])[0];
  if (!safe) return false;
  const current = currentSelectionRoots();
  const exists = current.includes(safe);
  const next = exists ? current.filter((item) => item !== safe) : current.concat(safe);
  setSelection(next, { source: exists ? 'ctrl-click-remove' : 'ctrl-click-add' });
  setPrimarySelection(next[next.length - 1] || null);
  setStatus(`Selected ${next.length} component${next.length === 1 ? '' : 's'} — choose Box, Hide, or Isolate`);
  return true;
}

function setSelection(targets, { source = 'selection-first' } = {}) {
  const safeTargets = sanitizeTargets(targets);
  clearLocalHelpers();
  state.selectedRoots = safeTargets;
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = safeTargets.slice();
  const helperRoot = runtime().scene || getModelRoot(runtime())?.parent || getModelRoot(runtime());
  for (const object of safeTargets) {
    const helper = new THREE.BoxHelper(object, SELECT_COLOR);
    helper.name = `SELECTION_FIRST_${objectId(object) || object.uuid || 'OBJECT'}`;
    helper.renderOrder = 1300;
    helper.userData = { isDisplayHelper: true, ignoreBounds: true, areaSelectHelper: true, TYPE: 'SELECTION_FIRST_HELPER', source: VERSION };
    helperRoot?.add?.(helper);
    state.helpers.push(helper);
  }
  runtime().renderOnce?.('selection-first-highlight');
  window.dispatchEvent(new CustomEvent('viewer:area-select', {
    detail: { action: safeTargets.length ? 'select' : 'clear', source, selectedCount: safeTargets.length, selectedIds: safeTargets.map(objectId).filter(Boolean), manager: VERSION }
  }));
  return safeTargets;
}

function clearSelection({ source = 'selection-first-clear', clearSync = false } = {}) {
  clearLocalHelpers();
  state.selectedRoots = [];
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = [];
  window.__3D_MARKUP_AREA_SELECT__?.clearSelection?.({ source, silent: true });
  if (clearSync) window.__3D_MARKUP_SELECTION_SYNC__?.clearSelection?.();
  runtime().renderOnce?.('selection-first-clear');
  setStatus('Selection cleared');
  window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'clear', source, selectedCount: 0, selectedIds: [], manager: VERSION } }));
  return true;
}

function clearLocalHelpers() {
  for (const helper of state.helpers) {
    helper.parent?.remove?.(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  }
  state.helpers = [];
}

function setPrimarySelection(target) {
  if (!target) return;
  window.__3D_MARKUP_SELECTED_OBJECT__ = target;
  window.__3D_MARKUP_SELECTED_DATA__ = target.userData || {};
  const rt = runtime();
  rt.selectedObject = target;
  rt.selectedData = target.userData || {};
  window.__3D_MARKUP_SELECTION_SYNC__?.selectObject?.(target, target.userData || {}, { source: 'selection-first' });
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
    const safe = resolveSafeComponentRoot(hit.object, rt);
    if (safe) return safe;
  }
  return null;
}

function applySectionBox(targets, source = 'section-box') {
  const safeTargets = sanitizeTargets(targets);
  const rt = runtime();
  const renderer = rt.renderer;
  const box = unionBoxFor(safeTargets);
  if (!box) {
    setStatus('Section Box failed: select component(s)/part(s) first');
    return false;
  }
  const expanded = box.clone().expandByScalar(sectionPadding(box));
  const planes = planesForBox(expanded);
  const meta = {
    mode: 'box',
    source: 'selection-first-section-box',
    trigger: source,
    resolver: 'selection-first-tools',
    selectedIds: safeTargets.map(objectId).filter(Boolean),
    selectedCount: safeTargets.length,
    box: boxSummary(expanded)
  };
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
  rt.renderOnce?.('selection-first-section-box');
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'apply', ...meta, planeCount: planes.length } }));
  setStatus(`Section Box applied to ${safeTargets.length} selected component${safeTargets.length === 1 ? '' : 's'}`);
  return true;
}

function clearSectionBox({ source = 'section-box-clear' } = {}) {
  const rt = runtime();
  if (typeof rt.clearClipping === 'function') rt.clearClipping({ source: 'selection-first-section-clear', trigger: source });
  if (rt.renderer) {
    rt.renderer.localClippingEnabled = false;
    rt.renderer.clippingPlanes = [];
  }
  rt.clippingPlanes = [];
  rt.clippingMode = 'none';
  state.sectionBoxActive = false;
  setClipButtonOff();
  rt.renderOnce?.('selection-first-section-clear');
  window.__3D_MARKUP_SECTION_BOX__?.clear?.({ source, silent: true });
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'clear', source, manager: VERSION } }));
  setStatus('Section Box cleared');
  return true;
}

function applyVisibility(mode, targets, source = 'visibility') {
  const rt = runtime();
  const root = getModelRoot(rt);
  const safeTargets = sanitizeTargets(targets);
  if (!root || !safeTargets.length) {
    setStatus(`Select component(s)/part(s) before ${mode === 'hide' ? 'Hide' : 'Isolate'}`);
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
  rt.renderOnce?.(`selection-first-${mode}`);
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', {
    detail: { action: mode, source, resolver: 'selection-first-tools', selectedIds: safeTargets.map(objectId).filter(Boolean), selectedCount: safeTargets.length, active: true }
  }));
  setStatus(`${mode === 'hide' ? 'Hidden' : 'Isolated'} ${safeTargets.length} selected component${safeTargets.length === 1 ? '' : 's'} — Reset or Show All restores`);
  return true;
}

function showAll(reason = 'show-all') {
  clearVisibility({ makeAllVisible: true, render: true, reason });
  window.__3D_MARKUP_VIEWPAD_TOOLS__?.showAll?.(reason);
  setStatus('All components shown');
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
  if (render) rt.renderOnce?.(reason);
  return true;
}

function resetAll(reason = 'reset-all') {
  cancelPickMode(reason);
  clearSectionBox({ source: reason });
  clearVisibility({ makeAllVisible: true, render: false, reason });
  clearSelection({ source: reason, clearSync: true });
  window.__3D_MARKUP_CANVAS_TOOL_MANAGER__?.cancelActiveTool?.(reason);
  window.__3D_MARKUP_EXPLODE_REVIEW__?.reassemble?.();
  setClipButtonOff();
  runtime().renderOnce?.('selection-first-reset-all');
  const fitButton = document.getElementById('resetCameraBtn');
  window.setTimeout(() => fitButton?.click?.(), 0);
  setStatus('Reset complete: selection, hide/isolate, section box, controls, and canvas view restored');
  window.dispatchEvent(new CustomEvent('viewer:reset-all', { detail: { reason, manager: VERSION } }));
  return true;
}

function exportSelectionCsv() {
  const targets = currentSelectionRoots();
  if (!targets.length) {
    setStatus('Selection CSV: no selected components');
    return '';
  }
  const rows = [['selected_index', 'object_id', 'object_name', 'object_type', 'property_key', 'property_value']];
  targets.forEach((object, index) => {
    const data = object.userData || {};
    const entries = Object.entries(data).filter(([key]) => !/helper|ignoreBounds/i.test(key));
    const safeEntries = entries.length ? entries : [['object_name', object.name || object.uuid || '']];
    safeEntries.forEach(([key, value]) => rows.push([index + 1, objectId(object), object.name || '', data.TYPE || data.type || object.type || '', key, serialize(value)]));
  });
  const csv = `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `selected-components-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`Exported ${targets.length} selected component${targets.length === 1 ? '' : 's'} to CSV`);
  return csv;
}

function context() {
  const rt = runtime();
  return { runtime: rt, canvas: runtimeCanvas(), renderer: rt.renderer || null, scene: rt.scene || null, camera: rt.camera || null, controls: rt.controls || null, modelRoot: getModelRoot(rt) };
}

function sanitizeTargets(targets) {
  const rt = runtime();
  const result = [];
  const seen = new Set();
  for (const target of targets || []) {
    const safe = resolveSafeComponentRoot(target, rt) || resolveSafeHideTarget(target, { runtime: rt });
    if (!safe || !isSafeTarget(safe, rt) || seen.has(safe)) continue;
    seen.add(safe);
    result.push(safe);
  }
  return pruneDescendantSelections(result);
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
  if (type === 'RVM_PRIMITIVE' || type === 'MODEL' || type === 'MODEL_ROOT' || type.includes('HELPER')) return false;
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

function unionBoxFor(targets) {
  let union = null;
  for (const target of targets) {
    const box = validBoxFor(target);
    if (!box) continue;
    if (!union) union = box.clone();
    else union.union(box);
  }
  return union;
}

function validBoxFor(object) {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z)
    && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z)
    && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z ? box : null;
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

function lockControls(reason = 'selection-first') {
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

function restoreControls(reason = 'selection-first-release') {
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
    cancelPickMode('escape');
    return;
  }
  if (state.sectionBoxActive || state.visibilityActive || currentSelectionRoots().length) {
    event.preventDefault();
    resetAll('escape');
  }
}

function hasInputFocus() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function setClipButtonOff() {
  const button = document.getElementById('clipBtn');
  if (button) {
    button.classList.remove('active');
    const span = button.querySelector('span');
    if (span) span.textContent = 'Clip Off';
  }
}

function label(mode) {
  if (mode === 'sectionBox') return 'Section Box';
  if (mode === 'hide') return 'Hide';
  if (mode === 'isolate') return 'Isolate';
  return 'Canvas tool';
}

function boxSummary(box) {
  return { min: [round(box.min.x), round(box.min.y), round(box.min.z)], max: [round(box.max.x), round(box.max.y), round(box.max.z)], size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)] };
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function safeCall(fn, owner) {
  try { return typeof fn === 'function' ? fn.call(owner) : undefined; } catch (_) { return undefined; }
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

function setStatus(message) {
  const status = document.getElementById('runtimeStatus') || document.getElementById('statusText');
  if (status && message) status.textContent = message;
  window.dispatchEvent(new CustomEvent('viewer:status-message', { detail: { message, source: VERSION } }));
}

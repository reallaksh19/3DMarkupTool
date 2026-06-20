import * as THREE from 'three';
import { getModelRoot, objectId, resolveSafeHideTarget } from './static-selection-resolver.js';

// Phase 15: regression repair for canvas-owning review actions.
// This controller does not touch model/parser/export data. It repairs UI action
// ownership after the Tag/XML grouping and canvas coordinator phases:
// - grouped Tag/XML menus keep real clickable rows
// - Tag >> Tag invokes the real manual leader tool
// - Area Select exported roots reject model/root-sized selections
// - Box/Isolate/Hide enter a one-click canvas-pick mode when no safe selection exists

const VERSION = 'canvas-action-regression-phase15-20260620';
const PICK_CLASS = 'canvas-review-pick-active';
const PICK_TOLERANCE_PX = 6;
const SECTION_PADDING_RATIO = 0.05;
const SECTION_MIN_PADDING = 1;
const GROUP_MENU_REPAIR = [
  { menuId: 'staticTagGroupMenu', ids: ['staticTagBtn', 'staticTagViewsBtn'] },
  { menuId: 'staticXmlGroupMenu', ids: ['staticIsonoteXmlBtn', 'staticImportXmlBtn', 'staticXmlQaBtn', 'staticExportXmlBtn'] },
  { menuId: 'staticSessionGroupMenu', ids: ['staticSaveSessionBtn', 'staticRestoreSessionBtn', 'staticClearSessionBtn'] }
];

const state = {
  pickMode: '',
  pickPointer: null,
  pickCanvas: null,
  controlsSnapshot: null,
  visibilityTouched: new Map(),
  visibilityActive: false,
  areaOriginals: null,
  areaSafeRoots: [],
  areaHelpers: [],
  actionPatched: false,
  groupRepaired: false,
  lastAction: 'init'
};

installCanvasActionRegression();

function installCanvasActionRegression() {
  installApi();
  runWhenReady(() => {
    repairGroupedMarkupMenus();
    patchActionApis();
    patchAreaSelectApi();
    bindCanvas(runtimeCanvas());
  });

  [
    'markup:app-ready',
    'viewer:model-loaded',
    'viewer:runtime-context',
    'viewer:static-shell-bundle-ready',
    'viewer:canvas-tools-rebound',
    'viewer:review-ribbon-tools',
    'viewer:ui-controls-changed'
  ].forEach((eventName) => window.addEventListener(eventName, () => {
    repairGroupedMarkupMenus();
    patchActionApis();
    patchAreaSelectApi();
    bindCanvas(runtimeCanvas());
  }));

  window.addEventListener('viewer:area-select', onAreaSelectEvent);
  window.addEventListener('keydown', onGlobalKeyDown, true);
}

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function installApi() {
  window.__3D_MARKUP_CANVAS_ACTION_REGRESSION__ = {
    version: VERSION,
    repairGroupedMarkupMenus,
    patchActionApis,
    patchAreaSelectApi,
    startPickMode,
    cancelPickMode,
    safeAreaRoots: () => state.areaSafeRoots.slice(),
    debug: () => ({
      version: VERSION,
      pickMode: state.pickMode,
      hasCanvas: Boolean(state.pickCanvas),
      controlsLocked: Boolean(state.controlsSnapshot),
      areaSafeCount: state.areaSafeRoots.length,
      areaHelperCount: state.areaHelpers.length,
      actionPatched: state.actionPatched,
      groupRepaired: state.groupRepaired,
      noPolling: true,
      noMutationObserver: true,
      noStartupSceneTraversal: true,
      lastAction: state.lastAction
    })
  };
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function bindCanvas(canvas) {
  if (!canvas || canvas.__canvasActionRegressionBound) return false;
  canvas.__canvasActionRegressionBound = true;
  canvas.addEventListener('pointerdown', onCanvasPointerDown, true);
  canvas.addEventListener('pointerup', onCanvasPointerUp, true);
  canvas.addEventListener('pointercancel', () => cancelPickMode('pointercancel'), true);
  state.pickCanvas = canvas;
  return true;
}

function repairGroupedMarkupMenus() {
  let repaired = false;
  for (const group of GROUP_MENU_REPAIR) {
    const menu = document.getElementById(group.menuId);
    if (!menu) continue;
    const note = menu.querySelector('.static-markup-menu-note');
    for (const id of group.ids) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.classList.add('static-markup-menu-item');
      button.setAttribute('role', 'menuitem');
      if (button.parentElement !== menu) menu.insertBefore(button, note || null);
      repaired = true;
    }
  }

  const tagButton = document.getElementById('staticTagBtn');
  if (tagButton && !tagButton.dataset.realManualLeaderBound) {
    tagButton.dataset.realManualLeaderBound = 'true';
    tagButton.title = 'Manual leader tag: click leader point, then annotation location';
    tagButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      launchManualLeaderTool();
      closeStaticMarkupGroups();
    }, true);
    repaired = true;
  }

  state.groupRepaired = state.groupRepaired || repaired;
  return repaired;
}

function closeStaticMarkupGroups() {
  window.__3D_MARKUP_STATIC_MARKUP__?.closeGroups?.();
  document.querySelectorAll('.static-markup-menu').forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll('.static-markup-group-toggle[aria-expanded="true"]').forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
}

async function launchManualLeaderTool() {
  const existing = document.getElementById('navisTagBtn');
  if (existing) {
    existing.click();
    setStatus('Manual Tag: click leader/arrow point.');
    return true;
  }
  try {
    await import('./navis-manual-tag-safe-controller.js?v=canvas-action-regression-phase15-20260620');
    const button = document.getElementById('navisTagBtn');
    if (button) {
      button.click();
      setStatus('Manual Tag: click leader/arrow point.');
      return true;
    }
  } catch (error) {
    console.warn('[3DMarkupTool] Manual tag controller failed to load', error);
  }
  setStatus('Manual Tag unavailable: viewer canvas is not ready yet.');
  return false;
}

function patchActionApis() {
  const viewpad = window.__3D_MARKUP_VIEWPAD_TOOLS__;
  if (viewpad && !viewpad.__canvasActionRegressionPatched) {
    const originalShowAll = typeof viewpad.showAll === 'function' ? viewpad.showAll.bind(viewpad) : null;
    viewpad.isolateSelected = () => runVisibilityAction('isolate');
    viewpad.hideSelected = () => runVisibilityAction('hide');
    viewpad.showAll = (reason = 'show-all') => {
      clearPickVisibility({ makeAllVisible: true, render: false });
      return originalShowAll ? originalShowAll(reason) : showAllVisibility(reason);
    };
    viewpad.__canvasActionRegressionPatched = VERSION;
    state.actionPatched = true;
  }

  const sectionBox = window.__3D_MARKUP_SECTION_BOX__;
  if (sectionBox && !sectionBox.__canvasActionRegressionPatched) {
    sectionBox.apply = () => runSectionBoxAction();
    sectionBox.__canvasActionRegressionPatched = VERSION;
    state.actionPatched = true;
  }

  return state.actionPatched;
}

function patchAreaSelectApi() {
  const api = window.__3D_MARKUP_AREA_SELECT__;
  if (!api || api.__canvasActionRegressionPatched) return false;
  const originals = {
    selectedRoots: typeof api.selectedRoots === 'function' ? api.selectedRoots.bind(api) : null,
    getSelectedRoots: typeof api.getSelectedRoots === 'function' ? api.getSelectedRoots.bind(api) : null,
    clearSelection: typeof api.clearSelection === 'function' ? api.clearSelection.bind(api) : null,
    clear: typeof api.clear === 'function' ? api.clear.bind(api) : null,
    buildSelectedPropertiesCsv: typeof api.buildSelectedPropertiesCsv === 'function' ? api.buildSelectedPropertiesCsv.bind(api) : null
  };
  state.areaOriginals = originals;

  api.selectedRoots = () => currentSafeAreaRoots();
  api.getSelectedRoots = () => currentSafeAreaRoots();
  api.clearSelection = (options = {}) => {
    clearAreaFilterHelpers();
    state.areaSafeRoots = [];
    window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = [];
    return originals.clearSelection ? originals.clearSelection(options) : originals.clear?.(options);
  };
  api.clear = api.clearSelection;
  api.buildSelectedPropertiesCsv = () => buildSafeAreaCsv();
  api.exportSelectedPropertiesCsv = () => exportSafeAreaCsv();
  api.__canvasActionRegressionPatched = VERSION;
  return true;
}

function onAreaSelectEvent(event) {
  const detail = event.detail || {};
  if (detail.action === 'clear') {
    clearAreaFilterHelpers();
    state.areaSafeRoots = [];
    return;
  }
  if (detail.action !== 'select') return;
  const raw = rawAreaRoots();
  const safe = sanitizeRoots(raw);
  state.areaSafeRoots = safe;
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = safe.slice();
  if (safe.length !== raw.length) {
    replaceAreaHighlights(safe);
    setStatus(`Area selected ${safe.length} safe component${safe.length === 1 ? '' : 's'}`);
  }
}

function rawAreaRoots() {
  const originals = state.areaOriginals || {};
  const fromOriginal = originals.selectedRoots?.() || originals.getSelectedRoots?.() || [];
  const source = Array.isArray(fromOriginal) && fromOriginal.length
    ? fromOriginal
    : (Array.isArray(window.__3D_MARKUP_AREA_SELECTED_ROOTS__) ? window.__3D_MARKUP_AREA_SELECTED_ROOTS__ : []);
  return source.filter(Boolean);
}

function currentSafeAreaRoots() {
  const raw = rawAreaRoots();
  const safe = sanitizeRoots(raw.length ? raw : state.areaSafeRoots);
  state.areaSafeRoots = safe;
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = safe.slice();
  return safe.slice();
}

function sanitizeRoots(roots) {
  const result = [];
  const seen = new Set();
  for (const root of roots || []) {
    const safe = resolveSafeHideTarget(root, { runtime: runtime() });
    if (!safe || seen.has(safe) || isRootSizedObject(safe)) continue;
    seen.add(safe);
    result.push(safe);
  }
  return result;
}

function isRootSizedObject(object) {
  const rt = runtime();
  const modelRoot = getModelRoot(rt);
  if (!object || !modelRoot || object === modelRoot || object.type === 'Scene' || object.isScene) return true;
  const data = object.userData || {};
  if (data.TYPE === 'MODEL' || data.TYPE === 'MODEL_ROOT' || data.isModelRoot || data.modelRoot) return true;
  if (/^(MODEL_ROOT|GLB_ROOT|RVM_ROOT)$/i.test(String(object.name || ''))) return true;

  const modelBox = validBoxFor(modelRoot);
  const objectBox = validBoxFor(object);
  if (!modelBox || !objectBox) return false;
  const modelSize = modelBox.getSize(new THREE.Vector3());
  const objectSize = objectBox.getSize(new THREE.Vector3());
  const ratios = ['x', 'y', 'z'].map((axis) => modelSize[axis] > 1e-9 ? objectSize[axis] / modelSize[axis] : 0);
  const coversModel = ratios.filter((ratio) => ratio >= 0.96).length >= 2 && object.children?.length > 1;
  return Boolean(coversModel);
}

function replaceAreaHighlights(safeRoots) {
  state.areaOriginals?.clearSelection?.({ source: 'canvas-action-regression-filter', silent: true });
  clearAreaFilterHelpers();
  state.areaSafeRoots = safeRoots.slice();
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = safeRoots.slice();
  const rt = runtime();
  const helperRoot = rt?.scene || getModelRoot(rt)?.parent || getModelRoot(rt);
  for (const object of safeRoots) {
    const helper = new THREE.BoxHelper(object, 0x37d8ff);
    helper.name = `AREA_SELECT_SAFE_${objectId(object) || object.uuid || 'OBJECT'}`;
    helper.userData = { isDisplayHelper: true, areaSelectHelper: true, TYPE: 'AREA_SELECT_HELPER_SAFE', source: VERSION };
    helperRoot?.add?.(helper);
    state.areaHelpers.push(helper);
  }
  rt?.renderOnce?.('area-select-safe-filter');
}

function clearAreaFilterHelpers() {
  for (const helper of state.areaHelpers) {
    helper.parent?.remove?.(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  }
  state.areaHelpers = [];
}

function runVisibilityAction(mode) {
  patchAreaSelectApi();
  const targets = actionTargets();
  if (targets.length) return applyVisibility(mode, targets, 'existing-selection');
  return startPickMode(mode);
}

function runSectionBoxAction() {
  const targets = actionTargets();
  if (targets.length) return applySectionBoxToTarget(targets[0], 'existing-selection');
  return startPickMode('sectionBox');
}

function actionTargets() {
  const area = currentSafeAreaRoots();
  if (area.length) return area;
  const selected = resolveSafeHideTarget(undefined, { runtime: runtime() });
  return selected && !isRootSizedObject(selected) ? [selected] : [];
}

function startPickMode(mode) {
  bindCanvas(runtimeCanvas());
  if (!runtimeCanvas()) {
    setStatus('Canvas tool unavailable: viewer canvas is not ready');
    return false;
  }
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
  if (!state.pickMode || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  lockControls(`pick:${state.pickMode}:pointerdown`);
  state.pickPointer = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: state.pickMode };
  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
}

function onCanvasPointerUp(event) {
  if (!state.pickMode || !state.pickPointer) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const down = state.pickPointer;
  runtimeCanvas()?.releasePointerCapture?.(down.pointerId);
  const mode = down.mode;
  state.pickPointer = null;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > PICK_TOLERANCE_PX) {
    setStatus(`${labelForMode(mode)}: click without dragging to pick a component`);
    return;
  }
  const target = pickSafeTarget(event);
  if (!target) {
    setStatus(`${labelForMode(mode)}: no component picked`);
    return;
  }
  cancelPickMode('picked', { quiet: true });
  if (mode === 'sectionBox') applySectionBoxToTarget(target, 'canvas-pick');
  else applyVisibility(mode, [target], 'canvas-pick');
}

function onGlobalKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (state.pickMode) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    cancelPickMode('escape');
    return;
  }
  if (state.visibilityActive) {
    clearPickVisibility({ makeAllVisible: true, render: true, reason: 'escape' });
  }
}

function pickSafeTarget(event) {
  const rt = runtime();
  const root = getModelRoot(rt);
  const canvas = runtimeCanvas();
  const camera = rt?.camera;
  if (!root || !canvas || !camera) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(root, true);
  for (const hit of hits) {
    const target = resolveSafeHideTarget(hit.object, { runtime: rt });
    if (target && !isRootSizedObject(target)) return target;
  }
  return null;
}

function applyVisibility(mode, targets, source = 'visibility') {
  const rt = runtime();
  const root = getModelRoot(rt);
  const safeTargets = sanitizeRoots(targets);
  if (!root || !safeTargets.length) {
    setStatus(`Select a component/part before ${mode === 'hide' ? 'Hide' : 'Isolate'}`);
    return false;
  }
  clearPickVisibility({ render: false });
  state.visibilityActive = true;

  if (mode === 'isolate') {
    root.traverse?.((object) => {
      if (object !== root) hideObject(object);
    });
    for (const target of safeTargets) showAncestryAndChildren(target, root);
  } else {
    for (const target of safeTargets) hideObject(target);
  }

  rt?.renderOnce?.(mode === 'hide' ? 'hide-selected-pick' : 'isolate-selected-pick');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', {
    detail: {
      action: mode,
      source,
      resolver: 'canvas-action-regression',
      selectedIds: safeTargets.map(objectId).filter(Boolean),
      selectedCount: safeTargets.length,
      active: true,
      touchedCount: state.visibilityTouched.size
    }
  }));
  setStatus(`${mode === 'hide' ? 'Hidden' : 'Isolated'} ${safeTargets.length} selected component${safeTargets.length === 1 ? '' : 's'} — Esc or Show All restores`);
  return true;
}

function showAllVisibility(reason = 'show-all') {
  return clearPickVisibility({ makeAllVisible: true, render: true, reason });
}

function clearPickVisibility({ makeAllVisible = false, render = true, reason = 'show-all' } = {}) {
  const rt = runtime();
  const root = getModelRoot(rt);
  if (makeAllVisible && root?.traverse) {
    root.traverse((object) => { object.visible = true; });
  } else {
    for (const [object, wasVisible] of state.visibilityTouched.entries()) object.visible = wasVisible;
  }
  state.visibilityTouched.clear();
  state.visibilityActive = false;
  if (render) rt?.renderOnce?.(reason === 'escape' ? 'show-all-escape' : reason);
  return true;
}

function hideObject(object) {
  if (!object) return;
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

function applySectionBoxToTarget(target, source = 'section-box') {
  const rt = runtime();
  const renderer = rt?.renderer;
  const box = validBoxFor(target);
  if (!box) {
    setStatus('Section Box failed: selected component has no valid bounds');
    return false;
  }
  const expanded = expandedSectionBox(box);
  const planes = planesForBox(expanded);
  const selectedId = objectId(target);
  const meta = {
    mode: 'box',
    source: 'canvas-action-section-box',
    trigger: source,
    resolver: 'canvas-action-regression',
    selectedId,
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
  rt?.renderOnce?.('section-box-selected-pick');
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
  const maxSize = Math.max(size.x, size.y, size.z, 0);
  return box.clone().expandByScalar(Math.max(SECTION_MIN_PADDING, maxSize * SECTION_PADDING_RATIO));
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
  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
    size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)]
  };
}

function buildSafeAreaCsv() {
  const rows = [];
  currentSafeAreaRoots().forEach((object, index) => {
    const data = object.userData || {};
    const entries = Object.entries(data).length ? Object.entries(data) : [['object_name', object.name || object.uuid || '']];
    entries.forEach(([key, value]) => rows.push([index + 1, objectId(object), object.name || '', data.TYPE || data.type || object.type || '', key, value]));
  });
  return [['selected_index', 'object_id', 'object_name', 'object_type', 'property_key', 'property_value'], ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n') + '\n';
}

function exportSafeAreaCsv() {
  const roots = currentSafeAreaRoots();
  if (!roots.length) {
    setStatus('Area Select: no safe selected components to export');
    return '';
  }
  const csv = buildSafeAreaCsv();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `area-selected-properties-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
  setStatus(`Exported ${roots.length} selected component${roots.length === 1 ? '' : 's'} to CSV`);
  return csv;
}

function lockControls(reason = 'canvas-action-pick') {
  const controls = runtime()?.controls;
  if (!controls) return false;
  if (!state.controlsSnapshot || state.controlsSnapshot.controls !== controls) {
    state.controlsSnapshot = {
      controls,
      enabled: controls.enabled,
      enableRotate: controls.enableRotate,
      enablePan: controls.enablePan,
      enableZoom: controls.enableZoom,
      mouseButtons: controls.mouseButtons ? { ...controls.mouseButtons } : null
    };
  }
  controls.enabled = false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = false;
  state.lastAction = reason;
  return true;
}

function restoreControls(reason = 'canvas-action-release') {
  const snapshot = state.controlsSnapshot;
  if (!snapshot?.controls) return false;
  const controls = snapshot.controls;
  controls.enabled = snapshot.enabled;
  controls.enableRotate = snapshot.enableRotate;
  controls.enablePan = snapshot.enablePan;
  controls.enableZoom = snapshot.enableZoom;
  if (snapshot.mouseButtons) controls.mouseButtons = { ...snapshot.mouseButtons };
  state.controlsSnapshot = null;
  state.lastAction = reason;
  return true;
}

function labelForMode(mode) {
  if (mode === 'sectionBox') return 'Section Box';
  if (mode === 'hide') return 'Hide Selected';
  if (mode === 'isolate') return 'Isolate Selected';
  return 'Canvas review action';
}

function setStatus(message) {
  const status = document.getElementById('runtimeStatus') || document.getElementById('statusText');
  if (status && message) status.textContent = message;
  window.dispatchEvent(new CustomEvent('viewer:status-message', { detail: { message, source: 'canvas-action-regression' } }));
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

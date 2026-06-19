import * as THREE from 'three';

// Event-driven runtime stabilizer for the ribbon review shell.
// Replaces the older stacked late-fix controllers that repeatedly patched/traversed
// the scene while a model was loading. This controller does no polling and only
// traverses scene content when the user invokes a review action.

const VERSION = 'startup-responsive-runtime-20260619';
const STYLE_ID = 'staticStartupResponsiveRuntimeStyle';
const INPUT_BLOCK_ID = 'startupResponsiveInputBlock';
const INPUT_STATUS_ID = 'startupResponsiveInputStatus';
const AREA_RECT_CLASS = 'startup-area-select-rect';
const AREA_HELPER_PREFIX = 'STARTUP_AREA_SELECT_';
const EXPLODE_ORIGINAL_KEY = '__startupResponsiveExplodeOriginalPosition';
const ACTION_KEYS = new Set([
  'areaSelect',
  'sectionBoxSelected',
  'isolateSelected',
  'hideSelected',
  'showAll',
  'explodeReview',
  'clearAreaSelection',
  'exportSelectedProperties',
  'explodeReset'
]);

let areaActive = false;
let areaDrag = null;
let areaOverlay = null;
let areaHelpers = [];
let areaSelected = [];
let attachedViewer = null;
let baseMeasureApi = null;
let baseSearchApi = null;
let refreshCount = 0;

runWhenReady(initStartupResponsiveRuntime);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initStartupResponsiveRuntime() {
  injectStyles();
  installGlobalEscape();
  installReviewCapture();
  lightRefresh();

  ['markup:app-ready', 'viewer:runtime-context', 'viewer:model-loaded', 'viewer:selection-changed'].forEach((eventName) => {
    window.addEventListener(eventName, () => window.setTimeout(lightRefresh, 0));
  });
  window.addEventListener('resize', lightRefresh);

  // Give concurrently imported optional modules time to publish their base APIs,
  // then capture/wrap them exactly a few times without permanent polling.
  [40, 180, 600].forEach((delay) => window.setTimeout(lightRefresh, delay));
}

function lightRefresh() {
  refreshCount += 1;
  captureBaseApis();
  stabilizePreviewButtons();
  forceInputControlsVisible();
  attachViewerPointerHooks();
  installApis();
  ensureReviewActionButtons();
  window.__3D_MARKUP_STARTUP_RESPONSIVE_RUNTIME__ = {
    version: VERSION,
    refresh: lightRefresh,
    checklist: () => ({
      version: VERSION,
      refreshCount,
      noPolling: true,
      inputVisible: Boolean(document.getElementById(INPUT_BLOCK_ID) && document.getElementById(INPUT_STATUS_ID)),
      previewStable: previewButtonsStable(),
      areaApi: window.__3D_MARKUP_AREA_SELECT__?.version === VERSION,
      viewpadToolsApi: window.__3D_MARKUP_VIEWPAD_TOOLS__?.__startupResponsivePatched === VERSION,
      explodeApi: window.__3D_MARKUP_EXPLODE_REVIEW__?.version === VERSION,
      selectedPropertiesApi: window.__3D_MARKUP_SELECTED_PROPERTIES_EXPORT__?.version === VERSION
    })
  };
}

function captureBaseApis() {
  const measure = window.__3D_MARKUP_MEASURE_POLYLINE__;
  if (measure && measure.version !== VERSION && !baseMeasureApi) baseMeasureApi = measure;
  const search = window.__3D_MARKUP_COMPONENT_SEARCH__;
  if (search && search.version !== VERSION && !baseSearchApi) baseSearchApi = search;
}

function installApis() {
  const previousViewpad = window.__3D_MARKUP_VIEWPAD_TOOLS__ || {};
  window.__3D_MARKUP_VIEWPAD_TOOLS__ = {
    ...previousViewpad,
    isolateSelected: () => isolateSelected('viewpad-startup-responsive'),
    hideSelected: () => hideSelected('viewpad-startup-responsive'),
    showAll: () => showAll('viewpad-startup-responsive'),
    __startupResponsivePatched: VERSION
  };

  window.__3D_MARKUP_AREA_SELECT__ = {
    version: VERSION,
    activate: activateAreaSelect,
    deactivate: deactivateAreaSelect,
    clear: clearAreaSelection,
    selectInClientRect,
    selectedIds: () => areaSelected.map(objectId).filter(Boolean),
    isActive: () => areaActive,
    debug: () => ({ version: VERSION, active: areaActive, selectedCount: areaSelected.length, helperCount: areaHelpers.length })
  };

  window.__3D_MARKUP_SECTION_BOX__ = {
    version: VERSION,
    apply: () => applySectionBox('api-startup-responsive'),
    clear: () => clearSectionBox('api-startup-responsive'),
    debug: () => ({ version: VERSION, selected: objectId(selectedComponent()), clippingPlanes: runtime()?.renderer?.clippingPlanes?.length || 0 })
  };

  window.__3D_MARKUP_EXPLODE_REVIEW__ = {
    version: VERSION,
    open: () => applyExplode('type', 'open-startup-responsive'),
    apply: (mode = 'type') => applyExplode(mode, 'api-startup-responsive'),
    reset: () => resetExplode('api-startup-responsive'),
    close: () => resetExplode('close-startup-responsive'),
    reassemble: () => resetExplode('reassemble-startup-responsive'),
    isExploded: () => explodedObjects().length > 0,
    debug: () => ({ version: VERSION, componentCount: selectableComponents().length, explodedCount: explodedObjects().length })
  };

  window.__3D_MARKUP_SELECTED_PROPERTIES_EXPORT__ = {
    version: VERSION,
    exportCsv: exportSelectedProperties,
    selectedIds: () => areaSelected.map(objectId).filter(Boolean),
    debug: () => ({ version: VERSION, selectedCount: selectedTargets().length, rows: buildSelectedPropertyRows().length })
  };

  if (baseMeasureApi) {
    window.__3D_MARKUP_MEASURE_POLYLINE__ = {
      ...baseMeasureApi,
      activate: () => {
        removeLegacyMeasureHelpersOnce();
        return baseMeasureApi.activate?.() !== false;
      },
      finish: () => baseMeasureApi.finish?.() !== false,
      clear: () => baseMeasureApi.clear?.() !== false,
      version: baseMeasureApi.version || VERSION,
      __startupResponsiveWrapped: VERSION
    };
  }
}

function installReviewCapture() {
  if (window.__3D_MARKUP_STARTUP_RESPONSIVE_CAPTURE__ === VERSION) return;
  window.__3D_MARKUP_STARTUP_RESPONSIVE_CAPTURE__ = VERSION;
  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-review-tool], [data-review-menu-tool]');
    if (!target) return;
    const key = target.dataset.reviewTool || target.dataset.reviewMenuTool;
    if (!ACTION_KEYS.has(key)) return;
    stop(event);
    runAction(key);
    closeMenus();
  }, true);
}

function runAction(key) {
  if (key === 'areaSelect') return activateAreaSelect();
  if (key === 'sectionBoxSelected') return applySectionBox('ribbon-startup-responsive');
  if (key === 'isolateSelected') return isolateSelected('ribbon-startup-responsive');
  if (key === 'hideSelected') return hideSelected('ribbon-startup-responsive');
  if (key === 'showAll') return showAll('ribbon-startup-responsive');
  if (key === 'explodeReview') return applyExplode('type', 'ribbon-startup-responsive');
  if (key === 'clearAreaSelection') return clearAreaSelection();
  if (key === 'exportSelectedProperties') return exportSelectedProperties();
  if (key === 'explodeReset') return resetExplode('ribbon-startup-responsive');
  return false;
}

function installGlobalEscape() {
  if (window.__3D_MARKUP_STARTUP_RESPONSIVE_ESC__ === VERSION) return;
  window.__3D_MARKUP_STARTUP_RESPONSIVE_ESC__ = VERSION;
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || isEditable(event.target)) return;
    let handled = false;
    if (areaActive) handled = deactivateAreaSelect('Area Select canceled') || handled;
    if (areaSelected.length || areaHelpers.length) handled = clearAreaSelection({ silent: true }) || handled;
    handled = resetExplode('escape-startup-responsive', true) || handled;
    handled = closeMenus() || handled;
    handled = baseMeasureApi?.finish?.() !== false || handled;
    if (!handled) return;
    setStatus('Esc: review tool exited');
    stop(event);
  }, true);
}

function stabilizePreviewButtons() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  const fitAll = document.getElementById('resetCameraBtn');
  const glb = document.getElementById('previewGlbBtn');
  const rvm = document.getElementById('previewRvmBtn');
  if (!viewGroup || !fitAll || !glb || !rvm) return false;

  document.getElementById('viewModeGlbAliasBtn')?.remove();
  document.getElementById('viewModeRvmAliasBtn')?.remove();
  glb.hidden = false;
  rvm.hidden = false;
  glb.removeAttribute('aria-hidden');
  rvm.removeAttribute('aria-hidden');
  glb.classList.add('startup-responsive-mode-button');
  rvm.classList.add('startup-responsive-mode-button');
  if (glb.parentElement !== viewGroup) fitAll.after(glb);
  if (rvm.parentElement !== viewGroup) glb.after(rvm);
  document.querySelector('[aria-label="Preview mode"]')?.classList.add('startup-preview-group-empty');
  return true;
}

function previewButtonsStable() {
  const group = document.querySelector('[aria-label="View tools"]');
  return Boolean(group && document.getElementById('previewGlbBtn')?.parentElement === group && document.getElementById('previewRvmBtn')?.parentElement === group);
}

function forceInputControlsVisible() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  document.body.classList.add('input-open');
  drawer.classList.add('startup-input-visible');
  document.getElementById('toggleInputBtn')?.classList.add('active');
  document.getElementById('closeInputBtn')?.setAttribute('hidden', '');

  let block = document.getElementById(INPUT_BLOCK_ID);
  if (!block) {
    block = document.createElement('div');
    block.id = INPUT_BLOCK_ID;
    block.className = 'startup-responsive-input-block';
    block.innerHTML = `<div id="${INPUT_STATUS_ID}" class="startup-responsive-input-status">No file chosen</div>`;
  }
  const head = drawer.querySelector('.drawer-head');
  if (head && head.nextSibling !== block) head.after(block);
  else if (!block.parentElement) drawer.insertBefore(block, drawer.firstChild);

  const fileDrop = document.querySelector('#inputDrawer .file-drop');
  const loadSample = document.getElementById('loadSampleBtn');
  const clear = document.getElementById('clearBtn');
  let row = loadSample?.closest?.('.button-row');
  if (!row && (loadSample || clear)) {
    row = document.createElement('div');
    row.className = 'button-row startup-input-actions';
    if (loadSample) row.appendChild(loadSample);
    if (clear) row.appendChild(clear);
  }
  if (fileDrop && fileDrop.parentElement !== block) block.appendChild(fileDrop);
  if (row && row.parentElement !== block) block.appendChild(row);

  const input = document.getElementById('xmlFile');
  if (input && input.dataset.startupResponsiveBound !== VERSION) {
    input.dataset.startupResponsiveBound = VERSION;
    input.addEventListener('change', updateInputStatus);
  }
  if (loadSample && loadSample.dataset.startupResponsiveBound !== VERSION) {
    loadSample.dataset.startupResponsiveBound = VERSION;
    loadSample.addEventListener('click', () => window.setTimeout(() => updateInputStatus('BM_CII sample loaded'), 0), true);
  }
  if (clear && clear.dataset.startupResponsiveBound !== VERSION) {
    clear.dataset.startupResponsiveBound = VERSION;
    clear.addEventListener('click', () => window.setTimeout(() => updateInputStatus('No file chosen'), 0), true);
  }
  updateInputStatus();
  return block;
}

function updateInputStatus(override = null) {
  const status = document.getElementById(INPUT_STATUS_ID);
  if (!status) return;
  const input = document.getElementById('xmlFile');
  status.textContent = override || input?.files?.[0]?.name || 'No file chosen';
}

function attachViewerPointerHooks() {
  const viewer = document.getElementById('viewer');
  if (!viewer || viewer === attachedViewer) return;
  if (attachedViewer) {
    attachedViewer.removeEventListener('pointerdown', onViewerPointerDown, true);
    attachedViewer.removeEventListener('pointermove', onViewerPointerMove, true);
    attachedViewer.removeEventListener('pointerup', onViewerPointerUp, true);
    attachedViewer.removeEventListener('pointercancel', onViewerPointerCancel, true);
  }
  attachedViewer = viewer;
  viewer.addEventListener('pointerdown', onViewerPointerDown, true);
  viewer.addEventListener('pointermove', onViewerPointerMove, true);
  viewer.addEventListener('pointerup', onViewerPointerUp, true);
  viewer.addEventListener('pointercancel', onViewerPointerCancel, true);
}

function activateAreaSelect() {
  areaActive = true;
  areaDrag = null;
  attachViewerPointerHooks();
  document.body.classList.add('area-select-active');
  setPressed('areaSelect', true);
  setStatus('Area Select: drag over visible components');
  return true;
}

function deactivateAreaSelect(message = 'Area Select off') {
  areaActive = false;
  areaDrag = null;
  removeAreaOverlay();
  document.body.classList.remove('area-select-active');
  setPressed('areaSelect', false);
  if (message) setStatus(message);
  return true;
}

function onViewerPointerDown(event) {
  if (!areaActive) return;
  if (event.button !== 0 || isEditable(event.target)) return;
  if (!runtime()?.camera || !modelRoot()) {
    deactivateAreaSelect('Area Select unavailable: load a model first');
    stop(event);
    return;
  }
  stop(event);
  areaDrag = { pointerId: event.pointerId, x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY };
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  createAreaOverlay();
}

function onViewerPointerMove(event) {
  if (!areaActive || !areaDrag) return;
  stop(event);
  areaDrag.x2 = event.clientX;
  areaDrag.y2 = event.clientY;
  updateAreaOverlay();
}

function onViewerPointerUp(event) {
  if (!areaActive || !areaDrag) return;
  stop(event);
  const rect = normalizeRect(areaDrag.x1, areaDrag.y1, event.clientX, event.clientY);
  event.currentTarget?.releasePointerCapture?.(areaDrag.pointerId);
  areaDrag = null;
  removeAreaOverlay();
  if ((rect.right - rect.left) < 8 || (rect.bottom - rect.top) < 8) return deactivateAreaSelect('Area Select canceled');
  const selected = selectInClientRect(rect, { source: 'startup-responsive-drag' });
  return deactivateAreaSelect(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
}

function onViewerPointerCancel(event) {
  if (!areaActive) return;
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
  deactivateAreaSelect('Area Select canceled');
}

function selectInClientRect(inputRect, { source = 'startup-responsive' } = {}) {
  const rt = runtime();
  const viewer = document.getElementById('viewer');
  if (!rt?.camera || !viewer) return [];
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRect(inputRect, viewport);
  const selected = selectableComponents().filter((object) => {
    if (!isEffectivelyVisible(object)) return false;
    const projected = projectedRect(object, rt.camera, viewport);
    return projected && rectsIntersect(rect, projected);
  });
  applyAreaSelection(selected, source);
  return selected;
}

function applyAreaSelection(selected, source) {
  clearAreaSelection({ silent: true });
  const host = runtime()?.scene || modelRoot()?.parent || modelRoot();
  areaSelected = selected.slice();
  for (const object of areaSelected) {
    const helper = new THREE.BoxHelper(object, 0x37d8ff);
    helper.name = `${AREA_HELPER_PREFIX}${object.uuid}`;
    helper.userData = { helper: true, areaSelectHelper: true, source: VERSION, selectedId: objectId(object) };
    helper.renderOrder = 9997;
    host?.add?.(helper);
    areaHelpers.push(helper);
  }
  if (areaSelected.length === 1) selectObject(areaSelected[0]);
  setStatus(`Area selected ${areaSelected.length} component${areaSelected.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'select', version: VERSION, source, selectedCount: areaSelected.length } }));
  requestRender('area-select-startup-responsive');
}

function clearAreaSelection({ silent = false } = {}) {
  areaHelpers.forEach((helper) => {
    helper.parent?.remove?.(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  });
  areaHelpers = [];
  areaSelected = [];
  if (!silent) setStatus('Area selection cleared');
  requestRender('area-select-clear-startup-responsive');
  return true;
}

function applySectionBox(source = 'startup-responsive-section') {
  const selected = selectedComponent();
  const rt = runtime();
  if (!selected) {
    setStatus('Select a component before Section Box');
    return false;
  }
  const box = bounds(selected);
  if (!validBox(box)) {
    setStatus('Section Box failed: selected component has no bounds');
    return false;
  }
  const pad = Math.max(box.getSize(new THREE.Vector3()).length() * 0.03, 0.001);
  const expanded = box.clone().expandByScalar(pad);
  const planes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -expanded.min.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), expanded.max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -expanded.min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), expanded.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -expanded.min.z),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), expanded.max.z)
  ];
  rt?.applyClipping?.(planes, { source, mode: 'box' });
  if (rt?.renderer) {
    rt.renderer.localClippingEnabled = true;
    rt.renderer.clippingPlanes = planes;
  }
  setStatus(`Section Box: ${objectId(selected) || 'selected component'}`);
  requestRender('section-box-startup-responsive');
  return true;
}

function clearSectionBox(source = 'startup-responsive-section-clear') {
  const rt = runtime();
  rt?.clearClipping?.({ source });
  if (rt?.renderer) {
    rt.renderer.localClippingEnabled = false;
    rt.renderer.clippingPlanes = [];
  }
  requestRender('section-box-clear-startup-responsive');
  return true;
}

function isolateSelected(source = 'startup-responsive-isolate') {
  const selected = selectedTargets();
  const components = selectableComponents();
  if (!selected.length || !components.length) {
    setStatus('Select a component to isolate');
    return false;
  }
  const keep = new Set(selected);
  components.forEach((object) => {
    object.visible = keep.has(object) || selected.some((target) => isAncestorOrDescendant(object, target));
  });
  selected.forEach((object) => {
    revealAncestors(object, modelRoot());
    object.traverse?.((child) => { child.visible = true; });
  });
  requestRender('isolate-startup-responsive');
  setStatus(`Isolated ${selected.length} selected component${selected.length === 1 ? '' : 's'}`);
  return true;
}

function hideSelected(source = 'startup-responsive-hide') {
  const targets = selectedTargets().filter((object) => canHideObject(object));
  if (!targets.length) {
    setStatus('Hide skipped: select a component/part, not the full model');
    return false;
  }
  targets.forEach((object) => { object.visible = false; });
  requestRender('hide-startup-responsive');
  setStatus(`Hidden ${targets.length} selected component${targets.length === 1 ? '' : 's'}`);
  return true;
}

function showAll(source = 'startup-responsive-show-all') {
  const root = modelRoot();
  if (!root) {
    setStatus('No model loaded');
    return false;
  }
  root.traverse?.((object) => { object.visible = true; });
  requestRender('show-all-startup-responsive');
  setStatus('All components shown');
  return true;
}

function applyExplode(mode = 'type', source = 'startup-responsive-explode') {
  const root = modelRoot();
  if (!root) {
    setStatus('Explode unavailable: no model loaded');
    return false;
  }
  resetExplode('explode-before-startup-responsive', true);
  const components = selectableComponents().filter(isEffectivelyVisible);
  if (components.length < 2) {
    setStatus('Explode needs at least two visible components');
    return false;
  }
  let groups = groupComponents(components, mode);
  if (groups.length < 2) groups = components.map((object, index) => ({ key: `OBJECT_${index + 1}`, objects: [object] }));
  const distance = explodeDistance(root);
  const mid = (groups.length - 1) / 2;
  groups.forEach((group, index) => {
    const offset = new THREE.Vector3((index - mid) * distance, 0, 0);
    group.objects.forEach((object) => moveByWorldOffset(object, offset));
  });
  requestRender('explode-startup-responsive');
  setStatus(`Exploded ${components.length} component(s). Use Reset or Esc to reassemble.`);
  return true;
}

function resetExplode(source = 'startup-responsive-explode-reset', silent = false) {
  const root = modelRoot();
  if (!root?.traverse) return false;
  let count = 0;
  root.traverse((object) => {
    const original = object.userData?.[EXPLODE_ORIGINAL_KEY];
    if (!Array.isArray(original)) return;
    object.position.set(original[0], original[1], original[2]);
    delete object.userData[EXPLODE_ORIGINAL_KEY];
    count += 1;
  });
  if (!silent || count) setStatus(count ? `Reassembled ${count} component(s)` : 'Explode already reset');
  requestRender('explode-reset-startup-responsive');
  return count > 0;
}

function exportSelectedProperties() {
  const rows = buildSelectedPropertyRows();
  if (!rows.length) {
    setStatus('Export Sel: no selected components');
    return false;
  }
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `selected-properties-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Exported ${rows.length} selected property row${rows.length === 1 ? '' : 's'}`);
  return true;
}

function buildSelectedPropertyRows() {
  const targets = selectedTargets();
  return targets.flatMap((object, index) => propertyRowsForObject(object, index + 1));
}

function propertyRowsForObject(object, index) {
  const data = object?.userData || {};
  const base = { selected_index: index, object_id: objectId(object), object_name: object?.name || '', object_type: object?.type || '' };
  const entries = Object.entries(data).filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value));
  if (!entries.length) return [{ ...base, property_key: '', property_value: '' }];
  return entries.map(([key, value]) => ({ ...base, property_key: key, property_value: value == null ? '' : String(value) }));
}

function selectableComponents() {
  const root = modelRoot();
  if (!root?.traverse) return [];
  const strong = [];
  root.traverse((object) => {
    if (!object || object === root || isHelper(object)) return;
    if (hasStrongComponentData(object)) strong.push(object);
  });
  if (strong.length) return uniqueObjects(strong);
  const renderables = [];
  root.traverse((object) => {
    if (object !== root && !isHelper(object) && (object.isMesh || object.isLine || object.isPoints)) renderables.push(object);
  });
  return uniqueObjects(renderables);
}

function hasStrongComponentData(object) {
  const data = object?.userData || {};
  return Boolean(data.componentId || data.COMPONENT_ID || data.componentClass || data.componentType || data.ID || data.id || data.TAG || data.SUPPORT_TAG || data.TYPE || data.type || data.meshRole || data.LINE_NO || data.lineNo || data.rawType || data.visualKey);
}

function selectedTargets() {
  if (areaSelected.length) return areaSelected.slice();
  const selected = selectedComponent();
  return selected ? [selected] : [];
}

function selectedComponent() {
  const selected = selectedObject();
  if (!selected) return null;
  const root = modelRoot();
  if (selected === root) return null;
  if (hasStrongComponentData(selected) || selected.isMesh || selected.isLine || selected.isPoints) return selected;
  let candidate = selected;
  while (candidate?.parent && candidate.parent !== root) {
    if (hasStrongComponentData(candidate.parent)) return candidate.parent;
    candidate = candidate.parent;
  }
  return selected;
}

function selectedObject() {
  const rt = runtime();
  return rt?.getSelectedObject?.() || window.__3D_MARKUP_SELECTED_OBJECT__ || rt?.selectedObject || rt?.selectedMesh || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject || window.__3D_MARKUP_TREE__?.state?.selectedObject || null;
}

function selectObject(object) {
  window.__3D_MARKUP_SELECTED_OBJECT__ = object;
  window.dispatchEvent(new CustomEvent('viewer:selection-changed', { detail: { selectedObject: object, source: VERSION } }));
}

function canHideObject(object) {
  const root = modelRoot();
  if (!object || !root || object === root) return false;
  const rootBox = bounds(root);
  const objectBox = bounds(object);
  if (!validBox(rootBox) || !validBox(objectBox)) return true;
  const rootVolume = Math.max(volume(rootBox), 1e-9);
  return volume(objectBox) / rootVolume < 0.92;
}

function moveByWorldOffset(object, offset) {
  if (!object.userData) object.userData = {};
  if (!object.userData[EXPLODE_ORIGINAL_KEY]) object.userData[EXPLODE_ORIGINAL_KEY] = object.position.toArray();
  object.position.add(offset);
}

function explodedObjects() {
  const root = modelRoot();
  if (!root?.traverse) return [];
  const objects = [];
  root.traverse((object) => { if (object.userData?.[EXPLODE_ORIGINAL_KEY]) objects.push(object); });
  return objects;
}

function groupComponents(components, mode) {
  const map = new Map();
  components.forEach((object) => {
    const data = object.userData || {};
    const key = mode === 'line'
      ? String(data.LINE_NO || data.lineNo || data.line || data.LINE || 'NO_LINE')
      : String(data.componentType || data.componentClass || data.TYPE || data.type || object.type || 'OBJECT');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(object);
  });
  return Array.from(map, ([key, objects]) => ({ key, objects }));
}

function explodeDistance(root) {
  const box = bounds(root);
  const size = validBox(box) ? box.getSize(new THREE.Vector3()).length() : 1;
  return Math.max(size * 0.12, 0.1);
}

function projectedRect(object, camera, viewport) {
  const box = bounds(object);
  if (!validBox(box)) return null;
  const points = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z), new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z), new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z), new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z), new THREE.Vector3(box.max.x, box.max.y, box.max.z)
  ].map((point) => point.project(camera));
  const xs = points.map((point) => viewport.left + ((point.x + 1) / 2) * viewport.width);
  const ys = points.map((point) => viewport.top + ((1 - point.y) / 2) * viewport.height);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function bounds(object) {
  try { return new THREE.Box3().setFromObject(object); }
  catch { return new THREE.Box3(); }
}

function validBox(box) {
  return box && Number.isFinite(box.min.x) && Number.isFinite(box.max.x) && box.min.x <= box.max.x && box.min.y <= box.max.y && box.min.z <= box.max.z;
}

function volume(box) {
  const size = box.getSize(new THREE.Vector3());
  return Math.max(0, size.x) * Math.max(0, size.y) * Math.max(0, size.z);
}

function isEffectivelyVisible(object) {
  let node = object;
  while (node) {
    if (node.visible === false) return false;
    node = node.parent;
  }
  return true;
}

function isAncestorOrDescendant(a, b) {
  if (a === b) return true;
  let node = a.parent;
  while (node) { if (node === b) return true; node = node.parent; }
  node = b.parent;
  while (node) { if (node === a) return true; node = node.parent; }
  return false;
}

function revealAncestors(object, stopAt) {
  let node = object;
  while (node && node !== stopAt) {
    node.visible = true;
    node = node.parent;
  }
  if (stopAt) stopAt.visible = true;
}

function createAreaOverlay() {
  removeAreaOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  areaOverlay = document.createElement('div');
  areaOverlay.className = AREA_RECT_CLASS;
  viewer.appendChild(areaOverlay);
  updateAreaOverlay();
}

function updateAreaOverlay() {
  if (!areaOverlay || !areaDrag) return;
  const viewport = document.getElementById('viewer')?.getBoundingClientRect?.();
  if (!viewport) return;
  const rect = clampRect(normalizeRect(areaDrag.x1, areaDrag.y1, areaDrag.x2, areaDrag.y2), viewport);
  areaOverlay.style.left = `${rect.left - viewport.left}px`;
  areaOverlay.style.top = `${rect.top - viewport.top}px`;
  areaOverlay.style.width = `${Math.max(1, rect.right - rect.left)}px`;
  areaOverlay.style.height = `${Math.max(1, rect.bottom - rect.top)}px`;
}

function removeAreaOverlay() {
  areaOverlay?.remove?.();
  areaOverlay = null;
}

function normalizeRect(x1, y1, x2, y2) {
  return { left: Math.min(x1, x2), right: Math.max(x1, x2), top: Math.min(y1, y2), bottom: Math.max(y1, y2) };
}

function clampRect(rect, viewport) {
  return { left: Math.max(viewport.left, Math.min(viewport.right, rect.left)), right: Math.max(viewport.left, Math.min(viewport.right, rect.right)), top: Math.max(viewport.top, Math.min(viewport.bottom, rect.top)), bottom: Math.max(viewport.top, Math.min(viewport.bottom, rect.bottom)) };
}

function rectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function removeLegacyMeasureHelpersOnce() {
  const root = runtime()?.scene || modelRoot()?.parent || modelRoot();
  if (!root?.traverse) return;
  const remove = [];
  root.traverse((object) => {
    const name = String(object.name || '');
    if (/^MEASURE_POINT_(?!FINAL_|STARTUP_)/i.test(name) || object.geometry?.type === 'SphereGeometry' && object.userData?.measurePolylineHelper) remove.push(object);
  });
  remove.forEach((object) => {
    object.parent?.remove?.(object);
    object.geometry?.dispose?.();
    object.material?.dispose?.();
  });
}

function modelRoot() {
  const rt = runtime();
  const root = rt?.modelRoot || rt?.getModelRoot?.() || null;
  if (root && root !== rt?.scene) return root;
  return root;
}

function runtime() {
  const rt = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
  return rt?.refresh?.() || rt;
}

function requestRender(reason) {
  const rt = runtime();
  rt?.renderOnce?.(reason);
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { reason } }));
}

function objectId(object) {
  const data = object?.userData || {};
  return String(data.ID || data.id || data.componentId || data.COMPONENT_ID || data.TAG || data.SUPPORT_TAG || data.NAME || data.name || object?.name || object?.uuid || '').trim();
}

function isHelper(object) {
  const data = object?.userData || {};
  const name = String(object?.name || '');
  return Boolean(data.helper || data.measurePolylineHelper || data.areaSelectHelper || data.sectionBoxHelper || data.isDisplayHelper)
    || /^(STARTUP_AREA_SELECT_|FINAL_AREA_SELECT_|DIRECT_AREA_SELECT_|AREA_SELECT_|inputxml|__|MEASURE_|ComponentSearchHighlight|MODEL_TREE_SELECTION)/i.test(name);
}

function setPressed(key, active) {
  document.querySelectorAll(`[data-review-tool="${cssEscape(key)}"], [data-review-menu-tool="${cssEscape(key)}"]`).forEach((button) => {
    button.classList.toggle('tool-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function closeMenus() {
  let handled = false;
  document.querySelectorAll('.review-top-menu-popover, .top-menu-popover').forEach((panel) => {
    if (!panel.hidden) handled = true;
    panel.hidden = true;
  });
  const ctx = document.getElementById('staticReviewContextMenu');
  if (ctx && !ctx.hidden) handled = true;
  ctx?.setAttribute('hidden', '');
  document.querySelectorAll('[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  return handled;
}

function setStatus(message) {
  const target = document.getElementById('statusText') || document.getElementById('runtimeStatus') || document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (target && message) target.textContent = message;
}

function uniqueObjects(objects) {
  return Array.from(new Set(objects.filter(Boolean)));
}

function toCsv(rows) {
  const headers = ['selected_index', 'object_id', 'object_name', 'object_type', 'property_key', 'property_value'];
  return [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function isEditable(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .startup-preview-group-empty { display: none !important; }
    #viewModeGlbAliasBtn, #viewModeRvmAliasBtn { display: none !important; }
    .startup-responsive-input-block { position: sticky; top: 0; z-index: 10; margin: 8px 10px 12px; padding: 10px; border: 1px solid rgba(96, 165, 250, .35); border-radius: 12px; background: rgba(7, 17, 32, .96); box-shadow: 0 10px 28px rgba(0,0,0,.25); }
    .startup-responsive-input-status { color: #eaf4ff; font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .startup-responsive-input-block .file-drop { margin: 0 0 8px; }
    .startup-responsive-input-block .button-row { margin: 0; display: flex; gap: 8px; flex-wrap: wrap; }
    .startup-area-select-rect { position: absolute; z-index: 900; pointer-events: none; border: 1px solid #38bdf8; background: rgba(56, 189, 248, .12); box-shadow: 0 0 0 1px rgba(2, 132, 199, .35) inset; }
    body.area-select-active #viewer { cursor: crosshair; }
  `;
  document.head.appendChild(style);
}

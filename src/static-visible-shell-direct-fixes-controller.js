import * as THREE from 'three';

// Direct corrective layer for the visible ribbon/input shell.
// This module is intentionally loaded before the older final-fixes document
// click guard so its capture handler owns the visible Review ribbon buttons.

const VERSION = 'visible-shell-direct-fixes-20260619';
const STYLE_ID = 'staticVisibleShellDirectFixesStyle';
const INPUT_BLOCK_ID = 'alwaysVisibleInputBlock';
const INPUT_STATUS_ID = 'alwaysVisibleInputStatus';
const AREA_RECT_CLASS = 'direct-area-select-rect';
const AREA_HELPER_PREFIX = 'DIRECT_AREA_SELECT_';
const EXPLODE_KEY = '__visibleShellDirectExplodeOriginalPosition';
const TOOL_KEYS = new Set([
  'areaSelect',
  'sectionBoxSelected',
  'componentSearch',
  'isolateSelected',
  'hideSelected',
  'showAll',
  'explodeReview',
  'measurePolyline'
]);

let areaActive = false;
let areaDrag = null;
let areaOverlay = null;
let areaHelpers = [];
let areaSelected = [];
let measureActive = false;
let attachedViewer = null;
let patchTick = 0;

runWhenReady(initVisibleShellDirectFixes);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initVisibleShellDirectFixes() {
  injectStyles();
  installEarlyReviewToolCapture();
  installApis();
  refreshVisibleShell();
  attachViewerPointerHooks();
  ['viewer:model-loaded', 'viewer:runtime-context', 'viewer:selection-changed', 'markup:app-ready'].forEach((eventName) => {
    window.addEventListener(eventName, () => window.setTimeout(refreshVisibleShell, 0));
  });
  window.addEventListener('resize', refreshVisibleShell);
  window.setInterval(refreshVisibleShell, 240);
}

function refreshVisibleShell() {
  patchTick += 1;
  stabilizePreviewModeButtons();
  forceAlwaysVisibleInputBlock();
  installApis();
  attachViewerPointerHooks();
  removeLegacyMeasureFlashHelpers();
  window.__3D_MARKUP_VISIBLE_SHELL_DIRECT_FIXES__ = {
    version: VERSION,
    refresh: refreshVisibleShell,
    checklist: () => ({
      version: VERSION,
      stableOriginalPreviewButtons: visiblePreviewButtonsAreStable(),
      aliasButtonsHidden: aliasButtonsHidden(),
      inputBlockVisible: Boolean(document.getElementById(INPUT_BLOCK_ID) && document.getElementById(INPUT_STATUS_ID)),
      reviewCaptureInstalled: window.__3D_MARKUP_VISIBLE_DIRECT_REVIEW_CAPTURE__ === VERSION,
      areaApi: window.__3D_MARKUP_AREA_SELECT__?.version === VERSION,
      sectionBoxApi: window.__3D_MARKUP_SECTION_BOX__?.version === VERSION,
      viewpadToolsApi: window.__3D_MARKUP_VIEWPAD_TOOLS__?.__visibleDirectPatched === VERSION,
      explodeApi: window.__3D_MARKUP_EXPLODE_REVIEW__?.version === VERSION,
      measureApi: window.__3D_MARKUP_MEASURE_POLYLINE__?.version === VERSION,
      patchTick
    })
  };
}

function installEarlyReviewToolCapture() {
  if (window.__3D_MARKUP_VISIBLE_DIRECT_REVIEW_CAPTURE__ === VERSION) return;
  window.__3D_MARKUP_VISIBLE_DIRECT_REVIEW_CAPTURE__ = VERSION;
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-review-tool], [data-review-menu-tool]');
    if (!button) return;
    const key = button.dataset.reviewTool || button.dataset.reviewMenuTool;
    if (!TOOL_KEYS.has(key)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    runDirectTool(key);
    closeMenus();
  }, true);
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || isEditable(event.target)) return;
    const handled = cancelActiveDirectTools();
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);
}

function installApis() {
  const previousTools = window.__3D_MARKUP_VIEWPAD_TOOLS__ || {};
  window.__3D_MARKUP_VIEWPAD_TOOLS__ = {
    ...previousTools,
    isolateSelected: () => isolateSelected('api-visible-direct'),
    hideSelected: () => hideSelected('api-visible-direct'),
    showAll: () => showAll('api-visible-direct'),
    __visibleDirectPatched: VERSION
  };

  window.__3D_MARKUP_AREA_SELECT__ = {
    version: VERSION,
    activate: activateAreaSelect,
    deactivate: deactivateAreaSelect,
    clear: clearAreaSelection,
    selectInClientRect,
    selectedIds: () => areaSelected.map(objectId).filter(Boolean),
    isActive: () => areaActive,
    debug: () => ({ version: VERSION, active: areaActive, helperCount: areaHelpers.length, selectedCount: areaSelected.length, attachedViewer: Boolean(attachedViewer) })
  };

  window.__3D_MARKUP_SECTION_BOX__ = {
    version: VERSION,
    apply: () => applySectionBox('api-visible-direct'),
    clear: () => clearSectionBox('api-visible-direct'),
    debug: () => ({ version: VERSION, selected: objectId(selectedComponent()), clippingPlanes: runtime()?.renderer?.clippingPlanes?.length || 0 })
  };

  window.__3D_MARKUP_EXPLODE_REVIEW__ = {
    version: VERSION,
    open: () => applyExplode('type', 'open-visible-direct'),
    apply: (mode = 'type') => applyExplode(mode, 'api-visible-direct'),
    reset: () => resetExplode('api-visible-direct'),
    close: () => resetExplode('close-visible-direct'),
    debug: () => ({ version: VERSION, componentCount: selectableComponents().length })
  };

  window.__3D_MARKUP_MEASURE_POLYLINE__ = {
    ...(window.__3D_MARKUP_MEASURE_POLYLINE__ || {}),
    version: VERSION,
    activate: activateMeasurePolyline,
    finish: finishMeasurePolyline,
    clear: () => window.__3D_MARKUP_MEASURE_POLYLINE__?.clear?.(),
    debug: () => ({ version: VERSION, active: measureActive, legacySphereMarkersRemoved: true })
  };
}

function runDirectTool(key) {
  if (key === 'areaSelect') return activateAreaSelect();
  if (key === 'sectionBoxSelected') return applySectionBox('ribbon-visible-direct');
  if (key === 'componentSearch') return openComponentSearch();
  if (key === 'isolateSelected') return isolateSelected('ribbon-visible-direct');
  if (key === 'hideSelected') return hideSelected('ribbon-visible-direct');
  if (key === 'showAll') return showAll('ribbon-visible-direct');
  if (key === 'explodeReview') return applyExplode('type', 'ribbon-visible-direct');
  if (key === 'measurePolyline') return activateMeasurePolyline();
  return false;
}

function stabilizePreviewModeButtons() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  const fitAll = document.getElementById('resetCameraBtn');
  const glb = document.getElementById('previewGlbBtn');
  const rvm = document.getElementById('previewRvmBtn');
  if (!viewGroup || !fitAll || !glb || !rvm) return false;

  document.getElementById('viewModeGlbAliasBtn')?.remove();
  document.getElementById('viewModeRvmAliasBtn')?.remove();

  glb.classList.add('visible-mode-direct');
  rvm.classList.add('visible-mode-direct');
  glb.hidden = false;
  rvm.hidden = false;
  glb.removeAttribute('aria-hidden');
  rvm.removeAttribute('aria-hidden');

  if (glb.parentElement !== viewGroup) fitAll.after(glb);
  if (rvm.parentElement !== viewGroup) glb.after(rvm);

  const previewGroup = document.querySelector('[aria-label="Preview mode"]');
  if (previewGroup && previewGroup !== viewGroup) previewGroup.classList.add('visible-preview-group-empty');
  return true;
}

function visiblePreviewButtonsAreStable() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  return Boolean(viewGroup && document.getElementById('previewGlbBtn')?.parentElement === viewGroup && document.getElementById('previewRvmBtn')?.parentElement === viewGroup);
}

function aliasButtonsHidden() {
  return !document.getElementById('viewModeGlbAliasBtn') && !document.getElementById('viewModeRvmAliasBtn');
}

function forceAlwaysVisibleInputBlock() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  document.body.classList.add('input-open');
  drawer.classList.add('input-direct-visible');
  document.getElementById('toggleInputBtn')?.classList.add('active');

  let block = document.getElementById(INPUT_BLOCK_ID);
  if (!block) {
    block = document.createElement('div');
    block.id = INPUT_BLOCK_ID;
    block.className = 'always-visible-input-block';
    block.innerHTML = `<div id="${INPUT_STATUS_ID}" class="always-visible-input-status">No file chosen</div>`;
  }

  const head = drawer.querySelector('.drawer-head');
  if (head?.nextSibling !== block) head?.after(block);
  else if (!block.parentElement) drawer.insertBefore(block, drawer.firstChild);

  const fileDrop = document.querySelector('#inputDrawer .file-drop');
  const loadSample = document.getElementById('loadSampleBtn');
  const clear = document.getElementById('clearBtn');
  let buttonRow = loadSample?.closest?.('.button-row');
  if (!buttonRow && (loadSample || clear)) {
    buttonRow = document.createElement('div');
    buttonRow.className = 'button-row direct-input-actions';
    if (loadSample) buttonRow.appendChild(loadSample);
    if (clear) buttonRow.appendChild(clear);
  }
  if (fileDrop && fileDrop.parentElement !== block) block.appendChild(fileDrop);
  if (buttonRow && buttonRow.parentElement !== block) block.appendChild(buttonRow);

  const input = document.getElementById('xmlFile');
  if (input && input.dataset.visibleDirectStatusBound !== VERSION) {
    input.dataset.visibleDirectStatusBound = VERSION;
    input.addEventListener('change', updateInputStatus);
  }
  if (loadSample && loadSample.dataset.visibleDirectStatusBound !== VERSION) {
    loadSample.dataset.visibleDirectStatusBound = VERSION;
    loadSample.addEventListener('click', () => window.setTimeout(() => updateInputStatus('BM_CII sample loaded'), 0), true);
  }
  if (clear && clear.dataset.visibleDirectStatusBound !== VERSION) {
    clear.dataset.visibleDirectStatusBound = VERSION;
    clear.addEventListener('click', () => window.setTimeout(() => updateInputStatus('No file chosen'), 0), true);
  }
  document.getElementById('closeInputBtn')?.setAttribute('hidden', '');
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
  const rt = runtime();
  if (!rt?.camera || !modelRoot()) {
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
  const selected = selectInClientRect(rect, { source: 'visible-direct-drag' });
  deactivateAreaSelect(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
  return selected;
}

function onViewerPointerCancel(event) {
  if (!areaActive) return;
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
  deactivateAreaSelect('Area Select canceled');
}

function selectInClientRect(inputRect, { source = 'visible-direct' } = {}) {
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
  requestRender('area-select-visible-direct');
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
  requestRender('area-select-clear-visible-direct');
  return true;
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

function openComponentSearch() {
  const api = window.__3D_MARKUP_COMPONENT_SEARCH__;
  if (api && api.version !== VERSION && typeof api.open === 'function') {
    const result = api.open();
    window.setTimeout(() => {
      document.querySelector('.final-component-search-panel, #staticFinalComponentSearchPanel, #staticComponentSearchPanel')?.removeAttribute('hidden');
      document.querySelector('.final-component-search-panel input, #staticFinalComponentSearchPanel input, #staticComponentSearchPanel input')?.focus?.();
    }, 0);
    return result !== false;
  }
  setStatus('Search / Jump unavailable');
  return false;
}

function applySectionBox(source = 'visible-direct-section') {
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
  requestRender('section-box-visible-direct');
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'apply', version: VERSION, source, selectedId: objectId(selected), planeCount: planes.length } }));
  return true;
}

function clearSectionBox(source = 'visible-direct-section-clear') {
  const rt = runtime();
  rt?.clearClipping?.({ source });
  if (rt?.renderer) {
    rt.renderer.localClippingEnabled = false;
    rt.renderer.clippingPlanes = [];
  }
  requestRender('section-box-clear-visible-direct');
  return true;
}

function isolateSelected(source = 'visible-direct-isolate') {
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
  requestRender('isolate-visible-direct');
  setStatus(`Isolated ${selected.length} selected component${selected.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'isolate', version: VERSION, source, selectedCount: selected.length } }));
  return true;
}

function hideSelected(source = 'visible-direct-hide') {
  const targets = selectedTargets().filter((object) => canHideObject(object));
  if (!targets.length) {
    setStatus('Hide skipped: select a component/part, not the full model');
    return false;
  }
  targets.forEach((object) => { object.visible = false; });
  requestRender('hide-visible-direct');
  setStatus(`Hidden ${targets.length} selected component${targets.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'hide', version: VERSION, source, selectedCount: targets.length } }));
  return true;
}

function showAll(source = 'visible-direct-show-all') {
  const root = modelRoot();
  if (!root) {
    setStatus('No model loaded');
    return false;
  }
  root.traverse?.((object) => { object.visible = true; });
  requestRender('show-all-visible-direct');
  setStatus('All components shown');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'showAll', version: VERSION, source } }));
  return true;
}

function applyExplode(mode = 'type', source = 'visible-direct-explode') {
  const root = modelRoot();
  if (!root) {
    setStatus('Explode unavailable: no model loaded');
    return false;
  }
  resetExplode('explode-before-visible-direct', true);
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
  requestRender('explode-visible-direct');
  setStatus(`Exploded ${components.length} component(s) into ${groups.length} group(s)`);
  window.dispatchEvent(new CustomEvent('viewer:explode-review', { detail: { action: 'apply', version: VERSION, source, mode, groups: groups.length, distance } }));
  return true;
}

function resetExplode(source = 'visible-direct-explode-reset', silent = false) {
  const root = modelRoot();
  if (!root?.traverse) return false;
  let count = 0;
  root.traverse((object) => {
    const original = object.userData?.[EXPLODE_KEY];
    if (!Array.isArray(original)) return;
    object.position.set(original[0], original[1], original[2]);
    delete object.userData[EXPLODE_KEY];
    count += 1;
  });
  if (!silent || count) setStatus(count ? `Explode reset: ${count} component(s)` : 'Explode reset');
  requestRender('explode-reset-visible-direct');
  return count > 0;
}

function activateMeasurePolyline() {
  measureActive = true;
  removeLegacyMeasureFlashHelpers();
  if (window.__3D_MARKUP_MEASURE_POLYLINE__?.version !== VERSION && typeof window.__3D_MARKUP_MEASURE_POLYLINE__?.activate === 'function') {
    return window.__3D_MARKUP_MEASURE_POLYLINE__.activate();
  }
  setStatus('Measure Polyline: click points');
  return true;
}

function finishMeasurePolyline() {
  measureActive = false;
  return true;
}

function removeLegacyMeasureFlashHelpers() {
  const root = runtime()?.scene || modelRoot()?.parent || modelRoot();
  if (!root?.traverse) return;
  const remove = [];
  root.traverse((object) => {
    const name = String(object.name || '');
    if (/^MEASURE_POINT_(?!FINAL_)/i.test(name) || name === '__MEASURE_POLYLINE_HELPERS__') remove.push(object);
    if (object.geometry?.type === 'SphereGeometry' && object.userData?.measurePolylineHelper) remove.push(object);
  });
  remove.forEach((object) => {
    object.parent?.remove?.(object);
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
  });
}

function cancelActiveDirectTools() {
  let handled = false;
  if (areaActive) handled = deactivateAreaSelect('Area Select canceled') || handled;
  handled = resetExplode('escape-visible-direct', true) || handled;
  closeMenus();
  if (handled) setStatus('Esc: review tool exited');
  return handled;
}

function selectedTargets() {
  if (areaSelected.length) return areaSelected.filter((object) => object?.parent);
  const selected = selectedComponent();
  return selected ? [selected] : [];
}

function selectedComponent() {
  const root = modelRoot();
  if (!root) return null;
  let object = selectedObject();
  if (!object && areaSelected.length === 1) object = areaSelected[0];
  if (!object || object === root || object.isScene || isHelper(object)) return null;
  if (!isDescendantOf(object, root) && object !== root) return null;

  let cursor = object;
  let directChild = null;
  while (cursor && cursor !== root && cursor.type !== 'Scene') {
    if (cursor.parent === root) directChild = cursor;
    const data = cursor.userData || {};
    const type = data.TYPE || data.type;
    if (type && type !== 'RVM_PRIMITIVE') return cursor;
    if (hasComponentMetadata(cursor)) return cursor;
    cursor = cursor.parent;
  }
  if (directChild && canHideObject(directChild)) return directChild;
  if (object.isMesh || object.isLine || object.isPoints) return object;
  return nearestRenderableDescendant(object);
}

function selectedObject() {
  const rt = runtime();
  return rt?.getSelectedObject?.()
    || rt?.selectedObject
    || rt?.selectedMesh
    || window.__3D_MARKUP_SELECTED_OBJECT__
    || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject
    || window.__3D_MARKUP_TREE__?.state?.selectedObject
    || null;
}

function selectableComponents() {
  const root = modelRoot();
  if (!root?.traverse) return [];
  const explicit = [];
  root.traverse((object) => {
    if (!object || object === root || isHelper(object)) return;
    if (!isRenderableOrGroup(object)) return;
    if (!hasComponentMetadata(object)) return;
    if (hasComponentAncestor(object, root)) return;
    explicit.push(object);
  });
  if (explicit.length >= 2) return explicit;
  const direct = root.children?.filter((object) => isRenderableOrGroup(object) && !isHelper(object) && object.name !== 'grid' && object.name !== 'axes') || [];
  if (direct.length >= 2) return direct;
  const leaves = [];
  root.traverse((object) => {
    if (object !== root && !isHelper(object) && (object.isMesh || object.isLine || object.isPoints)) leaves.push(object);
  });
  return leaves;
}

function hasComponentMetadata(object) {
  const data = object?.userData || {};
  return Boolean(data.componentId || data.COMPONENT_ID || data.componentClass || data.componentType || data.ID || data.id || data.TAG || data.SUPPORT_TAG || data.TYPE === 'COMPONENT' || data.TYPE === 'SUPPORT_RESTRAINT' || data.type === 'COMPONENT' || data.meshRole || data.fromNode || data.toNode || data.LINE_NO || data.lineNo || data.rawType || data.visualKey);
}

function hasComponentAncestor(object, root) {
  let cursor = object.parent;
  while (cursor && cursor !== root && cursor.type !== 'Scene') {
    if (hasComponentMetadata(cursor)) return true;
    cursor = cursor.parent;
  }
  return false;
}

function canHideObject(object) {
  const root = modelRoot();
  if (!object || !root || object === root || object.isScene || object.parent?.type === 'Scene') return false;
  const objectBox = bounds(object);
  const rootBox = bounds(root);
  if (!validBox(objectBox) || !validBox(rootBox)) return true;
  const os = objectBox.getSize(new THREE.Vector3());
  const rs = rootBox.getSize(new THREE.Vector3());
  const objectVolume = Math.max(os.x * os.y * os.z, 0);
  const rootVolume = Math.max(rs.x * rs.y * rs.z, 0);
  if (rootVolume > 0 && objectVolume / rootVolume > 0.92) return false;
  return true;
}

function isRenderableOrGroup(object) {
  return Boolean(object?.isMesh || object?.isLine || object?.isPoints || object?.isGroup || object?.children?.length);
}

function isEffectivelyVisible(object) {
  let cursor = object;
  while (cursor) {
    if (cursor.visible === false) return false;
    cursor = cursor.parent;
  }
  return true;
}

function isHelper(object) {
  const name = String(object?.name || '');
  return Boolean(object?.userData?.helper || object?.userData?.areaSelectHelper || object?.userData?.measurePolylineHelper || /HELPER|GRID|AXES|SELECTION_BOX/i.test(name));
}

function isDescendantOf(object, root) {
  let cursor = object;
  while (cursor) {
    if (cursor === root) return true;
    cursor = cursor.parent;
  }
  return false;
}

function isAncestorOrDescendant(a, b) {
  return isDescendantOf(a, b) || isDescendantOf(b, a);
}

function revealAncestors(object, stopAt) {
  let cursor = object;
  while (cursor && cursor !== stopAt?.parent) {
    cursor.visible = true;
    if (cursor === stopAt) break;
    cursor = cursor.parent;
  }
}

function nearestRenderableDescendant(object) {
  let found = null;
  object?.traverse?.((child) => {
    if (!found && child !== object && !isHelper(child) && (child.isMesh || child.isLine || child.isPoints)) found = child;
  });
  return found;
}

function groupComponents(objects, mode = 'type') {
  const map = new Map();
  objects.forEach((object, index) => {
    const data = object.userData || {};
    const key = mode === 'line'
      ? String(data.LINE_NO || data.lineNo || data.line || 'NO_LINE')
      : String(data.componentType || data.componentClass || data.TYPE || data.type || object.type || `OBJECT_${index + 1}`);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(object);
  });
  return Array.from(map.entries()).map(([key, groupObjects]) => ({ key, objects: groupObjects }));
}

function explodeDistance(root) {
  const box = bounds(root);
  if (!validBox(box)) return 1;
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z, 1) * 0.22;
}

function moveByWorldOffset(object, offset) {
  if (!object.userData) object.userData = {};
  if (!Array.isArray(object.userData[EXPLODE_KEY])) object.userData[EXPLODE_KEY] = [object.position.x, object.position.y, object.position.z];
  const parentQuat = new THREE.Quaternion();
  object.parent?.getWorldQuaternion?.(parentQuat);
  const localOffset = offset.clone().applyQuaternion(parentQuat.invert());
  object.position.add(localOffset);
}

function projectedRect(object, camera, viewport) {
  const box = bounds(object);
  if (!validBox(box)) return null;
  const corners = boxCorners(box).concat([box.getCenter(new THREE.Vector3())]);
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity; let any = false;
  corners.forEach((point) => {
    const p = point.project(camera);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.z < -1 || p.z > 1) return;
    const x = viewport.left + ((p.x + 1) / 2) * viewport.width;
    const y = viewport.top + ((1 - p.y) / 2) * viewport.height;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    any = true;
  });
  return any ? { left, top, right, bottom } : null;
}

function bounds(object) {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return validBox(box) ? box : null;
}

function boxCorners(box) {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z), new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z), new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z), new THREE.Vector3(max.x, max.y, max.z)
  ];
}

function normalizeRect(x1, y1, x2, y2) {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
}

function clampRect(rect, viewport) {
  return {
    left: clamp(rect.left, viewport.left, viewport.right),
    top: clamp(rect.top, viewport.top, viewport.bottom),
    right: clamp(rect.right, viewport.left, viewport.right),
    bottom: clamp(rect.bottom, viewport.top, viewport.bottom)
  };
}

function rectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function selectObject(object) {
  const rt = runtime();
  if (typeof rt?.selectObject === 'function') return rt.selectObject(object, { source: VERSION });
  window.__3D_MARKUP_SELECTED_OBJECT__ = object;
  window.dispatchEvent(new CustomEvent('markup:selected-object-changed', { detail: { object, source: VERSION } }));
  window.dispatchEvent(new CustomEvent('viewer:selection-changed', { detail: { selectedObject: object, source: VERSION } }));
  return true;
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

function setStatus(message) {
  const target = document.getElementById('statusText') || document.getElementById('runtimeStatus') || document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (target && message) target.textContent = message;
}

function setPressed(key, active) {
  document.querySelectorAll(`[data-review-tool="${cssEscape(key)}"], [data-review-menu-tool="${cssEscape(key)}"]`).forEach((button) => {
    button.classList.toggle('tool-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function closeMenus() {
  document.querySelectorAll('.review-top-menu-popover, .top-menu-popover').forEach((panel) => { panel.hidden = true; });
  document.getElementById('staticReviewContextMenu')?.setAttribute('hidden', '');
  document.querySelectorAll('[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function validBox(box) {
  return Boolean(box) && Number.isFinite(box.min?.x) && Number.isFinite(box.min?.y) && Number.isFinite(box.min?.z) && Number.isFinite(box.max?.x) && Number.isFinite(box.max?.y) && Number.isFinite(box.max?.z) && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z;
}

function objectId(object) {
  const data = object?.userData || {};
  return String(data.ID || data.id || data.componentId || data.COMPONENT_ID || data.TAG || data.SUPPORT_TAG || data.NAME || data.name || object?.name || object?.uuid || '').trim();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function isEditable(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #viewModeGlbAliasBtn,
    #viewModeRvmAliasBtn,
    .final-mode-alias { display: none !important; visibility: hidden !important; pointer-events: none !important; }
    #previewGlbBtn.visible-mode-direct,
    #previewRvmBtn.visible-mode-direct { display: flex !important; visibility: visible !important; pointer-events: auto !important; }
    [aria-label="Preview mode"].visible-preview-group-empty { display: none !important; }
    #inputDrawer.input-direct-visible { display: block !important; visibility: visible !important; }
    #closeInputBtn { display: none !important; }
    #${INPUT_BLOCK_ID}.always-visible-input-block { position: sticky; top: 0; z-index: 70; display: grid; gap: 9px; padding: 10px 12px 12px; margin: 0 0 12px; border: 1px solid rgba(83,125,176,.34); border-radius: 12px; background: linear-gradient(180deg, rgba(10,26,47,.99), rgba(6,18,34,.97)); box-shadow: 0 8px 22px rgba(0,0,0,.22); }
    #${INPUT_STATUS_ID}.always-visible-input-status { min-height: 26px; display: flex; align-items: center; color: #dcecff; font-size: 12px; font-weight: 850; }
    #${INPUT_BLOCK_ID} .file-drop { margin: 0 !important; min-height: 46px; display: flex !important; align-items: center; justify-content: center; }
    #${INPUT_BLOCK_ID} .button-row { margin: 0 !important; display: flex !important; gap: 8px; flex-wrap: wrap; }
    #${INPUT_BLOCK_ID} #loadSampleBtn,
    #${INPUT_BLOCK_ID} #clearBtn { display: inline-flex !important; align-items: center; justify-content: center; }
    #inputDrawer .panel-section:first-of-type:empty { display: none !important; }
    .${AREA_RECT_CLASS} { position: absolute; z-index: 140; pointer-events: none; border: 1px dashed #37d8ff; background: rgba(55,216,255,.13); box-shadow: 0 0 0 1px rgba(7,20,39,.74); }
  `;
  document.head.appendChild(style);
}

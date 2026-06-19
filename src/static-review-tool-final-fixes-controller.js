import * as THREE from 'three';

// Final corrective layer for the ribbon-first review shell.
// Loaded last so it can replace unstable shortcut/viewpad hooks with one
// consistent runtime resolver for selection, area select, section box,
// search, visibility, explode, measure, and input visibility.

const VERSION = 'review-tool-final-fixes-20260619';
const STYLE_ID = 'staticReviewToolFinalFixesStyle';
const MEASURE_GROUP = '__FINAL_MEASURE_POLYLINE_HELPERS__';
const AREA_PREFIX = 'FINAL_AREA_SELECT_';
const SEARCH_PANEL_ID = 'staticFinalComponentSearchPanel';
const FILE_STATUS_ID = 'inputFileChosenStatus';
const MODE_ALIAS_GLB_ID = 'viewModeGlbAliasBtn';
const MODE_ALIAS_RVM_ID = 'viewModeRvmAliasBtn';
const EXPLODE_ORIGINAL_KEY = '__finalReviewExplodeOriginalPosition';

let areaActive = false;
let areaDrag = null;
let areaOverlay = null;
let areaHelpers = [];
let areaSelected = [];
let attachedCanvas = null;
let measureActive = false;
let measurePoints = [];
let measurePanel = null;
let measureGroup = null;
let searchPanel = null;
let searchResults = [];
let patchTick = 0;

runWhenReady(initFinalFixes);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initFinalFixes() {
  injectStyles();
  forceInputVisible();
  ensureModeAliases();
  installApis();
  attachCanvas();
  installClickGuards();
  installInputGuards();
  refreshAll();
  window.addEventListener('viewer:model-loaded', () => window.setTimeout(refreshAll, 0));
  window.addEventListener('viewer:runtime-context', () => window.setTimeout(refreshAll, 0));
  window.addEventListener('resize', refreshAll);
  window.setInterval(refreshAll, 650);
}

function refreshAll() {
  patchTick += 1;
  forceInputVisible();
  ensureModeAliases();
  installApis();
  attachCanvas();
  mirrorModeAliases();
  removeLegacyMeasureHelpers();
  window.__3D_MARKUP_REVIEW_TOOL_FINAL_FIXES__ = {
    version: VERSION,
    refresh: refreshAll,
    checklist: () => ({
      version: VERSION,
      inputForcedVisible: document.body.classList.contains('input-open') && Boolean(document.getElementById(FILE_STATUS_ID)),
      stableModeAliases: Boolean(document.getElementById(MODE_ALIAS_GLB_ID) && document.getElementById(MODE_ALIAS_RVM_ID)),
      originalModesHidden: originalPreviewButtonsHidden(),
      areaApi: window.__3D_MARKUP_AREA_SELECT__?.version === VERSION,
      sectionBoxApi: window.__3D_MARKUP_SECTION_BOX__?.version === VERSION,
      searchApi: window.__3D_MARKUP_COMPONENT_SEARCH__?.version === VERSION,
      viewpadToolsApi: window.__3D_MARKUP_VIEWPAD_TOOLS__?.__finalReviewPatched === VERSION,
      explodeApi: window.__3D_MARKUP_EXPLODE_REVIEW__?.version === VERSION,
      measureApi: window.__3D_MARKUP_MEASURE_POLYLINE__?.version === VERSION,
      patchTick
    })
  };
}

function installApis() {
  const previousViewpad = window.__3D_MARKUP_VIEWPAD_TOOLS__ || {};
  window.__3D_MARKUP_VIEWPAD_TOOLS__ = {
    ...previousViewpad,
    isolateSelected: () => isolateSelected('viewpad-final'),
    hideSelected: () => hideSelected('viewpad-final'),
    showAll: () => showAll('viewpad-final'),
    __finalReviewPatched: VERSION
  };

  window.__3D_MARKUP_AREA_SELECT__ = {
    version: VERSION,
    activate: activateAreaSelect,
    deactivate: deactivateAreaSelect,
    clear: clearAreaSelection,
    selectInClientRect,
    isActive: () => areaActive,
    selectedIds: () => areaSelected.map(objectId).filter(Boolean),
    debug: () => ({ version: VERSION, active: areaActive, selectedCount: areaSelected.length, helperCount: areaHelpers.length, canvasAttached: Boolean(attachedCanvas) })
  };

  window.__3D_MARKUP_SECTION_BOX__ = {
    version: VERSION,
    apply: () => applySectionBox('section-final'),
    clear: () => clearSectionBox('section-final-clear'),
    debug: () => ({ version: VERSION, hasSelected: Boolean(selectedComponent()), clippingPlanes: runtime()?.renderer?.clippingPlanes?.length || 0 })
  };

  window.__3D_MARKUP_COMPONENT_SEARCH__ = {
    version: VERSION,
    open: openSearchPanel,
    close: closeSearchPanel,
    search: querySearch,
    focus: (id) => focusSearchResult(id),
    debug: () => ({ version: VERSION, panelOpen: Boolean(searchPanel && !searchPanel.hidden), resultCount: searchResults.length })
  };

  window.__3D_MARKUP_EXPLODE_REVIEW__ = {
    version: VERSION,
    open: () => applyExplode('type', 'open-final'),
    apply: (mode = 'type') => applyExplode(mode, 'api-final'),
    reset: () => resetExplode('api-final'),
    close: () => resetExplode('close-final'),
    groups: (mode = 'type') => groupComponents(selectableComponents(), mode).map((g) => ({ key: g.key, count: g.objects.length })),
    debug: () => ({ version: VERSION, componentCount: selectableComponents().length })
  };

  window.__3D_MARKUP_MEASURE_POLYLINE__ = {
    version: VERSION,
    activate: activateMeasure,
    finish: finishMeasure,
    clear: clearMeasure,
    undo: undoMeasure,
    isActive: () => measureActive,
    points: () => measurePoints.map(vectorToArray),
    segments: () => segmentLengths(measurePoints),
    total: () => totalLength(measurePoints),
    debug: () => ({ version: VERSION, active: measureActive, pointCount: measurePoints.length, helperType: 'THREE.Points pixel markers' })
  };
}

function installClickGuards() {
  if (window.__3D_MARKUP_REVIEW_FINAL_CLICK_GUARDS__ === VERSION) return;
  window.__3D_MARKUP_REVIEW_FINAL_CLICK_GUARDS__ = VERSION;
  document.addEventListener('click', (event) => {
    const review = event.target?.closest?.('[data-review-tool], [data-review-menu-tool]');
    if (!review) return;
    const key = review.dataset.reviewTool || review.dataset.reviewMenuTool;
    if (!['areaSelect', 'sectionBoxSelected', 'componentSearch', 'isolateSelected', 'hideSelected', 'showAll', 'explodeReview', 'measurePolyline'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    runFinalTool(key);
    closeMenus();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || isEditable(event.target)) return;
    let handled = false;
    if (areaActive) handled = deactivateAreaSelect('Area Select canceled') || handled;
    if (measureActive) handled = finishMeasure() || handled;
    if (searchPanel && !searchPanel.hidden) handled = closeSearchPanel() || handled;
    handled = resetExplode('escape-final', true) || handled;
    closeMenus();
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setStatus('Esc: review tool exited');
    }
  }, true);
}

function runFinalTool(key) {
  if (key === 'areaSelect') return activateAreaSelect();
  if (key === 'sectionBoxSelected') return applySectionBox('ribbon-final');
  if (key === 'componentSearch') return openSearchPanel();
  if (key === 'isolateSelected') return isolateSelected('ribbon-final');
  if (key === 'hideSelected') return hideSelected('ribbon-final');
  if (key === 'showAll') return showAll('ribbon-final');
  if (key === 'explodeReview') return applyExplode('type', 'ribbon-final');
  if (key === 'measurePolyline') return activateMeasure();
  return false;
}

function ensureModeAliases() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  if (!viewGroup) return;
  const fitAll = document.getElementById('resetCameraBtn');
  const glbOriginal = document.getElementById('previewGlbBtn');
  const rvmOriginal = document.getElementById('previewRvmBtn');
  const glb = ensureModeAlias(MODE_ALIAS_GLB_ID, 'GLB', 'Preview GLB mode', 'box', () => glbOriginal?.click?.());
  const rvm = ensureModeAlias(MODE_ALIAS_RVM_ID, 'RVM', 'Preview RVM mode', 'file', () => rvmOriginal?.click?.());
  if (fitAll?.parentElement === viewGroup) {
    if (glb.parentElement !== viewGroup) fitAll.after(glb);
    if (rvm.parentElement !== viewGroup) glb.after(rvm);
  } else {
    if (glb.parentElement !== viewGroup) viewGroup.appendChild(glb);
    if (rvm.parentElement !== viewGroup) viewGroup.appendChild(rvm);
  }
  mirrorModeAliases();
}

function ensureModeAlias(id, label, title, icon, handler) {
  let button = document.getElementById(id);
  if (!button) {
    button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'tool-btn mode mode-alias final-mode-alias';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler();
      window.setTimeout(mirrorModeAliases, 0);
      window.setTimeout(mirrorModeAliases, 160);
    });
    button.replaceChildren(iconNode(icon), textNode(label));
  }
  return button;
}

function mirrorModeAliases() {
  mirrorOneMode('previewGlbBtn', MODE_ALIAS_GLB_ID);
  mirrorOneMode('previewRvmBtn', MODE_ALIAS_RVM_ID);
  document.querySelector('[aria-label="Preview mode"]')?.classList.add('preview-mode-hidden-original');
}

function mirrorOneMode(originalId, aliasId) {
  const original = document.getElementById(originalId);
  const alias = document.getElementById(aliasId);
  if (!alias) return;
  const disabled = original?.disabled === true;
  alias.disabled = disabled;
  alias.classList.toggle('active', Boolean(original?.classList.contains('active')));
  alias.setAttribute('aria-pressed', alias.classList.contains('active') ? 'true' : 'false');
}

function originalPreviewButtonsHidden() {
  const glb = document.getElementById('previewGlbBtn');
  const rvm = document.getElementById('previewRvmBtn');
  return Boolean(glb && rvm);
}

function forceInputVisible() {
  document.body.classList.add('input-open');
  document.getElementById('toggleInputBtn')?.classList.add('active');
  const input = document.getElementById('xmlFile');
  const first = document.querySelector('#inputDrawer .panel-section:first-of-type');
  if (first && !document.getElementById(FILE_STATUS_ID)) {
    const status = document.createElement('div');
    status.id = FILE_STATUS_ID;
    status.className = 'input-file-status';
    status.textContent = 'No file chosen';
    first.insertBefore(status, first.querySelector('.file-drop'));
  }
  updateFileStatus();
  if (input && !input.dataset.finalFileStatusBound) {
    input.dataset.finalFileStatusBound = VERSION;
    input.addEventListener('change', updateFileStatus);
  }
}

function installInputGuards() {
  if (window.__3D_MARKUP_INPUT_ALWAYS_VISIBLE__ === VERSION) return;
  window.__3D_MARKUP_INPUT_ALWAYS_VISIBLE__ = VERSION;
  document.getElementById('closeInputBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add('input-open');
  }, true);
  document.getElementById('toggleInputBtn')?.addEventListener('click', () => {
    window.setTimeout(() => document.body.classList.add('input-open'), 0);
  }, true);
  document.getElementById('clearBtn')?.addEventListener('click', () => window.setTimeout(() => updateFileStatus('No file chosen'), 0), true);
  document.getElementById('loadSampleBtn')?.addEventListener('click', () => window.setTimeout(() => updateFileStatus('BM_CII sample loaded'), 0), true);
}

function updateFileStatus(override = null) {
  const status = document.getElementById(FILE_STATUS_ID);
  const input = document.getElementById('xmlFile');
  if (!status) return;
  status.textContent = override || input?.files?.[0]?.name || 'No file chosen';
}

function activateAreaSelect() {
  areaActive = true;
  attachCanvas();
  document.body.classList.add('area-select-active');
  setPressed('areaSelect', true);
  setStatus('Area Select: drag a rectangle over components');
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

function attachCanvas() {
  const canvas = runtimeCanvas();
  if (!canvas || canvas === attachedCanvas) return;
  if (attachedCanvas) {
    attachedCanvas.removeEventListener('pointerdown', onPointerDown, true);
    attachedCanvas.removeEventListener('pointermove', onPointerMove, true);
    attachedCanvas.removeEventListener('pointerup', onPointerUp, true);
    attachedCanvas.removeEventListener('pointercancel', onPointerCancel, true);
    attachedCanvas.removeEventListener('dblclick', onDoubleClick, true);
  }
  attachedCanvas = canvas;
  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointermove', onPointerMove, true);
  canvas.addEventListener('pointerup', onPointerUp, true);
  canvas.addEventListener('pointercancel', onPointerCancel, true);
  canvas.addEventListener('dblclick', onDoubleClick, true);
}

function onPointerDown(event) {
  if (areaActive) return onAreaPointerDown(event);
  if (measureActive) return onMeasurePointerDown(event);
}

function onPointerMove(event) {
  if (!areaActive || !areaDrag) return;
  stop(event);
  areaDrag.x2 = event.clientX;
  areaDrag.y2 = event.clientY;
  updateAreaOverlay();
}

function onPointerUp(event) {
  if (!areaActive || !areaDrag) return;
  stop(event);
  const rect = normalizeRect(areaDrag.x1, areaDrag.y1, event.clientX, event.clientY);
  event.currentTarget?.releasePointerCapture?.(areaDrag.pointerId);
  areaDrag = null;
  removeAreaOverlay();
  if ((rect.right - rect.left) < 8 || (rect.bottom - rect.top) < 8) return deactivateAreaSelect('Area Select canceled');
  const selected = selectInClientRect(rect, { source: 'area-final-drag' });
  deactivateAreaSelect(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
}

function onPointerCancel(event) {
  if (!areaActive) return;
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
  deactivateAreaSelect('Area Select canceled');
}

function onAreaPointerDown(event) {
  if (event.button !== 0) return;
  if (!runtime()?.camera || !modelRoot()) {
    deactivateAreaSelect('Area Select unavailable: model/camera not ready');
    return;
  }
  stop(event);
  areaDrag = { pointerId: event.pointerId, x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY };
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  createAreaOverlay();
}

function selectInClientRect(inputRect, { source = 'area-final' } = {}) {
  const rt = runtime();
  const camera = rt?.camera;
  const viewer = document.getElementById('viewer');
  if (!camera || !viewer) return [];
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRect(inputRect, viewport);
  const selected = selectableComponents().filter((object) => {
    if (!isEffectivelyVisible(object)) return false;
    const projected = projectedRect(object, camera, viewport);
    return projected && rectsIntersect(rect, projected);
  });
  applyAreaSelection(selected, source);
  return selected;
}

function applyAreaSelection(selected, source = 'area-final') {
  clearAreaSelection({ silent: true });
  const scene = runtime()?.scene || modelRoot()?.parent || modelRoot();
  areaSelected = selected.slice();
  for (const object of areaSelected) {
    const helper = new THREE.BoxHelper(object, 0x37d8ff);
    helper.name = `${AREA_PREFIX}${objectId(object) || object.uuid}`;
    helper.userData = { helper: true, areaSelectHelper: true, source: VERSION, selectedId: objectId(object) };
    helper.renderOrder = 9997;
    scene?.add?.(helper);
    areaHelpers.push(helper);
  }
  if (areaSelected.length === 1) selectObject(areaSelected[0], { source: 'area-select' });
  setStatus(`Area selected ${areaSelected.length} component${areaSelected.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'select', version: VERSION, source, selectedCount: areaSelected.length, selectedIds: areaSelected.map(objectId).filter(Boolean) } }));
  requestRender('area-final-select');
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
  requestRender('area-final-clear');
  return true;
}

function createAreaOverlay() {
  removeAreaOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  areaOverlay = document.createElement('div');
  areaOverlay.className = 'final-area-select-rect';
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

function openSearchPanel() {
  ensureSearchPanel();
  searchPanel.hidden = false;
  searchPanel.setAttribute('aria-hidden', 'false');
  const input = searchPanel.querySelector('input');
  input.value = '';
  renderSearchResults(indexComponents().slice(0, 30));
  input.focus();
  setStatus('Search / Jump opened');
  return true;
}

function closeSearchPanel() {
  if (!searchPanel) return false;
  searchPanel.hidden = true;
  searchPanel.setAttribute('aria-hidden', 'true');
  return true;
}

function ensureSearchPanel() {
  if (searchPanel?.isConnected) return searchPanel;
  searchPanel = document.getElementById(SEARCH_PANEL_ID) || document.createElement('div');
  searchPanel.id = SEARCH_PANEL_ID;
  searchPanel.className = 'final-component-search-panel';
  searchPanel.setAttribute('role', 'dialog');
  searchPanel.setAttribute('aria-label', 'Component Search');
  searchPanel.innerHTML = '<div class="final-search-head"><strong>Search / Jump</strong><button type="button" data-search-close>×</button></div><input type="search" placeholder="ID, node, line, tag, type..." autocomplete="off" /><div class="final-search-results"></div>';
  (document.getElementById('viewer') || document.body).appendChild(searchPanel);
  searchPanel.querySelector('[data-search-close]')?.addEventListener('click', closeSearchPanel);
  searchPanel.querySelector('input')?.addEventListener('input', (event) => querySearch(event.target.value));
  searchPanel.querySelector('input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = searchPanel.querySelector('[data-result-id]');
      if (first) focusSearchResult(first.dataset.resultId);
    }
  });
  return searchPanel;
}

function querySearch(query = '') {
  const q = String(query || '').trim().toLowerCase();
  const all = indexComponents();
  const result = q ? all.filter((item) => item.haystack.includes(q)).slice(0, 50) : all.slice(0, 30);
  renderSearchResults(result);
  return result;
}

function renderSearchResults(results) {
  ensureSearchPanel();
  searchResults = results;
  const host = searchPanel.querySelector('.final-search-results');
  host.innerHTML = '';
  if (!results.length) {
    host.innerHTML = '<div class="final-search-empty">No matching component.</div>';
    return;
  }
  results.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.resultId = item.id;
    button.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.meta)}</span>`;
    button.addEventListener('click', () => focusSearchResult(item.id));
    host.appendChild(button);
  });
}

function focusSearchResult(id) {
  const item = searchResults.find((result) => result.id === id) || indexComponents().find((result) => result.id === id);
  if (!item?.object) return false;
  selectObject(item.object, { source: 'component-search' });
  focusCameraOnObject(item.object);
  closeSearchPanel();
  setStatus(`Jumped to ${item.label}`);
  return true;
}

function indexComponents() {
  return selectableComponents().map((object, index) => {
    const data = object.userData || {};
    const values = [objectId(object), object.name, object.type, ...Object.values(data).map((v) => String(v ?? ''))].filter(Boolean);
    const id = object.uuid || `component-${index}`;
    return {
      id,
      object,
      label: objectId(object) || object.name || `Component ${index + 1}`,
      meta: [data.componentType || data.componentClass || data.TYPE || object.type, data.LINE_NO || data.lineNo, data.TAG || data.SUPPORT_TAG].filter(Boolean).join(' · ') || object.type || 'component',
      haystack: values.join(' ').toLowerCase()
    };
  });
}

function applySectionBox(source = 'section-final') {
  const rt = runtime();
  const selected = selectedComponent();
  const renderer = rt?.renderer;
  if (!selected) {
    setStatus('Select a component before Section Box');
    return false;
  }
  const box = bounds(selected);
  if (!box) {
    setStatus('Section Box failed: selected component has no bounds');
    return false;
  }
  const pad = sectionPadding(box);
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
  if (renderer) {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = planes;
  }
  if (rt) {
    rt.clippingPlanes = planes;
    rt.clippingMode = 'box';
  }
  setStatus(`Section Box: ${objectId(selected) || 'selected component'}`);
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action: 'apply', version: VERSION, source, selectedId: objectId(selected), planeCount: planes.length } }));
  requestRender('section-final');
  return true;
}

function clearSectionBox(source = 'section-clear-final') {
  const rt = runtime();
  rt?.clearClipping?.({ source });
  if (rt?.renderer) {
    rt.renderer.localClippingEnabled = false;
    rt.renderer.clippingPlanes = [];
  }
  requestRender('section-clear-final');
  setStatus('Section Box cleared');
  return true;
}

function isolateSelected(source = 'isolate-final') {
  const root = modelRoot();
  const selected = selectedComponent();
  if (!root || !selected) {
    setStatus('Select a component to isolate');
    return false;
  }
  const components = ensureComponentListContains(selectableComponents(), selected);
  components.forEach((object) => {
    object.visible = object === selected || isAncestorOrDescendant(object, selected);
  });
  revealAncestors(selected, root);
  selected.traverse?.((child) => { child.visible = true; });
  requestRender('isolate-final');
  setStatus(`Isolated ${objectId(selected) || 'selected component'}`);
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'isolate', version: VERSION, source, selectedId: objectId(selected), componentCount: components.length } }));
  return true;
}

function hideSelected(source = 'hide-final') {
  const root = modelRoot();
  const selected = selectedComponent();
  if (!root || !selected) {
    setStatus('Select a component to hide');
    return false;
  }
  if (selected === root || selected.parent?.type === 'Scene') {
    setStatus('Hide skipped: selection is the full model, select a component/part');
    return false;
  }
  selected.visible = false;
  requestRender('hide-final');
  setStatus(`Hidden ${objectId(selected) || 'selected component'}`);
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'hide', version: VERSION, source, selectedId: objectId(selected) } }));
  return true;
}

function showAll(source = 'show-all-final') {
  const root = modelRoot();
  if (!root) {
    setStatus('No model loaded');
    return false;
  }
  root.traverse?.((object) => { object.visible = true; });
  requestRender('show-all-final');
  setStatus('All components shown');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'showAll', version: VERSION, source } }));
  return true;
}

function applyExplode(mode = 'type', source = 'explode-final') {
  const root = modelRoot();
  if (!root) {
    setStatus('Explode unavailable: no model loaded');
    return false;
  }
  resetExplode('explode-before-final', true);
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
  requestRender('explode-final');
  setStatus(`Exploded ${components.length} component(s) into ${groups.length} group(s)`);
  window.dispatchEvent(new CustomEvent('viewer:explode-review', { detail: { action: 'apply', version: VERSION, source, mode, axis: 'X', distance, groups: groups.map((g) => ({ key: g.key, count: g.objects.length })) } }));
  return true;
}

function resetExplode(source = 'explode-reset-final', silent = false) {
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
  if (!count && silent) return false;
  requestRender('explode-reset-final');
  if (!silent || count) setStatus(count ? `Explode reset: ${count} component(s)` : 'Explode reset');
  window.dispatchEvent(new CustomEvent('viewer:explode-review', { detail: { action: 'reset', version: VERSION, source, resetCount: count } }));
  return count > 0;
}

function activateMeasure() {
  measureActive = true;
  attachCanvas();
  ensureMeasurePanel().hidden = false;
  document.body.classList.add('measure-polyline-active');
  setPressed('measurePolyline', true);
  renderMeasurePanel();
  setStatus('Measure Polyline: click points; Enter/Esc to finish');
  return true;
}

function finishMeasure() {
  measureActive = false;
  document.body.classList.remove('measure-polyline-active');
  setPressed('measurePolyline', false);
  renderMeasurePanel();
  setStatus(measurePoints.length > 1 ? `Measurement total: ${formatLength(totalLength(measurePoints))}` : 'Measure Polyline off');
  return true;
}

function clearMeasure() {
  measurePoints = [];
  clearMeasureHelpers();
  renderMeasurePanel();
  requestRender('measure-clear-final');
  return true;
}

function undoMeasure() {
  if (!measurePoints.length) return false;
  measurePoints = measurePoints.slice(0, -1);
  rebuildMeasureHelpers();
  renderMeasurePanel();
  requestRender('measure-undo-final');
  return true;
}

function onMeasurePointerDown(event) {
  if (event.button !== 0) return;
  stop(event);
  const point = pickWorldPoint(event);
  if (!point) {
    setStatus('Measure: no point found');
    return;
  }
  measurePoints.push(point);
  rebuildMeasureHelpers();
  renderMeasurePanel();
  requestRender('measure-point-final');
}

function onDoubleClick(event) {
  if (!measureActive) return;
  stop(event);
  finishMeasure();
}

function ensureMeasurePanel() {
  if (measurePanel?.isConnected) return measurePanel;
  measurePanel = document.getElementById('staticMeasurePolylinePanel') || document.createElement('div');
  measurePanel.id = 'staticMeasurePolylinePanel';
  measurePanel.className = 'measure-polyline-panel final-measure-panel';
  (document.getElementById('viewer') || document.body).appendChild(measurePanel);
  return measurePanel;
}

function renderMeasurePanel() {
  const panel = ensureMeasurePanel();
  const segments = segmentLengths(measurePoints);
  panel.innerHTML = `<div class="measure-polyline-panel__header"><strong>Measure</strong><span>polyline length</span></div><div class="measure-polyline-panel__stats"><div><span>Points</span><strong>${measurePoints.length}</strong></div><div><span>Segments</span><strong>${segments.length}</strong></div><div><span>Total</span><strong>${formatLength(totalLength(measurePoints))}</strong></div></div><div class="measure-polyline-panel__segments">${segments.length ? segments.map((value, index) => `<div class="measure-polyline-panel__segment"><span>S${index + 1}</span><strong>${formatLength(value)}</strong></div>`).join('') : `<div class="measure-polyline-panel__empty">${measureActive ? 'Click model points to start measuring.' : 'Click Polyline to start measuring.'}</div>`}</div><div class="measure-polyline-panel__actions"><button type="button" data-measure-action="undo">Undo</button><button type="button" data-measure-action="clear">Clear</button><button type="button" data-measure-action="finish">${measureActive ? 'Finish' : 'Start'}</button></div>`;
  panel.hidden = !measureActive && measurePoints.length === 0;
  panel.querySelector('[data-measure-action="undo"]')?.addEventListener('click', undoMeasure);
  panel.querySelector('[data-measure-action="clear"]')?.addEventListener('click', clearMeasure);
  panel.querySelector('[data-measure-action="finish"]')?.addEventListener('click', () => measureActive ? finishMeasure() : activateMeasure());
}

function rebuildMeasureHelpers() {
  clearMeasureHelpers();
  const group = ensureMeasureGroup();
  if (!group) return;
  if (measurePoints.length > 1) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(measurePoints), new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false }));
    line.name = 'MEASURE_POLYLINE_LINE_FINAL';
    line.renderOrder = 9998;
    line.userData = { helper: true, measurePolylineHelper: true, source: VERSION };
    group.add(line);
  }
  measurePoints.forEach((point, index) => {
    const geom = new THREE.BufferGeometry().setFromPoints([point]);
    const mat = new THREE.PointsMaterial({ color: 0xffd166, size: 9, sizeAttenuation: false, depthTest: false });
    const marker = new THREE.Points(geom, mat);
    marker.name = `MEASURE_POINT_FINAL_${index + 1}`;
    marker.renderOrder = 9999;
    marker.userData = { helper: true, measurePolylineHelper: true, pixelMarker: true, source: VERSION };
    group.add(marker);
  });
}

function ensureMeasureGroup() {
  if (measureGroup?.isConnected) return measureGroup;
  const scene = runtime()?.scene || modelRoot()?.parent || modelRoot();
  if (!scene?.add) return null;
  measureGroup = new THREE.Group();
  measureGroup.name = MEASURE_GROUP;
  measureGroup.userData = { helper: true, measurePolylineHelper: true, source: VERSION };
  scene.add(measureGroup);
  return measureGroup;
}

function clearMeasureHelpers() {
  if (!measureGroup) return;
  while (measureGroup.children.length) {
    const child = measureGroup.children.pop();
    child.parent?.remove?.(child);
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
}

function removeLegacyMeasureHelpers() {
  const root = runtime()?.scene || modelRoot()?.parent || modelRoot();
  if (!root?.traverse) return;
  const remove = [];
  root.traverse((object) => {
    if (/^MEASURE_POINT_(?!FINAL_)/i.test(object.name || '') || object.name === '__MEASURE_POLYLINE_HELPERS__') remove.push(object);
  });
  remove.forEach((object) => {
    object.parent?.remove?.(object);
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
  });
}

function selectableComponents() {
  const root = modelRoot();
  if (!root?.traverse) return [];
  const strong = [];
  root.traverse((object) => {
    if (!object || object === root || isHelper(object)) return;
    if (!hasStrongComponentData(object)) return;
    if (hasStrongAncestor(object, root)) return;
    strong.push(object);
  });
  if (strong.length >= 2) return strong;
  const renderables = [];
  root.traverse((object) => {
    if (!object || object === root || isHelper(object)) return;
    if ((object.isMesh || object.isLine || object.isPoints) && isRenderableObject(object)) renderables.push(object);
  });
  return renderables.length ? renderables : strong;
}

function selectedComponent() {
  const root = modelRoot();
  let object = selectedObject();
  if (!root) return null;
  if (!object && areaSelected.length === 1) object = areaSelected[0];
  if (!object || object === root || object.isScene || isHelper(object)) return null;
  let cursor = object;
  while (cursor && cursor !== root && cursor.type !== 'Scene') {
    if (hasStrongComponentData(cursor)) return cursor;
    cursor = cursor.parent;
  }
  if (object === root || object.parent?.type === 'Scene') return nearestRenderableDescendant(object) || null;
  return object;
}

function selectedObject() {
  const rt = runtime();
  return rt?.getSelectedObject?.()
    || window.__3D_MARKUP_SELECTED_OBJECT__
    || rt?.selectedObject
    || rt?.selectedMesh
    || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject
    || window.__3D_MARKUP_TREE__?.state?.selectedObject
    || null;
}

function hasStrongComponentData(object) {
  const data = object?.userData || {};
  return Boolean(data.componentId || data.COMPONENT_ID || data.componentClass || data.componentType || data.ID || data.id || data.TAG || data.SUPPORT_TAG || data.TYPE === 'COMPONENT' || data.meshRole || data.fromNode || data.toNode || data.LINE_NO || data.lineNo || data.rawType || data.visualKey);
}

function hasStrongAncestor(object, root) {
  let cursor = object.parent;
  while (cursor && cursor !== root && cursor.type !== 'Scene') {
    if (hasStrongComponentData(cursor)) return true;
    cursor = cursor.parent;
  }
  return false;
}

function nearestRenderableDescendant(object) {
  let found = null;
  object?.traverse?.((child) => {
    if (!found && child !== object && isRenderableObject(child) && !isHelper(child)) found = child;
  });
  return found;
}

function isRenderableObject(object) {
  return Boolean(object?.isMesh || object?.isLine || object?.isPoints);
}

function ensureComponentListContains(list, selected) {
  if (!selected) return list;
  return list.some((object) => object === selected) ? list : list.concat(selected);
}

function isHelper(object) {
  const data = object?.userData || {};
  const name = String(object?.name || '');
  return Boolean(data.helper || data.measurePolylineHelper || data.areaSelectHelper || data.sectionBoxHelper || data.isDisplayHelper)
    || /^(inputxml|__|FINAL_AREA_SELECT_|AREA_SELECT_|MEASURE_|ComponentSearchHighlight|MODEL_TREE_SELECTION)/i.test(name);
}

function isEffectivelyVisible(object) {
  let cursor = object;
  while (cursor) {
    if (cursor.visible === false) return false;
    cursor = cursor.parent;
  }
  return true;
}

function isAncestorOrDescendant(a, b) {
  if (a === b) return true;
  let cursor = b.parent;
  while (cursor) { if (cursor === a) return true; cursor = cursor.parent; }
  cursor = a.parent;
  while (cursor) { if (cursor === b) return true; cursor = cursor.parent; }
  return false;
}

function revealAncestors(object, stopAt) {
  let cursor = object;
  while (cursor) {
    cursor.visible = true;
    if (cursor === stopAt) break;
    cursor = cursor.parent;
  }
}

function groupComponents(objects, mode) {
  const map = new Map();
  objects.forEach((object) => {
    const data = object.userData || {};
    const key = cleanKey(mode === 'line'
      ? (data.LINE_NO || data.lineNo || data.lineNumber || 'UNASSIGNED_LINE')
      : (data.componentType || data.componentClass || data.rawType || data.TYPE || object.type || 'UNKNOWN_TYPE'));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(object);
  });
  return Array.from(map.entries()).map(([key, objectsInGroup]) => ({ key, objects: objectsInGroup }));
}

function cleanKey(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9_.-]+/g, '_') || 'UNASSIGNED';
}

function moveByWorldOffset(object, worldOffset) {
  if (!object.userData) object.userData = {};
  if (!Array.isArray(object.userData[EXPLODE_ORIGINAL_KEY])) object.userData[EXPLODE_ORIGINAL_KEY] = [object.position.x, object.position.y, object.position.z];
  const original = new THREE.Vector3().fromArray(object.userData[EXPLODE_ORIGINAL_KEY]);
  if (object.parent) {
    const targetWorld = object.parent.localToWorld(original.clone()).add(worldOffset);
    object.position.copy(object.parent.worldToLocal(targetWorld));
  } else {
    object.position.copy(original.add(worldOffset));
  }
}

function explodeDistance(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (!validBox(box)) return 100;
  const size = box.getSize(new THREE.Vector3());
  return Math.max(Math.max(size.x, size.y, size.z, 1) * 0.18, 0.05);
}

function focusCameraOnObject(object) {
  const rt = runtime();
  const camera = rt?.camera;
  const controls = rt?.controls;
  const box = bounds(object);
  if (!camera || !box) return false;
  const center = box.getCenter(new THREE.Vector3());
  const size = Math.max(box.getSize(new THREE.Vector3()).length(), 1);
  const direction = camera.position.clone().sub(controls?.target || center).normalize();
  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 1e-8) direction.set(1, 1, 1).normalize();
  camera.position.copy(center.clone().add(direction.multiplyScalar(size * 1.8)));
  if (controls?.target) controls.target.copy(center);
  controls?.update?.();
  camera.updateProjectionMatrix?.();
  requestRender('component-search-focus-final');
  return true;
}

function pickWorldPoint(event) {
  const rt = runtime();
  const camera = rt?.camera;
  const canvas = runtimeCanvas();
  if (!camera || !canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const candidates = [];
  modelRoot()?.traverse?.((object) => { if (!isHelper(object) && isRenderableObject(object)) candidates.push(object); });
  const hit = raycaster.intersectObjects(candidates, false).find((item) => item.point);
  if (hit?.point) return hit.point.clone();
  const target = rt?.controls?.target?.clone?.() || new THREE.Vector3();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(), target);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function projectedRect(object, camera, viewport) {
  const box = bounds(object);
  if (!box) return null;
  const points = boxCorners(box).concat([box.getCenter(new THREE.Vector3())]);
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity; let any = false;
  points.forEach((point) => {
    const p = point.project(camera);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.z < -1 || p.z > 1) return;
    const x = viewport.left + ((p.x + 1) / 2) * viewport.width;
    const y = viewport.top + ((1 - p.y) / 2) * viewport.height;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); any = true;
  });
  return any ? { left, top, right, bottom } : null;
}

function bounds(object) {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return validBox(box) ? box : null;
}

function sectionPadding(box) {
  const size = box.getSize(new THREE.Vector3());
  return Math.max(Math.max(size.x, size.y, size.z) * 0.08, 0.001);
}

function boxCorners(box) {
  const { min, max } = box;
  return [new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(min.x, min.y, max.z), new THREE.Vector3(min.x, max.y, min.z), new THREE.Vector3(min.x, max.y, max.z), new THREE.Vector3(max.x, min.y, min.z), new THREE.Vector3(max.x, min.y, max.z), new THREE.Vector3(max.x, max.y, min.z), new THREE.Vector3(max.x, max.y, max.z)];
}

function normalizeRect(x1, y1, x2, y2) {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
}

function clampRect(rect, viewport) {
  return { left: clamp(rect.left, viewport.left, viewport.right), top: clamp(rect.top, viewport.top, viewport.bottom), right: clamp(rect.right, viewport.left, viewport.right), bottom: clamp(rect.bottom, viewport.top, viewport.bottom) };
}

function rectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function segmentLengths(points) {
  const out = [];
  for (let i = 1; i < points.length; i += 1) out.push(points[i - 1].distanceTo(points[i]));
  return out;
}

function totalLength(points) {
  return segmentLengths(points).reduce((sum, value) => sum + value, 0);
}

function formatLength(value) {
  if (!Number.isFinite(value)) return '—';
  return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(3)} m` : `${value.toFixed(1)} mm`;
}

function vectorToArray(v) {
  return [Number(v.x), Number(v.y), Number(v.z)];
}

function objectId(object) {
  const data = object?.userData || {};
  return String(data.ID || data.id || data.componentId || data.COMPONENT_ID || data.TAG || data.SUPPORT_TAG || data.NAME || data.name || object?.name || object?.uuid || '').trim();
}

function selectObject(object, data = {}) {
  const rt = runtime();
  if (typeof rt?.selectObject === 'function') return rt.selectObject(object, data, { source: VERSION });
  window.__3D_MARKUP_SELECTED_OBJECT__ = object;
  window.__3D_MARKUP_SELECTED_DATA__ = data;
  window.dispatchEvent(new CustomEvent('markup:selected-object-changed', { detail: { object, data, source: VERSION } }));
  return true;
}

function modelRoot() {
  const rt = runtime();
  return rt?.modelRoot || rt?.getModelRoot?.() || null;
}

function runtime() {
  const rt = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
  return rt?.refresh?.() || rt;
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function requestRender(reason) {
  const rt = runtime();
  rt?.renderOnce?.(reason);
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { reason } }));
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('runtimeStatus') || document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (status && message) status.textContent = message;
}

function setPressed(key, active) {
  document.querySelectorAll(`[data-review-tool="${key}"], [data-review-menu-tool="${key}"], [data-view="${key}"]`).forEach((button) => {
    button.classList.toggle('tool-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function closeMenus() {
  document.getElementById('staticReviewContextMenu')?.setAttribute('hidden', '');
  document.querySelectorAll('.review-top-menu-popover, .top-menu-popover').forEach((panel) => { panel.hidden = true; });
  document.querySelectorAll('[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function iconNode(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = kind === 'file'
    ? '<path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14 3v6h5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
    : '<path d="M5 7l7-4 7 4v10l-7 4-7-4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 7l7 4 7-4M12 11v10" fill="none" stroke="currentColor" stroke-width="1.8"/>';
  return svg;
}

function textNode(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function validBox(box) {
  return Boolean(box) && Number.isFinite(box.min?.x) && Number.isFinite(box.min?.y) && Number.isFinite(box.min?.z) && Number.isFinite(box.max?.x) && Number.isFinite(box.max?.y) && Number.isFinite(box.max?.z) && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
    #previewGlbBtn, #previewRvmBtn, [aria-label="Preview mode"].preview-mode-hidden-original { display: none !important; }
    .final-mode-alias svg { width: 20px !important; height: 20px !important; }
    .input-drawer { display: block !important; visibility: visible !important; }
    #closeInputBtn { display: none !important; }
    #inputDrawer .panel-section:first-of-type { position: sticky; top: 0; z-index: 35; background: linear-gradient(180deg, rgba(10,26,47,.98), rgba(6,18,34,.96)); padding-bottom: 12px; border-bottom: 1px solid rgba(83,125,176,.28); }
    #${FILE_STATUS_ID}.input-file-status { min-height: 28px; display: flex; align-items: center; padding: 6px 10px; margin: 0 0 8px; border: 1px solid rgba(83,125,176,.34); border-radius: 8px; background: rgba(7,20,39,.84); color: #dcecff; font-size: 12px; font-weight: 800; }
    .final-area-select-rect { position: absolute; z-index: 80; pointer-events: none; border: 1px dashed #37d8ff; background: rgba(55,216,255,.11); box-shadow: 0 0 0 1px rgba(7,20,39,.74); }
    .final-component-search-panel { position: absolute; right: 78px; top: 94px; z-index: 135; width: min(360px, calc(100% - 110px)); max-height: min(460px, calc(100% - 126px)); overflow: auto; padding: 10px; border: 1px solid rgba(125,168,224,.46); border-radius: 12px; background: rgba(8,14,27,.97); color: #eaf4ff; box-shadow: 0 22px 54px rgba(0,0,0,.45); }
    .final-component-search-panel[hidden] { display: none !important; }
    .final-search-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .final-search-head button { min-width: 30px; width: 30px; min-height: 30px; height: 30px; padding: 0; }
    .final-component-search-panel input { width: 100%; margin-bottom: 8px; }
    .final-search-results { display: grid; gap: 5px; }
    .final-search-results button { width: 100%; display: grid; grid-template-columns: 1fr; text-align: left; gap: 3px; padding: 7px 9px; }
    .final-search-results button span, .final-search-empty { color: #9fb3cc; font-size: 11px; }
    .final-measure-panel { right: 76px !important; }
  `;
  document.head.appendChild(style);
}

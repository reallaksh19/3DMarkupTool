import * as THREE from 'three';

// Corrective ribbon usability pass.
// Fixes dropdown clipping/duplication, moves GLB/RVM preview into View/Fit,
// adds View/Fit collapse, keeps Input controls sticky, and replaces fragile
// Box / Area Select / Measure runtime hooks with robust implementations.

const VERSION = 'ribbon-usability-fixes-20260619';
const STYLE_ID = 'staticRibbonUsabilityFixesStyle';
const VIEW_EXPANDED_KEY = '3dmarkup.viewFitExpanded.v1';
const AREA_HELPER_PREFIX = 'AREA_SELECT_';
const MEASURE_GROUP_NAME = '__MEASURE_POLYLINE_HELPERS__';
const SECTION_BOX_SOURCE = 'ribbon-usability-section-box';

let areaActive = false;
let areaDrag = null;
let areaOverlay = null;
let areaSelected = [];
let areaHelpers = [];
let measureActive = false;
let measurePoints = [];
let measureGroup = null;
let measurePanel = null;
let attachedAreaCanvas = null;
let attachedMeasureCanvas = null;
let patchCount = 0;

runWhenReady(initRibbonUsabilityFixes);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initRibbonUsabilityFixes() {
  injectStyles();
  installApis();
  refreshLayout();
  attachCanvasListeners();
  ['markup:app-ready', 'viewer:model-loaded', 'viewer:selection-changed', 'viewer:ui-controls-changed']
    .forEach((name) => window.addEventListener(name, () => window.setTimeout(refreshAll, 0)));
  window.addEventListener('resize', refreshLayout);
  window.setInterval(refreshAll, 700);
  window.__3D_MARKUP_RIBBON_USABILITY_FIXES__ = {
    version: VERSION,
    refresh: refreshAll,
    checklist: () => ({
      version: VERSION,
      topReviewMenuRemoved: !document.getElementById('topReviewMenu'),
      previewButtonsInViewFit: previewButtonsInViewFit(),
      viewFitHasExpander: Boolean(document.getElementById('viewFitCollapseToggleBtn')),
      inputFirstSectionSticky: true,
      areaApiPatched: window.__3D_MARKUP_AREA_SELECT__?.version === VERSION,
      sectionBoxApiPatched: window.__3D_MARKUP_SECTION_BOX__?.version === VERSION,
      measureApiPatched: window.__3D_MARKUP_MEASURE_POLYLINE__?.version === VERSION
    })
  };
}

function refreshAll() {
  refreshLayout();
  attachCanvasListeners();
  removeTopReviewMenu();
  patchCount += 1;
}

function refreshLayout() {
  removeTopReviewMenu();
  movePreviewButtonsToViewFit();
  ensureViewFitCollapse();
  normalizeExportMenu();
  ensureInputOpen();
}

function removeTopReviewMenu() {
  document.getElementById('topReviewMenu')?.remove?.();
}

function movePreviewButtonsToViewFit() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  if (!viewGroup) return false;
  viewGroup.dataset.expandedLabel = 'View / Fit / Mode';

  const fitSel = document.getElementById('fitSelectionBtn');
  const previewGlb = document.getElementById('previewGlbBtn');
  const previewRvm = document.getElementById('previewRvmBtn');
  [previewGlb, previewRvm].forEach((button) => {
    if (!button) return;
    button.classList.add('view-fit-preview-mode');
    button.dataset.viewFitPreview = '1';
    if (button.parentElement !== viewGroup) {
      if (button === previewGlb && fitSel?.parentElement === viewGroup) fitSel.after(button);
      else if (button === previewRvm && previewGlb?.parentElement === viewGroup) previewGlb.after(button);
      else viewGroup.appendChild(button);
    }
  });

  document.querySelectorAll('[aria-label="Preview mode"]').forEach((group) => {
    if (!group.querySelector('button')) group.remove();
  });

  return previewButtonsInViewFit();
}

function previewButtonsInViewFit() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  return Boolean(viewGroup && document.getElementById('previewGlbBtn')?.parentElement === viewGroup && document.getElementById('previewRvmBtn')?.parentElement === viewGroup);
}

function ensureViewFitCollapse() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  if (!viewGroup) return;
  viewGroup.classList.add('view-fit-collapsible');

  const expanded = localStorage.getItem(VIEW_EXPANDED_KEY) === '1';
  viewGroup.classList.toggle('view-fit-expanded', expanded);
  viewGroup.classList.toggle('view-fit-collapsed', !expanded);

  const extraIds = ['viewTopBtn', 'viewFrontBtn', 'viewSideBtn', 'fitSelectionBtn'];
  extraIds.forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.dataset.viewCollapseExtra = '1';
  });

  let toggle = document.getElementById('viewFitCollapseToggleBtn');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'viewFitCollapseToggleBtn';
    toggle.type = 'button';
    toggle.className = 'tool-btn view-fit-collapse-toggle';
    toggle.title = 'Expand / collapse View-Fit tools';
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextExpanded = !viewGroup.classList.contains('view-fit-expanded');
      localStorage.setItem(VIEW_EXPANDED_KEY, nextExpanded ? '1' : '0');
      ensureViewFitCollapse();
    });
    viewGroup.appendChild(toggle);
  }

  toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  toggle.replaceChildren(iconGlyph(expanded ? 'collapse' : 'expand'), textNode(expanded ? '<<' : '>>'));
  viewGroup.appendChild(toggle);
}

function normalizeExportMenu() {
  const exp = document.getElementById('topExportMenu');
  if (!exp) return;
  exp.classList.add('top-export-menu-fixed');
  const pop = exp.querySelector('.top-menu-popover');
  if (pop) {
    pop.style.maxHeight = 'min(420px, calc(100vh - 88px))';
    pop.style.overflow = 'auto';
  }
}

function ensureInputOpen() {
  document.body.classList.add('input-open');
  document.getElementById('toggleInputBtn')?.classList.add('active');
}

function installApis() {
  installAreaSelectApi();
  installSectionBoxApi();
  installMeasureApi();
  patchComponentSearchApi();
}

function installAreaSelectApi() {
  window.__3D_MARKUP_AREA_SELECT__ = {
    version: VERSION,
    activate: activateAreaSelect,
    deactivate: deactivateAreaSelect,
    clear: clearAreaSelection,
    isActive: () => areaActive,
    selectedIds: () => areaSelected.map(objectId).filter(Boolean),
    selectInClientRect,
    debug: () => ({ version: VERSION, active: areaActive, selectedCount: areaSelected.length, helperCount: areaHelpers.length, canvasAttached: Boolean(attachedAreaCanvas) })
  };
}

function activateAreaSelect() {
  areaActive = true;
  attachCanvasListeners();
  document.body.classList.add('area-select-active');
  setPressed('areaSelect', true);
  setStatus('Area Select: drag a window over components');
  dispatchArea('activate');
  return true;
}

function deactivateAreaSelect(message = 'Area Select off') {
  areaActive = false;
  areaDrag = null;
  removeAreaOverlay();
  document.body.classList.remove('area-select-active');
  setPressed('areaSelect', false);
  if (message) setStatus(message);
  dispatchArea('deactivate');
  return true;
}

function attachCanvasListeners() {
  const canvas = runtimeCanvas();
  if (canvas && canvas !== attachedAreaCanvas) {
    if (attachedAreaCanvas) {
      attachedAreaCanvas.removeEventListener('pointerdown', onAreaPointerDown, true);
      attachedAreaCanvas.removeEventListener('pointermove', onAreaPointerMove, true);
      attachedAreaCanvas.removeEventListener('pointerup', onAreaPointerUp, true);
      attachedAreaCanvas.removeEventListener('pointercancel', onAreaPointerCancel, true);
    }
    attachedAreaCanvas = canvas;
    canvas.addEventListener('pointerdown', onAreaPointerDown, true);
    canvas.addEventListener('pointermove', onAreaPointerMove, true);
    canvas.addEventListener('pointerup', onAreaPointerUp, true);
    canvas.addEventListener('pointercancel', onAreaPointerCancel, true);
  }

  if (canvas && canvas !== attachedMeasureCanvas) {
    if (attachedMeasureCanvas) {
      attachedMeasureCanvas.removeEventListener('pointerdown', onMeasurePointerDown, true);
      attachedMeasureCanvas.removeEventListener('dblclick', onMeasureDoubleClick, true);
    }
    attachedMeasureCanvas = canvas;
    canvas.addEventListener('pointerdown', onMeasurePointerDown, true);
    canvas.addEventListener('dblclick', onMeasureDoubleClick, true);
  }
}

function onAreaPointerDown(event) {
  if (!areaActive || event.button !== 0) return;
  const rt = runtime();
  if (!rt?.camera || !modelRoot(rt)) {
    deactivateAreaSelect('Area Select unavailable: model/camera not ready');
    return;
  }
  stopCanvasEvent(event);
  areaDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY };
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  createAreaOverlay();
}

function onAreaPointerMove(event) {
  if (!areaActive || !areaDrag) return;
  stopCanvasEvent(event);
  areaDrag.currentX = event.clientX;
  areaDrag.currentY = event.clientY;
  updateAreaOverlay();
}

function onAreaPointerUp(event) {
  if (!areaActive || !areaDrag) return;
  stopCanvasEvent(event);
  const rect = normalizedClientRect(areaDrag.startX, areaDrag.startY, event.clientX, event.clientY);
  event.currentTarget?.releasePointerCapture?.(areaDrag.pointerId);
  areaDrag = null;
  removeAreaOverlay();
  if ((rect.right - rect.left) < 8 || (rect.bottom - rect.top) < 8) {
    deactivateAreaSelect('Area Select canceled');
    return;
  }
  const selected = selectInClientRect(rect, { source: 'ribbon-area-select' });
  deactivateAreaSelect(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
}

function onAreaPointerCancel(event) {
  if (!areaActive) return;
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
  deactivateAreaSelect('Area Select canceled');
}

function selectInClientRect(clientRect, { source = 'area-select' } = {}) {
  const rt = runtime();
  const root = modelRoot(rt);
  const camera = rt?.camera;
  const viewer = document.getElementById('viewer');
  if (!root || !camera || !viewer) return [];
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRectToViewport(clientRect, viewport);
  const selected = [];
  for (const candidate of collectComponentRoots(root)) {
    if (!isEffectivelyVisible(candidate)) continue;
    const projected = projectedObjectRect(candidate, camera, viewport);
    if (projected && rectsIntersect(rect, projected)) selected.push(candidate);
  }
  applyAreaSelection(selected, rt);
  setStatus(`Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
  dispatchArea('select', { source, selectedCount: selected.length, selectedIds: selected.map(objectId).filter(Boolean) });
  return selected;
}

function applyAreaSelection(selected, rt = runtime()) {
  clearAreaSelection({ silent: true });
  areaSelected = selected.slice();
  const scene = rt?.scene || modelRoot(rt)?.parent;
  for (const object of areaSelected) {
    const helper = new THREE.BoxHelper(object, 0x37d8ff);
    helper.name = `${AREA_HELPER_PREFIX}${objectId(object) || object.uuid || 'OBJECT'}`;
    helper.userData = { areaSelectHelper: true, helper: true, TYPE: 'AREA_SELECT_HELPER', selectedId: objectId(object), source: VERSION };
    helper.renderOrder = 9996;
    scene?.add?.(helper);
    areaHelpers.push(helper);
  }
  requestRender('ribbon-area-select');
}

function clearAreaSelection({ source = 'area-select-clear', silent = false } = {}) {
  areaHelpers.forEach((helper) => {
    helper.parent?.remove?.(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  });
  areaHelpers = [];
  areaSelected = [];
  requestRender('ribbon-area-select-clear');
  if (!silent) {
    setStatus('Area selection cleared');
    dispatchArea('clear', { source });
  }
  return true;
}

function createAreaOverlay() {
  removeAreaOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  areaOverlay = document.createElement('div');
  areaOverlay.className = 'ribbon-area-select-rect';
  viewer.appendChild(areaOverlay);
  updateAreaOverlay();
}

function updateAreaOverlay() {
  if (!areaOverlay || !areaDrag) return;
  const viewer = document.getElementById('viewer');
  const viewport = viewer?.getBoundingClientRect?.();
  if (!viewport) return;
  const rect = clampRectToViewport(normalizedClientRect(areaDrag.startX, areaDrag.startY, areaDrag.currentX, areaDrag.currentY), viewport);
  areaOverlay.style.left = `${rect.left - viewport.left}px`;
  areaOverlay.style.top = `${rect.top - viewport.top}px`;
  areaOverlay.style.width = `${Math.max(rect.right - rect.left, 1)}px`;
  areaOverlay.style.height = `${Math.max(rect.bottom - rect.top, 1)}px`;
}

function removeAreaOverlay() {
  areaOverlay?.remove?.();
  areaOverlay = null;
}

function patchComponentSearchApi() {
  const existing = window.__3D_MARKUP_COMPONENT_SEARCH__;
  if (!existing || existing.__ribbonUsabilityWrapped === VERSION) return;
  const open = existing.open?.bind(existing);
  const close = existing.close?.bind(existing);
  existing.open = () => {
    const result = typeof open === 'function' ? open() : false;
    const panel = document.getElementById('staticComponentSearchPanel');
    if (panel) {
      panel.hidden = false;
      panel.style.zIndex = '120';
      panel.querySelector('input')?.focus?.();
    }
    setStatus('Search / Jump opened');
    return result !== false;
  };
  existing.close = () => {
    const result = typeof close === 'function' ? close() : false;
    document.getElementById('staticComponentSearchPanel')?.setAttribute('hidden', '');
    return result !== false;
  };
  existing.__ribbonUsabilityWrapped = VERSION;
}

function installSectionBoxApi() {
  const previous = window.__3D_MARKUP_SECTION_BOX__ || {};
  window.__3D_MARKUP_SECTION_BOX__ = {
    ...previous,
    version: VERSION,
    apply: () => applySectionBoxFromSelection({ source: 'ribbon-section-box' }),
    clear: () => clearSectionBox({ source: 'ribbon-section-box-clear' }),
    debug: () => {
      const selected = selectedComponentRoot();
      const rt = runtime();
      return { version: VERSION, hasSelected: Boolean(selected), selectedId: objectId(selected), rendererReady: Boolean(rt?.renderer), clippingPlanes: rt?.renderer?.clippingPlanes?.length || 0 };
    }
  };
}

function applySectionBoxFromSelection({ source = 'section-box' } = {}) {
  const rt = runtime();
  const renderer = rt?.renderer;
  const selected = selectedComponentRoot();
  if (!selected) {
    setStatus('Select a component before Section Box');
    dispatchSectionBox('fail', { source, reason: 'missing-selection' });
    return false;
  }
  const box = boundsForObject(selected);
  if (!isValidBox(box)) {
    setStatus('Section Box failed: selected component has no valid bounds');
    dispatchSectionBox('fail', { source, reason: 'invalid-bounds', selectedId: objectId(selected) });
    return false;
  }
  const expanded = box.clone().expandByScalar(sectionPadding(box));
  const planes = planesForBox(expanded);
  const meta = { mode: 'box', source: SECTION_BOX_SOURCE, trigger: source, selectedId: objectId(selected), box: boxSummary(expanded) };
  if (typeof rt?.applyClipping === 'function') rt.applyClipping(planes, meta);
  if (renderer) {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = planes;
  }
  if (rt) {
    rt.clippingPlanes = planes;
    rt.clippingMode = 'box';
  }
  requestRender('ribbon-section-box');
  setStatus(`Section Box: ${meta.selectedId || 'selected component'}`);
  dispatchSectionBox('apply', { ...meta, rendererReady: Boolean(renderer), planeCount: planes.length });
  return true;
}

function clearSectionBox({ source = 'section-box-clear' } = {}) {
  const rt = runtime();
  const renderer = rt?.renderer;
  if (typeof rt?.clearClipping === 'function') rt.clearClipping({ source });
  if (renderer) {
    renderer.localClippingEnabled = false;
    renderer.clippingPlanes = [];
  }
  if (rt) {
    rt.clippingPlanes = [];
    rt.clippingMode = 'none';
  }
  requestRender('ribbon-section-box-clear');
  dispatchSectionBox('clear', { source });
  setStatus('Section Box cleared');
  return true;
}

function installMeasureApi() {
  window.__3D_MARKUP_MEASURE_POLYLINE__ = {
    version: VERSION,
    activate: activateMeasure,
    finish: finishMeasure,
    clear: clearMeasure,
    undo: undoMeasurePoint,
    isActive: () => measureActive,
    points: () => measurePoints.map(vectorToArray),
    segments: () => segmentLengths(measurePoints),
    total: () => totalLength(measurePoints),
    debug: () => ({ version: VERSION, active: measureActive, pointCount: measurePoints.length, markerRadius: pointMarkerRadius(), groupChildren: measureGroup?.children?.length || 0 })
  };
  window.addEventListener('keydown', onMeasureKeyDown, true);
}

function activateMeasure() {
  measureActive = true;
  attachCanvasListeners();
  ensureMeasurePanel().hidden = false;
  document.body.classList.add('measure-polyline-active');
  setPressed('measurePolyline', true);
  renderMeasurePanel();
  setStatus('Measure Polyline: click points, Enter/Esc to finish');
  dispatchMeasure('activate');
  return true;
}

function finishMeasure() {
  measureActive = false;
  document.body.classList.remove('measure-polyline-active');
  setPressed('measurePolyline', false);
  renderMeasurePanel();
  setStatus(measurePoints.length > 1 ? `Measurement total: ${formatLength(totalLength(measurePoints))}` : 'Measure Polyline off');
  dispatchMeasure('finish');
  return true;
}

function clearMeasure() {
  measurePoints = [];
  clearMeasureHelpers();
  renderMeasurePanel();
  requestRender('ribbon-measure-clear');
  dispatchMeasure('clear');
  return true;
}

function undoMeasurePoint() {
  if (!measurePoints.length) return false;
  measurePoints = measurePoints.slice(0, -1);
  rebuildMeasureHelpers();
  renderMeasurePanel();
  requestRender('ribbon-measure-undo');
  dispatchMeasure('undo');
  return true;
}

function onMeasurePointerDown(event) {
  if (!measureActive || event.button !== 0) return;
  stopCanvasEvent(event);
  const point = pickWorldPoint(event);
  if (!point) {
    setStatus('Measure: no point found');
    return;
  }
  measurePoints = measurePoints.concat([point]);
  rebuildMeasureHelpers();
  renderMeasurePanel();
  setStatus(`Measurement total: ${formatLength(totalLength(measurePoints))}`);
  requestRender('ribbon-measure-point');
  dispatchMeasure('point', { point: vectorToArray(point) });
}

function onMeasureDoubleClick(event) {
  if (!measureActive) return;
  stopCanvasEvent(event);
  finishMeasure();
}

function onMeasureKeyDown(event) {
  if (!measureActive || isEditable(event.target)) return;
  if (event.key === 'Escape' || event.key === 'Enter') {
    stopCanvasEvent(event);
    finishMeasure();
  } else if (event.key === 'Backspace' || (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey))) {
    stopCanvasEvent(event);
    undoMeasurePoint();
  }
}

function ensureMeasurePanel() {
  if (measurePanel?.isConnected) return measurePanel;
  const host = document.getElementById('viewer') || document.body;
  measurePanel = document.getElementById('staticMeasurePolylinePanel') || document.createElement('div');
  measurePanel.id = 'staticMeasurePolylinePanel';
  measurePanel.className = 'measure-polyline-panel';
  measurePanel.setAttribute('role', 'dialog');
  measurePanel.setAttribute('aria-label', 'Measure Polyline');
  host.appendChild(measurePanel);
  return measurePanel;
}

function renderMeasurePanel() {
  const panel = ensureMeasurePanel();
  const segments = segmentLengths(measurePoints);
  panel.innerHTML = `
    <div class="measure-polyline-panel__header"><strong>Measure</strong><span>polyline length</span></div>
    <div class="measure-polyline-panel__stats">
      <div><span>Points</span><strong>${measurePoints.length}</strong></div>
      <div><span>Segments</span><strong>${segments.length}</strong></div>
      <div><span>Total</span><strong>${formatLength(totalLength(measurePoints))}</strong></div>
    </div>
    <div class="measure-polyline-panel__segments">
      ${segments.length ? segments.map((length, index) => `<div class="measure-polyline-panel__segment"><span>S${index + 1}</span><strong>${formatLength(length)}</strong></div>`).join('') : `<div class="measure-polyline-panel__empty">${measureActive ? 'Click model points to start measuring.' : 'Click Polyline to start measuring.'}</div>`}
    </div>
    <div class="measure-polyline-panel__actions">
      <button type="button" data-measure-action="undo">Undo</button>
      <button type="button" data-measure-action="clear">Clear</button>
      <button type="button" data-measure-action="finish">${measureActive ? 'Finish' : 'Start'}</button>
    </div>
  `;
  panel.hidden = !measureActive && measurePoints.length === 0;
  panel.querySelector('[data-measure-action="undo"]')?.addEventListener('click', undoMeasurePoint);
  panel.querySelector('[data-measure-action="clear"]')?.addEventListener('click', clearMeasure);
  panel.querySelector('[data-measure-action="finish"]')?.addEventListener('click', () => measureActive ? finishMeasure() : activateMeasure());
}

function ensureMeasureGroup() {
  const rt = runtime();
  const scene = rt?.scene || modelRoot(rt)?.parent;
  if (!scene?.add) return null;
  const existing = findObjectByName(MEASURE_GROUP_NAME);
  if (existing) {
    measureGroup = existing;
    return measureGroup;
  }
  measureGroup = new THREE.Group();
  measureGroup.name = MEASURE_GROUP_NAME;
  measureGroup.userData = { measurePolylineHelper: true, helper: true, selectable: false, source: VERSION };
  scene.add(measureGroup);
  return measureGroup;
}

function rebuildMeasureHelpers() {
  clearMeasureHelpers();
  const group = ensureMeasureGroup();
  if (!group) return;
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffd166, linewidth: 2, depthTest: false });
  for (let i = 1; i < measurePoints.length; i += 1) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([measurePoints[i - 1], measurePoints[i]]), lineMaterial.clone());
    line.name = `MEASURE_SEGMENT_${i}`;
    line.renderOrder = 9998;
    line.userData = { measurePolylineHelper: true, segmentIndex: i - 1, length: measurePoints[i - 1].distanceTo(measurePoints[i]), source: VERSION };
    group.add(line);
  }
  const radius = pointMarkerRadius();
  measurePoints.forEach((point, index) => {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd166, depthTest: false }));
    marker.name = `MEASURE_POINT_${index + 1}`;
    marker.position.copy(point);
    marker.renderOrder = 9999;
    marker.userData = { measurePolylineHelper: true, pointIndex: index, stableMarkerRadius: radius, source: VERSION };
    group.add(marker);
  });
}

function clearMeasureHelpers() {
  const group = ensureMeasureGroup();
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
}

function pointMarkerRadius() {
  const root = modelRoot();
  const box = new THREE.Box3();
  if (root) box.setFromObject(root);
  const size = isValidBox(box) ? Math.max(box.getSize(new THREE.Vector3()).length(), 1e-6) : 1;
  return clamp(size * 0.0007, size * 0.00025, size * 0.0025);
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
  const root = modelRoot(rt);
  const candidates = [];
  root?.traverse?.((object) => {
    if (isHelperObject(object)) return;
    if (object.isMesh || object.isLine || object.isPoints) candidates.push(object);
  });
  const hit = candidates.length ? raycaster.intersectObjects(candidates, false).find((item) => item?.point) : null;
  if (hit?.point) return hit.point.clone();
  const target = rt?.controls?.target?.clone?.() || new THREE.Vector3();
  const direction = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(direction, target);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function collectComponentRoots(root = modelRoot()) {
  const roots = [];
  const accepted = new Set();
  if (!root?.traverse) return roots;
  root.traverse((object) => {
    if (!object || object === root || accepted.has(object.uuid) || isHelperObject(object)) return;
    if (!isComponentCandidate(object)) return;
    if (hasComponentAncestor(object, root)) return;
    roots.push(object);
    accepted.add(object.uuid);
  });
  if (roots.length) return roots;
  for (const child of root.children || []) {
    if (!isHelperObject(child) && hasRenderableDescendant(child)) roots.push(child);
  }
  return roots;
}

function isComponentCandidate(object) {
  const data = object?.userData || {};
  return Boolean(
    data.ID || data.id || data.componentId || data.COMPONENT_ID || data.componentClass || data.componentType
    || data.TYPE === 'COMPONENT' || data.meshRole || data.fromNode || data.toNode || data.LINE_NO || data.lineNo
    || data.TAG || data.SUPPORT_TAG || object?.name
  );
}

function hasComponentAncestor(object, root) {
  let cursor = object.parent;
  while (cursor && cursor !== root && cursor.type !== 'Scene') {
    if (isComponentCandidate(cursor)) return true;
    cursor = cursor.parent;
  }
  return false;
}

function hasRenderableDescendant(object) {
  let found = false;
  object?.traverse?.((child) => {
    if (!found && !isHelperObject(child) && (child.isMesh || child.isLine || child.isPoints)) found = true;
  });
  return found;
}

function isHelperObject(object) {
  const data = object?.userData || {};
  const name = String(object?.name || '');
  return Boolean(data.helper || data.measurePolylineHelper || data.areaSelectHelper || data.sectionBoxHelper || data.isDisplayHelper)
    || /^(inputxml|__|AREA_SELECT_|MEASURE_|ComponentSearchHighlight|MODEL_TREE_SELECTION)/i.test(name);
}

function selectedObject(rt = runtime()) {
  return rt?.getSelectedObject?.()
    || window.__3D_MARKUP_SELECTED_OBJECT__
    || rt?.selectedObject
    || rt?.selectedMesh
    || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject
    || window.__3D_MARKUP_TREE__?.state?.selectedObject
    || null;
}

function selectedComponentRoot() {
  const root = modelRoot();
  let object = selectedObject();
  if (!object) {
    const ids = areaSelected.map(objectId).filter(Boolean);
    if (ids.length === 1) object = findComponentById(ids[0], root);
  }
  if (!object || !root || object === root || object.isScene) return null;
  let cursor = object;
  let best = isComponentCandidate(cursor) ? cursor : null;
  while (cursor?.parent && cursor.parent !== root && cursor.parent.type !== 'Scene') {
    cursor = cursor.parent;
    if (isComponentCandidate(cursor)) best = cursor;
  }
  return best || object;
}

function findComponentById(id, root = modelRoot()) {
  const wanted = String(id || '').trim();
  let found = null;
  root?.traverse?.((object) => {
    if (!found && objectId(object) === wanted) found = object;
  });
  return found;
}

function boundsForObject(object) {
  object?.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  return isValidBox(box) ? box : null;
}

function sectionPadding(box) {
  const size = box.getSize(new THREE.Vector3());
  return Math.max(Math.max(size.x, size.y, size.z, 0) * 0.05, Math.max(size.length() * 0.002, 0.001));
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

function projectedObjectRect(object, camera, viewport) {
  const box = boundsForObject(object);
  if (!box) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let any = false;
  for (const corner of boxCorners(box)) {
    const projected = corner.project(camera);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1 || projected.z > 1) continue;
    const x = viewport.left + ((projected.x + 1) / 2) * viewport.width;
    const y = viewport.top + ((1 - projected.y) / 2) * viewport.height;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
    any = true;
  }
  return any ? { left, top, right, bottom } : null;
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

function normalizedClientRect(x1, y1, x2, y2) {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
}

function clampRectToViewport(rect, viewport) {
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

function isEffectivelyVisible(object) {
  let cursor = object;
  while (cursor) {
    if (cursor.visible === false) return false;
    cursor = cursor.parent;
  }
  return true;
}

function segmentLengths(list = measurePoints) {
  const out = [];
  for (let i = 1; i < list.length; i += 1) out.push(list[i - 1].distanceTo(list[i]));
  return out;
}

function totalLength(list = measurePoints) {
  return segmentLengths(list).reduce((sum, length) => sum + length, 0);
}

function formatLength(length) {
  if (!Number.isFinite(length)) return '—';
  if (Math.abs(length) >= 1000) return `${(length / 1000).toFixed(3)} m`;
  return `${length.toFixed(1)} mm`;
}

function runtime() {
  const rt = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
  return rt?.refresh?.() || rt;
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function modelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
}

function findObjectByName(name) {
  let found = null;
  const scene = runtime()?.scene || modelRoot()?.parent || modelRoot();
  scene?.traverse?.((object) => {
    if (!found && object.name === name) found = object;
  });
  return found;
}

function objectId(object) {
  const data = object?.userData || {};
  return String(data.ID || data.id || data.componentId || data.COMPONENT_ID || data.TAG || data.NAME || data.name || object?.name || object?.uuid || '').trim();
}

function boxSummary(box) {
  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
    size: [round(box.max.x - box.min.x), round(box.max.y - box.min.y), round(box.max.z - box.min.z)]
  };
}

function vectorToArray(v) {
  return [Number(v.x), Number(v.y), Number(v.z)];
}

function isValidBox(box) {
  return Boolean(box)
    && Number.isFinite(box.min?.x) && Number.isFinite(box.min?.y) && Number.isFinite(box.min?.z)
    && Number.isFinite(box.max?.x) && Number.isFinite(box.max?.y) && Number.isFinite(box.max?.z)
    && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return Number.isFinite(min) ? min : 0;
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function textNode(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

function iconGlyph(kind) {
  const span = document.createElement('span');
  span.className = 'view-fit-collapse-glyph';
  span.setAttribute('aria-hidden', 'true');
  span.textContent = kind === 'collapse' ? '«' : '»';
  return span;
}

function setPressed(key, pressed) {
  document.querySelectorAll(`[data-review-tool="${key}"], [data-view="${key}"]`).forEach((button) => {
    button.classList.toggle('tool-active', pressed);
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });
}

function stopCanvasEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function requestRender(reason) {
  const rt = runtime();
  if (typeof rt?.renderOnce === 'function') rt.renderOnce(reason);
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { reason } }));
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('runtimeStatus') || document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (status && message) status.textContent = message;
}

function dispatchArea(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action, version: VERSION, ...detail } }));
}

function dispatchSectionBox(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:section-box', { detail: { action, version: VERSION, ...detail } }));
}

function dispatchMeasure(action, extra = {}) {
  window.dispatchEvent(new CustomEvent('viewer:measure-polyline', {
    detail: {
      action,
      version: VERSION,
      active: measureActive,
      pointCount: measurePoints.length,
      segmentCount: Math.max(measurePoints.length - 1, 0),
      totalLength: totalLength(measurePoints),
      formattedTotal: formatLength(totalLength(measurePoints)),
      ...extra
    }
  }));
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
    .viewer-topbar, .topbar-main, .topbar-actions { overflow: visible !important; }
    .top-menu-popover {
      z-index: 2200 !important;
      max-height: min(420px, calc(100vh - 88px));
      overflow: auto;
    }
    #topReviewMenu { display: none !important; }
    .review-top-menu-wrap { display: none !important; }

    [aria-label="Preview mode"]:empty { display: none !important; }
    [aria-label="View tools"].view-fit-collapsible { padding-right: 5px; }
    [aria-label="View tools"].view-fit-collapsed [data-view-collapse-extra="1"] { display: none !important; }
    [aria-label="View tools"] .view-fit-preview-mode { display: inline-flex !important; }
    #viewFitCollapseToggleBtn {
      width: 42px !important;
      min-width: 42px !important;
      max-width: 42px !important;
      font-weight: 1000;
      color: #bfe2ff;
    }
    #viewFitCollapseToggleBtn .view-fit-collapse-glyph { font-size: 18px; line-height: 1; }
    #viewFitCollapseToggleBtn span:last-child { font-size: 11px; }

    .input-drawer .panel-section:first-of-type {
      position: sticky;
      top: 0;
      z-index: 25;
      margin: -2px -2px 6px;
      padding: 12px 2px 14px;
      background: linear-gradient(180deg, rgba(10, 26, 47, .99), rgba(7, 18, 34, .98));
      border-bottom: 1px solid rgba(83, 125, 176, .22);
    }

    .component-search-panel { z-index: 120 !important; }
    .ribbon-area-select-rect {
      position: absolute;
      z-index: 130;
      pointer-events: none;
      border: 2px solid rgba(61, 220, 151, .98);
      border-radius: 4px;
      background: rgba(61, 220, 151, .14);
      box-shadow: 0 0 0 1px rgba(4, 12, 23, .7), 0 10px 30px rgba(0, 0, 0, .26);
    }
    body.area-select-active #viewer canvas,
    body.measure-polyline-active #viewer canvas { cursor: crosshair !important; }

    .measure-polyline-panel {
      right: 76px !important;
      top: 122px !important;
      z-index: 125 !important;
    }
  `;
  document.head.appendChild(style);
}

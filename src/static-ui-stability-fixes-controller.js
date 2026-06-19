import * as THREE from 'three';

// UI stability pass for the ribbon-first GLB/RVM Review shell.
// Owns non-invasive runtime patches only: global Escape, robust isolate/hide/show,
// ribbon explode apply/reset, measure marker normalization, export tile cleanup, and
// shared icon sizing. It intentionally does not alter parsing, geometry, GLB/RVM/ATT
// exporters, or src/app.js.

const VERSION = 'esc-tools-export-icons-20260619';
const STYLE_ID = 'staticUiStabilityFixesStyle';
const ESC_EVENT = 'viewer:global-escape';
const PATCH_INTERVAL_MS = 350;
const MAX_PATCH_ATTEMPTS = 80;
const EXPLODE_ORIGINAL_KEY = '__ribbonExplodeOriginalPosition';
const HELPER_NAME = '__MEASURE_POLYLINE_HELPERS__';

let patchAttempts = 0;
let viewpadToolsPatched = false;
let explodePatched = false;
let clickPatchInstalled = false;
let measurePatchInstalled = false;

runWhenReady(initStabilityFixes);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initStabilityFixes() {
  injectStyles();
  installGlobalEscape();
  installRibbonExplodeClickPatch();
  installMeasureHelperPatch();
  cleanupQuickExportGroup();
  installApi();
  patchLoop();
}

function patchLoop() {
  patchViewpadVisibilityApi();
  patchExplodeApi();
  cleanupQuickExportGroup();
  normalizeMeasureHelpers('patch-loop');
  patchAttempts += 1;
  if ((!viewpadToolsPatched || !explodePatched) && patchAttempts < MAX_PATCH_ATTEMPTS) {
    window.setTimeout(patchLoop, PATCH_INTERVAL_MS);
  }
}

function installApi() {
  window.__3D_MARKUP_UI_STABILITY_FIXES__ = {
    version: VERSION,
    escape: () => runGlobalEscape({ source: 'api' }),
    normalizeMeasureHelpers: () => normalizeMeasureHelpers('api'),
    isolateSelected: () => robustIsolateSelected('api'),
    hideSelected: () => robustHideSelected('api'),
    showAll: () => robustShowAll('api'),
    explodeApply: (mode = 'type') => robustApplyExplode(mode, { source: 'api' }),
    explodeReset: () => robustResetExplode({ source: 'api' }),
    checklist: () => ({
      version: VERSION,
      globalEsc: true,
      viewpadToolsPatched,
      explodePatched,
      quickExportMerged: !document.getElementById('quickExportGroup'),
      reviewIconSize: getComputedStyle(document.documentElement).getPropertyValue('--review-ribbon-icon-size').trim() || '20px'
    })
  };
}

function installGlobalEscape() {
  if (window.__3D_MARKUP_GLOBAL_ESC_INSTALLED__) return;
  window.__3D_MARKUP_GLOBAL_ESC_INSTALLED__ = VERSION;
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || isEditable(event.target)) return;
    const handled = runGlobalEscape({ source: 'keyboard' });
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);
}

function runGlobalEscape({ source = 'escape' } = {}) {
  let handled = false;

  handled = callApi('__3D_MARKUP_MARQUEE_ZOOM__', 'deactivate', 'Marquee zoom canceled') || handled;
  handled = callApi('__3D_MARKUP_AREA_SELECT__', 'deactivate', 'Area select canceled') || handled;
  handled = callApi('__3D_MARKUP_COMPONENT_SEARCH__', 'close') || handled;
  handled = callApi('__3D_MARKUP_REVIEW_RIBBON_INTEGRATION__', 'closeMenu') || handled;
  handled = callApi('__3D_MARKUP_VIEWPAD_INTEGRATION__', 'closeMenu') || handled;

  const measure = window.__3D_MARKUP_MEASURE_POLYLINE__;
  if (measure?.isActive?.()) {
    handled = callApi('__3D_MARKUP_MEASURE_POLYLINE__', 'finish') || handled;
  }

  const panels = [
    'staticMeasurePolylinePanel',
    'staticSavedViewsPanel',
    'staticComponentSearchPanel',
    'staticExplodeReviewPanel',
    'staticReviewContextMenu',
    'topReviewMenu'
  ];
  for (const id of panels) {
    const element = document.getElementById(id);
    if (!element) continue;
    if (id === 'topReviewMenu') {
      const pop = element.querySelector('.review-top-menu-popover, .top-menu-popover');
      const btn = element.querySelector('[aria-expanded="true"]');
      if (pop && !pop.hidden) {
        pop.hidden = true;
        btn?.setAttribute('aria-expanded', 'false');
        handled = true;
      }
      continue;
    }
    if (!element.hidden) {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
      handled = true;
    }
  }

  // Exiting the explode tool must restore the model positions, not leave a temporary
  // review transform active after Escape.
  handled = robustResetExplode({ source: 'escape', silentIfEmpty: true }) || handled;

  document.body.classList.remove('marquee-zoom-active', 'area-select-active', 'measure-polyline-active');
  document.querySelectorAll('[aria-pressed="true"].tool-active').forEach((button) => {
    button.classList.remove('tool-active');
    button.setAttribute('aria-pressed', 'false');
  });

  if (handled) {
    setStatus('Esc: tool canceled / review mode exited');
    window.dispatchEvent(new CustomEvent(ESC_EVENT, { detail: { source, version: VERSION } }));
    requestRender('global-escape');
  }
  return handled;
}

function patchViewpadVisibilityApi() {
  const api = window.__3D_MARKUP_VIEWPAD_TOOLS__;
  if (!api || api.__uiStabilityPatched) return false;
  api.isolateSelected = () => robustIsolateSelected('viewpad-api');
  api.hideSelected = () => robustHideSelected('viewpad-api');
  api.showAll = () => robustShowAll('viewpad-api');
  api.__uiStabilityPatched = VERSION;
  viewpadToolsPatched = true;
  return true;
}

function patchExplodeApi() {
  const api = window.__3D_MARKUP_EXPLODE_REVIEW__;
  if (!api || api.__uiStabilityPatched) return false;
  api.apply = (mode = 'type') => robustApplyExplode(mode, { source: 'explode-api' });
  api.reset = () => robustResetExplode({ source: 'explode-api-reset' });
  api.groups = (mode = 'type') => groupComponents(collectComponentRoots().filter(isEffectivelyVisible), mode).map((group) => ({ key: group.key, count: group.objects.length }));
  api.close = () => closeExplodePanel();
  api.__uiStabilityPatched = VERSION;
  explodePatched = true;
  return true;
}

function installRibbonExplodeClickPatch() {
  if (clickPatchInstalled) return;
  clickPatchInstalled = true;
  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-review-tool="explodeReview"], [data-review-menu-tool="explodeReview"]');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    robustApplyExplode('type', { source: 'ribbon-click' });
    hideContextMenus();
  }, true);
}

function robustIsolateSelected(source = 'isolate') {
  const rt = runtime();
  const root = modelRoot(rt);
  const selected = selectedComponentRoot(rt);
  if (!root || !selected) {
    setStatus('Select a component to isolate');
    return false;
  }

  const roots = collectComponentRoots(root);
  if (roots.length) {
    roots.forEach((object) => { object.visible = object === selected || isAncestorOrDescendant(object, selected); });
  } else {
    root.traverse?.((object) => { if (object !== root) object.visible = false; });
  }
  revealObjectAndAncestors(selected, root);
  selected.traverse?.((object) => { object.visible = true; });

  requestRender('robust-isolate-selected');
  dispatchVisibility('isolate', { source, selectedId: objectId(selected), rootCount: roots.length });
  setStatus(`Isolated ${objectId(selected) || 'selected component'}`);
  return true;
}

function robustHideSelected(source = 'hide') {
  const selected = selectedComponentRoot(runtime());
  if (!selected) {
    setStatus('Select a component to hide');
    return false;
  }
  selected.visible = false;
  requestRender('robust-hide-selected');
  dispatchVisibility('hide', { source, selectedId: objectId(selected) });
  setStatus(`Hidden ${objectId(selected) || 'selected component'}`);
  return true;
}

function robustShowAll(source = 'showAll') {
  const root = modelRoot(runtime());
  if (!root) {
    setStatus('No model loaded');
    return false;
  }
  root.traverse?.((object) => { object.visible = true; });
  requestRender('robust-show-all');
  dispatchVisibility('showAll', { source });
  setStatus('All components shown');
  return true;
}

function robustApplyExplode(mode = 'type', { source = 'explode' } = {}) {
  const root = modelRoot(runtime());
  if (!root) {
    setStatus('Explode unavailable: no model loaded');
    return false;
  }
  const components = collectComponentRoots(root).filter(isEffectivelyVisible);
  if (!components.length) {
    setStatus('Explode unavailable: no visible components found');
    return false;
  }

  robustResetExplode({ source: 'explode-before-apply', silentIfEmpty: true });
  const groups = groupComponents(components, mode);
  if (groups.length < 2) {
    // Still apply a small split by object index so the command gives visible feedback
    // when metadata is incomplete or all objects share the same type/line.
    groups.splice(0, groups.length, ...components.map((object, index) => ({ key: `OBJECT_${index + 1}`, objects: [object] })));
  }

  const distance = explodeDistance(root);
  const axis = new THREE.Vector3(1, 0, 0);
  const middle = (groups.length - 1) / 2;
  groups.forEach((group, index) => {
    const offset = axis.clone().multiplyScalar((index - middle) * distance);
    group.objects.forEach((object) => moveObjectByWorldOffset(object, offset));
  });

  requestRender('robust-explode-review');
  window.dispatchEvent(new CustomEvent('viewer:explode-review', {
    detail: {
      action: 'apply',
      source,
      mode,
      axis: 'X',
      distance,
      groups: groups.map((group) => ({ key: group.key, count: group.objects.length }))
    }
  }));
  setStatus(`Exploded ${components.length} component(s) into ${groups.length} review group(s)`);
  return true;
}

function robustResetExplode({ source = 'explode-reset', silentIfEmpty = false } = {}) {
  const root = modelRoot(runtime());
  if (!root?.traverse) return false;
  let resetCount = 0;
  root.traverse((object) => {
    const original = object.userData?.[EXPLODE_ORIGINAL_KEY];
    if (!Array.isArray(original)) return;
    object.position.set(original[0], original[1], original[2]);
    delete object.userData[EXPLODE_ORIGINAL_KEY];
    resetCount += 1;
  });
  closeExplodePanel();
  if (!resetCount && silentIfEmpty) return false;
  requestRender('robust-explode-reset');
  window.dispatchEvent(new CustomEvent('viewer:explode-review', { detail: { action: 'reset', source, resetCount } }));
  if (!silentIfEmpty || resetCount) setStatus(resetCount ? `Explode reset: ${resetCount} component(s)` : 'Explode reset');
  return resetCount > 0;
}

function closeExplodePanel() {
  const panel = document.getElementById('staticExplodeReviewPanel');
  if (!panel || panel.hidden) return false;
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  return true;
}

function installMeasureHelperPatch() {
  if (measurePatchInstalled) return;
  measurePatchInstalled = true;
  window.addEventListener('viewer:measure-polyline', () => window.setTimeout(() => normalizeMeasureHelpers('measure-event'), 0));
  window.addEventListener('viewer:model-loaded', () => window.setTimeout(() => normalizeMeasureHelpers('model-loaded'), 0));
  window.setInterval(() => normalizeMeasureHelpers('measure-poll'), 1200);
}

function normalizeMeasureHelpers(source = 'measure') {
  const group = findObjectByName(HELPER_NAME);
  if (!group?.children?.length) return false;
  const radius = stablePointMarkerRadius();
  let changed = 0;
  group.children.forEach((child) => {
    if (!/^MEASURE_POINT_/i.test(child.name || '')) return;
    if (!child.geometry || child.userData?.stableMarkerRadius === radius) return;
    child.geometry.dispose?.();
    child.geometry = new THREE.SphereGeometry(radius, 16, 12);
    child.userData.stableMarkerRadius = radius;
    child.userData.measureMarkerStable = VERSION;
    changed += 1;
  });
  if (changed) {
    requestRender(`normalize-measure-helpers:${source}`);
    window.dispatchEvent(new CustomEvent('viewer:measure-helper-normalized', { detail: { version: VERSION, source, radius, changed } }));
  }
  return changed > 0;
}

function stablePointMarkerRadius() {
  const root = modelRoot(runtime());
  const box = new THREE.Box3();
  if (root) box.setFromObject(root);
  const size = isValidBox(box) ? box.getSize(new THREE.Vector3()).length() : 1;
  // Use model-relative sizing with no absolute 5-unit minimum. This prevents meter-scale
  // scenes from drawing huge yellow disks while keeping markers visible on mm-scale scenes.
  return clamp(size * 0.004, size * 0.0008, size * 0.012 || 0.01);
}

function cleanupQuickExportGroup() {
  const group = document.getElementById('quickExportGroup');
  if (!group) return false;
  group.remove();
  window.dispatchEvent(new CustomEvent('viewer:ui-controls-changed', { detail: { feature: 'quick-export-merged-to-menu' } }));
  return true;
}

function runtime() {
  const rt = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
  return rt?.refresh?.() || rt;
}

function modelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
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

function selectedComponentRoot(rt = runtime()) {
  const root = modelRoot(rt);
  let object = selectedObject(rt);
  if (!root) return null;

  if (!object) {
    const areaIds = window.__3D_MARKUP_AREA_SELECT__?.selectedIds?.() || [];
    if (areaIds.length === 1) object = findComponentById(areaIds[0], root);
  }
  if (!object || object === root || object.isScene) return null;

  let cursor = object;
  let best = isComponentCandidate(cursor) ? cursor : null;
  while (cursor?.parent && cursor.parent !== root && cursor.parent.type !== 'Scene') {
    cursor = cursor.parent;
    if (isComponentCandidate(cursor)) best = cursor;
  }
  return best || object;
}

function collectComponentRoots(root = modelRoot(runtime())) {
  const roots = [];
  const accepted = new Set();
  if (!root?.traverse) return roots;

  root.traverse((object) => {
    if (!object || object === root || accepted.has(object.uuid) || isHelperObject(object)) return;
    if (!isComponentCandidate(object)) return;
    if (hasAcceptedAncestor(object, root)) return;
    roots.push(object);
    accepted.add(object.uuid);
  });

  if (roots.length) return roots;

  // Metadata-poor fallback: use top-level renderable children so isolate/explode still work
  // on imported GLB/RVM scenes that do not expose component IDs on every parent node.
  for (const child of root.children || []) {
    if (isHelperObject(child) || !hasRenderableDescendant(child)) continue;
    roots.push(child);
  }
  return roots;
}

function isComponentCandidate(object) {
  const data = object?.userData || {};
  return Boolean(
    data.componentId
    || data.COMPONENT_ID
    || data.componentClass
    || data.componentType
    || data.ID
    || data.id
    || data.TAG
    || data.SUPPORT_TAG
    || data.TYPE === 'COMPONENT'
    || data.meshRole
    || data.fromNode
    || data.toNode
    || data.LINE_NO
    || data.lineNo
    || object?.name
  );
}

function isHelperObject(object) {
  const data = object?.userData || {};
  const name = String(object?.name || '');
  return Boolean(data.helper || data.measurePolylineHelper || data.areaSelectHelper || data.sectionBoxHelper || data.isDisplayHelper)
    || /^(__|AREA_SELECT_|MEASURE_|ComponentSearchHighlight|MODEL_TREE_SELECTION)/i.test(name);
}

function hasAcceptedAncestor(object, root) {
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
  while (cursor) {
    if (cursor === a) return true;
    cursor = cursor.parent;
  }
  cursor = a.parent;
  while (cursor) {
    if (cursor === b) return true;
    cursor = cursor.parent;
  }
  return false;
}

function revealObjectAndAncestors(object, stopAt) {
  let cursor = object;
  while (cursor) {
    cursor.visible = true;
    if (cursor === stopAt) break;
    cursor = cursor.parent;
  }
}

function findComponentById(id, root = modelRoot(runtime())) {
  const wanted = String(id || '').trim();
  if (!wanted || !root?.traverse) return null;
  let found = null;
  root.traverse((object) => {
    if (!found && objectId(object) === wanted) found = object;
  });
  return found;
}

function groupComponents(objects, mode = 'type') {
  const map = new Map();
  objects.forEach((object) => {
    const key = mode === 'line' ? lineKey(object) : typeKey(object);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(object);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupObjects]) => ({ key, objects: groupObjects }));
}

function lineKey(object) {
  const data = object?.userData || {};
  return cleanKey(data.LINE_NO || data.lineNo || data.lineNumber || data.LINE_NUMBER || data.line || data.lineId || 'UNASSIGNED_LINE');
}

function typeKey(object) {
  const data = object?.userData || {};
  return cleanKey(data.componentClass || data.componentType || data.visualKey || data.rawType || data.TYPE || object?.type || 'UNKNOWN_TYPE');
}

function cleanKey(value) {
  const text = String(value ?? '').trim();
  return text ? text.toUpperCase().replace(/[^A-Z0-9_./-]+/g, '_') : 'UNASSIGNED';
}

function explodeDistance(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (!isValidBox(box)) return 250;
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  return Math.max(maxSize * 0.22, 0.05);
}

function moveObjectByWorldOffset(object, worldOffset) {
  if (!object.userData) object.userData = {};
  if (!Array.isArray(object.userData[EXPLODE_ORIGINAL_KEY])) {
    object.userData[EXPLODE_ORIGINAL_KEY] = [object.position.x, object.position.y, object.position.z];
  }
  if (object.parent) {
    const originalLocal = new THREE.Vector3().fromArray(object.userData[EXPLODE_ORIGINAL_KEY]);
    const originalWorld = object.parent.localToWorld(originalLocal.clone());
    const targetWorld = originalWorld.add(worldOffset);
    object.position.copy(object.parent.worldToLocal(targetWorld));
  } else {
    object.position.fromArray(object.userData[EXPLODE_ORIGINAL_KEY]).add(worldOffset);
  }
}

function findObjectByName(name) {
  const scene = runtime()?.scene || modelRoot()?.parent || modelRoot();
  let found = null;
  scene?.traverse?.((object) => {
    if (!found && object.name === name) found = object;
  });
  return found;
}

function objectId(object) {
  const data = object?.userData || {};
  return String(data.ID || data.id || data.componentId || data.COMPONENT_ID || data.TAG || data.NAME || data.name || object?.name || object?.uuid || '').trim();
}

function dispatchVisibility(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action, ...detail } }));
}

function hideContextMenus() {
  document.getElementById('staticReviewContextMenu')?.setAttribute('hidden', '');
  document.querySelectorAll('.review-top-menu-popover, .top-menu-popover').forEach((panel) => { panel.hidden = true; });
  document.querySelectorAll('[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function callApi(apiName, methodName, ...args) {
  const fn = window[apiName]?.[methodName];
  if (typeof fn !== 'function') return false;
  try {
    const result = fn(...args);
    return result !== false;
  } catch (error) {
    console.warn(`[3DMarkupTool] ${apiName}.${methodName} failed during Escape/tool cleanup`, error);
    return false;
  }
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

function isEditable(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

function isValidBox(box) {
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

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return Number.isFinite(min) ? min : 0.01;
  return Math.min(Math.max(value, min), max);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root { --review-ribbon-icon-size: 20px; }
    .main-ribbon .tool-btn svg,
    .main-ribbon .tool-btn .lucide,
    .main-ribbon .tool-btn .review-tool-svg,
    #staticReviewRibbonGroup .review-ribbon-tool-icon {
      width: var(--review-ribbon-icon-size) !important;
      height: var(--review-ribbon-icon-size) !important;
      flex: 0 0 var(--review-ribbon-icon-size);
    }
    #staticReviewRibbonGroup.review-ribbon-group { max-width: none !important; }
    #staticReviewRibbonGroup .review-ribbon-tool-btn {
      width: 64px !important;
      min-width: 64px !important;
      max-width: 64px !important;
      height: 56px !important;
      min-height: 56px !important;
      max-height: 56px !important;
    }
    #quickExportGroup { display: none !important; }
    .measure-polyline-panel { right: 76px; }
  `;
  document.head.appendChild(style);
}

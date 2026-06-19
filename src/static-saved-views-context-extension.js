// Extends the standalone Saved Views runtime API with review context capture.
// Camera/clipping remain owned by static-saved-views-controller.js; this module
// adds selection, color mode, and visibility state without changing src/app.js.

const VERSION = 'saved-views-context-extension-20260619';
const STORAGE_KEY = '3dmarkup.savedViews.v1';
const PATCH_RETRY_MS = 180;
const MAX_PATCH_RETRIES = 40;

let retryCount = 0;
let patched = false;

installSavedViewsContextExtension();

function installSavedViewsContextExtension() {
  const start = () => patchWhenReady();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function patchWhenReady() {
  const api = window.__3D_MARKUP_SAVED_VIEWS__;
  if (!api || patched || api.__reviewContextExtended) {
    if (!api && retryCount < MAX_PATCH_RETRIES) {
      retryCount += 1;
      window.setTimeout(patchWhenReady, PATCH_RETRY_MS);
    }
    return Boolean(api?.__reviewContextExtended);
  }

  const original = {
    save: api.save?.bind(api),
    restore: api.restore?.bind(api),
    restoreLatest: api.restoreLatest?.bind(api),
    list: api.list?.bind(api),
    debug: api.debug?.bind(api)
  };

  api.save = (name) => {
    const view = original.save?.(name);
    if (view?.id) attachContextToStoredView(view.id, captureReviewContext());
    return loadSavedViews().find((item) => item.id === view?.id) || view;
  };

  api.restore = (id) => {
    const view = resolveView(id);
    const ok = original.restore?.(id);
    if (ok && view?.snapshot?.reviewContext) restoreReviewContext(view.snapshot.reviewContext);
    return ok;
  };

  api.restoreLatest = () => {
    const views = loadSavedViews();
    const latest = views[views.length - 1];
    const ok = original.restoreLatest?.();
    if (ok && latest?.snapshot?.reviewContext) restoreReviewContext(latest.snapshot.reviewContext);
    return ok;
  };

  api.open = () => openSavedViewsPanel();
  api.captureReviewContext = () => captureReviewContext();
  api.restoreReviewContext = (context) => restoreReviewContext(context);
  api.list = () => loadSavedViews();
  api.debug = () => ({
    ...(original.debug?.() || {}),
    contextExtensionVersion: VERSION,
    contextEnabled: true,
    latestContext: loadSavedViews().at(-1)?.snapshot?.reviewContext || null
  });
  api.__reviewContextExtended = true;
  patched = true;
  dispatchSavedContext('patch', { count: loadSavedViews().length });
  return true;
}

function captureReviewContext() {
  const color = captureColorMode();
  const roots = collectComponentRoots();
  const hiddenIds = roots.filter((object) => object.visible === false).map(objectId).filter(Boolean);
  const selectedId = selectedComponentId();
  const areaSelectedIds = window.__3D_MARKUP_AREA_SELECT__?.selectedIds?.() || [];

  return {
    schemaVersion: 'SavedViewReviewContext.v1',
    capturedAt: Date.now(),
    selectedId,
    areaSelectedIds,
    colorBy: color,
    visibility: {
      hiddenIds,
      hiddenCount: hiddenIds.length,
      rootCount: roots.length
    },
    activeViewpadTools: activeViewpadTools()
  };
}

function restoreReviewContext(context = {}) {
  if (!context || typeof context !== 'object') return false;
  const restored = {
    color: restoreColorMode(context.colorBy),
    visibility: restoreVisibility(context.visibility),
    selection: restoreSelection(context.selectedId)
  };
  requestRender('saved-view-review-context-restore');
  dispatchSavedContext('restore', { restored, selectedId: context.selectedId || '' });
  return true;
}

function attachContextToStoredView(id, context) {
  const views = loadSavedViews();
  const view = views.find((item) => item.id === id);
  if (!view) return false;
  if (!view.snapshot) view.snapshot = {};
  view.snapshot.reviewContext = context;
  storeSavedViews(views);
  dispatchSavedContext('capture', {
    id,
    selectedId: context.selectedId || '',
    hiddenCount: context.visibility?.hiddenCount || 0,
    colorBy: context.colorBy?.value || ''
  });
  return true;
}

function openSavedViewsPanel() {
  const panel = document.getElementById('staticSavedViewsPanel');
  if (panel) {
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    dispatchSavedContext('open');
    return true;
  }
  const button = document.querySelector('.view-pad [data-view="savedViews"]');
  if (button) {
    button.click();
    dispatchSavedContext('open');
    return true;
  }
  return false;
}

function resolveView(id) {
  const views = loadSavedViews();
  if (typeof id === 'string' && id) return views.find((item) => item.id === id) || views[views.length - 1] || null;
  return views[views.length - 1] || null;
}

function loadSavedViews() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && item.snapshot) : [];
  } catch {
    return [];
  }
}

function storeSavedViews(views) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    return true;
  } catch (error) {
    console.warn('[3DMarkupTool] Failed to store saved-view review context.', error);
    return false;
  }
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function modelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
}

function collectComponentRoots(root = modelRoot()) {
  const roots = [];
  const accepted = new Set();
  if (!root?.traverse) return roots;
  root.traverse((object) => {
    if (!object || object === root || accepted.has(object) || isHelperObject(object)) return;
    if (!isComponentCandidate(object)) return;
    if (hasComponentAncestor(object, root)) return;
    roots.push(object);
    accepted.add(object);
  });
  return roots;
}

function selectedComponentId() {
  const object = selectedComponentRoot();
  return object ? objectId(object) : '';
}

function selectedComponentRoot(rt = runtime()) {
  const root = modelRoot(rt);
  let object = rt?.selectedObject || rt?.selectedMesh || null;
  if (!object) return null;
  while (object.parent && object.parent !== root && object.parent.type !== 'Scene') {
    if (isComponentCandidate(object.parent)) object = object.parent;
    else break;
  }
  return object;
}

function restoreSelection(selectedId) {
  if (!selectedId) return false;
  const object = findComponentById(selectedId);
  const rt = runtime();
  if (!object || !rt) return false;
  rt.selectedObject = object;
  rt.selectedMesh = object;
  setStatus(`Restored selection: ${selectedId}`);
  window.dispatchEvent(new CustomEvent('viewer:saved-view-selection-restore', { detail: { selectedId } }));
  return true;
}

function findComponentById(id) {
  return collectComponentRoots().find((object) => objectId(object) === id) || null;
}

function restoreVisibility(visibility = {}) {
  const hiddenIds = new Set(Array.isArray(visibility.hiddenIds) ? visibility.hiddenIds : []);
  const roots = collectComponentRoots();
  if (!roots.length) return false;
  roots.forEach((object) => { object.visible = !hiddenIds.has(objectId(object)); });
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', { detail: { action: 'restoreSavedViewVisibility', hiddenCount: hiddenIds.size } }));
  return true;
}

function captureColorMode() {
  const select = document.getElementById('colorBySelect');
  if (!select) return { value: '', label: '' };
  return {
    value: select.value,
    label: select.selectedOptions?.[0]?.textContent || select.value
  };
}

function restoreColorMode(colorBy = {}) {
  const select = document.getElementById('colorBySelect');
  if (!select || !colorBy.value) return false;
  const hasOption = Array.from(select.options || []).some((option) => option.value === colorBy.value);
  if (!hasOption) return false;
  select.value = colorBy.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function activeViewpadTools() {
  return Array.from(document.querySelectorAll('.view-pad [aria-pressed="true"], .view-pad .tool-active'))
    .map((button) => button.dataset.view)
    .filter(Boolean);
}

function isHelperObject(object) {
  const data = object.userData || {};
  return Boolean(data.helper || data.measurePolylineHelper || data.areaSelectHelper || data.sectionBoxHelper) || String(object.name || '').startsWith('__');
}

function isComponentCandidate(object) {
  const data = object.userData || {};
  return Boolean(
    data.componentId
    || data.componentClass
    || data.componentType
    || data.ID
    || data.id
    || data.TYPE === 'COMPONENT'
    || data.meshRole
    || data.fromNode
    || data.toNode
    || data.LINE_NO
    || data.lineNo
    || data.SUPPORT_TAG
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

function objectId(object) {
  const data = object?.userData || {};
  return String(data.ID || data.id || data.componentId || data.NAME || data.TAG || object?.name || object?.uuid || '');
}

function requestRender(reason) {
  const rt = runtime();
  if (typeof rt?.renderOnce === 'function') rt.renderOnce(reason);
  else window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { reason } }));
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('runtimeStatus') || document.getElementById('coreStatus');
  if (status && message) status.textContent = message;
}

function dispatchSavedContext(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:saved-view-context', {
    detail: { action, version: VERSION, ...detail }
  }));
}

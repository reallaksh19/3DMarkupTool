// Static clip diagnostics + selection resolver.
// Keeps Clip Plane / Clip Box visible in the status bar and makes clip tools
// consume the same selected object shown by the main viewer status/properties.

const VERSION = 'static-clip-diagnostics-selection-20260619';
const LOG_PREFIX = '[3DMarkupTool:clip]';
let lastClipText = '';

runWhenReady(initClipDiagnostics);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initClipDiagnostics() {
  ensureClipStatus();
  aliasTreeApi();
  syncSelection('startup');
  bindEvents();
  setClipStatus('Clip: idle');
  window.__3D_MARKUP_CLIP_DIAGNOSTICS__ = {
    version: VERSION,
    syncSelection,
    setStatus: setClipStatus,
    log: clipLog,
    selectedObject: () => syncSelection('api')
  };
  clipLog('ready', { version: VERSION });
}

function bindEvents() {
  ['markup:app-ready', 'markup:render-context', 'viewer:runtime-context', 'viewer:static-tree-ready', 'viewer:static-tree-refreshed', 'viewer:selection-changed']
    .forEach((eventName) => window.addEventListener(eventName, () => {
      aliasTreeApi();
      syncSelection(eventName);
    }));

  window.addEventListener('click', (event) => {
    const target = event.target?.closest?.('button, [role="button"');
    window.setTimeout(() => {
      aliasTreeApi();
      const selected = syncSelection('click');
      const id = selectedIdFromStatusOrProps();
      if (event.target?.closest?.('#staticClipBoxBaselineBtn')) {
        clipLog('clipbox.baseline.click', { selectedId: id, hasObject: Boolean(selected) });
        setClipStatus(selected ? `Clip Box baseline: ${id || objectLabel(selected)}` : 'Clip Box baseline failed: no selected object');
      }
      if (event.target?.closest?.('#staticClipBoxApplyBtn')) {
        clipLog('clipbox.apply.click', { selectedId: id, hasObject: Boolean(selected), ranges: currentClipBoxRanges() });
        setClipStatus(selected ? `Clip Box apply: ${id || objectLabel(selected)} ${rangeText()}` : 'Clip Box apply failed: no selected object');
      }
      if (event.target?.closest?.('#clipPlaneBaselineBtn')) {
        clipLog('clipplane.baseline.click', { selectedId: id, hasObject: Boolean(selected) });
        setClipStatus(selected ? `Clip Plane baseline: ${id || objectLabel(selected)}` : 'Clip Plane baseline failed: no selected object');
      }
      if (event.target?.closest?.('#clipAdjustToggleBtn, #clipBtn')) {
        clipLog('clipplane.toggle.click', { selectedId: id, hasObject: Boolean(selected) });
      }
    }, 0);
  }, true);

  window.addEventListener('viewer:clipping-changed', (event) => {
    const detail = event.detail || {};
    const mode = detail.mode || 'unknown';
    const planes = Array.isArray(detail.planes) ? detail.planes.length : 0;
    clipLog('clipping.changed', { mode, planes, source: detail.source || 'unknown' });
    if (mode === 'none') setClipStatus('Clip: cleared');
    else setClipStatus(`Clip ${mode}: ${planes} plane${planes === 1 ? '' : 's'} active`);
  });
}

function ensureClipStatus() {
  let node = document.getElementById('clipStatus');
  if (node) return node;
  const statusbar = document.querySelector('.viewer-statusbar');
  if (!statusbar) return null;
  node = document.createElement('span');
  node.id = 'clipStatus';
  node.textContent = 'Clip: idle';
  statusbar.appendChild(node);
  return node;
}

function setClipStatus(text) {
  const status = ensureClipStatus();
  lastClipText = text || 'Clip: idle';
  if (status) status.textContent = lastClipText;
}

function aliasTreeApi() {
  if (window.__3D_MARKUP_TREE__ && !window.__3D_MARKUP_STATIC_TREE__) {
    window.__3D_MARKUP_STATIC_TREE__ = window.__3D_MARKUP_TREE__;
  }
  if (window.__3D_MARKUP_STATIC_TREE__ && !window.__3D_MARKUP_TREE__) {
    window.__3D_MARKUP_TREE__ = window.__3D_MARKUP_STATIC_TREE__;
  }
}

function syncSelection(source = 'manual') {
  const runtime = runtimeObject();
  if (runtime.selectedObject && !runtime.selectedObject.isScene) return runtime.selectedObject;

  const selectedId = selectedIdFromStatusOrProps();
  if (!selectedId) {
    setClipStatus(lastClipText || 'Clip: no selection');
    return null;
  }

  const object = findObjectById(selectedId);
  if (!object) {
    clipLog('selection.resolve.miss', {
      source,
      selectedId,
      treeCount: treeObjects().length,
      hasRuntimeRoot: Boolean(runtime.modelRoot || runtime.scene)
    }, 'warn');
    setClipStatus(`Clip selection unresolved: ${selectedId}`);
    return null;
  }

  runtime.selectedObject = object;
  runtime.selectedData = object.userData || {};
  runtime.selectedId = selectedId;
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

  clipLog('selection.resolved', { source, selectedId, object: objectLabel(object) });
  if (!/baseline|apply|active|cleared/i.test(lastClipText)) setClipStatus(`Clip ready: ${selectedId}`);
  return object;
}

function selectedIdFromStatusOrProps() {
  const statusText = String(document.getElementById('selectedStatus')?.textContent || '').trim();
  const match = statusText.match(/Selected:\s*([^\s]+)/i);
  if (match && match[1] && !/^none$/i.test(match[1])) return normalizeId(match[1]);

  const propertyTitle = document.querySelector('.selected-card-title span')?.textContent?.trim();
  if (propertyTitle && !/^no selection$/i.test(propertyTitle)) return normalizeId(propertyTitle);

  return '';
}

function findObjectById(id) {
  const normalized = normalizeId(id);
  if (!normalized) return null;

  const fromTree = treeObjects().find((item) => objectMatches(item.object || item, normalized));
  if (fromTree) return fromTree.object || fromTree;

  const runtime = runtimeObject();
  const root = runtime.modelRoot || runtime.scene;
  let found = null;
  root?.traverse?.((object) => {
    if (found || !object || object.isScene) return;
    if (objectMatches(object, normalized)) found = object;
  });
  return found;
}

function treeObjects() {
  return window.__3D_MARKUP_TREE__?.state?.objects
    || window.__3D_MARKUP_STATIC_TREE__?.state?.objects
    || [];
}

function objectMatches(object, normalizedId) {
  const raw = object?.userData || {};
  const candidates = [
    object?.name,
    raw.ID,
    raw.id,
    raw.REF_NO,
    raw.refNo,
    raw.LABEL,
    raw.label,
    raw.NODE,
    raw.node,
    raw.componentId,
    raw.COMPONENT_ID,
    raw.title,
    raw.name
  ];
  return candidates.some((value) => normalizeId(value) === normalizedId);
}

function runtimeObject() {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
  return runtime;
}

function currentClipBoxRanges() {
  const value = (axis, edge) => document.getElementById(`staticClipBox_${axis}${edge}`)?.value ?? '';
  return {
    x: [value('x', 'Min'), value('x', 'Max')],
    y: [value('y', 'Min'), value('y', 'Max')],
    z: [value('z', 'Min'), value('z', 'Max')]
  };
}

function rangeText() {
  const r = currentClipBoxRanges();
  return `X ${r.x[0]}-${r.x[1]}%, Y ${r.y[0]}-${r.y[1]}%, Z ${r.z[0]}-${r.z[1]}%`;
}

function objectLabel(object) {
  const raw = object?.userData || {};
  return raw.ID || raw.id || raw.REF_NO || raw.refNo || raw.LABEL || raw.label || object?.name || object?.uuid || 'object';
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .replace(/^Selected:\s*/i, '')
    .replace(/[\s,;]+$/g, '')
    .toUpperCase();
}

function clipLog(event, detail = {}, level = 'info') {
  const payload = { event, ...detail };
  const method = level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'info';
  console[method](LOG_PREFIX, payload);
}

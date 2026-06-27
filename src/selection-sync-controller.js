import * as THREE from 'three';

const TREE_HELPER_NAME = 'MODEL_TREE_SELECTION_HELPER';
const APP_HELPER_NAME = 'SELECTION_BOX_HELPER';

const state = {
  renderer: getRuntime()?.renderer || null,
  scene: getRuntime()?.scene || null,
  camera: getRuntime()?.camera || null,
  helper: null,
  selectedUuid: '',
  lastCanvasSyncAt: 0
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initSelectionSync, { once: true });
} else {
  initSelectionSync();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
});

window.addEventListener('viewer:runtime-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
});

window.addEventListener('markup:request-select-object', (event) => {
  const object = event.detail?.object || null;
  if (!object) return;
  selectObject(object, event.detail?.data || findUserData(object), { source: event.detail?.source || 'runtime' });
});

window.addEventListener('markup:request-clear-selection', () => clearSyncedSelection());

function initSelectionSync() {
  document.addEventListener('click', onTreeItemClick, true);
  document.getElementById('clearSelectionBtn')?.addEventListener('click', () => clearSyncedSelection(), true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clearSyncedSelection();
  }, true);

  const viewer = document.getElementById('viewer');
  viewer?.addEventListener('pointerup', () => {
    window.setTimeout(syncTreeFromCanvasSelection, 0);
  });

  window.__3D_MARKUP_SELECTION_SYNC__ = {
    selectObject,
    clearSelection: clearSyncedSelection,
    findObjectByUuid,
    getSelectedObject: () => window.__3D_MARKUP_SELECTED_OBJECT__ || null,
    getSelectedData: () => window.__3D_MARKUP_SELECTED_DATA__ || null
  };
}

function onTreeItemClick(event) {
  const button = event.target?.closest?.('.tree-item');
  if (!button) return;

  const object = findObjectByUuid(button.dataset.uuid);
  if (!object) return;

  const data = findUserData(object);
  selectObject(object, data, { source: 'tree' });
}

function selectObject(object, data = {}, options = {}) {
  if (!object) return false;

  state.selectedUuid = object.uuid;
  window.__3D_MARKUP_SELECTED_OBJECT__ = object;
  window.__3D_MARKUP_SELECTED_DATA__ = data;

  const runtime = getRuntime();
  if (runtime) {
    runtime.selectedObject = object;
    runtime.selectedData = data;
  }

  markTreeActive(object.uuid);
  showSelectionHelper(object);
  updateSelectionStatus(data, object);

  if (options.source === 'tree' || options.source === 'runtime') {
    showProperties(data, object);
  }

  const detail = { object, data, source: options.source || 'unknown' };
  window.dispatchEvent(new CustomEvent('markup:selected-object-changed', { detail }));
  window.dispatchEvent(new CustomEvent('viewer:selection-changed', { detail }));
  return true;
}

function clearSyncedSelection() {
  state.selectedUuid = '';
  window.__3D_MARKUP_SELECTED_OBJECT__ = null;
  window.__3D_MARKUP_SELECTED_DATA__ = null;

  const runtime = getRuntime();
  if (runtime) {
    runtime.selectedObject = null;
    runtime.selectedData = null;
  }

  markTreeActive('');
  removeSelectionHelper();
  window.dispatchEvent(new CustomEvent('markup:selected-object-cleared'));
  window.dispatchEvent(new CustomEvent('viewer:selection-changed', { detail: { object: null, data: null, source: 'clear' } }));
}

function syncTreeFromCanvasSelection() {
  const now = performance.now();
  if (now - state.lastCanvasSyncAt < 80) return;
  state.lastCanvasSyncAt = now;

  const scene = getScene();
  if (!scene) return;

  const appHelper = findObjectByName(scene, APP_HELPER_NAME);
  if (!appHelper) {
    const status = document.getElementById('selectedStatus')?.textContent || '';
    if (/selected:\s*none/i.test(status)) clearSyncedSelection();
    return;
  }

  const object = findClosestObjectToHelper(scene, appHelper);
  if (!object) return;

  selectObject(object, findUserData(object), { source: 'canvas' });
  removeSelectionHelper();
}

function findClosestObjectToHelper(scene, helper) {
  const helperBox = new THREE.Box3().setFromObject(helper);
  if (!isValidBox(helperBox)) return null;

  const helperCenter = helperBox.getCenter(new THREE.Vector3());
  const helperSize = helperBox.getSize(new THREE.Vector3());
  const helperDiag = Math.max(helperSize.length(), 1e-6);

  let best = null;
  let bestScore = Infinity;
  const scratch = new THREE.Box3();

  scene.traverse?.((object) => {
    if (shouldSkip(object) || !object.geometry) return;
    if (!Object.keys(findUserData(object)).length) return;

    scratch.setFromObject(object);
    if (!isValidBox(scratch)) return;

    const center = scratch.getCenter(new THREE.Vector3());
    const size = scratch.getSize(new THREE.Vector3());
    const centerScore = center.distanceTo(helperCenter) / helperDiag;
    const sizeScore = Math.abs(size.length() - helperSize.length()) / helperDiag;
    const score = centerScore + sizeScore * 0.35;

    if (score < bestScore) {
      bestScore = score;
      best = object;
    }
  });

  return best;
}

function showSelectionHelper(object) {
  removeSelectionHelper();

  const scene = getScene();
  if (!scene || !object) return;

  const box = new THREE.Box3().setFromObject(object);
  if (!isValidBox(box)) return;

  const helper = new THREE.Box3Helper(box, 0xf7b75c);
  helper.name = TREE_HELPER_NAME;
  helper.renderOrder = 1200;
  helper.userData = { isDisplayHelper: true, ignoreBounds: true };
  if (helper.material) {
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.95;
  }

  scene.add(helper);
  state.helper = helper;
}

function removeSelectionHelper() {
  if (!state.helper) {
    const scene = getScene();
    const orphan = scene ? findObjectByName(scene, TREE_HELPER_NAME) : null;
    if (orphan) orphan.parent?.remove?.(orphan);
    return;
  }

  state.helper.parent?.remove?.(state.helper);
  state.helper.geometry?.dispose?.();
  state.helper.material?.dispose?.();
  state.helper = null;
}

function markTreeActive(uuid) {
  document.querySelectorAll('.tree-item.tree-item-active').forEach((node) => node.classList.remove('tree-item-active'));
  if (!uuid) return;

  const active = document.querySelector(`.tree-item[data-uuid="${cssEscape(uuid)}"]`);
  if (!active) return;

  active.classList.add('tree-item-active');
  active.scrollIntoView?.({ block: 'nearest' });
}

function updateSelectionStatus(data, object) {
  const status = document.getElementById('selectedStatus');
  if (!status) return;

  const title = displayTitle(data, object);
  status.textContent = `Selected: ${title}`;
}

function showProperties(data, object) {
  const body = document.getElementById('propertiesBody');
  if (!body) return;

  document.body.classList.add('props-open');
  body.classList.remove('empty-state');

  const normalized = normalizeProperties(data, object);
  const identityRows = [
    ['ID', normalized.id],
    ['Type', normalized.type],
    ['Line No.', normalized.lineNo],
    ['From Node', normalized.fromNode],
    ['To Node', normalized.toNode],
    ['Source', normalized.source]
  ];

  const displayData = { ...(data || {}) };
  if (displayData.rawSupport) {
    Object.assign(displayData, displayData.rawSupport);
    delete displayData.rawSupport;
  }
  if (displayData.sourceAttributes) {
    Object.assign(displayData, displayData.sourceAttributes);
    delete displayData.sourceAttributes;
  }
  delete displayData.sourceAttributesJson;
  delete displayData.diagnosticsJson;
  const rawRows = Object.entries(displayData).slice(0, 80);
  body.innerHTML = `
    <div class="selected-card">
      <div class="selected-card-title">
        <span>${escapeHtml(normalized.title)}</span>
        <span class="badge">${escapeHtml(normalized.type)}</span>
      </div>
      <div class="selected-card-subtitle">${escapeHtml(normalized.subtitle)}</div>
      <div class="badge-row"><span class="badge">Tree Selection</span></div>
    </div>
    ${section('Common', true, rows(identityRows))}
    ${section('Raw Metadata', false, rows(rawRows))}`;
}

function normalizeProperties(data, object) {
  const type = valueOf(data, ['TYPE', 'type', 'engineeringType', 'ENGINEERING_TYPE']) || object?.type || 'Object';
  const id = valueOf(data, ['SUPPORT_MARKER_ID', 'supportMarkerId', 'ID', 'id', 'REF_NO', 'refNo', 'LABEL', 'label']) || object?.name || type;
  const lineNo = valueOf(data, ['lineNo', 'LINE_NO', 'lineNumber', 'LINE_NUMBER']) || 'N/A';
  const fromNode = valueOf(data, ['fromNode', 'FROM_NODE', 'node', 'NODE']) || 'N/A';
  const toNode = valueOf(data, ['toNode', 'TO_NODE']) || 'N/A';
  const source = valueOf(data, ['sourceKind', 'SOURCE_KIND', 'source', 'SOURCE', 'sourceMode', 'SOURCE_MODE']) || 'N/A';
  const title = type === 'SUPPORT_MARKER'
    ? `${valueOf(data, ['family', 'FAMILY']) || 'Support'} marker at node ${fromNode}`
    : id;
  const subtitle = type === 'SUPPORT_MARKER'
    ? valueOf(data, ['isonoteRawText', 'ISONOTE_RAW_TEXT']) || source
    : [fromNode !== 'N/A' || toNode !== 'N/A' ? `Node ${fromNode}${toNode !== 'N/A' ? ` -> ${toNode}` : ''}` : '', source].filter(Boolean).join(' / ');

  if (type === 'SUPPORT_MARKER') {
    return { id, type, lineNo, fromNode, toNode, source, title, subtitle };
  }

  return {
    id,
    type,
    lineNo,
    fromNode,
    toNode,
    source,
    title,
    subtitle: [fromNode !== 'N/A' || toNode !== 'N/A' ? `Node ${fromNode}${toNode !== 'N/A' ? ` â†’ ${toNode}` : ''}` : '', source].filter(Boolean).join(' / ')
  };
}

function section(title, open, html) {
  return `<details class="prop-section" ${open ? 'open' : ''}><summary>${escapeHtml(title)}</summary><div class="prop-grid">${html}</div></details>`;
}

function rows(items) {
  return items.map(([key, value]) => `<div class="prop-key">${escapeHtml(key)}</div><div class="prop-value">${escapeHtml(value ?? 'N/A')}</div>`).join('');
}

function displayTitle(data, object) {
  return valueOf(data, ['ID', 'id', 'REF_NO', 'refNo', 'LABEL', 'label']) || object?.name || valueOf(data, ['TYPE', 'type']) || 'Object';
}

function valueOf(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function findObjectByUuid(uuid) {
  if (!uuid) return null;
  let found = null;
  const scene = getScene();
  scene?.traverse?.((object) => {
    if (!found && object.uuid === uuid) found = object;
  });
  return found;
}

function findObjectByName(scene, name) {
  let found = null;
  scene?.traverse?.((object) => {
    if (!found && String(object.name || '').toUpperCase() === name) found = object;
  });
  return found;
}

function findUserData(object) {
  let current = object;
  let fallback = {};
  while (current) {
    const data = current.userData || {};
    if (Object.keys(data).length) {
      if (data.TYPE && data.TYPE !== 'RVM_PRIMITIVE') return data;
      if (data.type && data.type !== 'RVM_PRIMITIVE') return data;
      if (!Object.keys(fallback).length) fallback = data;
    }
    current = current.parent;
  }
  return fallback;
}

function shouldSkip(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;

  const name = String(object.name || '').toLowerCase();
  if (name === 'grid' || name === 'axes') return true;
  if (name.includes('helper') || name.includes('measure') || name.includes('clip_plane_preview')) return true;

  return false;
}

function getScene() {
  return state.scene || getRuntime()?.scene || null;
}

function getRuntime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function isValidBox(box) {
  return Boolean(box) && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

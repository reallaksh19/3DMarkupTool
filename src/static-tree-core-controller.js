import * as THREE from 'three';

// Static/core Model Tree.
// Loaded in normal recovery mode. It does not import or re-enable the old
// advanced tree/clip controller stack. It reads the active scene from the
// lightweight runtime bridge and owns only the tree panel + tree selection UI.

const VERSION = 'static-shell-score-tree-20260618';
const MAX_TREE_ITEMS = 600;

const state = {
  open: false,
  objects: [],
  selectedObject: null,
  helper: null,
  refreshTimer: 0
};

runWhenReady(initStaticTreeCore);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initStaticTreeCore() {
  ensureTreeStyles();
  ensureTreePanel();
  bindTreeToggle();
  bindRuntimeEvents();
  installTreeApi();
  scheduleRefresh('startup');
  window.dispatchEvent(new CustomEvent('viewer:static-tree-ready', { detail: { version: VERSION } }));
}

function ensureTreeStyles() {
  if (document.getElementById('staticTreeCoreStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticTreeCoreStyles';
  style.textContent = `
    .static-tree-panel {
      position: absolute;
      z-index: 15;
      top: 58px;
      left: 14px;
      width: min(340px, calc(100% - 36px));
      max-height: calc(100% - 86px);
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      border: 1px solid rgba(83, 125, 176, .36);
      border-radius: 12px;
      background: rgba(5, 15, 29, .94);
      box-shadow: 0 20px 48px rgba(0, 0, 0, .38);
      overflow: hidden;
      backdrop-filter: blur(10px);
    }
    .static-tree-panel[hidden] { display: none; }
    .static-tree-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(83, 125, 176, .22);
      color: #fff;
      font-size: 13px;
      font-weight: 900;
    }
    .static-tree-close {
      width: 28px;
      min-width: 28px;
      height: 28px;
      min-height: 28px;
      padding: 0;
      border-radius: 8px;
    }
    .static-tree-tools {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 9px 10px;
      border-bottom: 1px solid rgba(83, 125, 176, .16);
    }
    .static-tree-search {
      min-height: 30px !important;
      font-size: 12px;
      padding: 5px 8px !important;
    }
    .static-tree-count {
      color: #9fb3cc;
      font-size: 11px;
      white-space: nowrap;
    }
    .static-tree-list {
      min-height: 0;
      overflow: auto;
      padding: 8px;
      display: grid;
      align-content: start;
      gap: 4px;
    }
    .static-tree-empty {
      padding: 14px 10px;
      color: #aabdd3;
      font-size: 12px;
      line-height: 1.45;
    }
    .static-tree-group {
      margin: 6px 0 3px;
      color: #74e6ff;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .static-tree-item {
      width: 100%;
      min-height: 30px;
      padding: 6px 8px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      border-radius: 8px;
      text-align: left;
      font-size: 11px;
      font-weight: 760;
      background: rgba(11, 29, 51, .76);
    }
    .static-tree-item strong,
    .static-tree-item small {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .static-tree-item small { color: #9fb3cc; font-size: 10px; }
    .static-tree-item.active {
      border-color: rgba(255, 171, 53, .72);
      background: linear-gradient(180deg, rgba(73, 50, 17, .98), rgba(38, 28, 13, .98));
    }
    .tree-toggle.tree-open { border-color: rgba(255, 171, 53, .8); color: #fff; background: linear-gradient(180deg, #176cc8, #0f3f82); }
  `;
  document.head.appendChild(style);
}

function ensureTreePanel() {
  const viewer = document.getElementById('viewer');
  if (!viewer) return null;
  let panel = document.getElementById('staticTreePanel');
  if (panel) return panel;

  panel = document.createElement('aside');
  panel.id = 'staticTreePanel';
  panel.className = 'static-tree-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Model tree');
  panel.innerHTML = `
    <div class="static-tree-head">
      <span>Model Tree</span>
      <button type="button" class="static-tree-close" id="staticTreeCloseBtn" title="Close tree">Ã—</button>
    </div>
    <div class="static-tree-tools">
      <input id="staticTreeSearch" class="static-tree-search" type="search" placeholder="Filter components" />
      <span id="staticTreeCount" class="static-tree-count">0 items</span>
    </div>
    <div id="staticTreeList" class="static-tree-list">
      <div class="static-tree-empty">Load or convert a model to populate the tree.</div>
    </div>
  `;
  viewer.appendChild(panel);

  panel.querySelector('#staticTreeCloseBtn')?.addEventListener('click', closeTree);
  panel.querySelector('#staticTreeSearch')?.addEventListener('input', renderTreeList);
  return panel;
}

function bindTreeToggle() {
  const button = document.getElementById('treeToggleBtn');
  if (!button || button.dataset.boundStaticTree === '1') return;
  button.dataset.boundStaticTree = '1';
  button.addEventListener('click', toggleTree);
}

function bindRuntimeEvents() {
  ['markup:app-ready', 'markup:render-context', 'viewer:runtime-context', 'viewer:grid-visibility-changed']
    .forEach((name) => window.addEventListener(name, () => scheduleRefresh(name)));
}

function installTreeApi() {
  window.__3D_MARKUP_TREE__ = {
    version: VERSION,
    open: openTree,
    close: closeTree,
    toggle: toggleTree,
    refresh: () => scheduleRefresh('api'),
    getObjects: () => state.objects.slice(),
    state
  };
}

function toggleTree() {
  state.open ? closeTree() : openTree();
}

function openTree() {
  const panel = ensureTreePanel();
  if (!panel) return;
  state.open = true;
  panel.hidden = false;
  document.getElementById('treeToggleBtn')?.classList.add('tree-open');
  scheduleRefresh('open');
}

function closeTree() {
  const panel = document.getElementById('staticTreePanel');
  state.open = false;
  if (panel) panel.hidden = true;
  document.getElementById('treeToggleBtn')?.classList.remove('tree-open');
}

function scheduleRefresh(source) {
  window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(() => refreshTree(source), 80);
}

function refreshTree(source = 'manual') {
  state.objects = collectSelectableObjects();
  updateCount();
  if (state.open) renderTreeList();
  window.dispatchEvent(new CustomEvent('viewer:static-tree-refreshed', {
    detail: {
      source,
      count: state.objects.length,
      version: VERSION
    }
  }));
}

function collectSelectableObjects() {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const scene = runtime.scene;
  if (!scene?.traverse) return [];

  const seen = new Set();
  const items = [];
  scene.traverse((object) => {
    if (items.length >= MAX_TREE_ITEMS) return;
    if (!object || isHelperObject(object)) return;
    const data = normalizeUserData(object.userData || {});
    if (!isSelectableData(data)) return;
    const key = object.uuid || object.id || `${data.type}:${data.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ object, data });
  });

  return items.sort((a, b) => {
    const typeCompare = a.data.type.localeCompare(b.data.type);
    if (typeCompare) return typeCompare;
    return a.data.title.localeCompare(b.data.title);
  });
}

function isHelperObject(object) {
  const name = String(object.name || '');
  return name === 'grid'
    || name === 'axes'
    || name.includes('HELPER')
    || name.includes('MEASURE')
    || object.isLight;
}

function normalizeUserData(raw) {
  const type = String(raw.TYPE || raw.type || '').trim();
  const engineering = raw.engineeringType || raw.ENGINEERING_TYPE || raw.meshRole || raw.MESH_ROLE || type || 'Object';
  const id = raw.ID || raw.id || raw.REF_NO || raw.refNo || raw.NODE || raw.node || raw.LABEL || raw.label || raw.name || '';
  const line = raw.lineNo || raw.LINE_NO || '';
  const source = raw.source || raw.SOURCE || raw.sourceMode || raw.SOURCE_MODE || '';
  const title = displayTitle(raw, type, id, engineering);
  return { raw, type: type || 'Object', engineering, id, line, source, title };
}

function displayTitle(raw, type, id, engineering) {
  if (type === 'SUPPORT_RESTRAINT') return `${raw.family || raw.FAMILY || 'Support'} @ ${raw.node || raw.NODE || 'node'}`;
  if (type === 'NODE') return `Node ${raw.NODE || raw.node || id || 'N/A'}`;
  if (type === 'ISONOTE_NAME_PLATE') return raw.BOARD_TEXT || raw.sourceNoteName || raw.SOURCE_NOTE_NAME || 'ISONOTE Annotation';
  if (type === 'ISONOTE_LEADER') return 'ISONOTE Leader';
  return id || engineering || type || 'Object';
}

function isSelectableData(data) {
  if (!data.type || data.type === 'RVM_PRIMITIVE') return false;
  if (data.type === 'Object' && !Object.keys(data.raw || {}).length) return false;
  return true;
}

function updateCount() {
  const count = document.getElementById('staticTreeCount');
  if (count) count.textContent = `${state.objects.length} item${state.objects.length === 1 ? '' : 's'}`;
}

function renderTreeList() {
  const list = document.getElementById('staticTreeList');
  if (!list) return;
  const query = String(document.getElementById('staticTreeSearch')?.value || '').trim().toLowerCase();
  const items = state.objects.filter((item) => treeText(item).includes(query));

  if (!items.length) {
    list.innerHTML = `<div class="static-tree-empty">${state.objects.length ? 'No matching components.' : 'Load or convert a model to populate the tree.'}</div>`;
    return;
  }

  let lastType = '';
  const html = [];
  items.forEach((item) => {
    if (item.data.type !== lastType) {
      lastType = item.data.type;
      html.push(`<div class="static-tree-group">${escapeHtml(lastType)}</div>`);
    }
    const index = state.objects.indexOf(item);
    const active = item.object === state.selectedObject ? ' active' : '';
    html.push(`<button type="button" class="static-tree-item${active}" data-tree-index="${index}">
      <strong>${escapeHtml(item.data.title)}</strong>
      <small>${escapeHtml(item.data.engineering || item.data.source || '')}</small>
    </button>`);
  });
  list.innerHTML = html.join('');
  list.querySelectorAll('[data-tree-index]').forEach((button) => {
    button.addEventListener('click', () => selectTreeObject(Number(button.dataset.treeIndex)));
  });
}

function treeText(item) {
  return [item.data.type, item.data.title, item.data.engineering, item.data.line, item.data.source]
    .join(' ')
    .toLowerCase();
}

function selectTreeObject(index) {
  const item = state.objects[index];
  if (!item?.object) return;
  state.selectedObject = item.object;
  showTreeSelectionHelper(item.object);
  showTreeProperties(item.data);
  document.body.classList.add('props-open');
  document.getElementById('selectedStatus') && (document.getElementById('selectedStatus').textContent = `Selected: ${item.data.title}`);
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  runtime.selectedObject = item.object;
  runtime.selectedData = item.data.raw;
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
  renderTreeList();
  window.dispatchEvent(new CustomEvent('viewer:selection-changed', {
    detail: {
      source: 'static-tree',
      object: item.object,
      data: item.data.raw
    }
  }));
}

function showTreeSelectionHelper(object) {
  removeTreeSelectionHelper();
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const scene = runtime.scene;
  if (!scene?.add) return;
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x)) return;
  state.helper = new THREE.Box3Helper(box, 0xffd166);
  state.helper.name = 'STATIC_TREE_SELECTION_HELPER';
  state.helper.renderOrder = 65;
  state.helper.material.depthTest = false;
  scene.add(state.helper);
}

function removeTreeSelectionHelper() {
  if (!state.helper) return;
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  runtime.scene?.remove?.(state.helper);
  state.helper.geometry?.dispose?.();
  state.helper.material?.dispose?.();
  state.helper = null;
}

function showTreeProperties(data) {
  const body = document.getElementById('propertiesBody');
  if (!body) return;
  body.classList.remove('empty-state');
  const entries = Object.entries(data.raw || {}).slice(0, 28);
  body.innerHTML = `
    <div class="selected-card">
      <div class="selected-card-title">
        <span>${escapeHtml(data.title)}</span>
        <span class="badge">${escapeHtml(data.type)}</span>
      </div>
      <div class="selected-card-subtitle">${escapeHtml(data.engineering || data.source || 'Selected from model tree')}</div>
      <div class="badge-row">
        ${data.line ? `<span class="badge">Line ${escapeHtml(data.line)}</span>` : ''}
        ${data.source ? `<span class="badge">${escapeHtml(data.source)}</span>` : ''}
      </div>
    </div>
    <details class="prop-section" open>
      <summary>Tree Selection</summary>
      <div class="prop-grid">
        <div class="prop-key">Type</div><div class="prop-value">${escapeHtml(data.type)}</div>
        <div class="prop-key">Engineering</div><div class="prop-value">${escapeHtml(data.engineering)}</div>
        <div class="prop-key">ID</div><div class="prop-value">${escapeHtml(data.id || 'N/A')}</div>
        <div class="prop-key">Line</div><div class="prop-value">${escapeHtml(data.line || 'N/A')}</div>
      </div>
    </details>
    <details class="prop-section">
      <summary>Raw Metadata</summary>
      <div class="prop-grid">
        ${entries.map(([key, value]) => `<div class="prop-key">${escapeHtml(key)}</div><div class="prop-value">${escapeHtml(value ?? 'N/A')}</div>`).join('')}
      </div>
    </details>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

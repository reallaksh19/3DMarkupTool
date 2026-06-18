import * as THREE from 'three';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const PANEL_ID = 'modelTreePanel';
const TOGGLE_ID = 'modelTreeToggle';
const SEARCH_ID = 'modelTreeSearch';
const LIST_ID = 'modelTreeList';
const COUNT_ID = 'modelTreeCount';
const STYLE_ID = 'modelTreePanelStyles';

const state = {
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  renderer: runtime?.renderer || null,
  objects: [],
  lastSignature: '',
  highlight: null,
  highlightTimer: 0,
  open: false,
  filter: ''
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initModelTree, { once: true });
} else {
  initModelTree();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (!renderer || !scene) return;
  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera || state.camera;
  rebuildIfChanged();
});

function initModelTree() {
  injectStyles();
  ensurePanel();
  window.addEventListener('keydown', (event) => {
    if (hasInputFocus()) return;
    if (event.key?.toLowerCase() === 't') togglePanel();
  });
  rebuildIfChanged(true);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .model-tree-toggle {
      position: absolute;
      left: 18px;
      top: 18px;
      z-index: 21;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 34px;
      padding: 7px 11px;
      border: 1px solid rgba(101, 213, 255, .44);
      border-radius: 999px;
      background: rgba(7, 13, 22, .76);
      color: #eaf6ff;
      box-shadow: 0 10px 26px rgba(0, 0, 0, .30);
      backdrop-filter: blur(10px);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .35px;
      cursor: pointer;
    }

    .model-tree-toggle:hover,
    .model-tree-toggle.tree-open {
      border-color: rgba(247, 183, 92, .86);
      background: rgba(35, 53, 76, .92);
      color: #fff0cf;
    }

    body.input-open .model-tree-toggle {
      left: 410px;
    }

    .model-tree-panel {
      position: absolute;
      left: 18px;
      top: 60px;
      bottom: 48px;
      z-index: 20;
      width: 342px;
      max-width: min(342px, calc(100vw - 42px));
      display: grid;
      grid-template-rows: auto auto 1fr;
      border: 1px solid rgba(88, 124, 160, .70);
      border-radius: 14px;
      background: rgba(11, 21, 35, .94);
      box-shadow: 0 18px 50px rgba(0, 0, 0, .36);
      backdrop-filter: blur(14px);
      overflow: hidden;
      transform: translateX(calc(-100% - 24px));
      opacity: 0;
      pointer-events: none;
      transition: transform .18s ease, opacity .18s ease;
    }

    body.input-open .model-tree-panel {
      left: 410px;
    }

    .model-tree-panel.tree-open {
      transform: translateX(0);
      opacity: 1;
      pointer-events: auto;
    }

    .model-tree-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 12px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, .09);
    }

    .model-tree-head strong {
      display: block;
      color: #fff;
      font-size: 13px;
      letter-spacing: .2px;
    }

    .model-tree-head span {
      display: block;
      margin-top: 3px;
      color: #9fb0c5;
      font-size: 11px;
      line-height: 1.35;
    }

    .model-tree-close {
      width: 28px;
      min-width: 28px;
      height: 28px;
      min-height: 28px;
      padding: 0;
      border-radius: 8px;
      background: rgba(255, 255, 255, .04);
    }

    .model-tree-search {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, .08);
      background: rgba(255, 255, 255, .025);
    }

    .model-tree-search input {
      width: 100%;
      height: 32px;
      border: 1px solid rgba(83, 119, 153, .86);
      border-radius: 9px;
      padding: 0 10px;
      color: #f6fbff;
      background: #07101d;
      font-size: 12px;
      outline: none;
    }

    .model-tree-search input:focus {
      border-color: rgba(101, 213, 255, .86);
      box-shadow: 0 0 0 2px rgba(101, 213, 255, .16);
    }

    .model-tree-list {
      overflow: auto;
      padding: 8px 10px 14px;
      color: #dce8f4;
      font-size: 12px;
    }

    .tree-empty {
      margin: 12px 4px;
      padding: 12px;
      border: 1px dashed rgba(132, 178, 220, .38);
      border-radius: 10px;
      color: #b8c8d9;
      background: rgba(255, 255, 255, .03);
      line-height: 1.4;
    }

    .tree-group {
      margin: 7px 0;
      border: 1px solid rgba(65, 94, 124, .72);
      border-radius: 10px;
      overflow: hidden;
      background: rgba(9, 18, 31, .58);
    }

    .tree-group > summary,
    .tree-subgroup > summary {
      cursor: pointer;
      user-select: none;
      list-style-position: inside;
    }

    .tree-group > summary {
      padding: 8px 9px;
      color: #ffffff;
      background: rgba(24, 42, 64, .88);
      font-weight: 900;
    }

    .tree-subgroup {
      margin: 6px 7px;
      border: 1px solid rgba(58, 86, 116, .64);
      border-radius: 8px;
      background: rgba(7, 14, 25, .56);
    }

    .tree-subgroup > summary {
      padding: 7px 8px;
      color: #d9efff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .2px;
      text-transform: uppercase;
    }

    .tree-count {
      float: right;
      min-width: 20px;
      padding: 1px 6px;
      border: 1px solid rgba(101, 213, 255, .28);
      border-radius: 999px;
      color: #d4ecff;
      background: rgba(101, 213, 255, .08);
      font-size: 10px;
      text-align: center;
    }

    .tree-item {
      width: calc(100% - 12px);
      min-height: auto;
      margin: 3px 6px 6px;
      padding: 7px 8px;
      display: grid;
      gap: 2px;
      border-radius: 8px;
      border: 1px solid transparent;
      color: #eff8ff;
      background: transparent;
      text-align: left;
      box-shadow: none;
    }

    .tree-item:hover,
    .tree-item.tree-item-active {
      border-color: rgba(247, 183, 92, .68);
      background: rgba(90, 67, 44, .36);
    }

    .tree-title {
      font-weight: 900;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tree-meta {
      color: #9fb0c5;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @media (max-width: 940px) {
      body.input-open .model-tree-toggle,
      .model-tree-toggle { left: 12px; top: 12px; }
      body.input-open .model-tree-panel,
      .model-tree-panel { left: 12px; top: 54px; width: calc(100vw - 24px); }
    }
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  const host = document.querySelector('.viewer-stage') || document.body;

  let toggle = document.getElementById(TOGGLE_ID);
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.type = 'button';
    toggle.className = 'model-tree-toggle';
    toggle.title = 'Show model tree (T)';
    toggle.textContent = 'Tree';
    toggle.addEventListener('click', togglePanel);
    host.appendChild(toggle);
  }

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.className = 'model-tree-panel';
    panel.setAttribute('aria-label', 'Model tree grouped by line number and component type');
    panel.innerHTML = `
      <div class="model-tree-head">
        <div>
          <strong>Model Tree</strong>
          <span id="${COUNT_ID}">Load a model to populate tree.</span>
        </div>
        <button type="button" class="model-tree-close" aria-label="Close model tree">×</button>
      </div>
      <div class="model-tree-search">
        <input id="${SEARCH_ID}" type="search" placeholder="Filter line, type, tag, node..." />
      </div>
      <div id="${LIST_ID}" class="model-tree-list">
        <div class="tree-empty">Run conversion to build the model tree.</div>
      </div>`;
    panel.querySelector('.model-tree-close')?.addEventListener('click', () => setPanel(false));
    panel.querySelector(`#${SEARCH_ID}`)?.addEventListener('input', (event) => {
      state.filter = event.target.value.trim().toLowerCase();
      renderTree();
    });
    host.appendChild(panel);
  }
}

function togglePanel() {
  setPanel(!state.open);
}

function setPanel(open) {
  state.open = Boolean(open);
  document.getElementById(PANEL_ID)?.classList.toggle('tree-open', state.open);
  document.getElementById(TOGGLE_ID)?.classList.toggle('tree-open', state.open);
  if (state.open) rebuildIfChanged(true);
}

function rebuildIfChanged(force = false) {
  const root = state.scene || runtime?.scene;
  if (!root) return;

  const objects = collectObjects(root);
  const signature = objects.map((entry) => entry.signature).join('|');
  if (!force && signature === state.lastSignature) return;

  state.lastSignature = signature;
  state.objects = objects;
  renderTree();
}

function collectObjects(root) {
  const entries = [];
  root.traverse?.((object) => {
    if (!object.visible || shouldSkip(object)) return;
    const data = findUserData(object);
    if (!Object.keys(data).length) return;

    const type = normalizeText(data.engineeringType || data.ENGINEERING_TYPE || data.type || data.TYPE || object.type || 'Object');
    if (/RVM_PRIMITIVE/i.test(type)) return;

    const lineNo = normalizeText(data.lineNo || data.LINE_NO || data.lineNumber || data.LINE_NUMBER || 'No Line No');
    const nodeText = normalizeText(data.node || data.NODE || [data.fromNode || data.FROM_NODE, data.toNode || data.TO_NODE].filter(Boolean).join(' → '));
    const title = normalizeText(data.ID || data.id || data.REF_NO || data.refNo || data.LABEL || data.label || object.name || type);
    const source = normalizeText(data.source || data.SOURCE || data.sourceMode || data.SOURCE_MODE || '');

    entries.push({
      object,
      data,
      lineNo,
      type,
      title,
      nodeText,
      source,
      signature: `${lineNo}::${type}::${title}::${nodeText}::${object.uuid}`,
      search: `${lineNo} ${type} ${title} ${nodeText} ${source}`.toLowerCase()
    });
  });

  return dedupeByObject(entries).sort((a, b) => naturalSort(a.lineNo, b.lineNo) || naturalSort(a.type, b.type) || naturalSort(a.title, b.title));
}

function dedupeByObject(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.object.uuid)) return false;
    seen.add(entry.object.uuid);
    return true;
  });
}

function renderTree() {
  ensurePanel();
  const list = document.getElementById(LIST_ID);
  const count = document.getElementById(COUNT_ID);
  if (!list || !count) return;

  const filtered = state.filter ? state.objects.filter((entry) => entry.search.includes(state.filter)) : state.objects;
  count.textContent = filtered.length ? `${filtered.length} selectable objects` : 'No matching selectable objects.';

  if (!filtered.length) {
    list.innerHTML = `<div class="tree-empty">${state.objects.length ? 'No objects match the filter.' : 'Run conversion to build the model tree.'}</div>`;
    return;
  }

  const byLine = groupBy(filtered, (entry) => entry.lineNo || 'No Line No');
  list.innerHTML = Object.entries(byLine).map(([lineNo, lineItems]) => {
    const byType = groupBy(lineItems, (entry) => entry.type || 'Object');
    return `<details class="tree-group" open>
      <summary>${escapeHtml(lineNo)} <span class="tree-count">${lineItems.length}</span></summary>
      ${Object.entries(byType).map(([type, typeItems]) => `<details class="tree-subgroup" open>
        <summary>${escapeHtml(type)} <span class="tree-count">${typeItems.length}</span></summary>
        ${typeItems.map((entry) => treeItem(entry)).join('')}
      </details>`).join('')}
    </details>`;
  }).join('');

  list.querySelectorAll('.tree-item').forEach((button) => {
    button.addEventListener('click', () => {
      const object = state.objects.find((entry) => entry.object.uuid === button.dataset.uuid)?.object;
      if (!object) return;
      list.querySelectorAll('.tree-item-active').forEach((node) => node.classList.remove('tree-item-active'));
      button.classList.add('tree-item-active');
      highlightObject(object);
    });
  });
}

function treeItem(entry) {
  const meta = [entry.nodeText ? `Node ${entry.nodeText}` : '', entry.source].filter(Boolean).join(' / ');
  return `<button type="button" class="tree-item" data-uuid="${escapeHtml(entry.object.uuid)}" title="${escapeHtml(entry.title)}">
    <span class="tree-title">${escapeHtml(entry.title)}</span>
    <span class="tree-meta">${escapeHtml(meta || entry.type)}</span>
  </button>`;
}

function highlightObject(object) {
  removeHighlight();
  const scene = state.scene || runtime?.scene;
  if (!scene) return;

  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x)) return;

  const helper = new THREE.Box3Helper(box, 0xf7b75c);
  helper.name = 'MODEL_TREE_TEMP_HIGHLIGHT';
  helper.renderOrder = 1200;
  helper.userData = { isDisplayHelper: true, ignoreBounds: true };
  if (helper.material) {
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.95;
  }

  scene.add(helper);
  state.highlight = helper;
  window.clearTimeout(state.highlightTimer);
  state.highlightTimer = window.setTimeout(removeHighlight, 4500);
}

function removeHighlight() {
  if (!state.highlight) return;
  const parent = state.highlight.parent;
  parent?.remove?.(state.highlight);
  state.highlight.geometry?.dispose?.();
  state.highlight.material?.dispose?.();
  state.highlight = null;
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
  if (!object || object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;

  const name = String(object.name || '').toLowerCase();
  if (name === 'grid' || name === 'axes') return true;
  if (name.includes('helper')) return true;
  if (name.includes('measure')) return true;
  if (name.includes('clip_plane_preview')) return true;
  if (name.includes('model_tree_temp_highlight')) return true;

  let parent = object.parent;
  while (parent) {
    const parentName = String(parent.name || '').toLowerCase();
    if (parent.userData?.ignoreBounds || parent.userData?.isDisplayHelper) return true;
    if (parentName.includes('helper') || parentName.includes('measure')) return true;
    parent = parent.parent;
  }

  return false;
}

function groupBy(items, keyFn) {
  return items.reduce((map, item) => {
    const key = keyFn(item) || 'Unassigned';
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});
}

function naturalSort(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || '';
}

function hasInputFocus() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

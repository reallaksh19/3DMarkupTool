import * as THREE from 'three';

// Adds compact in-canvas component search/jump tooling without touching src/app.js.
// Tool: SR = Search. Searches model object names/userData and focuses camera on a match.

const VERSION = 'component-search-viewpad-20260619';
const STYLE_ID = 'static-component-search-style';
const PANEL_ID = 'staticComponentSearchPanel';
const TOOL_VIEW = 'componentSearch';
const TOOL_LABEL = 'SR';
const TOOL_TITLE = 'Search / jump to component, node, line, support, or tag';
const MAX_RESULTS = 40;
const SEARCHABLE_KEYS = [
  'ID', 'id', 'componentId', 'COMPONENT_ID', 'sourceId', 'SOURCE_ID',
  'TAG', 'tag', 'SUPPORT_TAG', 'supportTag', 'LINE_NO', 'lineNo', 'lineNumber',
  'NODE', 'node', 'fromNode', 'toNode', 'FROM_NODE', 'TO_NODE',
  'TYPE', 'type', 'componentClass', 'componentType', 'NAME', 'name', 'rawType'
];

let lastIndex = [];
let lastResults = [];
let activeHighlight = null;
let activeObject = null;

installComponentSearchTool();

function installComponentSearchTool() {
  const start = () => {
    injectStyles();
    ensureButton();
    ensurePanel();
    installApi();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function ensureButton() {
  const pad = document.querySelector('.view-pad');
  if (!pad) return;
  pad.classList.add('view-pad-with-component-search');

  let button = pad.querySelector(`[data-view="${TOOL_VIEW}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = TOOL_VIEW;
    button.className = 'viewpad-component-search-btn';
    button.textContent = TOOL_LABEL;
    const anchor = pad.querySelector('[data-view="savedViews"]')
      || pad.querySelector('[data-view="viewPrevious"]')
      || pad.querySelector('[data-view="marqueeZoom"]')
      || pad.querySelector('[data-view="zoom"]')
      || null;
    pad.insertBefore(button, anchor);
  }

  button.title = TOOL_TITLE;
  button.setAttribute('aria-label', TOOL_TITLE);
  if (!button.__componentSearchClickBound) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    });
    button.__componentSearchClickBound = true;
  }
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  const host = document.getElementById('viewer') || document.querySelector('.viewer-wrap') || document.body;
  panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'component-search-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Component Search');
  host.appendChild(panel);
  renderPanel(panel);
  return panel;
}

function renderPanel(panel = document.getElementById(PANEL_ID), query = '') {
  if (!panel) return;
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'component-search-panel__header';
  header.innerHTML = '<strong>Search</strong><span>component / node / line / support</span>';
  panel.appendChild(header);

  const searchRow = document.createElement('div');
  searchRow.className = 'component-search-panel__search-row';

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Type node, line no, tag, ID...';
  input.value = query;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.addEventListener('input', () => updateResults(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = lastResults[0];
      if (first) focusSearchResult(first.id);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      togglePanel(false);
    }
  });
  searchRow.appendChild(input);

  searchRow.appendChild(panelButton('×', 'Close search', () => togglePanel(false)));
  panel.appendChild(searchRow);

  const list = document.createElement('div');
  list.className = 'component-search-panel__results';
  list.dataset.componentSearchResults = '1';
  panel.appendChild(list);

  updateResults(query);
  window.setTimeout(() => input.focus(), 0);
}

function panelButton(text, title, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  });
  return button;
}

function togglePanel(force) {
  const panel = ensurePanel();
  if (!panel) return;
  const nextVisible = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !nextVisible;
  if (nextVisible) renderPanel(panel);
  dispatchSearch('panel', { visible: nextVisible, indexCount: buildSearchIndex().length });
}

function updateResults(query) {
  const list = document.querySelector('[data-component-search-results="1"]');
  if (!list) return [];
  const results = searchComponents(query);
  list.innerHTML = '';

  if (!query.trim()) {
    list.appendChild(emptyRow(`${lastIndex.length} searchable objects`));
    return results;
  }

  if (!results.length) {
    list.appendChild(emptyRow('No matches'));
    return results;
  }

  for (const result of results.slice(0, MAX_RESULTS)) {
    list.appendChild(resultRow(result));
  }
  return results;
}

function resultRow(result) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'component-search-panel__result';
  row.dataset.componentSearchId = result.id;
  row.title = result.path || result.label;
  row.addEventListener('click', () => focusSearchResult(result.id));

  const label = document.createElement('strong');
  label.textContent = result.label;
  row.appendChild(label);

  const meta = document.createElement('span');
  meta.textContent = result.meta;
  row.appendChild(meta);

  return row;
}

function emptyRow(text) {
  const row = document.createElement('div');
  row.className = 'component-search-panel__empty';
  row.textContent = text;
  return row;
}

function installApi() {
  window.__3D_MARKUP_COMPONENT_SEARCH__ = {
    version: VERSION,
    open: () => togglePanel(true),
    close: () => togglePanel(false),
    index: () => buildSearchIndex(),
    search: (query) => searchComponents(query),
    focus: (idOrIndex) => focusSearchResult(idOrIndex),
    clear: () => clearHighlight(),
    debug: () => ({ indexCount: buildSearchIndex().length, resultCount: lastResults.length, activeId: activeObject ? objectId(activeObject) : null })
  };
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function modelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
}

function buildSearchIndex() {
  const rt = runtime();
  const root = modelRoot(rt);
  const seen = new Set();
  const index = [];
  if (!root?.traverse) {
    lastIndex = [];
    return lastIndex;
  }

  root.traverse((object) => {
    if (!object || object === root || seen.has(object.uuid)) return;
    const data = object.userData || {};
    if (!isSearchableObject(object, data)) return;
    const searchRoot = componentRootFor(object, root);
    if (searchRoot && !seen.has(searchRoot.uuid)) {
      seen.add(searchRoot.uuid);
      index.push(searchRecord(searchRoot));
    } else if (!searchRoot) {
      seen.add(object.uuid);
      index.push(searchRecord(object));
    }
  });

  lastIndex = index.filter(Boolean);
  return lastIndex;
}

function isSearchableObject(object, data = object.userData || {}) {
  if (object.name && object.name.trim()) return true;
  return SEARCHABLE_KEYS.some((key) => data[key] !== undefined && data[key] !== null && `${data[key]}`.trim() !== '');
}

function componentRootFor(object, root) {
  let cursor = object;
  let candidate = isSearchableObject(cursor) ? cursor : null;
  while (cursor?.parent && cursor.parent !== root && cursor.parent.type !== 'Scene') {
    cursor = cursor.parent;
    if (isSearchableObject(cursor)) candidate = cursor;
  }
  return candidate || object;
}

function searchRecord(object) {
  const data = object.userData || {};
  const id = object.uuid;
  const label = objectLabel(object);
  const meta = objectMeta(data, object);
  const haystack = normalizeSearchText([label, meta, object.name, object.type, stringifyUserData(data)].join(' '));
  return { id, label, meta, path: objectPath(object), object, haystack };
}

function searchComponents(query) {
  const q = normalizeSearchText(query || '');
  const index = buildSearchIndex();
  if (!q) {
    lastResults = [];
    return lastResults;
  }
  lastResults = index
    .map((record) => ({ ...record, score: searchScore(record, q) }))
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, MAX_RESULTS);
  dispatchSearch('search', { query, results: lastResults.length, indexCount: index.length });
  return lastResults;
}

function searchScore(record, q) {
  if (!record?.haystack) return 0;
  const label = normalizeSearchText(record.label);
  if (label === q) return 100;
  if (label.startsWith(q)) return 85;
  if (record.haystack.includes(` ${q} `)) return 70;
  if (record.haystack.includes(q)) return 50;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length && tokens.every((token) => record.haystack.includes(token))) return 35;
  return 0;
}

function focusSearchResult(idOrIndex) {
  let result = null;
  if (typeof idOrIndex === 'number') result = lastResults[idOrIndex] || lastIndex[idOrIndex];
  if (!result && typeof idOrIndex === 'string') {
    result = lastResults.find((item) => item.id === idOrIndex)
      || lastIndex.find((item) => item.id === idOrIndex || normalizeSearchText(item.label) === normalizeSearchText(idOrIndex));
  }
  if (!result && lastResults.length) result = lastResults[0];
  if (!result?.object) {
    setStatus('Search result not found');
    dispatchSearch('fail', { reason: 'result-not-found', idOrIndex });
    return false;
  }

  const ok = focusObject(result.object);
  if (!ok) return false;
  activeObject = result.object;
  highlightObject(result.object);
  setStatus(`Found ${result.label}`);
  dispatchSearch('focus', { id: result.id, label: result.label, meta: result.meta });
  return true;
}

function focusObject(object) {
  const rt = runtime();
  const camera = rt?.camera;
  if (!camera || !object) {
    setStatus('Viewer camera not ready');
    return false;
  }

  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    setStatus('Search result has no bounds');
    return false;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const controls = rt?.controls;
  const direction = new THREE.Vector3().subVectors(camera.position, controls?.target || center);
  if (direction.lengthSq() < 1e-6) direction.set(1, 1, 1);
  direction.normalize();

  if (camera.isPerspectiveCamera || camera.type === 'PerspectiveCamera') {
    const fov = THREE.MathUtils.degToRad(camera.fov || 50);
    const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.8;
    camera.position.copy(center).addScaledVector(direction, Math.max(distance, maxDim * 2));
  } else if (camera.isOrthographicCamera || camera.type === 'OrthographicCamera') {
    camera.position.copy(center).addScaledVector(direction, Math.max(maxDim * 2, 100));
    const width = Math.max(camera.right - camera.left, 1);
    const height = Math.max(camera.top - camera.bottom, 1);
    camera.zoom = Math.max(0.05, Math.min(1000, Math.min(width, height) / (maxDim * 2.2)));
  } else {
    camera.position.copy(center).addScaledVector(direction, Math.max(maxDim * 3, 100));
  }

  if (controls?.target) controls.target.copy(center);
  controls?.update?.();
  camera.updateProjectionMatrix?.();
  rt?.renderOnce?.('component-search-focus');
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { reason: 'component-search-focus' } }));
  return true;
}

function highlightObject(object) {
  clearHighlight();
  const rt = runtime();
  const scene = rt?.scene || object?.parent;
  if (!scene || !object) return null;
  const helper = new THREE.BoxHelper(object, 0x00e5ff);
  helper.name = 'ComponentSearchHighlight';
  helper.userData = { TYPE: 'VIEWPAD_HELPER', helperRole: 'component-search-highlight', sourceObjectId: objectId(object) };
  scene.add(helper);
  activeHighlight = helper;
  rt?.renderOnce?.('component-search-highlight');
  return helper;
}

function clearHighlight() {
  if (activeHighlight?.parent) activeHighlight.parent.remove(activeHighlight);
  activeHighlight?.geometry?.dispose?.();
  activeHighlight?.material?.dispose?.();
  activeHighlight = null;
  runtime()?.renderOnce?.('component-search-clear');
  return true;
}

function objectLabel(object) {
  const data = object.userData || {};
  const keys = ['ID', 'id', 'componentId', 'COMPONENT_ID', 'TAG', 'tag', 'SUPPORT_TAG', 'lineNo', 'LINE_NO', 'name', 'NAME'];
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && `${value}`.trim()) return `${value}`.trim();
  }
  return object.name || object.uuid || 'component';
}

function objectId(object) {
  return objectLabel(object);
}

function objectMeta(data, object) {
  const bits = [];
  const type = data.componentType || data.rawType || data.TYPE || object.type;
  const klass = data.componentClass || data.CLASS || data.kind;
  const line = data.lineNo || data.LINE_NO || data.lineNumber;
  const from = data.fromNode || data.FROM_NODE;
  const to = data.toNode || data.TO_NODE;
  if (klass) bits.push(`${klass}`);
  if (type && type !== klass) bits.push(`${type}`);
  if (line) bits.push(`Line ${line}`);
  if (from || to) bits.push(`${from || '?'}→${to || '?'}`);
  return bits.join(' · ') || object.type || 'Object';
}

function objectPath(object) {
  const names = [];
  let cursor = object;
  while (cursor && cursor.type !== 'Scene') {
    names.push(objectLabel(cursor));
    cursor = cursor.parent;
  }
  return names.reverse().join(' / ');
}

function stringifyUserData(data) {
  try {
    return Object.entries(data || {})
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => `${key} ${value}`)
      .join(' ');
  } catch {
    return '';
  }
}

function normalizeSearchText(value) {
  return ` ${String(value || '').toLowerCase().replace(/[^a-z0-9_.:+\-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (status) status.textContent = message;
}

function dispatchSearch(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:component-search', { detail: { action, ...detail } }));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .viewpad-component-search-btn { font-weight: 800; letter-spacing: -0.04em; }
    .component-search-panel {
      position: absolute;
      top: 78px;
      right: 62px;
      z-index: 30;
      width: min(340px, calc(100vw - 96px));
      max-height: min(460px, calc(100vh - 120px));
      padding: 10px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.94);
      color: #e5e7eb;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
      backdrop-filter: blur(8px);
      overflow: hidden;
    }
    .component-search-panel[hidden] { display: none !important; }
    .component-search-panel__header { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; margin-bottom: 8px; }
    .component-search-panel__header span { color: #94a3b8; font-size: 11px; }
    .component-search-panel__search-row { display: grid; grid-template-columns: 1fr 32px; gap: 6px; margin-bottom: 8px; }
    .component-search-panel__search-row input {
      min-width: 0;
      padding: 7px 9px;
      border-radius: 9px;
      border: 1px solid rgba(148, 163, 184, 0.32);
      background: rgba(2, 6, 23, 0.72);
      color: #f8fafc;
      outline: none;
    }
    .component-search-panel__search-row button,
    .component-search-panel__result {
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 9px;
      background: rgba(30, 41, 59, 0.76);
      color: #e5e7eb;
      cursor: pointer;
    }
    .component-search-panel__results { display: grid; gap: 5px; max-height: 350px; overflow: auto; padding-right: 2px; }
    .component-search-panel__result { display: grid; grid-template-columns: 1fr; gap: 2px; padding: 7px 8px; text-align: left; }
    .component-search-panel__result:hover { background: rgba(51, 65, 85, 0.92); }
    .component-search-panel__result span { color: #cbd5e1; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .component-search-panel__empty { color: #94a3b8; font-size: 12px; padding: 10px 4px; text-align: center; }
  `;
  document.head.appendChild(style);
}

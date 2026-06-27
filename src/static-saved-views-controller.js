import * as THREE from 'three';

// Adds compact in-canvas Saved Views tooling without touching src/app.js.
// Tool: SV = Saved Views. Captures/restores camera target, zoom/orientation, and clipping planes.

const VERSION = 'saved-views-viewpad-20260619';
const STYLE_ID = 'static-saved-views-style';
const PANEL_ID = 'staticSavedViewsPanel';
const TOOL_VIEW = 'savedViews';
const TOOL_LABEL = 'SV';
const TOOL_TITLE = 'Saved Views: save/restore camera and clipping';
const STORAGE_KEY = '3dmarkup.savedViews.v1';
const MAX_SAVED_VIEWS = 30;

installSavedViewsTool();

function installSavedViewsTool() {
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
  pad.classList.add('view-pad-with-saved-views');

  let button = pad.querySelector(`[data-view="${TOOL_VIEW}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = TOOL_VIEW;
    button.className = 'viewpad-saved-views-btn';
    button.textContent = TOOL_LABEL;
    const anchor = pad.querySelector('[data-view="viewPrevious"]')
      || pad.querySelector('[data-view="marqueeZoom"]')
      || pad.querySelector('[data-view="zoom"]')
      || null;
    pad.insertBefore(button, anchor);
  }

  button.title = TOOL_TITLE;
  button.setAttribute('aria-label', TOOL_TITLE);
  if (!button.__savedViewsClickBound) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    });
    button.__savedViewsClickBound = true;
  }
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) {
    renderPanel(panel);
    return panel;
  }

  const host = document.getElementById('viewer') || document.querySelector('.viewer-wrap') || document.body;
  panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'saved-views-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Saved Views');
  host.appendChild(panel);
  renderPanel(panel);
  return panel;
}

function renderPanel(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return;
  const views = loadSavedViews();
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'saved-views-panel__header';
  header.innerHTML = '<strong>Saved Views</strong><span>camera + clip</span>';
  panel.appendChild(header);

  const actions = document.createElement('div');
  actions.className = 'saved-views-panel__actions';
  actions.appendChild(panelButton('Save', 'Save current view', () => saveCurrentView()));
  actions.appendChild(panelButton('Last', 'Restore latest saved view', () => restoreLatestView()));
  actions.appendChild(panelButton('Close', 'Close saved views', () => togglePanel(false)));
  panel.appendChild(actions);

  const list = document.createElement('div');
  list.className = 'saved-views-panel__list';
  if (!views.length) {
    const empty = document.createElement('div');
    empty.className = 'saved-views-panel__empty';
    empty.textContent = 'No saved views yet';
    list.appendChild(empty);
  } else {
    for (const view of views.slice().reverse()) {
      list.appendChild(viewRow(view));
    }
  }
  panel.appendChild(list);
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

function viewRow(view) {
  const row = document.createElement('div');
  row.className = 'saved-views-panel__row';
  row.dataset.savedViewId = view.id;

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'saved-views-panel__restore';
  label.title = `Restore ${view.name}`;
  label.textContent = view.name || 'Saved View';
  label.addEventListener('click', () => restoreSavedView(view.id));
  row.appendChild(label);

  const meta = document.createElement('span');
  meta.className = 'saved-views-panel__meta';
  meta.textContent = formatTime(view.createdAt);
  row.appendChild(meta);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'saved-views-panel__delete';
  remove.title = `Delete ${view.name}`;
  remove.textContent = 'Ã—';
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteSavedView(view.id);
  });
  row.appendChild(remove);

  return row;
}

function togglePanel(force) {
  const panel = ensurePanel();
  if (!panel) return;
  const nextVisible = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !nextVisible;
  if (nextVisible) renderPanel(panel);
  dispatchSavedView('panel', { visible: nextVisible, count: loadSavedViews().length });
}

function installApi() {
  window.__3D_MARKUP_SAVED_VIEWS__ = {
    version: VERSION,
    save: (name) => saveCurrentView({ name }),
    restore: (id) => restoreSavedView(id),
    restoreLatest: () => restoreLatestView(),
    delete: (id) => deleteSavedView(id),
    list: () => loadSavedViews(),
    clear: () => clearSavedViews(),
    debug: () => debugSnapshot()
  };
}

function saveCurrentView({ name } = {}) {
  const snapshot = captureViewSnapshot();
  if (!snapshot) {
    setStatus('Saved View failed: camera not ready');
    dispatchSavedView('fail', { reason: 'camera-missing' });
    return null;
  }

  const views = loadSavedViews();
  const fallbackName = `View ${views.length + 1}`;
  let viewName = typeof name === 'string' && name.trim() ? name.trim() : fallbackName;
  if (!name && typeof window.prompt === 'function') {
    viewName = (window.prompt('Saved view name', fallbackName) || fallbackName).trim() || fallbackName;
  }

  const view = {
    id: `view_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    schemaVersion: 'SavedView.v1',
    name: viewName,
    createdAt: Date.now(),
    snapshot
  };
  views.push(view);
  while (views.length > MAX_SAVED_VIEWS) views.shift();
  storeSavedViews(views);
  renderPanel();
  setStatus(`Saved view: ${view.name}`);
  dispatchSavedView('save', { id: view.id, name: view.name, count: views.length });
  return view;
}

function restoreLatestView() {
  const views = loadSavedViews();
  const latest = views[views.length - 1];
  if (!latest) {
    setStatus('No saved views');
    dispatchSavedView('fail', { reason: 'no-saved-views' });
    return false;
  }
  return restoreSavedView(latest.id);
}

function restoreSavedView(id) {
  const views = loadSavedViews();
  const view = views.find((item) => item.id === id) || views[views.length - 1];
  if (!view) {
    setStatus('Saved View not found');
    dispatchSavedView('fail', { reason: 'view-not-found', id });
    return false;
  }
  const ok = applyViewSnapshot(view.snapshot, `saved-view:${view.id}`);
  if (ok) {
    setStatus(`Restored view: ${view.name}`);
    dispatchSavedView('restore', { id: view.id, name: view.name });
  }
  return ok;
}

function deleteSavedView(id) {
  const views = loadSavedViews();
  const next = views.filter((item) => item.id !== id);
  storeSavedViews(next);
  renderPanel();
  setStatus('Saved view deleted');
  dispatchSavedView('delete', { id, count: next.length });
  return next.length !== views.length;
}

function clearSavedViews() {
  storeSavedViews([]);
  renderPanel();
  setStatus('Saved views cleared');
  dispatchSavedView('clear', { count: 0 });
  return true;
}

function captureViewSnapshot() {
  const rt = runtime();
  const camera = rt?.camera;
  const controls = rt?.controls;
  if (!camera) return null;
  return {
    cameraType: camera.type || 'Camera',
    position: vectorToArray(camera.position),
    quaternion: quaternionToArray(camera.quaternion),
    up: vectorToArray(camera.up, [0, 1, 0]),
    zoom: finiteOr(camera.zoom, 1),
    target: vectorToArray(controls?.target),
    clipping: captureClipping(rt)
  };
}

function applyViewSnapshot(snapshot, reason) {
  const rt = runtime();
  const camera = rt?.camera;
  const controls = rt?.controls;
  if (!camera || !snapshot) return false;

  setVector(camera.position, snapshot.position);
  setVector(camera.up, snapshot.up || [0, 1, 0]);
  if (camera.quaternion && Array.isArray(snapshot.quaternion)) {
    camera.quaternion.set(snapshot.quaternion[0], snapshot.quaternion[1], snapshot.quaternion[2], snapshot.quaternion[3]);
  }
  if (Number.isFinite(snapshot.zoom)) camera.zoom = snapshot.zoom;
  if (controls?.target && snapshot.target) setVector(controls.target, snapshot.target);
  restoreClipping(rt, snapshot.clipping || {});
  controls?.update?.();
  camera.updateProjectionMatrix?.();
  requestRender(rt, reason || 'saved-view-restore');
  return true;
}

function captureClipping(rt = runtime()) {
  const renderer = rt?.renderer;
  const planes = Array.isArray(renderer?.clippingPlanes)
    ? renderer.clippingPlanes
    : Array.isArray(rt?.clippingPlanes)
      ? rt.clippingPlanes
      : [];
  return {
    enabled: Boolean(renderer?.localClippingEnabled || planes.length),
    mode: rt?.clippingMode || (planes.length ? 'unknown' : 'none'),
    source: rt?.source || 'saved-view',
    planes: planes.map((plane) => ({
      normal: vectorToArray(plane?.normal),
      constant: finiteOr(plane?.constant, 0)
    }))
  };
}

function restoreClipping(rt = runtime(), clipping = {}) {
  const renderer = rt?.renderer;
  const planes = Array.isArray(clipping.planes) ? clipping.planes.map(hydratePlane).filter(Boolean) : [];
  const meta = { source: 'saved-view-restore', mode: clipping.mode || (planes.length ? 'saved' : 'none') };

  if (planes.length && typeof rt?.applyClipping === 'function') {
    rt.applyClipping(planes, meta);
  } else if (!planes.length && typeof rt?.clearClipping === 'function') {
    rt.clearClipping(meta);
  } else if (renderer) {
    renderer.localClippingEnabled = planes.length > 0;
    renderer.clippingPlanes = planes;
  }

  if (rt) {
    rt.clippingPlanes = planes;
    rt.clippingMode = planes.length ? (clipping.mode || 'saved') : 'none';
    rt.source = 'saved-view-restore';
  }
  return planes.length;
}

function hydratePlane(record) {
  if (!record || !Array.isArray(record.normal)) return null;
  return new THREE.Plane(
    new THREE.Vector3(finiteOr(record.normal[0], 0), finiteOr(record.normal[1], 0), finiteOr(record.normal[2], 0)),
    finiteOr(record.constant, 0)
  );
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function requestRender(rt, reason) {
  if (typeof rt?.renderOnce === 'function') {
    rt.renderOnce(reason);
  } else {
    window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { source: reason } }));
  }
}

function loadSavedViews() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isSavedView) : [];
  } catch {
    return [];
  }
}

function storeSavedViews(views) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views.filter(isSavedView)));
  } catch (error) {
    console.warn('[3DMarkupTool] Failed to store saved views.', error);
  }
}

function isSavedView(view) {
  return Boolean(view && typeof view.id === 'string' && view.snapshot && Array.isArray(view.snapshot.position));
}

function vectorToArray(vector, fallback = [0, 0, 0]) {
  if (!vector) return fallback.slice();
  return [finiteOr(vector.x, fallback[0]), finiteOr(vector.y, fallback[1]), finiteOr(vector.z, fallback[2])];
}

function quaternionToArray(quaternion) {
  if (!quaternion) return [0, 0, 0, 1];
  return [finiteOr(quaternion.x, 0), finiteOr(quaternion.y, 0), finiteOr(quaternion.z, 0), finiteOr(quaternion.w, 1)];
}

function setVector(vector, values) {
  if (!vector || !Array.isArray(values)) return;
  vector.set?.(finiteOr(values[0], 0), finiteOr(values[1], 0), finiteOr(values[2], 0));
}

function finiteOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function formatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('runtimeStatus');
  if (status && message) status.textContent = message;
}

function dispatchSavedView(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:saved-view', {
    detail: { action, ...detail }
  }));
}

function debugSnapshot() {
  const views = loadSavedViews();
  const rt = runtime();
  return {
    version: VERSION,
    storageKey: STORAGE_KEY,
    count: views.length,
    hasCamera: Boolean(rt?.camera),
    hasControls: Boolean(rt?.controls),
    latest: views[views.length - 1]?.name || null
  };
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .view-pad-with-saved-views .viewpad-saved-views-btn {
      border: 1px solid rgba(151, 128, 255, 0.82);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(52, 44, 111, 0.96), rgba(26, 22, 66, 0.98));
      color: #f0edff;
      font-size: 10px;
      font-weight: 950;
      min-width: 44px;
      min-height: 34px;
      padding: 0 6px;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .view-pad-with-saved-views .viewpad-saved-views-btn:hover,
    .view-pad-with-saved-views .viewpad-saved-views-btn:focus-visible {
      border-color: rgba(192, 177, 255, 1);
      background: linear-gradient(180deg, rgba(76, 63, 164, 0.98), rgba(39, 31, 101, 0.98));
      outline: none;
    }
    .saved-views-panel {
      position: absolute;
      right: 84px;
      top: 92px;
      z-index: 47;
      width: 230px;
      max-height: min(420px, calc(100vh - 170px));
      overflow: auto;
      border: 1px solid rgba(151, 128, 255, 0.72);
      border-radius: 12px;
      background: rgba(9, 14, 28, 0.96);
      color: #eef2ff;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38);
      padding: 10px;
      font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .saved-views-panel[hidden] { display: none !important; }
    .saved-views-panel__header { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; margin-bottom: 8px; }
    .saved-views-panel__header span { color: rgba(210, 218, 255, 0.68); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
    .saved-views-panel__actions { display: flex; gap: 6px; margin-bottom: 8px; }
    .saved-views-panel button {
      border: 1px solid rgba(151, 128, 255, 0.48);
      border-radius: 8px;
      background: rgba(36, 45, 78, 0.9);
      color: #f4f2ff;
      cursor: pointer;
      padding: 5px 7px;
      font-weight: 800;
    }
    .saved-views-panel button:hover,
    .saved-views-panel button:focus-visible { border-color: rgba(192, 177, 255, 0.95); outline: none; }
    .saved-views-panel__list { display: grid; gap: 6px; }
    .saved-views-panel__row { display: grid; grid-template-columns: 1fr auto auto; gap: 6px; align-items: center; }
    .saved-views-panel__restore { text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .saved-views-panel__meta { color: rgba(210, 218, 255, 0.62); font-size: 10px; }
    .saved-views-panel__delete { min-width: 28px; color: #ffd6dc !important; }
    .saved-views-panel__empty { color: rgba(210, 218, 255, 0.68); padding: 8px 2px; }
  `;
  document.head.appendChild(style);
}

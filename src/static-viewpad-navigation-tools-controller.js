import { getAreaSelectedRoots, getModelRoot, objectId, resolveSafeHideTarget } from './static-selection-resolver.js?v=bust-cache-4';

// Adds compact in-canvas view/navigation tools without touching src/app.js.
// Tools: previous view, next view, isolate selected, hide selected, show all.

const STYLE_ID = 'static-viewpad-navigation-tools-style';
const BUTTONS = [
  { key: 'viewPrevious', label: 'PV', title: 'Previous view' },
  { key: 'viewNext', label: 'NX', title: 'Next view' },
  { key: 'isolateSelected', label: 'ISO', title: 'Isolate selected component' },
  { key: 'hideSelected', label: 'HID', title: 'Hide selected component' },
  { key: 'showAll', label: 'ALL', title: 'Show all hidden components' }
];
const MAX_HISTORY = 40;
const SNAPSHOT_EPS = 1e-4;

const undoStack = [];
const redoStack = [];
const visibilitySession = {
  active: false,
  mode: '',
  touched: new Map(),
  targets: new Set(),
  selectedId: '',
  selectedIds: [],
  reason: ''
};

let changeTimer = 0;
let historyAttachedToControls = null;
let suppressHistory = false;
let visibilityEscBound = false;

installViewpadTools();

function installViewpadTools() {
  const start = () => {
    injectStyles();
    ensureButtons();
    attachHistoryCapture();
    attachVisibilityEsc();
    window.__3D_MARKUP_VIEWPAD_TOOLS__ = {
      recordView: () => recordCurrentView('manual'),
      previousView,
      nextView,
      isolateSelected,
      hideSelected,
      showAll,
      clearVisibility: () => showAll('api-clear-visibility'),
      visibility: getVisibilityState,
      history: () => ({ previous: undoStack.length, next: redoStack.length })
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function ensureButtons() {
  const pad = document.querySelector('.view-pad');
  if (!pad) return;
  pad.classList.add('view-pad-with-navigation-tools');

  const anchor = pad.querySelector('[data-view="marqueeZoom"]') || pad.querySelector('[data-view="zoom"]') || null;
  for (const descriptor of BUTTONS) {
    let button = pad.querySelector(`[data-view="${descriptor.key}"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = descriptor.key;
      button.className = 'viewpad-nav-tool-btn';
      button.textContent = descriptor.label;
      button.title = descriptor.title;
      button.setAttribute('aria-label', descriptor.title);
      pad.insertBefore(button, anchor);
    }
    if (!button.__viewpadNavToolBound) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onToolClick(descriptor.key);
      });
      button.__viewpadNavToolBound = true;
    }
  }
}

function onToolClick(key) {
  if (key === 'viewPrevious') return previousView();
  if (key === 'viewNext') return nextView();
  if (key === 'isolateSelected') return isolateSelected();
  if (key === 'hideSelected') return hideSelected();
  if (key === 'showAll') return showAll();
  return false;
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function attachHistoryCapture() {
  recordCurrentView('initial');
  window.addEventListener('viewer:runtime-context', () => {
    attachControlsListener();
    scheduleHistoryRecord('runtime-context');
  });
  window.addEventListener('viewer:model-loaded', () => scheduleHistoryRecord('model-loaded'));
  window.addEventListener('resize', () => scheduleHistoryRecord('resize'));
  attachControlsListener();
}

function attachControlsListener() {
  const controls = runtime()?.controls;
  if (!controls || controls === historyAttachedToControls || typeof controls.addEventListener !== 'function') return;
  historyAttachedToControls = controls;
  controls.addEventListener('change', () => scheduleHistoryRecord('controls-change'));
}

function scheduleHistoryRecord(reason) {
  if (suppressHistory) return;
  window.clearTimeout(changeTimer);
  changeTimer = window.setTimeout(() => recordCurrentView(reason), 180);
}

function cameraSnapshot() {
  const rt = runtime();
  const camera = rt?.camera;
  const controls = rt?.controls;
  if (!camera) return null;
  return {
    position: vectorToArray(camera.position),
    quaternion: quaternionToArray(camera.quaternion),
    zoom: finiteOr(camera.zoom, 1),
    target: vectorToArray(controls?.target),
    type: camera.type || 'Camera'
  };
}

function recordCurrentView(reason) {
  const snapshot = cameraSnapshot();
  if (!snapshot) return false;
  const last = undoStack[undoStack.length - 1];
  if (last && snapshotsNear(last, snapshot)) return true;
  undoStack.push({ ...snapshot, reason, at: Date.now() });
  while (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateButtons();
  return true;
}

function previousView() {
  recordCurrentView('before-previous');
  if (undoStack.length < 2) {
    setStatus('No previous view');
    return false;
  }
  const current = undoStack.pop();
  redoStack.push(current);
  const target = undoStack[undoStack.length - 1];
  applyViewSnapshot(target, 'view-previous');
  updateButtons();
  setStatus('Previous view');
  return true;
}

function nextView() {
  if (!redoStack.length) {
    setStatus('No next view');
    return false;
  }
  const snapshot = redoStack.pop();
  undoStack.push(snapshot);
  applyViewSnapshot(snapshot, 'view-next');
  updateButtons();
  setStatus('Next view');
  return true;
}

function applyViewSnapshot(snapshot, reason) {
  const rt = runtime();
  const camera = rt?.camera;
  const controls = rt?.controls;
  if (!camera || !snapshot) return false;
  suppressHistory = true;
  setVector(camera.position, snapshot.position);
  if (camera.quaternion && snapshot.quaternion) {
    camera.quaternion.set(snapshot.quaternion[0], snapshot.quaternion[1], snapshot.quaternion[2], snapshot.quaternion[3]);
  }
  if (Number.isFinite(snapshot.zoom)) camera.zoom = snapshot.zoom;
  if (controls?.target && snapshot.target) setVector(controls.target, snapshot.target);
  controls?.update?.();
  camera.updateProjectionMatrix?.();
  rt?.renderOnce?.(reason);
  window.dispatchEvent(new CustomEvent('viewer:view-history', { detail: { reason, snapshot } }));
  window.setTimeout(() => { suppressHistory = false; }, 220);
  return true;
}

function isolateSelected() {
  const rt = runtime();
  const root = getModelRoot(rt);
  const targets = resolveActionTargets(rt);
  const selected = targets[0];
  if (!root || !targets.length || !selected) {
    setStatus('Select a component/part before Isolate');
    return false;
  }

  beginVisibilitySession('isolate', selected, 'isolate-selected', { targets });
  root.traverse?.((object) => {
    if (object !== root) hideObject(object);
  });

  for (const target of targets) {
    showAncestryAndChildren(target, root);
  }

  rt?.renderOnce?.('isolate-selected');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', {
    detail: {
      action: 'isolate',
      selectedId: objectId(selected),
      selectedIds: targets.map(objectId).filter(Boolean),
      selectedCount: targets.length,
      source: targets.length > 1 ? 'area-select' : 'single-selection',
      resolver: 'shared-selection-resolver',
      active: true,
      touchedCount: visibilitySession.touched.size
    }
  }));
  setStatus(`Isolated ${targets.length} selected component${targets.length === 1 ? '' : 's'} â€” Esc or Show All restores`);
  return true;
}

function hideSelected() {
  const rt = runtime();
  const targets = resolveActionTargets(rt);
  const selected = targets[0];
  if (!targets.length || !selected) {
    setStatus('Select a component/part before Hide');
    return false;
  }

  if (visibilitySession.active && visibilitySession.mode !== 'hide') {
    finishVisibilitySession('before-hide-selected', { makeAllVisible: true, render: false });
  }
  beginVisibilitySession('hide', selected, 'hide-selected', {
    append: visibilitySession.mode === 'hide',
    targets
  });
  for (const target of targets) hideObject(target);

  rt?.renderOnce?.('hide-selected');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', {
    detail: {
      action: 'hide',
      selectedId: objectId(selected),
      selectedIds: targets.map(objectId).filter(Boolean),
      selectedCount: targets.length,
      source: targets.length > 1 ? 'area-select' : 'single-selection',
      resolver: 'shared-selection-resolver',
      active: true,
      hiddenCount: visibilitySession.targets.size
    }
  }));
  setStatus(`Hidden ${targets.length} selected component${targets.length === 1 ? '' : 's'} â€” Esc or Show All restores`);
  return true;
}

function resolveActionTargets(rt = runtime()) {
  const areaRoots = getAreaSelectedRoots({ runtime: rt });
  if (areaRoots.length) return areaRoots;
  const selected = resolveSafeHideTarget(undefined, { runtime: rt });
  return selected ? [selected] : [];
}

function showAncestryAndChildren(selected, root) {
  let cursor = selected;
  while (cursor && cursor !== root.parent) {
    showObject(cursor);
    cursor = cursor.parent;
  }
  selected.traverse?.((object) => { showObject(object); });
}

function showAll(reason = 'show-all') {
  const rt = runtime();
  const root = getModelRoot(rt);
  if (!root) {
    clearVisibilitySessionState();
    setStatus('No model loaded');
    return false;
  }
  finishVisibilitySession(reason, { makeAllVisible: true, render: false });
  root.traverse?.((object) => { object.visible = true; });
  rt?.renderOnce?.(reason === 'escape' ? 'show-all-escape' : 'show-all');
  window.dispatchEvent(new CustomEvent('viewer:visibility-tools', {
    detail: { action: 'showAll', reason, active: false }
  }));
  setStatus(reason === 'escape' ? 'Visibility restored' : 'All components shown');
  return true;
}

function attachVisibilityEsc() {
  if (visibilityEscBound) return;
  visibilityEscBound = true;
  document.addEventListener('keydown', onVisibilityEscape, { capture: true });
}

function onVisibilityEscape(event) {
  if (event.key !== 'Escape' || !visibilitySession.active) return;
  event.preventDefault();
  showAll('escape');
}

function beginVisibilitySession(mode, selected, reason, options = {}) {
  if (!options.append) clearVisibilitySessionState();
  const targets = Array.isArray(options.targets) && options.targets.length ? options.targets : (selected ? [selected] : []);
  visibilitySession.active = true;
  visibilitySession.mode = mode;
  visibilitySession.reason = reason;
  visibilitySession.selectedId = objectId(selected);
  visibilitySession.selectedIds = targets.map(objectId).filter(Boolean);
  for (const target of targets) visibilitySession.targets.add(target);
  document.body?.classList?.toggle('visibility-tool-active', true);
  document.body?.classList?.toggle('visibility-isolate-active', mode === 'isolate');
  document.body?.classList?.toggle('visibility-hide-active', mode === 'hide');
}

function hideObject(object) {
  if (!object) return;
  recordOriginalVisibility(object);
  object.visible = false;
}

function showObject(object) {
  if (!object) return;
  recordOriginalVisibility(object);
  object.visible = true;
}

function recordOriginalVisibility(object) {
  if (!object || visibilitySession.touched.has(object)) return;
  visibilitySession.touched.set(object, object.visible !== false);
}

function finishVisibilitySession(reason = 'show-all', options = {}) {
  const rt = runtime();
  if (options.makeAllVisible !== true) {
    for (const [object, wasVisible] of visibilitySession.touched.entries()) {
      object.visible = wasVisible;
    }
  }
  clearVisibilitySessionState();
  if (options.render !== false) rt?.renderOnce?.(reason);
}

function clearVisibilitySessionState() {
  visibilitySession.active = false;
  visibilitySession.mode = '';
  visibilitySession.reason = '';
  visibilitySession.selectedId = '';
  visibilitySession.selectedIds = [];
  visibilitySession.touched.clear();
  visibilitySession.targets.clear();
  document.body?.classList?.remove('visibility-tool-active', 'visibility-isolate-active', 'visibility-hide-active');
}

function getVisibilityState() {
  return {
    active: visibilitySession.active,
    mode: visibilitySession.mode,
    selectedId: visibilitySession.selectedId,
    selectedIds: visibilitySession.selectedIds.slice(),
    touchedCount: visibilitySession.touched.size,
    targetCount: visibilitySession.targets.size,
    reason: visibilitySession.reason
  };
}

function updateButtons() {
  const previous = document.querySelector('[data-view="viewPrevious"]');
  const next = document.querySelector('[data-view="viewNext"]');
  if (previous) previous.disabled = undoStack.length < 2;
  if (next) next.disabled = redoStack.length < 1;
}

function vectorToArray(vector) {
  return [finiteOr(vector?.x, 0), finiteOr(vector?.y, 0), finiteOr(vector?.z, 0)];
}

function quaternionToArray(quaternion) {
  return [finiteOr(quaternion?.x, 0), finiteOr(quaternion?.y, 0), finiteOr(quaternion?.z, 0), finiteOr(quaternion?.w, 1)];
}

function setVector(vector, values) {
  if (!vector || !Array.isArray(values)) return;
  vector.set?.(values[0] || 0, values[1] || 0, values[2] || 0);
}

function finiteOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function snapshotsNear(a, b) {
  return arraysNear(a.position, b.position) && arraysNear(a.quaternion, b.quaternion) && arraysNear(a.target, b.target) && Math.abs((a.zoom || 1) - (b.zoom || 1)) < SNAPSHOT_EPS;
}

function arraysNear(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((value, index) => Math.abs(value - b[index]) < SNAPSHOT_EPS);
}

function setStatus(message) {
  const status = document.getElementById('statusText');
  if (status && message) status.textContent = message;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .view-pad-with-navigation-tools .viewpad-nav-tool-btn {
      border: 1px solid rgba(70, 136, 214, 0.72);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(24, 56, 94, 0.95), rgba(11, 28, 50, 0.98));
      color: #eaf4ff;
      font-size: 10px;
      font-weight: 800;
      min-width: 44px;
      min-height: 34px;
      padding: 0 6px;
      letter-spacing: 0.03em;
      cursor: pointer;
    }
    .view-pad-with-navigation-tools .viewpad-nav-tool-btn:hover,
    .view-pad-with-navigation-tools .viewpad-nav-tool-btn:focus-visible {
      border-color: rgba(95, 170, 255, 0.95);
      background: linear-gradient(180deg, rgba(37, 99, 169, 0.96), rgba(14, 52, 95, 0.98));
      outline: none;
    }
    .view-pad-with-navigation-tools .viewpad-nav-tool-btn:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

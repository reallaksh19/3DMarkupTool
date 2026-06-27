import * as THREE from 'three';

// Explode Review is a temporary visual-review transform only.
// It never writes original positions into object.userData and never changes export/parser data.
// Traversal is performed only after the user invokes Apply; startup only installs bounded handlers.

const VERSION = 'explode-reassemble-phase9-20260620';
const TOOL_VIEW = 'explodeReview';
const TOOL_LABEL = 'XP';
const TOOL_TITLE = 'Explode Review: separate components by type or line number';
const STYLE_ID = 'static-explode-review-style';
const PANEL_ID = 'staticExplodeReviewPanel';
const DEFAULT_DISTANCE = 250;

const originalPositions = new Map();

let button = null;
let currentMode = 'type';
let currentAxis = 'X';
let currentDistance = DEFAULT_DISTANCE;
let lastGroups = [];
let explodeActive = false;
let explodeEscBound = false;

installExplodeReviewTool();

function installExplodeReviewTool() {
  const start = () => {
    injectStyles();
    ensureButton();
    ensurePanel();
    attachExplodeEsc();
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
  pad.classList.add('view-pad-with-explode-review');

  button = pad.querySelector(`[data-view="${TOOL_VIEW}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = TOOL_VIEW;
    button.className = 'viewpad-explode-review-btn';
    button.textContent = TOOL_LABEL;
    const anchor = pad.querySelector('[data-view="measurePolyline"]')
      || pad.querySelector('[data-view="componentSearch"]')
      || pad.querySelector('[data-view="savedViews"]')
      || pad.querySelector('[data-view="areaSelect"]')
      || pad.querySelector('[data-view="marqueeZoom"]')
      || pad.querySelector('[data-view="zoom"]')
      || null;
    pad.insertBefore(button, anchor);
  }

  button.title = TOOL_TITLE;
  button.setAttribute('aria-label', TOOL_TITLE);
  if (!button.__explodeReviewClickBound) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    });
    button.__explodeReviewClickBound = true;
  }
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;
  const host = document.getElementById('viewer') || document.querySelector('.viewer-wrap') || document.body;
  panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'explode-review-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Explode Review');
  host.appendChild(panel);
  renderPanel(panel);
  return panel;
}

function renderPanel(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return;
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'explode-review-panel__header';
  header.innerHTML = '<strong>Explode</strong><span>temporary review only</span>';
  panel.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'explode-review-panel__grid';
  grid.appendChild(field('Group', select('explodeGroupMode', currentMode, [
    ['type', 'Type/Class'],
    ['line', 'Line No']
  ], (value) => { currentMode = value; })));
  grid.appendChild(field('Axis', select('explodeAxis', currentAxis, [
    ['X', 'X'],
    ['Y', 'Y'],
    ['Z', 'Z']
  ], (value) => { currentAxis = value; })));
  grid.appendChild(field('Gap', numberInput('explodeDistance', currentDistance, (value) => {
    currentDistance = clampDistance(value);
  })));
  panel.appendChild(grid);

  const stats = document.createElement('div');
  stats.className = 'explode-review-panel__stats';
  stats.textContent = explodeActive
    ? `Active explode: ${lastGroups.length} group(s), ${originalPositions.size} moved root(s)`
    : (lastGroups.length ? `Last explode: ${lastGroups.length} group(s)` : 'No explode applied in this session.');
  panel.appendChild(stats);

  const actions = document.createElement('div');
  actions.className = 'explode-review-panel__actions';
  actions.appendChild(panelButton('Apply', 'Explode current model by selected grouping', () => applyExplode(currentMode)));
  actions.appendChild(panelButton('Reassemble', 'Restore original component positions', () => reassembleExplode('panel')));
  actions.appendChild(panelButton('Close', 'Close explode panel', () => { panel.hidden = true; }));
  panel.appendChild(actions);
}

function field(label, control) {
  const wrapper = document.createElement('label');
  wrapper.className = 'explode-review-panel__field';
  const span = document.createElement('span');
  span.textContent = label;
  wrapper.appendChild(span);
  wrapper.appendChild(control);
  return wrapper;
}

function select(id, value, options, onChange) {
  const control = document.createElement('select');
  control.id = id;
  for (const [optionValue, label] of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = label;
    option.selected = optionValue === value;
    control.appendChild(option);
  }
  control.addEventListener('change', () => onChange(control.value));
  return control;
}

function numberInput(id, value, onChange) {
  const control = document.createElement('input');
  control.id = id;
  control.type = 'number';
  control.min = '0';
  control.max = '5000';
  control.step = '25';
  control.value = String(value);
  control.addEventListener('change', () => {
    const next = clampDistance(Number(control.value));
    control.value = String(next);
    onChange(next);
  });
  return control;
}

function panelButton(text, title, handler) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  btn.title = title;
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  });
  return btn;
}

function togglePanel() {
  const panel = ensurePanel();
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    renderPanel(panel);
    setStatus('Explode Review: choose grouping and Apply');
  }
}

function openPanel() {
  const panel = ensurePanel();
  panel.hidden = false;
  renderPanel(panel);
  setStatus('Explode Review: choose grouping and Apply');
  return true;
}

function closePanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.hidden = true;
  return true;
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function modelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
}

function collectComponentRoots(root = modelRoot()) {
  if (!root) return [];
  const roots = [];
  const accepted = new Set();
  root.traverse?.((object) => {
    if (!object || object === root || accepted.has(object)) return;
    if (isHelperObject(object)) return;
    if (!isComponentCandidate(object)) return;
    if (hasComponentAncestor(object, root)) return;
    roots.push(object);
    accepted.add(object);
  });
  return roots;
}

function isHelperObject(object) {
  const data = object.userData || {};
  return Boolean(data.helper || data.measurePolylineHelper || data.areaSelectHelper || data.sectionBoxHelper)
    || String(object.name || '').startsWith('__');
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

function groupKey(object, mode) {
  const data = object.userData || {};
  if (mode === 'line') {
    return cleanGroupKey(
      data.LINE_NO
      || data.lineNo
      || data.lineNumber
      || data.LINE_NUMBER
      || data.LINE
      || data.line
      || data.lineId
      || data.LINE_ID
      || data.sourceLineNo
      || 'UNASSIGNED_LINE'
    );
  }
  return cleanGroupKey(
    data.componentClass
    || data.componentType
    || data.visualKey
    || data.rawType
    || data.TYPE
    || object.type
    || 'UNKNOWN_TYPE'
  );
}

function cleanGroupKey(value) {
  const text = String(value ?? '').trim();
  return text ? text.toUpperCase().replace(/[^A-Z0-9_./-]+/g, '_') : 'UNASSIGNED';
}

function groupComponents(components, mode = currentMode) {
  const map = new Map();
  for (const component of components) {
    const key = groupKey(component, mode);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(component);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, objects]) => ({ key, objects }));
}

function applyExplode(mode = currentMode) {
  const rt = runtime();
  const root = modelRoot(rt);
  if (!root) {
    setStatus('Explode unavailable: no model loaded');
    return false;
  }
  const components = collectComponentRoots(root).filter((object) => object.visible !== false);
  if (!components.length) {
    setStatus('Explode unavailable: no component metadata found');
    return false;
  }

  resetExplode({ silent: true, render: false });
  const groups = groupComponents(components, mode);
  const axis = axisVector(currentAxis);
  const middle = (groups.length - 1) / 2;
  groups.forEach((group, index) => {
    const offset = axis.clone().multiplyScalar((index - middle) * currentDistance);
    group.objects.forEach((object) => moveObjectByWorldOffset(object, offset));
  });

  explodeActive = originalPositions.size > 0;
  document.body?.classList?.toggle('explode-review-active', explodeActive);
  lastGroups = groups.map((group) => ({ key: group.key, count: group.objects.length }));
  rt?.renderOnce?.('explode-review');
  dispatchExplode('apply', {
    mode,
    axis: currentAxis,
    distance: currentDistance,
    groups: lastGroups,
    movedCount: originalPositions.size,
    active: explodeActive
  });
  setStatus(`Exploded ${components.length} component(s) into ${groups.length} ${mode === 'line' ? 'line' : 'type'} group(s) â€” Esc or Reassemble restores`);
  renderPanel();
  return true;
}

function reassembleExplode(source = 'api') {
  return resetExplode({ source, reason: source === 'escape' ? 'explode-review-escape' : 'explode-review-reassemble' });
}

function resetExplode(options = {}) {
  const rt = runtime();
  let resetCount = 0;
  for (const [object, original] of originalPositions.entries()) {
    if (!object?.position || !original) continue;
    if (typeof object.position.copy === 'function') object.position.copy(original);
    else object.position.set?.(original.x || 0, original.y || 0, original.z || 0);
    resetCount += 1;
  }

  originalPositions.clear();
  explodeActive = false;
  document.body?.classList?.remove('explode-review-active');

  if (options.render !== false) rt?.renderOnce?.(options.reason || 'explode-review-reset');
  if (!options.silent) {
    dispatchExplode(options.source === 'escape' ? 'escape-reset' : 'reset', { resetCount, active: false });
    setStatus(resetCount ? `Reassembled ${resetCount} exploded component(s)` : 'Explode reset: no moved components');
    renderPanel();
  }
  return true;
}

function moveObjectByWorldOffset(object, worldOffset) {
  if (!object || !object.position) return;
  if (!originalPositions.has(object)) {
    originalPositions.set(object, object.position.clone?.() || new THREE.Vector3(object.position.x || 0, object.position.y || 0, object.position.z || 0));
  }
  const originalLocal = originalPositions.get(object).clone();
  if (object.parent) {
    const originalWorld = object.parent.localToWorld(originalLocal.clone());
    const targetWorld = originalWorld.add(worldOffset);
    const targetLocal = object.parent.worldToLocal(targetWorld);
    object.position.copy(targetLocal);
  } else {
    object.position.copy(originalLocal.add(worldOffset));
  }
}

function axisVector(axis) {
  if (axis === 'Y') return new THREE.Vector3(0, 1, 0);
  if (axis === 'Z') return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(1, 0, 0);
}

function clampDistance(value) {
  if (!Number.isFinite(value)) return DEFAULT_DISTANCE;
  return Math.max(0, Math.min(5000, Math.round(value)));
}

function attachExplodeEsc() {
  if (explodeEscBound) return;
  explodeEscBound = true;
  document.addEventListener('keydown', onExplodeEscape, { capture: true });
}

function onExplodeEscape(event) {
  if (event.key !== 'Escape' || !explodeActive) return;
  event.preventDefault();
  closePanel();
  reassembleExplode('escape');
}

function setStatus(text) {
  const status = document.getElementById('coreStatus') || document.getElementById('statusText') || document.getElementById('uiHealthBadge');
  if (status) status.textContent = text;
}

function dispatchExplode(action, extra = {}) {
  window.dispatchEvent(new CustomEvent('viewer:explode-review', {
    detail: { action, version: VERSION, ...extra }
  }));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .viewpad-explode-review-btn { font-weight: 800; letter-spacing: -0.02em; }
    .explode-review-panel {
      position: absolute;
      right: 58px;
      top: 144px;
      z-index: 22;
      width: 224px;
      padding: 10px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.92);
      color: #e5edf7;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
      font-size: 12px;
      backdrop-filter: blur(10px);
    }
    .explode-review-panel[hidden] { display: none !important; }
    .explode-review-panel__header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .explode-review-panel__header span { color: #94a3b8; font-size: 11px; }
    .explode-review-panel__grid { display: grid; grid-template-columns: 1fr; gap: 7px; }
    .explode-review-panel__field { display: grid; grid-template-columns: 58px 1fr; align-items: center; gap: 8px; }
    .explode-review-panel__field span { color: #9fb0c5; }
    .explode-review-panel select,
    .explode-review-panel input {
      min-width: 0;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.88);
      color: #f8fafc;
      padding: 5px 7px;
      font-size: 12px;
    }
    .explode-review-panel__stats { margin-top: 8px; color: #cbd5e1; font-size: 11px; }
    .explode-review-panel__actions { display: flex; gap: 6px; margin-top: 9px; }
    .explode-review-panel__actions button {
      flex: 1;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 8px;
      background: rgba(30, 41, 59, 0.92);
      color: #f8fafc;
      padding: 6px 7px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
    }
    .explode-review-panel__actions button:hover { background: rgba(51, 65, 85, 0.96); }
    body.explode-review-active .viewpad-explode-review-btn { border-color: rgba(251, 191, 36, 0.85); color: #fde68a; }
  `;
  document.head.appendChild(style);
}

function installApi() {
  window.__3D_MARKUP_EXPLODE_REVIEW__ = {
    version: VERSION,
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    apply: (mode = currentMode) => applyExplode(mode),
    reset: () => resetExplode(),
    reassemble: () => reassembleExplode('api'),
    clear: () => resetExplode({ source: 'api-clear' }),
    groups: (mode = currentMode) => groupComponents(collectComponentRoots(), mode).map((group) => ({ key: group.key, count: group.objects.length })),
    state: () => ({
      mode: currentMode,
      axis: currentAxis,
      distance: currentDistance,
      active: explodeActive,
      movedCount: originalPositions.size,
      lastGroups: [...lastGroups]
    })
  };
}

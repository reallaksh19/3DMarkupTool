// First-class static shell wiring.
//
// This module is intentionally small and deterministic. It is loaded by
// safe-ui-bootstrap.js even when optional UI behavior modules are disabled.
// It must not move toolbar rows, create retry loops, or import advanced tools.

const GRID_DEFAULT_VISIBLE = false;
const GRID_POLL_LIMIT = 24;
const GRID_POLL_DELAY_MS = 120;

const state = {
  gridUserSet: false,
  gridVisible: GRID_DEFAULT_VISIBLE,
  gridPollCount: 0,
  ready: false
};

runWhenReady(initStaticShellCore);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initStaticShellCore() {
  ensureGridToolbarButton();
  bindGridButton();
  bindRuntimeEvents();
  normalizeShellState();
  applyGridDefaultSoon();
  state.ready = true;
  window.__3D_MARKUP_STATIC_SHELL_CORE__ = {
    version: 'static-shell-core-grid-20260618',
    setGridVisible,
    getGridObject,
    state
  };
  window.dispatchEvent(new CustomEvent('viewer:static-shell-core-ready', { detail: { state } }));
}

function ensureGridToolbarButton() {
  if (document.getElementById('gridToggleBtn')) return;
  const displayGroup = document.querySelector('[data-group="display"]')
    || document.querySelector('.two-row-command-group')
    || document.querySelector('.main-ribbon');
  const clipBtn = document.getElementById('clipBtn');
  if (!displayGroup || !clipBtn) return;

  const button = document.createElement('button');
  button.id = 'gridToggleBtn';
  button.type = 'button';
  button.className = 'tool-btn shell-grid-toggle';
  button.title = 'Show / hide canvas grid (G)';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<i data-lucide="grid-3x3"></i><span>Grid Off</span>';
  displayGroup.insertBefore(button, clipBtn);

  // app.js has already called lucide.createIcons(). Re-run safely if available.
  if (window.lucide?.createIcons) {
    try { window.lucide.createIcons(); } catch { /* icon fallback is text */ }
  }
}

function bindGridButton() {
  const button = document.getElementById('gridToggleBtn');
  if (button?.dataset.boundStaticShellGrid === '1') return;
  if (!button) return;
  button.dataset.boundStaticShellGrid = '1';
  button.addEventListener('click', () => {
    state.gridUserSet = true;
    setGridVisible(!state.gridVisible, { user: true });
  });
}

function bindRuntimeEvents() {
  window.addEventListener('markup:app-ready', () => applyGridDefaultSoon());
  window.addEventListener('markup:render-context', () => applyGridDefaultSoon());
  window.addEventListener('viewer:runtime-context', () => applyGridDefaultSoon());
  window.addEventListener('keydown', (event) => {
    if (hasInputFocus()) return;
    if (event.key.toLowerCase() !== 'g') return;
    event.preventDefault();
    state.gridUserSet = true;
    setGridVisible(!state.gridVisible, { user: true });
  });
}

function hasInputFocus() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function normalizeShellState() {
  document.body.classList.add('static-shell-core-ready');
  const ribbon = document.querySelector('.main-ribbon');
  if (ribbon) ribbon.scrollLeft = 0;
  updateGridButton();
}

function applyGridDefaultSoon() {
  window.setTimeout(() => {
    if (!state.gridUserSet) setGridVisible(GRID_DEFAULT_VISIBLE, { defaultApply: true });
    if (!getGridObject() && state.gridPollCount < GRID_POLL_LIMIT) {
      state.gridPollCount += 1;
      applyGridDefaultSoon();
    }
  }, state.gridPollCount ? GRID_POLL_DELAY_MS : 0);
}

function getGridObject() {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const scene = runtime.scene;
  if (!scene?.traverse) return null;
  let grid = null;
  scene.traverse((object) => {
    if (grid) return;
    if (object?.name === 'grid') grid = object;
  });
  return grid;
}

function setGridVisible(visible, detail = {}) {
  state.gridVisible = Boolean(visible);
  const grid = getGridObject();
  if (grid) grid.visible = state.gridVisible;
  updateGridButton();
  window.dispatchEvent(new CustomEvent('viewer:grid-visibility-changed', {
    detail: {
      visible: state.gridVisible,
      gridFound: Boolean(grid),
      ...detail
    }
  }));
}

function updateGridButton() {
  const button = document.getElementById('gridToggleBtn');
  if (!button) return;
  button.classList.toggle('active', state.gridVisible);
  button.classList.toggle('tool-active', state.gridVisible);
  button.setAttribute('aria-pressed', state.gridVisible ? 'true' : 'false');
  const label = button.querySelector('span');
  if (label) label.textContent = state.gridVisible ? 'Grid On' : 'Grid Off';
}

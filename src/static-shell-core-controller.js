// First-class static shell wiring.
//
// This module is intentionally small and deterministic. It is loaded by
// safe-ui-bootstrap.js even when optional UI behavior modules are disabled.
// It must not move toolbar rows, create retry loops, or import advanced tools.

const GRID_DEFAULT_VISIBLE = false;
const GRID_POLL_LIMIT = 24;
const GRID_POLL_DELAY_MS = 120;
const UI_COUNT_SELECTOR = 'button[id], select[id], input[id], [role="button"][id]';
const VERSION = 'static-shell-ui-loaded-enabled-20260618';

const state = {
  gridUserSet: false,
  gridVisible: GRID_DEFAULT_VISIBLE,
  gridPollCount: 0,
  ready: false,
  uiLoaded: 0,
  uiEnabled: 0,
  uiScore: 0,
  uiScoreChecks: [],
  ribbonAnchorUntil: 0
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
  ensureCoreStyles();
  ensureUiScoreBadge();
  ensureGridToolbarButton();
  bindGridButton();
  bindRuntimeEvents();
  normalizeShellState();
  applyGridDefaultSoon();
  updateUiScoreSoon();
  state.ready = true;
  window.__3D_MARKUP_STATIC_SHELL_CORE__ = {
    version: VERSION,
    setGridVisible,
    getGridObject,
    updateUiScore,
    anchorRibbonLeft,
    state
  };
  window.dispatchEvent(new CustomEvent('viewer:static-shell-core-ready', { detail: { state } }));
}

function ensureCoreStyles() {
  if (document.getElementById('staticShellCoreStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticShellCoreStyles';
  style.textContent = `
    .ui-score-pill { min-width: 86px; border-color: rgba(55,216,255,.46); color: #74e6ff; background: rgba(5, 32, 46, .74); }
    .ui-score-pill.score-ok { border-color: rgba(39,224,161,.48); color: #2df0ae; }
    .ui-score-pill.score-warn { border-color: rgba(255,171,53,.56); color: #ffc86d; }

    html, body.pro-shell { max-width: 100vw; overflow-x: hidden !important; }
    body.pro-shell .viewer-topbar,
    body.pro-shell .app-workspace { width: 100%; max-width: 100vw; margin-left: 0 !important; transform: none !important; }
    body.pro-shell .viewer-topbar { padding-left: max(12px, env(safe-area-inset-left)); padding-right: max(12px, env(safe-area-inset-right)); }
    body.pro-shell .main-ribbon { width: 100%; max-width: 100%; margin-left: 0 !important; transform: none !important; padding-left: 8px; padding-right: 8px; scroll-padding-left: 8px; overscroll-behavior-x: contain; }
    body.pro-shell .main-ribbon > :first-child { margin-left: 0 !important; }
    body.pro-shell .main-ribbon::-webkit-scrollbar { height: 8px; }
    body.pro-shell .main-ribbon::-webkit-scrollbar-thumb { background: rgba(83, 125, 176, .42); border-radius: 999px; }
  `;
  document.head.appendChild(style);
}

function ensureUiScoreBadge() {
  let badge = document.getElementById('uiScorePill');
  if (badge) return badge;
  const runtimeStatus = document.getElementById('runtimeStatus');
  const host = runtimeStatus?.parentElement || document.querySelector('.topbar-actions');
  if (!host) return null;
  badge = document.createElement('div');
  badge.id = 'uiScorePill';
  badge.className = 'status-pill ui-score-pill score-warn';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  badge.title = 'UI loaded / UI enabled';
  badge.textContent = 'UI 0/0';
  runtimeStatus?.after(badge) || host.appendChild(badge);
  return badge;
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
  window.addEventListener('markup:app-ready', () => {
    anchorRibbonLeftSoon();
    applyGridDefaultSoon();
    updateUiScoreSoon();
  });
  window.addEventListener('markup:render-context', () => {
    anchorRibbonLeftSoon();
    applyGridDefaultSoon();
    updateUiScoreSoon();
  });
  window.addEventListener('viewer:runtime-context', () => {
    anchorRibbonLeftSoon();
    applyGridDefaultSoon();
    updateUiScoreSoon();
  });
  window.addEventListener('viewer:static-tree-ready', () => { anchorRibbonLeftSoon(); updateUiScoreSoon(); });
  window.addEventListener('viewer:static-tree-refreshed', updateUiScoreSoon);
  window.addEventListener('viewer:grid-visibility-changed', updateUiScoreSoon);
  window.addEventListener('load', anchorRibbonLeftSoon, { once: true });
  window.addEventListener('resize', anchorRibbonLeftSoon);
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
  anchorRibbonLeftSoon();
  updateGridButton();
  updateUiScore();
}

function anchorRibbonLeftSoon() {
  state.ribbonAnchorUntil = Date.now() + 1500;
  [0, 30, 120, 300, 700, 1200, 1600].forEach((delay) => {
    window.setTimeout(() => {
      if (Date.now() <= state.ribbonAnchorUntil + 100) anchorRibbonLeft();
    }, delay);
  });
}

function anchorRibbonLeft() {
  const root = document.scrollingElement || document.documentElement;
  if (root) root.scrollLeft = 0;
  if (document.body) document.body.scrollLeft = 0;
  if (window.scrollX) window.scrollTo(0, window.scrollY || 0);

  const ribbon = document.querySelector('.main-ribbon');
  if (ribbon) ribbon.scrollLeft = 0;
  const topbar = document.querySelector('.viewer-topbar');
  if (topbar) topbar.scrollLeft = 0;
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

function updateUiScoreSoon() {
  window.setTimeout(updateUiScore, 0);
  window.setTimeout(updateUiScore, 250);
}

function updateUiScore() {
  const controls = getCountableUiControls();
  const loaded = controls.length;
  const enabledControls = controls.filter(isUiControlEnabled);
  const enabled = enabledControls.length;
  const disabled = controls
    .filter((control) => !isUiControlEnabled(control))
    .map(getControlLabel)
    .filter(Boolean);

  state.uiLoaded = loaded;
  state.uiEnabled = enabled;
  state.uiScore = loaded;
  state.uiScoreChecks = controls.map((control) => ({
    id: control.id || '',
    label: getControlLabel(control),
    loaded: true,
    enabled: isUiControlEnabled(control)
  }));

  const badge = ensureUiScoreBadge();
  if (badge) {
    badge.textContent = `UI ${loaded}/${enabled}`;
    badge.title = [
      `UI loaded: ${loaded}`,
      `UI enabled: ${enabled}`,
      disabled.length ? `Disabled: ${disabled.join(', ')}` : 'Disabled: none'
    ].join('\n');
    badge.classList.toggle('score-ok', loaded > 0 && loaded === enabled);
    badge.classList.toggle('score-warn', loaded !== enabled);
  }

  window.__3D_MARKUP_UI_SCORE__ = {
    loaded,
    enabled,
    disabled,
    controls: state.uiScoreChecks,
    version: VERSION
  };
  window.dispatchEvent(new CustomEvent('viewer:ui-score-changed', {
    detail: window.__3D_MARKUP_UI_SCORE__
  }));
}

function getCountableUiControls() {
  const root = document.querySelector('.pro-shell') || document.body;
  return Array.from(root.querySelectorAll(UI_COUNT_SELECTOR))
    .filter((control) => control.id)
    .filter((control) => control.id !== 'supportMode')
    .filter((control) => control.type !== 'hidden')
    .filter((control) => !control.closest('[data-ui-count="ignore"], .ui-count-ignore, .sr-only'));
}

function isUiControlEnabled(control) {
  if (!control) return false;
  if (control.disabled) return false;
  if (control.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

function getControlLabel(control) {
  if (!control) return '';
  return control.getAttribute('aria-label')
    || control.title
    || control.textContent?.replace(/\s+/g, ' ').trim()
    || control.id
    || control.tagName;
}

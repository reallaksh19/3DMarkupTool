const SAFETY_VERSION = window.__3D_MARKUP_SAFE_UI_VERSION__ || 'ui-runtime-cleanup-20260618';

const state = {
  gridVisible: false,
  gridApplyToken: 0,
  gridUserControlled: false,
  clipObserver: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCoreAppSafety, { once: true });
} else {
  initCoreAppSafety();
}

window.addEventListener('viewer:model-loaded', () => scheduleGridOff({ force: true }));
window.addEventListener('markup:safe-ui-status', () => lockClipButtonIcon());
window.addEventListener('markup:toolbar-optimized', () => lockClipButtonIcon());

document.addEventListener('click', (event) => {
  if (event.target?.closest?.('#gridToggleBtn')) state.gridUserControlled = true;
}, true);

window.addEventListener('keydown', (event) => {
  if (event.key?.toLowerCase() === 'g') state.gridUserControlled = true;
}, true);

function initCoreAppSafety() {
  ensureLegacyHint();
  ensureCoordStatus();
  scheduleGridOff({ force: true });
  lockClipButtonIcon();

  window.__3D_MARKUP_CORE_SAFETY__ = {
    version: SAFETY_VERSION,
    setGridVisible,
    ensureLegacyHint,
    ensureCoordStatus,
    lockClipButtonIcon
  };
}

function ensureLegacyHint() {
  if (document.getElementById('hint')) return document.getElementById('hint');

  const hint = document.createElement('div');
  hint.id = 'hint';
  hint.className = 'hint legacy-hint-compat';
  hint.textContent = '';
  hint.hidden = true;
  hint.style.display = 'none';
  hint.setAttribute('aria-hidden', 'true');
  (document.getElementById('viewer') || document.body).appendChild(hint);
  return hint;
}

function ensureCoordStatus() {
  if (document.getElementById('coordStatus')) return document.getElementById('coordStatus');

  const statusHost = document.querySelector('.status-bar')
    || document.querySelector('.viewer-status')
    || document.getElementById('statusBar')
    || document.body;

  const coord = document.createElement('span');
  coord.id = 'coordStatus';
  coord.className = 'status-pill coord-status';
  coord.textContent = 'XYZ: -';
  statusHost.appendChild(coord);
  return coord;
}

function setGridVisible(visible) {
  state.gridUserControlled = true;
  state.gridVisible = Boolean(visible);
  applyGridVisibility();
  syncGridButton();
}

function scheduleGridOff(options = {}) {
  if (state.gridUserControlled && !options.force) return;
  state.gridVisible = false;
  const token = ++state.gridApplyToken;

  const applyRepeatedly = (remaining) => {
    if (token !== state.gridApplyToken) return;
    applyGridVisibility();
    syncGridButton();
    if (remaining > 0) window.requestAnimationFrame(() => applyRepeatedly(remaining - 1));
  };

  applyRepeatedly(18);
}

function applyGridVisibility() {
  const runtime = getRuntime();
  const scene = runtime?.scene || runtime?.getScene?.();
  if (!scene) return;

  scene.traverse?.((object) => {
    if (isGridHelper(object)) object.visible = state.gridVisible;
  });
}

function syncGridButton() {
  const button = document.getElementById('gridToggleBtn');
  if (!button) return;

  button.classList.toggle('tool-active', state.gridVisible);
  button.setAttribute('aria-pressed', String(state.gridVisible));
  button.title = state.gridVisible ? 'Hide canvas grid (G)' : 'Show canvas grid (G)';
  const label = button.querySelector('span');
  if (label) label.textContent = state.gridVisible ? 'Grid On' : 'Grid Off';
}

function lockClipButtonIcon() {
  const button = document.getElementById('clipBtn');
  if (!button) return;

  button.classList.add('icon-only-clip-btn');
  button.title = button.classList.contains('tool-active') ? 'Disable clip plane' : 'Enable clip plane';
  button.setAttribute('aria-label', button.title);

  const span = button.querySelector('span');
  if (span) {
    span.classList.add('visually-hidden');
    span.textContent = button.classList.contains('tool-active') ? 'Clip On' : 'Clip Off';
  }

  if (state.clipObserver) return;

  state.clipObserver = new MutationObserver(() => {
    const currentButton = document.getElementById('clipBtn');
    const currentSpan = currentButton?.querySelector('span');
    if (!currentButton || !currentSpan) return;

    currentButton.classList.add('icon-only-clip-btn');
    currentSpan.classList.add('visually-hidden');
    currentButton.title = currentButton.classList.contains('tool-active') ? 'Disable clip plane' : 'Enable clip plane';
    currentButton.setAttribute('aria-label', currentButton.title);
  });

  state.clipObserver.observe(button, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true
  });
}

function getRuntime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function isGridHelper(object) {
  if (!object) return false;
  if (String(object.name || '').toLowerCase() === 'grid') return true;
  if (object.type === 'GridHelper') return true;
  return false;
}

injectStyles();

function injectStyles() {
  if (document.getElementById('coreAppSafetyControllerStyles')) return;

  const style = document.createElement('style');
  style.id = 'coreAppSafetyControllerStyles';
  style.textContent = `
    .visually-hidden {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    .icon-only-clip-btn svg,
    .icon-only-clip-btn [data-lucide] {
      display: inline-block !important;
    }
  `;
  document.head.appendChild(style);
}

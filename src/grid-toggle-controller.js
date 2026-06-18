const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;

const state = {
  gridVisible: false,
  scene: runtime?.scene || null,
  button: null,
  lastApplyToken: 0
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGridToggle, { once: true });
} else {
  initGridToggle();
}

window.addEventListener('markup:render-context', (event) => {
  const { scene } = event.detail || {};
  if (scene) state.scene = scene;
  applyGridVisibility();
});

function initGridToggle() {
  injectStyles();
  ensureButton();
  updateButton();
  bindShortcuts();
  scheduleApplyGridVisibility();
}

function ensureButton() {
  if (state.button && document.body.contains(state.button)) return state.button;

  const viewGroup = document.querySelector('[aria-label="View tools"]');
  if (!viewGroup) return null;

  const button = document.createElement('button');
  button.id = 'gridToggleBtn';
  button.type = 'button';
  button.className = 'tool-btn icon-text grid-toggle-btn';
  button.title = 'Show canvas grid (G)';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `
    <svg class="grid-toggle-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14M5.5 3v14M10 3v14M14.5 3v14"></path>
    </svg>
    <span>Grid Off</span>`;

  button.addEventListener('click', () => {
    state.gridVisible = !state.gridVisible;
    updateButton();
    applyGridVisibility();
    status(state.gridVisible ? 'Grid on' : 'Grid off');
  });

  viewGroup.appendChild(button);
  state.button = button;
  return button;
}

function bindShortcuts() {
  if (window.__3D_MARKUP_GRID_TOGGLE_SHORTCUT__) return;
  window.__3D_MARKUP_GRID_TOGGLE_SHORTCUT__ = true;

  window.addEventListener('keydown', (event) => {
    if (hasInputFocus()) return;
    if (event.key?.toLowerCase() !== 'g') return;
    event.preventDefault();
    state.gridVisible = !state.gridVisible;
    updateButton();
    applyGridVisibility();
    status(state.gridVisible ? 'Grid on' : 'Grid off');
  });
}

function updateButton() {
  const button = ensureButton();
  if (!button) return;

  button.classList.toggle('tool-active', state.gridVisible);
  button.setAttribute('aria-pressed', String(state.gridVisible));
  button.title = state.gridVisible ? 'Hide canvas grid (G)' : 'Show canvas grid (G)';
  const label = button.querySelector('span');
  if (label) label.textContent = state.gridVisible ? 'Grid On' : 'Grid Off';
}

function scheduleApplyGridVisibility() {
  const token = ++state.lastApplyToken;
  const applyRepeatedly = (remaining) => {
    if (token !== state.lastApplyToken) return;
    applyGridVisibility();
    if (remaining > 0) window.requestAnimationFrame(() => applyRepeatedly(remaining - 1));
  };
  applyRepeatedly(12);
}

function applyGridVisibility() {
  const scene = state.scene || runtime?.scene || window.__3D_MARKUP_CLIP_RUNTIME__?.scene;
  if (!scene) return;

  scene.traverse?.((object) => {
    if (isGridHelper(object)) object.visible = state.gridVisible;
  });
}

function isGridHelper(object) {
  if (!object) return false;
  if (String(object.name || '').toLowerCase() === 'grid') return true;
  if (object.type === 'GridHelper') return true;
  return false;
}

function hasInputFocus() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function status(message) {
  const runtimeStatus = document.getElementById('runtimeStatus');
  if (runtimeStatus) runtimeStatus.textContent = message;
}

function injectStyles() {
  if (document.getElementById('gridToggleControllerStyles')) return;

  const style = document.createElement('style');
  style.id = 'gridToggleControllerStyles';
  style.textContent = `
    .grid-toggle-btn {
      min-width: 82px;
    }

    .grid-toggle-icon {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      opacity: .94;
    }
  `;
  document.head.appendChild(style);
}

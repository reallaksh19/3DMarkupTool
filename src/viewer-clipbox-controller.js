import * as THREE from 'three';

const STYLE_ID = 'viewerClipBoxControllerStyles';
const MENU_ID = 'clipBoxMenu';
const HELPER_NAME = 'CLIP_BOX_HELPER';
const RUNTIME_READY_EVENTS = [
  'viewer:runtime-ready',
  'viewer:runtime-context',
  'viewer:model-loaded',
  'viewer:selection-changed',
  'markup:render-context'
];

const state = {
  enabled: false,
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 100,
  zMin: 0,
  zMax: 100,
  helper: null,
  lastBoundsSource: 'none'
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initClipBoxController, { once: true });
} else {
  initClipBoxController();
}

window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleSync(8));
RUNTIME_READY_EVENTS.forEach((name) => window.addEventListener(name, () => {
  if (state.enabled) applyClipBox();
  syncUi();
}));

function initClipBoxController() {
  injectStyles();
  scheduleSync(16);
}

function scheduleSync(remaining = 6) {
  window.requestAnimationFrame(() => {
    ensureClipBoxMenu();
    syncUi();
    if (remaining > 0) window.setTimeout(() => scheduleSync(remaining - 1), 140);
  });
}

function ensureClipBoxMenu() {
  const displayGroup = document.querySelector('.two-row-command-group[data-group="display"]');
  if (!displayGroup) return;

  let menu = document.getElementById(MENU_ID);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'two-row-menu viewer-clipbox-menu';
    menu.dataset.menu = 'clipBox';
    menu.innerHTML = menuMarkup();
    hookMenu(menu);
  }

  const clipButton = document.getElementById('clipBtn');
  if (clipButton?.parentElement === displayGroup && menu.parentElement !== displayGroup) {
    clipButton.insertAdjacentElement('afterend', menu);
  } else if (menu.parentElement !== displayGroup) {
    displayGroup.appendChild(menu);
  }
}

function hookMenu(menu) {
  if (menu.dataset.viewerClipBoxHooked) return;
  menu.dataset.viewerClipBoxHooked = '1';

  menu.querySelector('#clipBoxEnable')?.addEventListener('change', () => {
    readInputs(menu);
    state.enabled = Boolean(menu.querySelector('#clipBoxEnable')?.checked);
    applyClipBox();
    syncUi();
  });

  ['x', 'y', 'z'].forEach((axis) => {
    menu.querySelector(`#clipBox_${axis}Min`)?.addEventListener('input', () => {
      readInputs(menu);
      if (state.enabled) applyClipBox();
      syncUi();
    });
    menu.querySelector(`#clipBox_${axis}Max`)?.addEventListener('input', () => {
      readInputs(menu);
      if (state.enabled) applyClipBox();
      syncUi();
    });
  });

  menu.querySelector('#clipBoxApplyBtn')?.addEventListener('click', () => {
    readInputs(menu);
    state.enabled = true;
    applyClipBox();
    syncUi();
  });

  menu.querySelector('#clipBoxResetBtn')?.addEventListener('click', () => {
    Object.assign(state, { enabled: false, xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 100, lastBoundsSource: 'none' });
    clearClipBox();
    syncUi();
  });
}

function readInputs(menu = document.getElementById(MENU_ID)) {
  ['x', 'y', 'z'].forEach((axis) => {
    const minInput = menu?.querySelector(`#clipBox_${axis}Min`);
    const maxInput = menu?.querySelector(`#clipBox_${axis}Max`);
    const min = clamp(Number(minInput?.value), 0, 100);
    const max = clamp(Number(maxInput?.value), 0, 100);
    state[`${axis}Min`] = Math.min(min, max);
    state[`${axis}Max`] = Math.max(min, max);
  });
}

function applyClipBox() {
  const runtime = getRuntime();
  const renderer = runtime?.getRenderer?.() || runtime?.renderer;
  const scene = runtime?.getScene?.() || runtime?.scene;

  if (!state.enabled) {
    clearClipBox();
    return false;
  }

  if (!renderer || !scene) {
    state.lastBoundsSource = 'no-renderer';
    return false;
  }

  const resolved = resolveBaseBounds(runtime);
  if (!resolved?.box) {
    state.lastBoundsSource = 'no-model';
    clearHelper();
    return false;
  }

  const activeBox = percentBox(resolved.box);
  const planes = planesForBox(activeBox);
  const applied = runtime?.applyClipping?.(planes, { mode: 'box', source: 'clip-box' }) || applyRendererClipping(renderer, planes);
  if (!applied) return false;

  state.lastBoundsSource = resolved.source;
  showHelper(scene, activeBox, resolved.source);
  return true;
}

function clearClipBox() {
  clearHelper();
  const runtime = getRuntime();
  if (runtime?.clippingMode === 'box' || runtime?.clippingMode === 'custom' || !runtime?.clippingPlanes?.length) {
    runtime?.clearClipping?.({ source: 'clip-box' });
  }
  state.lastBoundsSource = 'none';
}

function resolveBaseBounds(runtime) {
  const selected = runtime?.getSelectedObject?.() || runtime?.selectedObject || null;
  const selectedBox = selected ? runtime?.getBounds?.(selected) : null;
  if (isValidBox(selectedBox)) return { box: selectedBox, source: 'selected' };

  const root = runtime?.getModelRoot?.() || runtime?.modelRoot || null;
  const modelBox = root ? runtime?.getBounds?.(root) : runtime?.getBounds?.();
  if (isValidBox(modelBox)) return { box: modelBox, source: 'model' };

  return null;
}

function percentBox(baseBox) {
  const min = baseBox.min;
  const max = baseBox.max;
  return new THREE.Box3(
    new THREE.Vector3(
      lerp(min.x, max.x, state.xMin / 100),
      lerp(min.y, max.y, state.yMin / 100),
      lerp(min.z, max.z, state.zMin / 100)
    ),
    new THREE.Vector3(
      lerp(min.x, max.x, state.xMax / 100),
      lerp(min.y, max.y, state.yMax / 100),
      lerp(min.z, max.z, state.zMax / 100)
    )
  );
}

function planesForBox(box) {
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min.z),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max.z)
  ];
}

function applyRendererClipping(renderer, planes) {
  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = planes;
  return true;
}

function showHelper(scene, box, source) {
  clearHelper();
  if (!scene || !isValidBox(box)) return;

  const helper = new THREE.Box3Helper(box, source === 'selected' ? 0xf7b75c : 0x65d5ff);
  helper.name = HELPER_NAME;
  helper.renderOrder = 1500;
  helper.userData = { isDisplayHelper: true, ignoreBounds: true, clipBoxHelper: true };
  if (helper.material) {
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.9;
  }
  scene.add(helper);
  state.helper = helper;
}

function clearHelper() {
  const helper = state.helper;
  if (!helper) return;
  helper.parent?.remove?.(helper);
  helper.geometry?.dispose?.();
  helper.material?.dispose?.();
  state.helper = null;
}

function syncUi(menu = document.getElementById(MENU_ID)) {
  if (!menu) return;

  const enable = menu.querySelector('#clipBoxEnable');
  if (enable) enable.checked = Boolean(state.enabled);

  ['x', 'y', 'z'].forEach((axis) => {
    const minInput = menu.querySelector(`#clipBox_${axis}Min`);
    const maxInput = menu.querySelector(`#clipBox_${axis}Max`);
    if (minInput && document.activeElement !== minInput) minInput.value = String(Math.round(state[`${axis}Min`]));
    if (maxInput && document.activeElement !== maxInput) maxInput.value = String(Math.round(state[`${axis}Max`]));
  });

  const readout = menu.querySelector('#clipBoxReadout');
  if (readout) readout.textContent = readoutText();
  menu.classList.toggle('clipbox-active', state.enabled);
}

function readoutText() {
  if (!state.enabled) return 'Clip Box is off. Enable it to show a 3D helper box.';
  if (state.lastBoundsSource === 'no-renderer') return 'Renderer context not ready yet.';
  if (state.lastBoundsSource === 'no-model') return 'Load or convert a model first.';

  const scope = state.lastBoundsSource === 'selected'
    ? 'Using selected object bounds'
    : 'Using full model bounds';
  return `${scope}: X ${Math.round(state.xMin)}-${Math.round(state.xMax)}%, Y ${Math.round(state.yMin)}-${Math.round(state.yMax)}%, Z ${Math.round(state.zMin)}-${Math.round(state.zMax)}%.`;
}

function menuMarkup() {
  return `
    <button type="button" class="two-row-menu-trigger viewer-clipbox-trigger" data-menu-key="clipBox" aria-haspopup="menu" aria-expanded="false">
      ${boxIconMarkup()}<span>Box</span><b aria-hidden="true">›</b>
    </button>
    <div class="two-row-menu-popover viewer-clipbox-popover" role="menu">
      <div class="viewer-clipbox-title">3D Clip Box</div>
      <label class="viewer-clipbox-check"><input id="clipBoxEnable" type="checkbox" /> <span>Enable clip box</span></label>
      ${axisRangeMarkup('x', 'X')}
      ${axisRangeMarkup('y', 'Y')}
      ${axisRangeMarkup('z', 'Z')}
      <div class="viewer-clipbox-actions">
        <button id="clipBoxApplyBtn" type="button">Apply</button>
        <button id="clipBoxResetBtn" type="button">Reset</button>
      </div>
      <div id="clipBoxReadout" class="viewer-clipbox-readout">Clip Box is off. Enable it to show a 3D helper box.</div>
    </div>`;
}

function axisRangeMarkup(axis, label) {
  return `
    <div class="viewer-clipbox-axis" data-axis="${axis}">
      <span>${label}</span>
      <input id="clipBox_${axis}Min" type="number" min="0" max="100" step="1" value="0" aria-label="${label} minimum percent" />
      <input id="clipBox_${axis}Max" type="number" min="0" max="100" step="1" value="100" aria-label="${label} maximum percent" />
    </div>`;
}

function boxIconMarkup() {
  return '<span class="two-row-svg" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/><path d="M7 7v10M17 7v10" opacity=".6"/></svg></span>';
}

function getRuntime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function isValidBox(box) {
  return Boolean(box)
    && Number.isFinite(box.min?.x)
    && Number.isFinite(box.min?.y)
    && Number.isFinite(box.min?.z)
    && Number.isFinite(box.max?.x)
    && Number.isFinite(box.max?.y)
    && Number.isFinite(box.max?.z)
    && box.max.x >= box.min.x
    && box.max.y >= box.min.y
    && box.max.z >= box.min.z;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function lerp(min, max, t) {
  return min + (max - min) * clamp(t, 0, 1);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.two-row-ribbon-ready .viewer-clipbox-menu {
      margin-left: 2px !important;
    }

    body.two-row-ribbon-ready .viewer-clipbox-menu.clipbox-active > .two-row-menu-trigger {
      border-color: rgba(247, 183, 92, .76) !important;
      background: rgba(90, 67, 44, .38) !important;
      color: #fff0cf !important;
    }

    body.two-row-ribbon-ready .viewer-clipbox-popover {
      min-width: 272px !important;
      padding: 10px !important;
      gap: 8px !important;
    }

    .viewer-clipbox-title {
      color: #e8f4ff;
      font-size: 12px;
      font-weight: 950;
      letter-spacing: .04em;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, .08);
    }

    .viewer-clipbox-check {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #dbeeff;
      font-size: 11px;
      font-weight: 850;
    }

    .viewer-clipbox-axis {
      display: grid;
      grid-template-columns: 22px 1fr 1fr;
      gap: 6px;
      align-items: center;
      color: #9fc4e8;
      font-size: 11px;
      font-weight: 900;
    }

    .viewer-clipbox-axis input {
      width: 100%;
      height: 28px;
      border-radius: 7px;
      border: 1px solid rgba(125, 172, 222, .35);
      background: rgba(9, 23, 37, .92);
      color: #f1f7ff;
      padding: 2px 6px;
      box-sizing: border-box;
    }

    .viewer-clipbox-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .viewer-clipbox-actions button {
      min-height: 30px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 900;
    }

    .viewer-clipbox-readout {
      color: #a9bed4;
      font-size: 10.5px;
      line-height: 1.35;
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, .08);
    }
  `;
  document.head.appendChild(style);
}

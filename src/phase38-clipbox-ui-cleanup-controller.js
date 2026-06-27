import * as THREE from 'three';

const STYLE_ID = 'phase38ClipBoxUiCleanupStyles';
const RETRIES = 32;

let userClosedInput = false;
let clipBoxState = {
  enabled: false,
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 100,
  zMin: 0,
  zMax: 100
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhase38ClipBoxUiCleanup, { once: true });
} else {
  initPhase38ClipBoxUiCleanup();
}

window.addEventListener('markup:safe-ui-status', () => scheduleApply(10));
window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleApply(10));
window.addEventListener('markup:app-ready', () => scheduleApply(10));
window.addEventListener('resize', () => scheduleApply(4));

function initPhase38ClipBoxUiCleanup() {
  injectStyles();
  scheduleApply(RETRIES);
}

function scheduleApply(remaining = 8) {
  window.requestAnimationFrame(() => {
    applyPhase38ClipBoxUiCleanup();
    if (remaining > 0) window.setTimeout(() => scheduleApply(remaining - 1), 120);
  });
}

function applyPhase38ClipBoxUiCleanup() {
  document.body.classList.add('phase38-ui-cleanup-ready');
  removeProtectedCoreFooterText();
  hookInputPanelClose();
  if (userClosedInput) closeInputDrawerNow();
  fixClipIcon();
  ensureClipBoxMenu();
}

function removeProtectedCoreFooterText() {
  document.querySelectorAll('.statusbar span').forEach((span) => {
    if (/protected\s+core/i.test(span.textContent || '')) span.remove();
  });
}

function hookInputPanelClose() {
  const close = document.getElementById('closeInputBtn');
  if (close && !close.dataset.phase38CloseHooked) {
    close.dataset.phase38CloseHooked = '1';
    close.addEventListener('click', () => {
      userClosedInput = true;
      window.setTimeout(closeInputDrawerNow, 0);
    }, true);
  }

  const toggle = document.getElementById('toggleInputBtn');
  if (toggle && !toggle.dataset.phase38ToggleHooked) {
    toggle.dataset.phase38ToggleHooked = '1';
    toggle.addEventListener('click', () => {
      window.setTimeout(() => {
        userClosedInput = !document.body.classList.contains('input-open');
        if (userClosedInput) closeInputDrawerNow();
        else openInputDrawerNow();
      }, 0);
    }, true);
  }
}

function closeInputDrawerNow() {
  const drawer = document.getElementById('inputDrawer');
  const toggle = document.getElementById('toggleInputBtn');
  document.body.classList.remove('input-open');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
  toggle?.classList.remove('active');
  toggle?.setAttribute('aria-pressed', 'false');
}

function openInputDrawerNow() {
  const drawer = document.getElementById('inputDrawer');
  const toggle = document.getElementById('toggleInputBtn');
  document.body.classList.add('input-open');
  drawer?.classList.add('open');
  drawer?.removeAttribute('hidden');
  drawer?.setAttribute('aria-hidden', 'false');
  toggle?.classList.add('active');
  toggle?.setAttribute('aria-pressed', 'true');
}

function fixClipIcon() {
  const button = document.getElementById('clipBtn');
  if (!button) return;

  const desiredLabel = /clip\s+on/i.test(button.textContent || '') || button.classList.contains('tool-active') ? 'Clip On' : 'Clip Off';
  const iconReady = button.querySelector('.phase38-clip-icon svg');
  const label = button.querySelector('.two-row-vis-label');

  if (!iconReady || !label) {
    button.innerHTML = `${clipIconMarkup()}<span class="two-row-vis-label">${escapeHtml(desiredLabel)}</span>`;
  } else if (label.textContent !== desiredLabel) {
    label.textContent = desiredLabel;
  }

  button.setAttribute('aria-label', desiredLabel);
  button.title = desiredLabel;

  if (!button.dataset.phase38ClipHooked) {
    button.dataset.phase38ClipHooked = '1';
    button.addEventListener('click', () => window.setTimeout(fixClipIcon, 0), true);
  }
}

function ensureClipBoxMenu() {
  const displayGroup = document.querySelector('.two-row-command-group[data-group="display"]');
  if (!displayGroup) return;

  let menu = document.getElementById('clipBoxMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'clipBoxMenu';
    menu.className = 'two-row-menu phase38-clipbox-menu';
    menu.dataset.menu = 'clipBox';
    menu.innerHTML = clipBoxMenuMarkup();
  }

  if (menu.parentElement !== displayGroup) displayGroup.appendChild(menu);
  hookClipBoxMenu(menu);
  syncClipBoxUi(menu);
}

function clipBoxMenuMarkup() {
  return `
    <button type="button" class="two-row-menu-trigger phase38-clipbox-trigger" data-menu-key="clipBox" aria-haspopup="menu" aria-expanded="false">
      ${boxIconMarkup()}<span>Box</span><b aria-hidden="true">â€º</b>
    </button>
    <div class="two-row-menu-popover phase38-clipbox-popover" role="menu">
      <div class="phase38-clipbox-title">3D Clip Box</div>
      <label class="phase38-clipbox-check"><input id="clipBoxEnable" type="checkbox" /> <span>Enable clip box</span></label>
      ${axisRangeMarkup('x', 'X')}
      ${axisRangeMarkup('y', 'Y')}
      ${axisRangeMarkup('z', 'Z')}
      <div class="phase38-clipbox-actions">
        <button id="clipBoxApplyBtn" type="button">Apply</button>
        <button id="clipBoxResetBtn" type="button">Reset</button>
      </div>
      <div id="clipBoxReadout" class="phase38-clipbox-readout">Load or convert a model, then enable Clip Box.</div>
    </div>`;
}

function axisRangeMarkup(axis, label) {
  return `
    <div class="phase38-clipbox-axis" data-axis="${axis}">
      <span>${label}</span>
      <input id="clipBox_${axis}Min" type="number" min="0" max="100" step="1" value="0" aria-label="${label} minimum percent" />
      <input id="clipBox_${axis}Max" type="number" min="0" max="100" step="1" value="100" aria-label="${label} maximum percent" />
    </div>`;
}

function hookClipBoxMenu(menu) {
  if (menu.dataset.phase38Hooked) return;
  menu.dataset.phase38Hooked = '1';

  menu.querySelector('#clipBoxEnable')?.addEventListener('change', () => {
    clipBoxState.enabled = Boolean(menu.querySelector('#clipBoxEnable')?.checked);
    readClipBoxInputs(menu);
    applyClipBox();
    syncClipBoxUi(menu);
  });

  ['x', 'y', 'z'].forEach((axis) => {
    menu.querySelector(`#clipBox_${axis}Min`)?.addEventListener('change', () => {
      readClipBoxInputs(menu);
      syncClipBoxUi(menu);
    });
    menu.querySelector(`#clipBox_${axis}Max`)?.addEventListener('change', () => {
      readClipBoxInputs(menu);
      syncClipBoxUi(menu);
    });
  });

  menu.querySelector('#clipBoxApplyBtn')?.addEventListener('click', () => {
    readClipBoxInputs(menu);
    clipBoxState.enabled = true;
    applyClipBox();
    syncClipBoxUi(menu);
  });

  menu.querySelector('#clipBoxResetBtn')?.addEventListener('click', () => {
    clipBoxState = { enabled: false, xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 100 };
    clearClipBox();
    syncClipBoxUi(menu);
  });
}

function readClipBoxInputs(menu) {
  ['x', 'y', 'z'].forEach((axis) => {
    const minInput = menu.querySelector(`#clipBox_${axis}Min`);
    const maxInput = menu.querySelector(`#clipBox_${axis}Max`);
    const min = clamp(Number(minInput?.value), 0, 100);
    const max = clamp(Number(maxInput?.value), 0, 100);
    clipBoxState[`${axis}Min`] = Math.min(min, max);
    clipBoxState[`${axis}Max`] = Math.max(min, max);
  });
}

function syncClipBoxUi(menu) {
  const enable = menu.querySelector('#clipBoxEnable');
  if (enable) enable.checked = Boolean(clipBoxState.enabled);

  ['x', 'y', 'z'].forEach((axis) => {
    const minInput = menu.querySelector(`#clipBox_${axis}Min`);
    const maxInput = menu.querySelector(`#clipBox_${axis}Max`);
    if (minInput) minInput.value = String(Math.round(clipBoxState[`${axis}Min`]));
    if (maxInput) maxInput.value = String(Math.round(clipBoxState[`${axis}Max`]));
  });

  const readout = menu.querySelector('#clipBoxReadout');
  if (!readout) return;
  const runtime = window.__3D_MARKUP_CLIP_RUNTIME__;
  if (!runtime?.renderer || !runtime?.scene) {
    readout.textContent = 'Renderer context not ready yet.';
    return;
  }
  readout.textContent = clipBoxState.enabled
    ? `Active: X ${clipBoxState.xMin}-${clipBoxState.xMax}%, Y ${clipBoxState.yMin}-${clipBoxState.yMax}%, Z ${clipBoxState.zMin}-${clipBoxState.zMax}%`
    : 'Clip Box is off.';
}

function applyClipBox() {
  const runtime = window.__3D_MARKUP_CLIP_RUNTIME__;
  const renderer = runtime?.renderer;
  const scene = runtime?.scene;
  if (!renderer || !scene) return;

  if (!clipBoxState.enabled) {
    clearClipBox();
    return;
  }

  const bounds = sceneBounds(scene);
  if (!bounds) return;

  const range = {
    xMin: lerp(bounds.min.x, bounds.max.x, clipBoxState.xMin / 100),
    xMax: lerp(bounds.min.x, bounds.max.x, clipBoxState.xMax / 100),
    yMin: lerp(bounds.min.y, bounds.max.y, clipBoxState.yMin / 100),
    yMax: lerp(bounds.min.y, bounds.max.y, clipBoxState.yMax / 100),
    zMin: lerp(bounds.min.z, bounds.max.z, clipBoxState.zMin / 100),
    zMax: lerp(bounds.min.z, bounds.max.z, clipBoxState.zMax / 100)
  };

  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -range.xMin),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), range.xMax),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -range.yMin),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), range.yMax),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -range.zMin),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), range.zMax)
  ];
}

function clearClipBox() {
  const renderer = window.__3D_MARKUP_CLIP_RUNTIME__?.renderer;
  if (renderer && Array.isArray(renderer.clippingPlanes) && renderer.clippingPlanes.length === 6) {
    renderer.clippingPlanes = [];
  }
}

function sceneBounds(root) {
  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  let count = 0;
  root.updateMatrixWorld?.(true);
  root.traverse?.((object) => {
    if (shouldSkipObject(object)) return;
    if (!object.geometry && !object.isMesh) return;
    scratch.setFromObject(object);
    if (!Number.isFinite(scratch.min.x)) return;
    box.union(scratch);
    count += 1;
  });
  return count && Number.isFinite(box.min.x) ? box : null;
}

function shouldSkipObject(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;
  const name = String(object.name || '').toLowerCase();
  return name === 'grid'
    || name === 'axes'
    || name.includes('helper')
    || name.includes('measure')
    || name.includes('selection_box_helper');
}

function clipIconMarkup() {
  return `<i class="two-row-svg phase38-clip-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M8 6v12a2 2 0 002 2h4a2 2 0 002-2V6"/><path d="M10 10l4 4M14 10l-4 4"/></svg></i>`;
}

function boxIconMarkup() {
  return `<span class="two-row-svg" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/><path d="M7 7v10M17 7v10" opacity=".6"/></svg></span>`;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function lerp(min, max, t) {
  return min + (max - min) * clamp(t, 0, 1);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function injectStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.phase38-ui-cleanup-ready .statusbar span:empty { display: none !important; }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready .app-shell.two-row-icon-shell {
      height: 128px !important;
      min-height: 128px !important;
      max-height: 128px !important;
      grid-template-rows: 56px 52px !important;
    }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready .app-shell.two-row-icon-shell .brand-block {
      height: 56px !important;
      min-height: 56px !important;
      grid-template-columns: auto auto auto minmax(8px, 1fr) auto !important;
    }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready .brand-block .eyebrow {
      max-width: none !important;
      font-size: 27px !important;
      line-height: 1 !important;
      letter-spacing: .08em !important;
      color: #d8edff !important;
      opacity: 1 !important;
    }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready .brand-block h1 {
      font-size: clamp(20px, 1.35vw, 24px) !important;
    }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready .brand-block p {
      font-size: 13px !important;
    }

    body:not(.input-open) #inputDrawer.phase37-drawer-stack,
    body:not(.input-open) #inputDrawer.phase36-drawer-fix,
    body:not(.input-open) #inputDrawer {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      transform: translateX(-105%) !important;
    }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready #clipBtn .phase38-clip-icon {
      width: 22px !important;
      height: 22px !important;
      font-size: 0 !important;
    }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready .phase38-clipbox-menu {
      margin-left: 2px !important;
    }

    body.two-row-ribbon-ready.phase38-ui-cleanup-ready .phase38-clipbox-popover {
      min-width: 260px !important;
      padding: 10px !important;
      gap: 8px !important;
    }

    .phase38-clipbox-title {
      color: #e8f4ff;
      font-size: 12px;
      font-weight: 950;
      letter-spacing: .04em;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .phase38-clipbox-check {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #dbeeff;
      font-size: 11px;
      font-weight: 850;
    }

    .phase38-clipbox-axis {
      display: grid;
      grid-template-columns: 22px 1fr 1fr;
      gap: 6px;
      align-items: center;
      color: #9fc4e8;
      font-size: 11px;
      font-weight: 900;
    }

    .phase38-clipbox-axis input {
      width: 100%;
      height: 28px;
      border-radius: 7px;
      border: 1px solid rgba(125, 172, 222, .35);
      background: rgba(9, 23, 37, .92);
      color: #f1f7ff;
      padding: 2px 6px;
      box-sizing: border-box;
    }

    .phase38-clipbox-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .phase38-clipbox-actions button {
      min-height: 30px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 900;
    }

    .phase38-clipbox-readout {
      color: #a9bed4;
      font-size: 10.5px;
      line-height: 1.35;
      padding-top: 4px;
      border-top: 1px solid rgba(255,255,255,.08);
    }
  `;
  document.head.appendChild(style);
}

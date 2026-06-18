import * as THREE from 'three';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  menu: null,
  target: null,
  hiddenObjects: new Set(),
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2()
};

const SKIP_NAME_PATTERNS = [
  'grid',
  'axes',
  'helper',
  'measure',
  'clip_plane_preview',
  'selection_box'
];

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initVisibilityContextMenu, { once: true });
} else {
  initVisibilityContextMenu();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (!renderer || !scene || !camera) return;

  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera;
  bindCanvas(renderer.domElement);
});

function initVisibilityContextMenu() {
  injectStyles();
  ensureMenu();
  document.addEventListener('click', hideMenu);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideMenu();
  });
}

function bindCanvas(canvas) {
  if (!canvas || canvas.dataset.visibilityContextBound === 'true') return;
  canvas.dataset.visibilityContextBound = 'true';
  canvas.addEventListener('contextmenu', onContextMenu);
}

function onContextMenu(event) {
  const renderer = state.renderer || runtime?.renderer;
  const scene = state.scene || runtime?.scene;
  const camera = state.camera || runtime?.camera;

  if (!renderer || !scene || !camera) return;
  event.preventDefault();
  event.stopPropagation();

  const target = pickSelectable(event, renderer, scene, camera);
  state.target = target;
  showMenu(event.clientX, event.clientY, target);
}

function pickSelectable(event, renderer, scene, camera) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.mouse, camera);

  const hits = state.raycaster.intersectObject(scene, true);
  for (const hit of hits) {
    const selectable = findSelectableObject(hit.object);
    if (selectable) return selectable;
  }
  return null;
}

function findSelectableObject(object) {
  let current = object;
  let fallback = null;

  while (current) {
    if (shouldSkipObject(current)) {
      current = current.parent;
      continue;
    }

    const data = current.userData || {};
    if (isSelectableData(data)) {
      if (data.TYPE && data.TYPE !== 'RVM_PRIMITIVE') return current;
      if (data.type && data.type !== 'RVM_PRIMITIVE') return current;
      fallback = fallback || current;
    }
    current = current.parent;
  }

  return fallback;
}

function shouldSkipObject(object) {
  if (!object || object.visible === false) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;

  const name = String(object.name || '').toLowerCase();
  return SKIP_NAME_PATTERNS.some((pattern) => name.includes(pattern));
}

function isSelectableData(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.TYPE === 'RVM_PRIMITIVE' || data.type === 'RVM_PRIMITIVE') return false;
  return Boolean(data.TYPE || data.type || data.ID || data.id || data.NODE || data.node || data.SOURCE || data.source);
}

function ensureMenu() {
  if (state.menu) return state.menu;

  const menu = document.createElement('div');
  menu.id = 'visibilityContextMenu';
  menu.className = 'visibility-context-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <div class="visibility-context-title" id="visibilityContextTitle">Object Visibility</div>
    <button type="button" data-action="hide">Hide Selected</button>
    <button type="button" data-action="isolate">Isolate Selected</button>
    <button type="button" data-action="showAll">Show All</button>
    <hr />
    <button type="button" data-action="copyTag">Copy Tag</button>
    <button type="button" data-action="copyMetadata">Copy Metadata</button>
  `;

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    event.preventDefault();
    handleAction(button.dataset.action);
  });

  document.body.appendChild(menu);
  state.menu = menu;
  return menu;
}

function showMenu(clientX, clientY, target) {
  const menu = ensureMenu();
  const title = menu.querySelector('#visibilityContextTitle');
  title.textContent = target ? labelForObject(target) : 'Model Visibility';

  menu.querySelector('[data-action="hide"]').disabled = !target;
  menu.querySelector('[data-action="isolate"]').disabled = !target;
  menu.querySelector('[data-action="copyTag"]').disabled = !target;
  menu.querySelector('[data-action="copyMetadata"]').disabled = !target;

  menu.hidden = false;
  menu.classList.add('open');

  const margin = 8;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(clientX, window.innerWidth - rect.width - margin);
  const top = Math.min(clientY, window.innerHeight - rect.height - margin);

  menu.style.left = `${Math.max(margin, left)}px`;
  menu.style.top = `${Math.max(margin, top)}px`;
}

function hideMenu() {
  if (!state.menu) return;
  state.menu.classList.remove('open');
  state.menu.hidden = true;
}

function handleAction(action) {
  const target = state.target;

  if (action === 'hide' && target) hideObject(target);
  if (action === 'isolate' && target) isolateObject(target);
  if (action === 'showAll') showAllObjects();
  if (action === 'copyTag' && target) copyText(labelForObject(target));
  if (action === 'copyMetadata' && target) copyText(JSON.stringify(findUserData(target), null, 2));

  hideMenu();
}

function hideObject(object) {
  if (!object) return;
  object.visible = false;
  object.userData.__visibilityHiddenByUi = true;
  state.hiddenObjects.add(object);
  status(`Hidden: ${labelForObject(object)}`);
}

function isolateObject(object) {
  if (!object) return;
  const selectables = collectSelectableObjects();
  selectables.forEach((candidate) => {
    const keep = candidate === object || isAncestor(candidate, object) || isAncestor(object, candidate);
    candidate.visible = keep;
    candidate.userData.__visibilityHiddenByUi = !keep;
    if (!keep) state.hiddenObjects.add(candidate);
  });
  object.visible = true;
  status(`Isolated: ${labelForObject(object)}`);
}

function showAllObjects() {
  const scene = state.scene || runtime?.scene;
  state.hiddenObjects.forEach((object) => {
    if (object) {
      object.visible = true;
      if (object.userData) object.userData.__visibilityHiddenByUi = false;
    }
  });
  state.hiddenObjects.clear();

  scene?.traverse?.((object) => {
    if (object.userData?.__visibilityHiddenByUi) {
      object.visible = true;
      object.userData.__visibilityHiddenByUi = false;
    }
  });

  status('Show All');
}

function collectSelectableObjects() {
  const scene = state.scene || runtime?.scene;
  const objects = [];
  const seen = new Set();

  scene?.traverse?.((object) => {
    if (shouldSkipObjectForCollection(object)) return;
    const selectable = findSelectableObjectForCollection(object);
    if (!selectable || seen.has(selectable)) return;
    seen.add(selectable);
    objects.push(selectable);
  });

  return objects;
}

function findSelectableObjectForCollection(object) {
  if (!object || shouldSkipObjectForCollection(object)) return null;
  const data = object.userData || {};
  return isSelectableData(data) ? object : null;
}

function shouldSkipObjectForCollection(object) {
  if (!object) return true;
  if (object.isLight || object.isCamera) return true;
  if (object.userData?.ignoreBounds || object.userData?.isDisplayHelper) return true;
  const name = String(object.name || '').toLowerCase();
  return SKIP_NAME_PATTERNS.some((pattern) => name.includes(pattern));
}

function isAncestor(possibleAncestor, object) {
  let current = object?.parent || null;
  while (current) {
    if (current === possibleAncestor) return true;
    current = current.parent;
  }
  return false;
}

function findUserData(object) {
  let current = object;
  while (current) {
    if (isSelectableData(current.userData)) return current.userData;
    current = current.parent;
  }
  return {};
}

function labelForObject(object) {
  const data = findUserData(object);
  return data.ID || data.id || data.LABEL || data.label || data.NODE || data.node || data.TYPE || data.type || object.name || 'Selected object';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ''));
    status('Copied to clipboard');
  } catch {
    status('Copy unavailable');
  }
}

function status(message) {
  const pill = document.getElementById('runtimeStatus');
  if (pill) pill.textContent = message;
}

function injectStyles() {
  if (document.getElementById('visibilityContextMenuStyles')) return;

  const style = document.createElement('style');
  style.id = 'visibilityContextMenuStyles';
  style.textContent = `
    .visibility-context-menu {
      position: fixed;
      z-index: 80;
      min-width: 190px;
      padding: 8px;
      border: 1px solid rgba(132, 178, 220, .52);
      border-radius: 12px;
      background: rgba(8, 15, 26, .96);
      color: #eef6ff;
      box-shadow: 0 18px 48px rgba(0, 0, 0, .38);
      backdrop-filter: blur(12px);
    }

    .visibility-context-menu[hidden] {
      display: none;
    }

    .visibility-context-title {
      padding: 7px 8px 9px;
      color: #ffe9b4;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .25px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 260px;
    }

    .visibility-context-menu button {
      width: 100%;
      min-height: 30px;
      justify-content: flex-start;
      margin: 2px 0;
      border-radius: 8px;
      background: rgba(31, 51, 78, .90);
      border-color: rgba(78, 112, 148, .9);
      color: #eef6ff;
      text-align: left;
    }

    .visibility-context-menu button:hover:not(:disabled) {
      border-color: rgba(101, 213, 255, .98);
      background: rgba(37, 66, 97, .96);
    }

    .visibility-context-menu button:disabled {
      opacity: .38;
      cursor: not-allowed;
    }

    .visibility-context-menu hr {
      border: 0;
      border-top: 1px solid rgba(132, 178, 220, .20);
      margin: 7px 4px;
    }
  `;
  document.head.appendChild(style);
}

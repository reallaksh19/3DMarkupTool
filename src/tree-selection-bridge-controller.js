const LIST_ID = 'modelTreeList';
const PANEL_ID = 'modelTreePanel';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTreeSelectionBridge, { once: true });
} else {
  initTreeSelectionBridge();
}

window.addEventListener('viewer:selection-changed', (event) => {
  const uuid = event.detail?.selectedObject?.uuid || event.detail?.object?.uuid || window.__3D_MARKUP_SELECTED_OBJECT__?.uuid;
  if (uuid) markActiveTreeItem(uuid);
});

window.addEventListener('markup:selected-object-changed', (event) => {
  const uuid = event.detail?.object?.uuid || window.__3D_MARKUP_SELECTED_OBJECT__?.uuid;
  if (uuid) markActiveTreeItem(uuid);
});

function initTreeSelectionBridge() {
  document.addEventListener('click', handleTreeClick, true);
}

function handleTreeClick(event) {
  const item = event.target?.closest?.(`#${PANEL_ID} .tree-item[data-uuid], #${LIST_ID} .tree-item[data-uuid]`);
  if (!item) return;

  const object = findObjectByUuid(item.dataset.uuid);
  if (!object) return;

  const runtime = getRuntime();
  const data = findUserData(object);
  runtime?.selectObject?.(object, data, { source: 'model-tree' });
  markActiveTreeItem(object.uuid);
}

function findObjectByUuid(uuid) {
  if (!uuid) return null;
  const runtime = getRuntime();
  const roots = [
    runtime?.getModelRoot?.(),
    runtime?.modelRoot,
    runtime?.getScene?.(),
    runtime?.scene
  ].filter(Boolean);

  for (const root of roots) {
    let found = null;
    root.traverse?.((object) => {
      if (!found && object.uuid === uuid) found = object;
    });
    if (found) return found;
  }

  return null;
}

function markActiveTreeItem(uuid) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;
  list.querySelectorAll('.tree-item-active').forEach((node) => node.classList.remove('tree-item-active'));
  const active = list.querySelector(`.tree-item[data-uuid="${cssEscape(uuid)}"]`);
  active?.classList.add('tree-item-active');
  active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function findUserData(object) {
  let current = object;
  let fallback = {};
  while (current) {
    const data = current.userData || {};
    if (Object.keys(data).length) {
      if (data.TYPE && data.TYPE !== 'RVM_PRIMITIVE') return data;
      if (data.type && data.type !== 'RVM_PRIMITIVE') return data;
      if (!Object.keys(fallback).length) fallback = data;
    }
    current = current.parent;
  }
  return fallback;
}

function getRuntime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}

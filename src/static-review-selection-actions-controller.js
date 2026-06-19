// Final selection/action layer for the ribbon review tools.
// Adds clear/export/reassemble actions and makes Area Select activation consistent
// from ribbon, menu, and canvas context menu without changing the viewer core.

const VERSION = 'review-selection-actions-20260619';
const STYLE_ID = 'staticReviewSelectionActionsStyle';
const RIBBON_GROUP_ID = 'staticReviewRibbonGroup';
const CONTEXT_MENU_ID = 'staticReviewContextMenu';
const AREA_PREFIX_RE = /^(FINAL_AREA_SELECT_|DIRECT_AREA_SELECT_|AREA_SELECT_)/i;
const ACTIONS = [
  { key: 'clearAreaSelection', label: 'Clear Sel', menuLabel: 'Clear Selection', icon: 'clear-selection', title: 'Clear area-selection highlight boxes' },
  { key: 'exportSelectedProperties', label: 'Export Sel', menuLabel: 'Export Selected Properties CSV', icon: 'export-selected', title: 'Export selected component metadata to CSV' },
  { key: 'explodeReset', label: 'Reset', menuLabel: 'Reassemble / Reset Explode', icon: 'reset-explode', title: 'Restore objects moved by Explode Review' }
];

let previousAreaApi = null;
let previousExplodeApi = null;
let patchTick = 0;

runWhenReady(initReviewSelectionActions);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initReviewSelectionActions() {
  injectStyles();
  patchToolApis();
  installEventGuards();
  refreshActions();
  ['markup:app-ready', 'viewer:model-loaded', 'viewer:runtime-context', 'viewer:area-select', 'viewer:explode-review'].forEach((eventName) => {
    window.addEventListener(eventName, () => window.setTimeout(refreshActions, 0));
  });
  window.addEventListener('resize', refreshActions);
  window.setInterval(refreshActions, 600);
}

function refreshActions() {
  patchTick += 1;
  patchToolApis();
  ensureRibbonActionButtons();
  ensureContextMenuActionButtons();
  window.__3D_MARKUP_REVIEW_SELECTION_ACTIONS__ = {
    version: VERSION,
    refresh: refreshActions,
    clearSelection: clearAreaSelection,
    exportSelectedProperties,
    resetExplode,
    debug: () => ({
      version: VERSION,
      areaSelectedCount: selectedAreaIds().length,
      helperCount: areaHelpers().length,
      explodedCount: explodedObjects().length,
      ribbonActions: ACTIONS.every((action) => Boolean(document.querySelector(`#${RIBBON_GROUP_ID} [data-review-tool="${cssEscape(action.key)}"]`))),
      contextActions: ACTIONS.every((action) => Boolean(document.querySelector(`#${CONTEXT_MENU_ID} [data-review-menu-tool="${cssEscape(action.key)}"]`))),
      patchTick
    })
  };
}

function patchToolApis() {
  patchAreaApi();
  patchExplodeApi();
  window.__3D_MARKUP_SELECTED_PROPERTIES_EXPORT__ = {
    version: VERSION,
    exportCsv: exportSelectedProperties,
    selectedIds: selectedAreaIds,
    debug: () => ({ selectedIds: selectedAreaIds(), exportedRows: buildSelectedPropertyRows().length })
  };
}

function patchAreaApi() {
  const current = window.__3D_MARKUP_AREA_SELECT__;
  if (!current || current.__selectionActionsPatched === VERSION) return;
  previousAreaApi = current;
  const patched = {
    ...current,
    version: current.version || VERSION,
    activate: (...args) => {
      // Starting Area Select should always clear stale boxes from a previous selection first.
      clearAreaSelection({ silent: true, keepApi: true });
      const result = call(previousAreaApi, 'activate', args);
      setStatus('Area Select: drag a box. Esc/Clear Sel clears selection. Export Sel exports properties.');
      return result !== false;
    },
    clear: (...args) => {
      const result = call(previousAreaApi, 'clear', args);
      removeAreaHelpers();
      setStatus('Area selection cleared');
      requestRender('area-selection-actions-clear');
      return result !== false;
    },
    exportProperties: exportSelectedProperties,
    selectedIds: () => unique((call(previousAreaApi, 'selectedIds', []) || []).concat(selectedAreaIdsFromHelpers())),
    __selectionActionsPatched: VERSION
  };
  window.__3D_MARKUP_AREA_SELECT__ = patched;
}

function patchExplodeApi() {
  const current = window.__3D_MARKUP_EXPLODE_REVIEW__;
  if (!current || current.__selectionActionsPatched === VERSION) return;
  previousExplodeApi = current;
  window.__3D_MARKUP_EXPLODE_REVIEW__ = {
    ...current,
    reset: (...args) => {
      const apiResult = call(previousExplodeApi, 'reset', args);
      const directResult = resetExplode('api-selection-actions');
      return apiResult !== false || directResult;
    },
    reassemble: () => resetExplode('reassemble-selection-actions'),
    isExploded: () => explodedObjects().length > 0,
    __selectionActionsPatched: VERSION
  };
}

function installEventGuards() {
  if (window.__3D_MARKUP_REVIEW_SELECTION_ACTION_GUARDS__ === VERSION) return;
  window.__3D_MARKUP_REVIEW_SELECTION_ACTION_GUARDS__ = VERSION;

  // Directly own the action buttons, and harden Area Select ribbon activation.
  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-review-tool], [data-review-menu-tool]');
    if (!target) return;
    const key = target.dataset.reviewTool || target.dataset.reviewMenuTool;
    if (key === 'areaSelect') {
      stop(event);
      window.__3D_MARKUP_AREA_SELECT__?.activate?.();
      closeMenus();
      return;
    }
    if (runActionKey(key, 'click-guard')) {
      stop(event);
      closeMenus();
    }
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || isEditable(event.target)) return;
    const hadSelection = selectedAreaIds().length > 0 || areaHelpers().length > 0;
    const hadExplode = explodedObjects().length > 0;
    if (!hadSelection && !hadExplode) return;
    clearAreaSelection({ silent: true });
    resetExplode('escape-selection-actions', true);
    setStatus('Esc: cleared selection / reassembled explode');
    stop(event);
  }, true);
}

function runActionKey(key, source = 'unknown') {
  if (key === 'clearAreaSelection') return clearAreaSelection({ source });
  if (key === 'exportSelectedProperties') return exportSelectedProperties({ source });
  if (key === 'explodeReset') return resetExplode(`reset-${source}`);
  return false;
}

function ensureRibbonActionButtons() {
  const group = document.getElementById(RIBBON_GROUP_ID);
  if (!group) return;
  const explodeButton = group.querySelector('[data-review-tool="explodeReview"]');
  ACTIONS.forEach((action) => {
    let button = group.querySelector(`[data-review-tool="${cssEscape(action.key)}"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-btn review-ribbon-tool-btn review-action-tool-btn';
      button.dataset.reviewTool = action.key;
      button.dataset.reviewToolIcon = action.icon;
      button.addEventListener('click', (event) => {
        stop(event);
        runActionKey(action.key, 'ribbon-action');
      });
    }
    decorateActionButton(button, action, 'review-ribbon-tool-icon');
    if (action.key === 'clearAreaSelection') {
      const area = group.querySelector('[data-review-tool="areaSelect"]');
      if (area && button.previousElementSibling !== area) area.after(button);
      else if (!button.parentElement) group.appendChild(button);
    } else if (action.key === 'exportSelectedProperties') {
      const showAll = group.querySelector('[data-review-tool="showAll"]');
      if (showAll && button.previousElementSibling !== showAll) showAll.after(button);
      else if (!button.parentElement) group.appendChild(button);
    } else if (action.key === 'explodeReset') {
      if (explodeButton && button.previousElementSibling !== explodeButton) explodeButton.after(button);
      else if (!button.parentElement) group.appendChild(button);
    }
  });
}

function ensureContextMenuActionButtons() {
  const menu = document.getElementById(CONTEXT_MENU_ID);
  if (!menu || menu.hidden) return;
  const explodeItem = menu.querySelector('[data-review-menu-tool="explodeReview"]');
  ACTIONS.forEach((action) => {
    let button = menu.querySelector(`[data-review-menu-tool="${cssEscape(action.key)}"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'review-context-menu__item review-action-context-item';
      button.dataset.reviewMenuTool = action.key;
      button.setAttribute('role', 'menuitem');
      button.addEventListener('click', (event) => {
        stop(event);
        runActionKey(action.key, 'context-action');
        closeMenus();
      });
    }
    decorateActionButton(button, action, 'review-context-menu__item__icon');
    if (action.key === 'clearAreaSelection') {
      const area = menu.querySelector('[data-review-menu-tool="areaSelect"]');
      if (area && button.previousElementSibling !== area) area.after(button);
      else if (!button.parentElement) menu.appendChild(button);
    } else if (action.key === 'exportSelectedProperties') {
      const showAll = menu.querySelector('[data-review-menu-tool="showAll"]');
      if (showAll && button.previousElementSibling !== showAll) showAll.after(button);
      else if (!button.parentElement) menu.appendChild(button);
    } else if (action.key === 'explodeReset') {
      if (explodeItem && button.previousElementSibling !== explodeItem) explodeItem.after(button);
      else if (!button.parentElement) menu.appendChild(button);
    }
  });
}

function decorateActionButton(button, action, iconClass) {
  const renderKey = `${VERSION}|${action.key}|${action.label}|${action.icon}`;
  button.title = action.title;
  button.setAttribute('aria-label', action.title);
  if (button.dataset.selectionActionRendered === renderKey) return;
  button.dataset.selectionActionRendered = renderKey;
  const iconWrap = document.createElement('span');
  iconWrap.className = iconClass;
  iconWrap.appendChild(iconNode(action.icon));
  const label = document.createElement('span');
  label.textContent = button.dataset.reviewMenuTool ? action.menuLabel : action.label;
  if (button.dataset.reviewMenuTool) label.className = 'review-context-menu__item__label';
  button.replaceChildren(iconWrap, label);
}

function clearAreaSelection({ silent = false, keepApi = false } = {}) {
  if (!keepApi) call(previousAreaApi || window.__3D_MARKUP_AREA_SELECT__, 'clear', []);
  removeAreaHelpers();
  window.__3D_MARKUP_SELECTED_OBJECT__ = null;
  window.dispatchEvent(new CustomEvent('viewer:area-select', { detail: { action: 'clear', version: VERSION } }));
  window.dispatchEvent(new CustomEvent('viewer:selection-changed', { detail: { selectedObject: null, source: VERSION } }));
  requestRender('area-selection-actions-clear');
  if (!silent) setStatus('Area selection cleared');
  return true;
}

function removeAreaHelpers() {
  areaHelpers().forEach((helper) => {
    helper.parent?.remove?.(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  });
}

function areaHelpers() {
  const root = runtime()?.scene || modelRoot()?.parent || modelRoot();
  if (!root?.traverse) return [];
  const helpers = [];
  root.traverse((object) => {
    const name = String(object.name || '');
    if (object.userData?.areaSelectHelper || AREA_PREFIX_RE.test(name)) helpers.push(object);
  });
  return helpers;
}

function selectedAreaIds() {
  const apiIds = call(previousAreaApi || window.__3D_MARKUP_AREA_SELECT__, 'selectedIds', []) || [];
  return unique(apiIds.concat(selectedAreaIdsFromHelpers()).filter(Boolean));
}

function selectedAreaIdsFromHelpers() {
  return areaHelpers().map((helper) => helper.userData?.selectedId).filter(Boolean);
}

function exportSelectedProperties({ source = 'export-selected-properties' } = {}) {
  const rows = buildSelectedPropertyRows();
  if (!rows.length) {
    setStatus('Export Sel: no area-selected/selected component found');
    return false;
  }
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `selected-properties-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Exported ${rows.length} selected property row${rows.length === 1 ? '' : 's'}`);
  window.dispatchEvent(new CustomEvent('viewer:selected-properties-export', { detail: { version: VERSION, source, rowCount: rows.length, selectedIds: selectedAreaIds() } }));
  return true;
}

function buildSelectedPropertyRows() {
  const ids = new Set(selectedAreaIds());
  let targets = selectableComponents().filter((object) => ids.has(objectId(object)) || ids.has(object.uuid));
  if (!targets.length) {
    const selected = selectedObject();
    if (selected && !isHelper(selected)) targets = [selected];
  }
  return targets.flatMap((object, index) => propertyRowsForObject(object, index + 1));
}

function propertyRowsForObject(object, index) {
  const data = object?.userData || {};
  const base = {
    selected_index: index,
    object_id: objectId(object),
    object_name: object?.name || '',
    object_type: object?.type || ''
  };
  const entries = Object.entries(data).filter(([, value]) => isExportableValue(value));
  if (!entries.length) return [{ ...base, property_key: '', property_value: '' }];
  return entries.map(([key, value]) => ({ ...base, property_key: key, property_value: stringifyValue(value) }));
}

function resetExplode(source = 'selection-actions-reset', silent = false) {
  const result = call(previousExplodeApi, 'reset', [source]);
  const root = modelRoot();
  let count = 0;
  root?.traverse?.((object) => {
    const keys = Object.keys(object.userData || {}).filter((key) => /ExplodeOriginalPosition/i.test(key));
    keys.forEach((key) => {
      const original = object.userData[key];
      if (!Array.isArray(original) || original.length < 3) return;
      object.position.set(original[0], original[1], original[2]);
      delete object.userData[key];
      count += 1;
    });
  });
  requestRender('explode-reassemble-selection-actions');
  if (!silent || count) setStatus(count ? `Reassembled ${count} moved component${count === 1 ? '' : 's'}` : 'Explode already reset');
  window.dispatchEvent(new CustomEvent('viewer:explode-review', { detail: { action: 'reset', version: VERSION, source, resetCount: count } }));
  return result !== false || count > 0;
}

function explodedObjects() {
  const root = modelRoot();
  if (!root?.traverse) return [];
  const objects = [];
  root.traverse((object) => {
    if (Object.keys(object.userData || {}).some((key) => /ExplodeOriginalPosition/i.test(key))) objects.push(object);
  });
  return objects;
}

function selectableComponents() {
  const root = modelRoot();
  if (!root?.traverse) return [];
  const strong = [];
  root.traverse((object) => {
    if (!object || object === root || isHelper(object)) return;
    const data = object.userData || {};
    if (data.componentId || data.COMPONENT_ID || data.componentClass || data.componentType || data.ID || data.id || data.TAG || data.SUPPORT_TAG || data.TYPE || data.type || data.meshRole || data.LINE_NO || data.lineNo || data.rawType || data.visualKey) strong.push(object);
  });
  if (strong.length) return uniqueObjects(strong);
  const renderables = [];
  root.traverse((object) => {
    if (object !== root && !isHelper(object) && (object.isMesh || object.isLine || object.isPoints)) renderables.push(object);
  });
  return renderables;
}

function selectedObject() {
  const rt = runtime();
  return rt?.getSelectedObject?.()
    || window.__3D_MARKUP_SELECTED_OBJECT__
    || rt?.selectedObject
    || rt?.selectedMesh
    || window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject
    || window.__3D_MARKUP_TREE__?.state?.selectedObject
    || null;
}

function objectId(object) {
  const data = object?.userData || {};
  return String(data.ID || data.id || data.componentId || data.COMPONENT_ID || data.TAG || data.SUPPORT_TAG || data.NAME || data.name || object?.name || object?.uuid || '').trim();
}

function modelRoot() {
  const rt = runtime();
  const root = rt?.modelRoot || rt?.getModelRoot?.() || null;
  if (root && root !== rt?.scene) return root;
  return root;
}

function runtime() {
  const rt = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
  return rt?.refresh?.() || rt;
}

function requestRender(reason) {
  const rt = runtime();
  rt?.renderOnce?.(reason);
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { reason } }));
}

function setStatus(message) {
  const target = document.getElementById('statusText') || document.getElementById('runtimeStatus') || document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (target && message) target.textContent = message;
}

function closeMenus() {
  document.querySelectorAll('.review-top-menu-popover, .top-menu-popover').forEach((panel) => { panel.hidden = true; });
  document.getElementById(CONTEXT_MENU_ID)?.setAttribute('hidden', '');
  document.querySelectorAll('[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function call(api, methodName, args = []) {
  const fn = api?.[methodName];
  if (typeof fn !== 'function') return null;
  try { return fn.apply(api, args); }
  catch (error) { console.warn(`[3DMarkupTool] ${VERSION} ${methodName} failed`, error); return false; }
}

function isExportableValue(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value);
}

function stringifyValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function toCsv(rows) {
  const headers = ['selected_index', 'object_id', 'object_name', 'object_type', 'property_key', 'property_value'];
  return [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isHelper(object) {
  const data = object?.userData || {};
  const name = String(object?.name || '');
  return Boolean(data.helper || data.measurePolylineHelper || data.areaSelectHelper || data.sectionBoxHelper || data.isDisplayHelper)
    || AREA_PREFIX_RE.test(name)
    || /^(inputxml|__|MEASURE_|ComponentSearchHighlight|MODEL_TREE_SELECTION)/i.test(name);
}

function isEditable(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

function unique(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function uniqueObjects(objects) {
  return Array.from(new Set(objects.filter(Boolean)));
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function iconNode(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = iconMarkup(name);
  return svg;
}

function iconMarkup(name) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    'clear-selection': `<path d="M5 5h14v14H5z" ${common} stroke-dasharray="3 2"/><path d="M8 8l8 8M16 8l-8 8" ${common}/>` ,
    'export-selected': `<path d="M12 4v9" ${common}/><path d="M8 9l4 4 4-4" ${common}/><path d="M5 16v3h14v-3" ${common}/><path d="M5 5h4M15 5h4" ${common} opacity=".6"/>`,
    'reset-explode': `<path d="M7 7l-4 4 4 4" ${common}/><path d="M3 11h11a5 5 0 1 1-3.7 8.4" ${common}/><path d="M15 5l4 4M19 5l-4 4" ${common} opacity=".75"/>`
  };
  return icons[name] || icons['clear-selection'];
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${RIBBON_GROUP_ID} .review-action-tool-btn { border-color: rgba(34, 197, 94, .32); }
    #${RIBBON_GROUP_ID} .review-action-tool-btn span:first-child { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; color: #c7f9d4; }
    #${RIBBON_GROUP_ID} .review-action-tool-btn span:first-child svg { width: 20px; height: 20px; }
    .review-action-context-item { color: #dcfce7; }
  `;
  document.head.appendChild(style);
}

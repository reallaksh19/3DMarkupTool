// Ribbon-first review tool integration.
// Keeps the GLB/RVM Review shell icon grammar: ribbon icon tiles, a top Review
// menu, and a canvas right-click menu all come from one registry. Older text-only
// view-pad shortcut buttons are hidden implementation hooks only.

const VERSION = 'review-ribbon-icons-20260619';
const STYLE_ID = 'staticReviewRibbonToolsStyle';
const RIBBON_GROUP_ID = 'staticReviewRibbonGroup';
const TOP_MENU_ID = 'topReviewMenu';
const CONTEXT_MENU_ID = 'staticReviewContextMenu';
const RETRY_MS = 220;
const MAX_RETRIES = 35;

const REVIEW_TOOL_REGISTRY = [
  { key: 'marqueeZoom', label: 'Zoom Box', menuLabel: 'Zoom Box', icon: 'zoom-box', title: 'Drag a box on the canvas to zoom into that area', api: ['__3D_MARKUP_MARQUEE_ZOOM__', 'activate'], ribbon: true },
  { key: 'areaSelect', label: 'Area Sel', menuLabel: 'Area Select', icon: 'area-select', title: 'Drag a box to select visible components', api: ['__3D_MARKUP_AREA_SELECT__', 'activate'], ribbon: true },
  { key: 'clearAreaSelection', label: 'Clear Sel', menuLabel: 'Clear Selection', icon: 'clear-selection', title: 'Clear Area Select highlights', api: ['__3D_MARKUP_AREA_SELECT__', 'clearSelection'], ribbon: true },
  { key: 'exportAreaSelectionCsv', label: 'Sel CSV', menuLabel: 'Export Selected CSV', icon: 'export-csv', title: 'Download properties for Area Select highlights as CSV', api: ['__3D_MARKUP_AREA_SELECT__', 'exportSelectedPropertiesCsv'], ribbon: true },
  { key: 'componentSearch', label: 'Search', menuLabel: 'Search / Jump', icon: 'search-target', title: 'Search by ID, node, line, support, tag, or type', api: ['__3D_MARKUP_COMPONENT_SEARCH__', 'open'], ribbon: true },
  { key: 'sectionBoxSelected', label: 'Box', menuLabel: 'Section Box', icon: 'section-box', title: 'Create a section box from the selected component', api: ['__3D_MARKUP_SECTION_BOX__', 'apply'], ribbon: true },
  { key: 'isolateSelected', label: 'Isolate', menuLabel: 'Isolate Selected', icon: 'isolate', title: 'Show only the selected component', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'isolateSelected'], ribbon: true },
  { key: 'hideSelected', label: 'Hide', menuLabel: 'Hide Selected', icon: 'hide', title: 'Hide the selected component', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'hideSelected'], ribbon: true },
  { key: 'showAll', label: 'Show All', menuLabel: 'Show All', icon: 'show-all', title: 'Show all hidden components', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'showAll'], ribbon: true },
  { key: 'savedViews', label: 'Views', menuLabel: 'Saved Views', icon: 'bookmark-view', title: 'Open saved views', api: ['__3D_MARKUP_SAVED_VIEWS__', 'open'], ribbon: true },
  { divider: true },
  { key: 'viewPrevious', label: 'Prev', menuLabel: 'Previous View', icon: 'undo-view', title: 'Go to the previous camera view', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'previousView'], ribbon: true },
  { key: 'viewNext', label: 'Next', menuLabel: 'Next View', icon: 'redo-view', title: 'Go to the next camera view', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'nextView'], ribbon: true },
  { key: 'measurePolyline', label: 'Polyline', menuLabel: 'Measure Polyline', icon: 'polyline-measure', title: 'Click multiple points to measure cumulative length', api: ['__3D_MARKUP_MEASURE_POLYLINE__', 'activate'], ribbon: true },
  { key: 'explodeReview', label: 'Explode', menuLabel: 'Explode Review', icon: 'explode', title: 'Separate components by type or line for review', ribbon: true }
];

const HIDDEN_VIEWPAD_KEYS = REVIEW_TOOL_REGISTRY.filter((tool) => tool.key).map((tool) => tool.key);
let contextMenu;
let attachedContextTarget;
let retryCount = 0;

runWhenReady(initReviewRibbonTools);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initReviewRibbonTools() {
  injectStyles();
  installApi();
  refreshIntegration();
  attachContextMenu();
  attachRefreshEvents();
  retryRefresh();
}

function refreshIntegration() {
  hideShortcutViewpadButtons();
  ensureRibbonGroup();
  ensureTopReviewMenu();
  attachContextMenu();
  return Boolean(document.getElementById(RIBBON_GROUP_ID) && document.getElementById(TOP_MENU_ID));
}

function ensureRibbonGroup() {
  const ribbon = document.querySelector('.main-ribbon');
  if (!ribbon) return null;
  let group = document.getElementById(RIBBON_GROUP_ID);
  if (!group) {
    group = document.createElement('div');
    group.id = RIBBON_GROUP_ID;
    group.className = 'tool-group toolbar-group review-ribbon-group';
    group.dataset.expandedGroup = 'review';
    group.dataset.expandedLabel = 'Review';
    group.setAttribute('aria-label', 'Review tools');
  }
  renderRibbonButtons(group);
  const display = document.querySelector('[data-group="display"]');
  const preview = document.querySelector('[aria-label="Preview mode"]');
  if (display?.parentElement === ribbon && group.previousElementSibling !== display) display.after(group);
  else if (!display && preview?.parentElement === ribbon && group.nextElementSibling !== preview) ribbon.insertBefore(group, preview);
  else if (!group.parentElement) ribbon.appendChild(group);
  return group;
}

function renderRibbonButtons(group) {
  const ribbonTools = tools().filter((tool) => tool.ribbon);
  const expected = new Set(ribbonTools.map((tool) => tool.key));
  Array.from(group.querySelectorAll('[data-review-tool]')).forEach((button) => {
    if (!expected.has(button.dataset.reviewTool)) button.remove();
  });
  ribbonTools.forEach((tool) => {
    let button = group.querySelector(`[data-review-tool="${cssEscape(tool.key)}"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-btn review-ribbon-tool-btn';
      button.dataset.reviewTool = tool.key;
      button.dataset.view = tool.key;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        runTool(tool.key, 'ribbon');
      });
      group.appendChild(button);
    }
    decorateToolButton(button, tool);
  });
}

function decorateToolButton(button, tool) {
  const renderKey = `${tool.icon}|${tool.label}|${tool.title}`;
  button.title = tool.title;
  button.setAttribute('aria-label', tool.title);
  button.dataset.reviewToolIcon = tool.icon;
  if (button.dataset.reviewToolRendered === renderKey) return;
  button.dataset.reviewToolRendered = renderKey;
  button.replaceChildren(iconNode(tool.icon, 'review-ribbon-tool-icon'), textNode('span', tool.label));
}

function ensureTopReviewMenu() {
  const actions = document.querySelector('.topbar-actions');
  const props = document.getElementById('togglePropsBtn');
  if (!actions || !props) return null;
  let wrap = document.getElementById(TOP_MENU_ID);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = TOP_MENU_ID;
    wrap.className = 'top-menu-wrap review-top-menu-wrap';
    wrap.innerHTML = '<button type="button" class="top-menu-btn panel-toggle review-top-menu-btn" aria-expanded="false"></button><div class="top-menu-popover review-top-menu-popover" hidden role="menu" aria-label="Review tools"></div>';
    wrap.querySelector('.review-top-menu-btn')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleTopReviewMenu(wrap);
    });
  }
  const button = wrap.querySelector('.review-top-menu-btn');
  if (button && button.dataset.reviewRendered !== VERSION) {
    button.title = 'Review tools';
    button.dataset.reviewRendered = VERSION;
    button.replaceChildren(iconNode('review-menu', 'review-menu-button-icon'), textNode('span', 'Review'));
  }
  renderTopReviewMenu(wrap);
  const markup = document.getElementById('topMarkupMenu');
  if (markup?.parentElement === actions && wrap.nextElementSibling !== markup) actions.insertBefore(wrap, markup);
  else if (!markup && props.parentElement === actions && props.nextElementSibling !== wrap) props.after(wrap);
  else if (!wrap.parentElement) actions.appendChild(wrap);
  return wrap;
}

function renderTopReviewMenu(wrap) {
  const pop = wrap.querySelector('.review-top-menu-popover');
  if (!pop || pop.dataset.reviewMenuRendered === VERSION) return;
  pop.dataset.reviewMenuRendered = VERSION;
  pop.innerHTML = '';
  REVIEW_TOOL_REGISTRY.forEach((tool) => {
    if (tool.divider) {
      const divider = document.createElement('div');
      divider.className = 'review-menu-divider';
      pop.appendChild(divider);
      return;
    }
    pop.appendChild(menuButton(tool, 'top-menu-review-item', () => {
      runTool(tool.key, 'top-menu');
      closeTopReviewMenus();
    }));
  });
  const note = document.createElement('div');
  note.className = 'top-menu-note';
  note.textContent = 'Area Select can feed Isolate, Hide, Show All, Clear Selection, and CSV export.';
  pop.appendChild(note);
}

function toggleTopReviewMenu(wrap) {
  const pop = wrap.querySelector('.review-top-menu-popover');
  const btn = wrap.querySelector('.review-top-menu-btn');
  const willOpen = pop?.hidden;
  closeTopReviewMenus();
  if (!pop || !willOpen) return;
  pop.hidden = false;
  btn?.setAttribute('aria-expanded', 'true');
}

function closeTopReviewMenus() {
  document.querySelectorAll('.review-top-menu-popover').forEach((pop) => { pop.hidden = true; });
  document.querySelectorAll('.review-top-menu-btn[aria-expanded="true"]').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
}

function attachContextMenu() {
  const target = document.getElementById('viewer') || document.querySelector('#viewer canvas') || document.querySelector('.viewer-shell');
  if (!target || target === attachedContextTarget) return;
  if (attachedContextTarget) attachedContextTarget.removeEventListener('contextmenu', onCanvasContextMenu, true);
  attachedContextTarget = target;
  attachedContextTarget.addEventListener('contextmenu', onCanvasContextMenu, true);
  window.addEventListener('click', closeContextMenu, true);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeContextMenu();
      closeTopReviewMenus();
    }
  }, true);
  window.addEventListener('resize', closeContextMenu);
}

function onCanvasContextMenu(event) {
  if (isEditable(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  showContextMenu(event.clientX, event.clientY);
}

function showContextMenu(x, y) {
  const panel = ensureContextMenu();
  renderContextMenu(panel);
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  const margin = 10;
  panel.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - panel.offsetWidth - margin))}px`;
  panel.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - panel.offsetHeight - margin))}px`;
  dispatchReviewTools('context-open', { x, y, itemCount: tools().length });
}

function closeContextMenu() {
  if (!contextMenu || contextMenu.hidden) return;
  contextMenu.hidden = true;
  contextMenu.setAttribute('aria-hidden', 'true');
  dispatchReviewTools('context-close');
}

function ensureContextMenu() {
  if (contextMenu) return contextMenu;
  contextMenu = document.getElementById(CONTEXT_MENU_ID);
  if (!contextMenu) {
    contextMenu = document.createElement('div');
    contextMenu.id = CONTEXT_MENU_ID;
    contextMenu.className = 'review-context-menu';
    contextMenu.hidden = true;
    contextMenu.setAttribute('role', 'menu');
    contextMenu.setAttribute('aria-label', 'Canvas review tools');
    contextMenu.setAttribute('aria-hidden', 'true');
    document.body.appendChild(contextMenu);
  }
  return contextMenu;
}

function renderContextMenu(panel) {
  panel.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'review-context-menu__header';
  header.textContent = 'Canvas Review Tools';
  panel.appendChild(header);
  REVIEW_TOOL_REGISTRY.forEach((tool) => {
    if (tool.divider) {
      const divider = document.createElement('div');
      divider.className = 'review-context-menu__divider';
      panel.appendChild(divider);
      return;
    }
    panel.appendChild(menuButton(tool, 'review-context-menu__item', () => {
      runTool(tool.key, 'context-menu');
      closeContextMenu();
    }));
  });
}

function menuButton(tool, className, onClick) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = className;
  item.dataset.reviewMenuTool = tool.key;
  item.title = tool.title;
  item.setAttribute('role', 'menuitem');
  item.appendChild(iconNode(tool.icon, `${className}__icon`));
  item.appendChild(textNode('span', tool.menuLabel || tool.label, `${className}__label`));
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return item;
}

function runTool(key, source = 'unknown') {
  const tool = tools().find((item) => item.key === key);
  if (!tool) return false;
  let result = false;
  if (tool.api) result = callApi(tool.api[0], tool.api[1]);
  if (!result) result = clickHiddenViewpadButton(key);
  dispatchReviewTools('run', { key, source, result: Boolean(result) });
  return result;
}

function callApi(apiName, methodName) {
  const api = window[apiName];
  const method = api?.[methodName];
  if (typeof method !== 'function') return false;
  method.call(api);
  return true;
}

function clickHiddenViewpadButton(key) {
  const button = document.querySelector(`.view-pad [data-view="${cssEscape(key)}"]`);
  if (!button) return false;
  button.click();
  return true;
}

function hideShortcutViewpadButtons() {
  HIDDEN_VIEWPAD_KEYS.forEach((key) => {
    document.querySelectorAll(`.view-pad [data-view="${cssEscape(key)}"]`).forEach((button) => {
      button.classList.add('review-shortcut-hidden-hook');
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });
  });
}

function attachRefreshEvents() {
  window.addEventListener('click', (event) => {
    if (!event.target?.closest?.('.review-top-menu-wrap')) closeTopReviewMenus();
  });
  ['markup:app-ready', 'viewer:model-loaded', 'viewer:selection-changed', 'viewer:ui-score-changed', 'viewer:area-select', 'viewer:visibility-tools']
    .forEach((eventName) => window.addEventListener(eventName, refreshIntegration));
}

function retryRefresh() {
  if (refreshIntegration() || retryCount >= MAX_RETRIES) return;
  retryCount += 1;
  window.setTimeout(retryRefresh, RETRY_MS);
}

function installApi() {
  const api = {
    version: VERSION,
    registry: () => tools().map(({ key, label, menuLabel, icon, title, ribbon }) => ({ key, label, menuLabel, icon, title, ribbon })),
    checklist: () => buildChecklist(),
    refresh: refreshIntegration,
    openMenu: (x, y) => showContextMenu(Number(x) || window.innerWidth / 2, Number(y) || window.innerHeight / 2),
    closeMenu: closeContextMenu,
    run: runTool
  };
  window.__3D_MARKUP_REVIEW_RIBBON_INTEGRATION__ = api;
  window.__3D_MARKUP_VIEWPAD_INTEGRATION__ = api;
}

function buildChecklist() {
  return tools().map((tool) => {
    const ribbonButton = document.querySelector(`#${RIBBON_GROUP_ID} [data-review-tool="${cssEscape(tool.key)}"]`);
    const topMenuButton = document.querySelector(`#${TOP_MENU_ID} [data-review-menu-tool="${cssEscape(tool.key)}"]`);
    const contextButton = document.querySelector(`#${CONTEXT_MENU_ID} [data-review-menu-tool="${cssEscape(tool.key)}"]`);
    const shortcutHook = document.querySelector(`.view-pad [data-view="${cssEscape(tool.key)}"]`);
    return {
      key: tool.key,
      feature: tool.menuLabel || tool.label,
      icon: tool.icon,
      hasRibbonButton: Boolean(ribbonButton),
      hasRibbonIcon: Boolean(ribbonButton?.querySelector?.('svg.review-ribbon-tool-icon')),
      hasRibbonTooltip: Boolean(ribbonButton?.title || ribbonButton?.getAttribute?.('aria-label')),
      hasReviewMenu: Boolean(topMenuButton),
      hasReviewMenuIcon: Boolean(topMenuButton?.querySelector?.('svg')),
      hasContextMenu: Boolean(contextButton),
      hasContextMenuIcon: Boolean(contextButton?.querySelector?.('svg')),
      shortcutHidden: !shortcutHook || shortcutHook.classList.contains('review-shortcut-hidden-hook') || getComputedStyle(shortcutHook).display === 'none'
    };
  });
}

function tools() {
  return REVIEW_TOOL_REGISTRY.filter((tool) => !tool.divider);
}

function iconNode(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('review-tool-svg');
  if (className) svg.classList.add(className);
  svg.innerHTML = iconMarkup(name);
  return svg;
}

function iconMarkup(name) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const filled = 'fill="currentColor" stroke="none"';
  const icons = {
    'zoom-box': `<rect x="4" y="4" width="11" height="11" rx="2" ${common}/><path d="M15 15l5 5" ${common}/><path d="M7 8h5M9.5 5.5v5" ${common}/><path d="M4 18h5" ${common} opacity=".55"/>`,
    'area-select': `<rect x="4" y="5" width="16" height="12" rx="2" ${common} stroke-dasharray="3 2"/><path d="M8 20h8" ${common}/><path d="M9 9h6M9 13h4" ${common}/>` ,
    'clear-selection': `<rect x="4" y="5" width="16" height="12" rx="2" ${common} stroke-dasharray="3 2"/><path d="M7 20l10-10M17 20L7 10" ${common}/>` ,
    'export-csv': `<path d="M6 3h8l4 4v14H6z" ${common}/><path d="M14 3v5h5" ${common}/><path d="M8 14h8M8 17h5M10 10l2 2 3-4" ${common}/>` ,
    'search-target': `<circle cx="10" cy="10" r="5" ${common}/><path d="M14 14l5 5" ${common}/><path d="M10 7v6M7 10h6" ${common}/>` ,
    'section-box': `<path d="M5 8l7-4 7 4-7 4-7-4z" ${common}/><path d="M5 8v8l7 4 7-4V8" ${common}/><path d="M12 12v8M8 10l8 5" ${common} opacity=".55"/>`,
    isolate: `<path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6z" ${common}/><circle cx="12" cy="12" r="3" ${common}/><path d="M12 4v2M12 18v2M4 12h2M18 12h2" ${common} opacity=".65"/>`,
    hide: `<path d="M3 3l18 18" ${common}/><path d="M9.5 5.5A9.6 9.6 0 0 1 12 5c5.8 0 9 7 9 7a17 17 0 0 1-2.1 3.1" ${common}/><path d="M6.7 6.8C4.3 8.4 3 12 3 12s3.2 7 9 7c1.7 0 3.2-.5 4.4-1.2" ${common}/>` ,
    'show-all': `<path d="M4 8l8-4 8 4-8 4-8-4z" ${common}/><path d="M4 12l8 4 8-4" ${common}/><path d="M4 16l8 4 8-4" ${common}/>` ,
    'bookmark-view': `<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1z" ${common}/><path d="M9 8h6M9 11h4" ${common}/>` ,
    'undo-view': `<path d="M9 7l-5 5 5 5" ${common}/><path d="M4 12h10a6 6 0 0 1 6 6" ${common}/>` ,
    'redo-view': `<path d="M15 7l5 5-5 5" ${common}/><path d="M20 12H10a6 6 0 0 0-6 6" ${common}/>` ,
    'polyline-measure': `<path d="M4 17l5-8 5 5 6-9" ${common}/><circle cx="4" cy="17" r="1.8" ${filled}/><circle cx="9" cy="9" r="1.8" ${filled}/><circle cx="14" cy="14" r="1.8" ${filled}/><circle cx="20" cy="5" r="1.8" ${filled}/>` ,
    explode: `<path d="M12 12L5 5M12 12l7-7M12 12l7 7M12 12l-7 7" ${common}/><path d="M5 5h5M5 5v5M19 5h-5M19 5v5M19 19h-5M19 19v-5M5 19h5M5 19v-5" ${common}/>` ,
    'review-menu': `<path d="M5 5h14v14H5z" ${common}/><path d="M8 9h8M8 13h5" ${common}/><path d="M16 16l3 3" ${common}/>`
  };
  return icons[name] || icons['review-menu'];
}

function textNode(tagName, text, className = '') {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function isEditable(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

function dispatchReviewTools(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:review-ribbon-tools', { detail: { action, version: VERSION, ...detail } }));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${RIBBON_GROUP_ID}.review-ribbon-group { max-width: 520px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; scroll-snap-type: x proximity; padding-right: 6px; }
    #${RIBBON_GROUP_ID}.review-ribbon-group::-webkit-scrollbar { display: none; }
    #${RIBBON_GROUP_ID} .review-ribbon-tool-btn { min-width: 56px; width: 56px; max-width: 56px; scroll-snap-align: start; }
    #${RIBBON_GROUP_ID} .review-ribbon-tool-btn span { max-width: 48px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .review-tool-svg { width: 17px; height: 17px; display: block; color: currentColor; }
    .review-ribbon-tool-icon { margin-bottom: 2px; color: #d9ecff; }
    .review-top-menu-btn .review-menu-button-icon { width: 16px; height: 16px; }
    .review-menu-divider { height: 1px; margin: 4px 2px; background: rgba(148, 163, 184, .22); }
    .top-menu-review-item svg { width: 15px; height: 15px; color: #bfdbfe; }
    .review-shortcut-hidden-hook,
    .view-pad ${HIDDEN_VIEWPAD_KEYS.map((key) => `[data-view="${key}"]`).join(', .view-pad ')} { display: none !important; }
    .review-context-menu { position: fixed; z-index: 1200; min-width: 246px; max-width: 300px; padding: 7px; border: 1px solid rgba(125, 168, 224, .45); border-radius: 12px; background: rgba(8, 14, 27, .97); color: #eaf4ff; box-shadow: 0 22px 54px rgba(0,0,0,.45); backdrop-filter: blur(12px); font: 12px/1.3 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .review-context-menu[hidden] { display: none !important; }
    .review-context-menu__header { padding: 6px 8px 7px; color: #93c5fd; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; font-size: 10px; }
    .review-context-menu__divider { height: 1px; margin: 5px 4px; background: rgba(148, 163, 184, .22); }
    .review-context-menu__item { width: 100%; min-height: 34px; display: grid; grid-template-columns: 28px 1fr; align-items: center; gap: 8px; border: 0; border-radius: 9px; background: transparent; color: inherit; padding: 7px 8px; text-align: left; cursor: pointer; }
    .review-context-menu__item:hover, .review-context-menu__item:focus-visible { background: rgba(37, 99, 169, .42); outline: none; }
    .review-context-menu__item__icon { width: 22px; height: 22px; padding: 3px; display: inline-flex; align-items: center; justify-content: center; border-radius: 7px; background: rgba(30, 64, 120, .62); color: #bfdbfe; }
    .review-context-menu__item__label { font-weight: 750; }
    @media (max-width: 1500px) {
      #${RIBBON_GROUP_ID}.review-ribbon-group { max-width: 390px; }
      #${RIBBON_GROUP_ID} .review-ribbon-tool-btn { min-width: 52px; width: 52px; max-width: 52px; }
    }
  `;
  document.head.appendChild(style);
}

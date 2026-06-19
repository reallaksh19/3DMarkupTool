// Integrates standalone viewpad tools with compact icons and a canvas menu.

const VERSION = 'viewpad-icons-context-saved-state-20260619';
const STYLE_ID = 'static-viewpad-tool-icons-context-style';
const MENU_ID = 'staticViewpadContextMenu';
const RETRY_MS = 180;
const MAX_RETRIES = 30;

const VIEWPAD_TOOL_REGISTRY = [
  { key: 'marqueeZoom', short: 'MZ', icon: '▣', label: 'Marquee Zoom', title: 'Drag a zoom window on the canvas', api: ['__3D_MARKUP_MARQUEE_ZOOM__', 'activate'] },
  { key: 'areaSelect', short: 'AS', icon: '☷', label: 'Area Select', title: 'Drag a window to select visible components', api: ['__3D_MARKUP_AREA_SELECT__', 'activate'] },
  { key: 'componentSearch', short: 'SR', icon: '⌕', label: 'Search / Jump', title: 'Search by ID, node, line, support, tag, or type', api: ['__3D_MARKUP_COMPONENT_SEARCH__', 'open'] },
  { key: 'savedViews', short: 'SV', icon: '★', label: 'Saved Views', title: 'Open saved view panel', api: ['__3D_MARKUP_SAVED_VIEWS__', 'open'] },
  { key: 'measurePolyline', short: 'ME', icon: '⌁', label: 'Measure Polyline', title: 'Click points to measure cumulative length', api: ['__3D_MARKUP_MEASURE_POLYLINE__', 'activate'] },
  { key: 'explodeReview', short: 'XP', icon: '⇔', label: 'Explode Review', title: 'Separate components by type or line' },
  { divider: true },
  { key: 'viewPrevious', short: 'PV', icon: '↶', label: 'Previous View', title: 'Go to previous camera view', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'previousView'] },
  { key: 'viewNext', short: 'NX', icon: '↷', label: 'Next View', title: 'Go to next camera view', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'nextView'] },
  { key: 'sectionBoxSelected', short: 'SB', icon: '◫', label: 'Section Box', title: 'Create section box from selected component', api: ['__3D_MARKUP_SECTION_BOX__', 'apply'] },
  { key: 'isolateSelected', short: 'ISO', icon: '◉', label: 'Isolate Selected', title: 'Show only selected component', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'isolateSelected'] },
  { key: 'hideSelected', short: 'HID', icon: '◌', label: 'Hide Selected', title: 'Hide selected component', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'hideSelected'] },
  { key: 'showAll', short: 'ALL', icon: '◎', label: 'Show All', title: 'Show all hidden components', api: ['__3D_MARKUP_VIEWPAD_TOOLS__', 'showAll'] }
];

let menu;
let retryCount = 0;
let attachedTarget;
let observer;

installViewpadIntegration();

function installViewpadIntegration() {
  const start = () => {
    injectStyles();
    ensureMenu();
    refreshIcons();
    attachCanvasMenu();
    attachObserver();
    installApi();
    retryRefresh();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function installApi() {
  window.__3D_MARKUP_VIEWPAD_INTEGRATION__ = {
    version: VERSION,
    registry: () => tools().map(({ key, short, icon, label, title }) => ({ key, short, icon, label, title })),
    checklist: () => buildChecklist(),
    refreshIcons,
    openMenu: (x, y) => showMenu(Number(x) || window.innerWidth / 2, Number(y) || window.innerHeight / 2),
    closeMenu,
    run: runTool
  };
}

function refreshIcons() {
  const pad = document.querySelector('.view-pad');
  if (!pad) return false;
  pad.classList.add('viewpad-integrated-icons');
  tools().forEach((descriptor) => {
    const button = buttonFor(descriptor.key);
    if (button) decorateButton(button, descriptor);
  });
  return true;
}

function decorateButton(button, descriptor) {
  button.classList.add('viewpad-integrated-tool-btn');
  button.dataset.viewpadToolIntegrated = 'true';
  button.dataset.viewpadToolShort = descriptor.short;
  if (!button.title) button.title = descriptor.title;
  if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', descriptor.title);

  const icon = document.createElement('span');
  icon.className = 'viewpad-tool-icon';
  icon.dataset.iconFor = descriptor.key;
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = descriptor.icon;

  const label = document.createElement('span');
  label.className = 'viewpad-tool-short';
  label.textContent = descriptor.short;
  button.replaceChildren(icon, label);
}

function attachObserver() {
  const pad = document.querySelector('.view-pad');
  if (!pad || observer) return;
  observer = new MutationObserver(() => refreshIcons());
  observer.observe(pad, { childList: true, subtree: true });
}

function retryRefresh() {
  if (refreshIcons() || retryCount >= MAX_RETRIES) return;
  retryCount += 1;
  window.setTimeout(retryRefresh, RETRY_MS);
}

function attachCanvasMenu() {
  const target = document.getElementById('viewer') || document.querySelector('#viewer canvas') || document.querySelector('.viewer-shell');
  if (!target || target === attachedTarget) return;
  if (attachedTarget) attachedTarget.removeEventListener('contextmenu', onCanvasMenu, true);
  attachedTarget = target;
  attachedTarget.addEventListener('contextmenu', onCanvasMenu, true);
  window.addEventListener('click', closeMenu, true);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); }, true);
  window.addEventListener('resize', closeMenu);
}

function onCanvasMenu(event) {
  if (isEditable(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  showMenu(event.clientX, event.clientY);
}

function showMenu(x, y) {
  const panel = ensureMenu();
  renderMenu(panel);
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  const margin = 10;
  panel.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - panel.offsetWidth - margin))}px`;
  panel.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - panel.offsetHeight - margin))}px`;
  dispatchMenu('open', { x, y, itemCount: tools().length });
}

function closeMenu() {
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  menu.setAttribute('aria-hidden', 'true');
  dispatchMenu('close');
}

function ensureMenu() {
  if (menu) return menu;
  menu = document.getElementById(MENU_ID);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'viewpad-context-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Canvas context tools');
    menu.setAttribute('aria-hidden', 'true');
    document.body.appendChild(menu);
  }
  return menu;
}

function renderMenu(panel) {
  panel.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'viewpad-context-menu__header';
  header.textContent = 'Canvas Tools';
  panel.appendChild(header);
  VIEWPAD_TOOL_REGISTRY.forEach((descriptor) => {
    if (descriptor.divider) {
      const divider = document.createElement('div');
      divider.className = 'viewpad-context-menu__divider';
      panel.appendChild(divider);
      return;
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'viewpad-context-menu__item';
    item.dataset.contextTool = descriptor.key;
    item.title = descriptor.title;
    item.appendChild(span('viewpad-context-menu__icon', descriptor.icon));
    item.appendChild(span('viewpad-context-menu__label', descriptor.label));
    item.appendChild(kbd(descriptor.short));
    item.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      runTool(descriptor.key);
      closeMenu();
    });
    panel.appendChild(item);
  });
}

function runTool(key) {
  const descriptor = tools().find((item) => item.key === key);
  if (!descriptor) return false;
  let result = false;
  if (descriptor.api) result = callApi(descriptor.api[0], descriptor.api[1]);
  if (!result) result = clickViewpadButton(key);
  dispatchMenu('run', { key, result: Boolean(result) });
  return result;
}

function callApi(apiName, methodName) {
  const method = window[apiName]?.[methodName];
  if (typeof method !== 'function') return false;
  method();
  return true;
}

function clickViewpadButton(key) {
  const button = buttonFor(key);
  if (!button) return false;
  button.click();
  return true;
}

function buildChecklist() {
  return tools().map((descriptor) => {
    const button = buttonFor(descriptor.key);
    return {
      key: descriptor.key,
      feature: descriptor.label,
      icon: descriptor.icon,
      hasButton: Boolean(button),
      hasIcon: Boolean(button?.querySelector?.('.viewpad-tool-icon')),
      hasTooltip: Boolean(button?.title || button?.getAttribute?.('aria-label')),
      hasContextMenu: true
    };
  });
}

function tools() {
  return VIEWPAD_TOOL_REGISTRY.filter((item) => !item.divider);
}

function buttonFor(key) {
  return document.querySelector(`.view-pad [data-view="${cssEscape(key)}"]`);
}

function span(className, text) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

function kbd(text) {
  const node = document.createElement('kbd');
  node.textContent = text;
  return node;
}

function isEditable(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function dispatchMenu(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:viewpad-context-menu', { detail: { action, version: VERSION, ...detail } }));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .viewpad-integrated-icons .viewpad-integrated-tool-btn { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-width: 44px; min-height: 36px; line-height: 1; }
    .viewpad-tool-icon { display: block; font-size: 15px; line-height: 1; color: currentColor; opacity: 0.95; }
    .viewpad-tool-short { display: block; font-size: 9px; font-weight: 900; letter-spacing: 0.04em; line-height: 1; }
    .viewpad-context-menu { position: fixed; z-index: 1200; min-width: 230px; max-width: 280px; padding: 7px; border: 1px solid rgba(125, 168, 224, 0.45); border-radius: 12px; background: rgba(8, 14, 27, 0.97); color: #eaf4ff; box-shadow: 0 22px 54px rgba(0, 0, 0, 0.45); backdrop-filter: blur(12px); font: 12px/1.3 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .viewpad-context-menu[hidden] { display: none !important; }
    .viewpad-context-menu__header { padding: 6px 8px 7px; color: #93c5fd; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
    .viewpad-context-menu__divider { height: 1px; margin: 5px 4px; background: rgba(148, 163, 184, 0.22); }
    .viewpad-context-menu__item { width: 100%; display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 8px; border: 0; border-radius: 9px; background: transparent; color: inherit; padding: 7px 8px; text-align: left; cursor: pointer; }
    .viewpad-context-menu__item:hover, .viewpad-context-menu__item:focus-visible { background: rgba(37, 99, 169, 0.42); outline: none; }
    .viewpad-context-menu__icon { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 7px; background: rgba(30, 64, 120, 0.62); color: #bfdbfe; font-weight: 900; }
    .viewpad-context-menu__label { font-weight: 750; }
    .viewpad-context-menu kbd { border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 6px; padding: 2px 5px; color: #cbd5e1; background: rgba(15, 23, 42, 0.74); font-size: 10px; font-family: inherit; }
  `;
  document.head.appendChild(style);
}

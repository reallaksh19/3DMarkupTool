const STYLE_ID = 'twoRowIconRibbonStyles';
const RETRIES = 24;

const TOP_ACTIONS = [
  { id: 'toggleInputBtn', label: 'Input', icon: 'panel-left' },
  { id: 'togglePropsBtn', label: 'Props', icon: 'panel-right' },
  { id: 'runtimeStatus', label: 'Core', kind: 'status' },
  { id: 'safeUiStatus', label: 'UI', kind: 'status' },
  { id: 'uiDiagnosticsBtn', label: 'Tools', icon: 'settings' }
];

const COMMAND_GROUPS = [
  {
    key: 'nav',
    label: 'NAV',
    items: [
      { id: 'selectToolBtn', label: 'Select', icon: 'pointer' },
      { id: 'orbitToolBtn', label: 'Orbit', icon: 'orbit' },
      { id: 'panToolBtn', label: 'Pan', icon: 'hand' },
      { id: 'measureBtn', label: 'Measure', icon: 'ruler' }
    ]
  },
  {
    key: 'view',
    label: 'VIEW',
    items: [
      { id: 'viewIsoBtn', label: 'Isometric', icon: 'cube' },
      { id: 'viewTopBtn', label: 'Top', icon: 'top' },
      { id: 'viewFrontBtn', label: 'Front', icon: 'front' },
      { id: 'viewSideBtn', label: 'Side', icon: 'side' }
    ]
  },
  {
    key: 'fit',
    label: 'FIT',
    items: [
      { id: 'resetCameraBtn', label: 'Fit All', icon: 'fit' },
      { id: 'fitSelectionBtn', label: 'Fit Selection', icon: 'fit-select' },
      { id: 'marqueeZoomBtn', label: 'Marquee Zoom', icon: 'marquee' }
    ]
  },
  {
    key: 'display',
    label: 'DISPLAY',
    color: true,
    items: [
      { id: 'gridToggleBtn', label: 'Grid', icon: 'grid' },
      { id: 'clipBtn', label: 'Clip', icon: 'clip' },
      { id: 'clearSelectionBtn', label: 'Clear', icon: 'eraser' }
    ]
  }
];

const MENU_GROUPS = [
  {
    key: 'export',
    label: 'Export',
    icon: 'export',
    items: [
      { id: 'previewGlbBtn', label: 'GLB', icon: 'box' },
      { id: 'previewRvmBtn', label: 'RVM', icon: 'file' },
      { id: 'rvmCompatBtn', label: 'RVM QA', icon: 'qa' }
    ]
  },
  {
    key: 'tags',
    label: 'Tags',
    icon: 'tag',
    items: [
      { id: 'navisTagBtn', label: 'Tag', icon: 'tag' },
      { id: 'navisIsonoteBtn', label: 'ISONOTE', icon: 'note' },
      { id: 'navisImportTagsBtn', label: 'Import', icon: 'import' },
      { id: 'navisTagViewsBtn', label: 'Views', icon: 'list' }
    ]
  },
  {
    key: 'session',
    label: 'Session',
    icon: 'save',
    items: [
      { id: 'navisSessionSaveBtn', label: 'Save', icon: 'save' },
      { id: 'navisSessionRestoreBtn', label: 'Restore', icon: 'restore' },
      { id: 'navisSessionClearBtn', label: 'Clear', icon: 'trash' }
    ]
  },
  {
    key: 'xml',
    label: 'XML',
    icon: 'xml',
    items: [
      { id: 'navisXmlQaBtn', label: 'QA', icon: 'check' },
      { id: 'navisExportTagsBtn', label: 'Export XML', icon: 'export' }
    ]
  }
];

const ICONS = {
  pointer: '<path d="M5 3l10 8-5 1 3 6-2 1-3-6-3 4z"/>',
  orbit: '<circle cx="12" cy="12" r="4"/><path d="M3 12c2-5 7-8 13-7M21 12c-2 5-7 8-13 7"/><path d="M15 3l2 2-3 1M9 21l-2-2 3-1"/>',
  hand: '<path d="M7 12V6a1.5 1.5 0 013 0v5M10 11V5a1.5 1.5 0 013 0v7M13 12V7a1.5 1.5 0 013 0v6M16 13v-2a1.5 1.5 0 013 0v3c0 5-3 7-7 7h-1c-3 0-5-2-6-5l-1-4a1.6 1.6 0 013-1l1 2"/>',
  ruler: '<path d="M4 15l11-11 5 5L9 20z"/><path d="M8 15l2 2M11 12l2 2M14 9l2 2"/>',
  cube: '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  top: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M8 8h8v8H8z"/>',
  front: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h8"/>',
  side: '<path d="M7 5h10l3 4v10H7z"/><path d="M17 5v4h3"/>',
  fit: '<path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/><path d="M9 9h6v6H9z"/>',
  'fit-select': '<path d="M5 5h5M5 5v5M19 5h-5M19 5v5M5 19h5M5 19v-5M19 19h-5M19 19v-5"/><path d="M9 9h6v6H9z"/>',
  marquee: '<rect x="5" y="5" width="14" height="14" rx="1" stroke-dasharray="3 2"/>',
  grid: '<path d="M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16"/>',
  clip: '<path d="M5 5l14 14M8 18l10-10"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
  eraser: '<path d="M4 16l8-8 6 6-6 6H7z"/><path d="M12 20h8"/>',
  box: '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M12 3v8M20 7l-8 4-8-4"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h4"/>',
  qa: '<path d="M5 12l4 4L19 6"/><path d="M4 20h16"/>',
  tag: '<path d="M4 5v6l8 8 7-7-8-7z"/><circle cx="8" cy="8" r="1.4"/>',
  note: '<path d="M7 3h10v18H7z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  import: '<path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 20h14"/>',
  export: '<path d="M12 20V10"/><path d="M8 14l4-4 4 4"/><path d="M5 4h14"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  save: '<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
  restore: '<path d="M5 12a7 7 0 117 7"/><path d="M5 12H2l3-3 3 3z"/>',
  trash: '<path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13"/>',
  check: '<path d="M5 12l4 4L19 6"/><rect x="4" y="4" width="16" height="16" rx="2"/>',
  xml: '<path d="M6 8l-3 4 3 4M18 8l3 4-3 4"/><path d="M14 5l-4 14"/>',
  'panel-left': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9 5v14"/>',
  'panel-right': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M15 5v14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTwoRowIconRibbon, { once: true });
} else {
  initTwoRowIconRibbon();
}

window.addEventListener('markup:safe-ui-status', () => scheduleApply(8));
window.addEventListener('markup:app-ready', () => scheduleApply(10));
window.addEventListener('markup:tag-views-ready', () => scheduleApply(6));

document.addEventListener('click', (event) => {
  const trigger = event.target?.closest?.('.two-row-menu-trigger');
  if (trigger) {
    event.preventDefault();
    toggleMenu(trigger.dataset.menuKey);
    return;
  }

  if (!event.target?.closest?.('.two-row-menu')) closeMenus();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenus();
});

function initTwoRowIconRibbon() {
  injectStyles();
  scheduleApply(RETRIES);
}

function scheduleApply(remaining = 8) {
  window.requestAnimationFrame(() => {
    applyTwoRowRibbon();
    if (remaining > 0) window.setTimeout(() => scheduleApply(remaining - 1), 160);
  });
}

function applyTwoRowRibbon() {
  const shell = document.querySelector('.app-shell');
  const brand = document.querySelector('.brand-block');
  const toolbar = document.querySelector('.toolbar');
  if (!shell || !brand || !toolbar) return;

  shell.classList.add('two-row-icon-shell');
  toolbar.classList.add('two-row-command-bar');

  setBrandCopy(brand);
  const topActions = ensureTopActions(brand);
  moveTopActions(topActions);

  const ribbon = ensureElement(toolbar, 'twoRowCommandRibbon', 'div', 'two-row-command-ribbon');
  COMMAND_GROUPS.forEach((group) => buildCommandGroup(ribbon, group));
  MENU_GROUPS.forEach((menu) => buildMenuGroup(ribbon, menu));

  hideEmptyLegacyContainers();
  window.dispatchEvent(new CustomEvent('markup:two-row-icon-ribbon-ready'));
}

function setBrandCopy(brand) {
  const eyebrow = brand.querySelector('.eyebrow');
  const h1 = brand.querySelector('h1');
  const p = brand.querySelector('p');
  if (eyebrow) eyebrow.textContent = '3D Markup Tool';
  if (h1) h1.textContent = 'GLB/RVM Review';
  if (p) p.textContent = 'View/Markup/Export';
  document.title = 'GLB/RVM Review';
}

function ensureTopActions(brand) {
  let actions = document.getElementById('twoRowTopActions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'twoRowTopActions';
    actions.className = 'two-row-top-actions';
    brand.appendChild(actions);
  }
  return actions;
}

function moveTopActions(actions) {
  TOP_ACTIONS.forEach((item) => {
    const element = document.getElementById(item.id);
    if (!element) return;
    if (element.parentElement !== actions) actions.appendChild(element);

    if (item.kind === 'status') {
      element.classList.add('two-row-status-chip');
      normalizeStatus(element, item.label);
    } else {
      decorateButton(element, item.label, item.icon, 'top');
    }
  });

  const emptyPanelGroup = document.querySelector('.panel-toggles');
  if (emptyPanelGroup && !emptyPanelGroup.children.length) emptyPanelGroup.remove();
}

function normalizeStatus(element, label) {
  if (!element.dataset.twoRowOriginalTitle) element.dataset.twoRowOriginalTitle = element.title || '';
  element.dataset.twoRowStatus = label;
  if (label === 'Core' && /^ready$/i.test((element.textContent || '').trim())) element.textContent = 'Core Ready';
}

function buildCommandGroup(ribbon, group) {
  const wrapper = ensureElement(ribbon, `twoRowGroup_${group.key}`, 'div', 'two-row-command-group');
  wrapper.dataset.group = group.key;
  wrapper.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'two-row-group-label';
  label.textContent = group.label;
  wrapper.appendChild(label);

  if (group.color) {
    const color = document.querySelector('.color-control');
    if (color) {
      color.classList.add('two-row-color-control');
      compactColorControl(color);
      wrapper.appendChild(color);
    }
  }

  group.items.forEach((item) => {
    const button = document.getElementById(item.id);
    if (!button) return;
    decorateButton(button, item.label, item.icon, 'command');
    wrapper.appendChild(button);
  });
}

function buildMenuGroup(ribbon, menu) {
  const wrapper = ensureElement(ribbon, `twoRowMenu_${menu.key}`, 'div', 'two-row-menu');
  wrapper.dataset.menu = menu.key;

  let trigger = wrapper.querySelector('.two-row-menu-trigger');
  if (!trigger) {
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'two-row-menu-trigger';
    trigger.dataset.menuKey = menu.key;
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    wrapper.appendChild(trigger);
  }
  trigger.innerHTML = `${icon(menu.icon)}<span>${escapeHtml(menu.label)}</span><b aria-hidden="true">›</b>`;
  trigger.title = `${menu.label} menu`;

  let popover = wrapper.querySelector('.two-row-menu-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.className = 'two-row-menu-popover';
    popover.setAttribute('role', 'menu');
    wrapper.appendChild(popover);
  }

  menu.items.forEach((item) => {
    const button = document.getElementById(item.id);
    if (!button) return;
    decorateMenuItem(button, item.label, item.icon);
    if (button.parentElement !== popover) popover.appendChild(button);
  });
}

function compactColorControl(color) {
  let label = color.querySelector('span');
  if (!label) {
    label = document.createElement('span');
    color.prepend(label);
  }
  label.innerHTML = `${icon('settings')}<span>Color</span>`;
  color.title = 'Color By';
}

function decorateButton(button, label, iconName, zone) {
  const key = `${zone}:${label}:${iconName}`;
  if (button.dataset.twoRowButtonKey === key) return;
  button.dataset.twoRowButtonKey = key;
  button.classList.add('two-row-icon-button', `two-row-${zone}-button`);
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `${icon(iconName)}<span class="two-row-vis-label">${escapeHtml(label)}</span>`;
}

function decorateMenuItem(button, label, iconName) {
  const key = `menu:${label}:${iconName}`;
  if (button.dataset.twoRowButtonKey === key) return;
  button.dataset.twoRowButtonKey = key;
  button.classList.add('two-row-menu-item');
  button.setAttribute('role', 'menuitem');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `${icon(iconName)}<span>${escapeHtml(label)}</span>`;
}

function toggleMenu(key) {
  document.querySelectorAll('.two-row-menu').forEach((menu) => {
    const open = menu.dataset.menu === key && !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    menu.querySelector('.two-row-menu-trigger')?.setAttribute('aria-expanded', String(open));
  });
}

function closeMenus() {
  document.querySelectorAll('.two-row-menu.open').forEach((menu) => {
    menu.classList.remove('open');
    menu.querySelector('.two-row-menu-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function hideEmptyLegacyContainers() {
  document.querySelectorAll('.toolbar > .tool-group, .toolbar > .toolbar-group, .toolbar-primary-row, .toolbar-secondary-row, .navis-tag-tools, .panel-toggles').forEach((node) => {
    if (node.id === 'twoRowCommandRibbon') return;
    if (!node.children.length) node.classList.add('two-row-legacy-empty');
  });
}

function ensureElement(parent, id, tagName, className) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement(tagName);
    element.id = id;
    element.className = className;
    parent.appendChild(element);
  }
  return element;
}

function icon(name) {
  const path = ICONS[name] || ICONS.cube;
  return `<span class="two-row-svg" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .app-shell.two-row-icon-shell {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      grid-template-rows: auto auto !important;
      align-items: stretch !important;
      gap: 8px !important;
      padding: 10px 14px !important;
      min-height: 0 !important;
    }

    .app-shell.two-row-icon-shell .brand-block {
      display: grid !important;
      grid-template-columns: auto minmax(0, 1fr) auto !important;
      grid-template-areas: 'eyebrow title actions' 'eyebrow subtitle actions' !important;
      align-items: center !important;
      gap: 2px 12px !important;
      min-width: 0 !important;
      width: 100% !important;
    }

    .app-shell.two-row-icon-shell .brand-block .eyebrow {
      grid-area: eyebrow !important;
      margin: 0 !important;
      white-space: nowrap !important;
      font-size: 10px !important;
      opacity: .78 !important;
    }

    .app-shell.two-row-icon-shell .brand-block h1 {
      grid-area: title !important;
      margin: 0 !important;
      font-size: 20px !important;
      line-height: 1.05 !important;
      white-space: nowrap !important;
    }

    .app-shell.two-row-icon-shell .brand-block p {
      grid-area: subtitle !important;
      margin: 0 !important;
      font-size: 11px !important;
      line-height: 1.15 !important;
      opacity: .72 !important;
      white-space: nowrap !important;
    }

    .two-row-top-actions {
      grid-area: actions !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 6px !important;
      min-width: 0 !important;
    }

    .two-row-top-actions .tool-btn,
    .two-row-top-actions #uiDiagnosticsBtn {
      height: 30px !important;
      min-height: 30px !important;
      padding: 5px 9px !important;
      border-radius: 9px !important;
      font-size: 11px !important;
      gap: 5px !important;
    }

    .two-row-top-actions .two-row-svg {
      width: 15px !important;
      height: 15px !important;
    }

    .two-row-status-chip {
      height: 30px !important;
      min-height: 30px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 10px !important;
      border-radius: 999px !important;
      font-size: 10.5px !important;
      font-weight: 850 !important;
      white-space: nowrap !important;
      border: 1px solid rgba(125,172,222,.25) !important;
      background: rgba(12, 30, 50, .82) !important;
    }

    .toolbar.two-row-command-bar {
      display: block !important;
      width: 100% !important;
      min-width: 0 !important;
      overflow: visible !important;
    }

    .two-row-command-ribbon {
      display: flex !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: 7px !important;
      width: 100% !important;
      min-width: 0 !important;
      overflow: visible !important;
      padding: 6px 8px !important;
      border-radius: 14px !important;
      border: 1px solid rgba(125,172,222,.18) !important;
      background: linear-gradient(180deg, rgba(18, 39, 63, .72), rgba(8, 18, 31, .76)) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04) !important;
    }

    .two-row-command-group,
    .two-row-menu {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      flex: 0 0 auto !important;
      min-width: 0 !important;
      padding: 3px 5px !important;
      border-radius: 11px !important;
      border: 1px solid rgba(125,172,222,.13) !important;
      background: rgba(7, 18, 30, .36) !important;
    }

    .two-row-group-label {
      display: inline-flex !important;
      align-items: center !important;
      height: 26px !important;
      padding: 0 4px !important;
      color: #86a5c1 !important;
      font-size: 9px !important;
      font-weight: 900 !important;
      letter-spacing: .08em !important;
      white-space: nowrap !important;
    }

    .two-row-icon-button.two-row-command-button {
      width: 30px !important;
      height: 30px !important;
      min-width: 30px !important;
      min-height: 30px !important;
      padding: 0 !important;
      border-radius: 9px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0 !important;
    }

    .two-row-icon-button.two-row-command-button .two-row-vis-label {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
      clip: rect(0 0 0 0) !important;
      white-space: nowrap !important;
    }

    .two-row-svg {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 18px !important;
      height: 18px !important;
      color: #dfeeff !important;
      flex: 0 0 auto !important;
    }

    .two-row-svg svg {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)) !important;
    }

    .two-row-color-control {
      height: 30px !important;
      min-width: 174px !important;
      max-width: 190px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      padding: 3px 6px !important;
      border-radius: 9px !important;
      white-space: nowrap !important;
    }

    .two-row-color-control span {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      font-size: 10px !important;
      font-weight: 850 !important;
    }

    .two-row-color-control .two-row-svg {
      width: 14px !important;
      height: 14px !important;
    }

    .two-row-color-control select {
      height: 24px !important;
      min-width: 92px !important;
      max-width: 108px !important;
      padding: 1px 6px !important;
      font-size: 10.5px !important;
      border-radius: 7px !important;
    }

    .two-row-menu-trigger {
      height: 30px !important;
      min-height: 30px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      padding: 0 8px !important;
      border-radius: 9px !important;
      border: 1px solid rgba(125,172,222,.20) !important;
      background: rgba(25, 57, 88, .74) !important;
      color: #e8f4ff !important;
      font-size: 10.5px !important;
      font-weight: 900 !important;
      cursor: pointer !important;
      white-space: nowrap !important;
    }

    .two-row-menu-trigger:hover,
    .two-row-menu.open .two-row-menu-trigger {
      background: rgba(38, 86, 129, .88) !important;
      border-color: rgba(130, 190, 255, .42) !important;
    }

    .two-row-menu-trigger .two-row-svg {
      width: 15px !important;
      height: 15px !important;
    }

    .two-row-menu-trigger b {
      font-size: 15px !important;
      line-height: 1 !important;
      opacity: .9 !important;
    }

    .two-row-menu-popover {
      position: absolute !important;
      top: calc(100% + 7px) !important;
      right: 0 !important;
      z-index: 80 !important;
      min-width: 150px !important;
      display: none !important;
      flex-direction: column !important;
      gap: 4px !important;
      padding: 7px !important;
      border-radius: 12px !important;
      border: 1px solid rgba(125,172,222,.24) !important;
      background: rgba(7, 17, 29, .98) !important;
      box-shadow: 0 18px 45px rgba(0,0,0,.48) !important;
    }

    .two-row-menu.open .two-row-menu-popover {
      display: flex !important;
    }

    .two-row-menu-item {
      width: 100% !important;
      height: 30px !important;
      min-height: 30px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: 8px !important;
      padding: 0 9px !important;
      border-radius: 8px !important;
      text-align: left !important;
      font-size: 11px !important;
      font-weight: 850 !important;
      white-space: nowrap !important;
    }

    .two-row-menu-item .two-row-svg {
      width: 15px !important;
      height: 15px !important;
    }

    .two-row-menu-item:disabled {
      opacity: .48 !important;
      cursor: not-allowed !important;
    }

    .two-row-legacy-empty,
    .toolbar-primary-row:empty,
    .toolbar-secondary-row:empty,
    .navis-tag-tools:empty,
    .panel-toggles:empty {
      display: none !important;
    }

    @media (max-width: 1360px) {
      .two-row-command-ribbon { gap: 5px !important; padding-inline: 6px !important; }
      .two-row-command-group, .two-row-menu { gap: 3px !important; padding-inline: 4px !important; }
      .two-row-group-label { font-size: 8px !important; padding-inline: 2px !important; }
      .two-row-icon-button.two-row-command-button { width: 28px !important; min-width: 28px !important; }
      .two-row-color-control { min-width: 158px !important; max-width: 166px !important; }
      .two-row-menu-trigger { padding-inline: 6px !important; }
    }
  `;
  document.head.appendChild(style);
}

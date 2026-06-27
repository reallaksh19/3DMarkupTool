const PANEL_ID = 'modelTreePanel';
const FLOATING_TOGGLE_ID = 'modelTreeToggle';
const RIBBON_TREE_ID = 'modelTreeRibbonBtn';
const STYLE_ID = 'treePanelBridgeStyles';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTreePanelBridge, { once: true });
} else {
  initTreePanelBridge();
}

window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleSync(8));
window.addEventListener('viewer:runtime-context', () => scheduleSync(2));
window.addEventListener('markup:render-context', () => scheduleSync(2));

function initTreePanelBridge() {
  injectStyles();
  exposeApi();
  scheduleSync(16);
}

function scheduleSync(remaining = 6) {
  window.requestAnimationFrame(() => {
    syncTreePanelHost();
    ensureRibbonTreeButton();
    exposeApi();
    if (remaining > 0) window.setTimeout(() => scheduleSync(remaining - 1), 140);
  });
}

function syncTreePanelHost() {
  const viewer = document.getElementById('viewer');
  const panel = document.getElementById(PANEL_ID);
  const toggle = document.getElementById(FLOATING_TOGGLE_ID);
  if (!viewer) return;

  if (getComputedStyle(viewer).position === 'static') viewer.style.position = 'relative';
  if (panel && panel.parentElement !== viewer) viewer.appendChild(panel);
  if (toggle && toggle.parentElement !== viewer) viewer.appendChild(toggle);

  panel?.classList.add('model-tree-panel-bridged');
  toggle?.classList.add('model-tree-floating-toggle-bridged');
}

function ensureRibbonTreeButton() {
  const ribbon = document.getElementById('twoRowCommandRibbon');
  const displayGroup = document.querySelector('[data-group="display"]') || ribbon;
  if (!displayGroup) return;

  let button = document.getElementById(RIBBON_TREE_ID);
  if (!button) {
    button = document.createElement('button');
    button.id = RIBBON_TREE_ID;
    button.type = 'button';
    button.className = 'two-row-command-btn tree-ribbon-command';
    button.title = 'Model Tree';
    button.setAttribute('aria-label', 'Toggle model tree');
    button.innerHTML = `${treeIconSvg()}<span>Tree</span>`;
    button.addEventListener('click', () => window.__3D_MARKUP_TREE__?.toggle?.());
  }

  if (button.parentElement !== displayGroup) displayGroup.appendChild(button);
  button.classList.toggle('tool-active', isTreeOpen());
}

function exposeApi() {
  window.__3D_MARKUP_TREE__ = {
    open: () => setTreeOpen(true),
    close: () => setTreeOpen(false),
    toggle: () => setTreeOpen(!isTreeOpen()),
    isOpen: isTreeOpen,
    refresh: () => window.dispatchEvent(new CustomEvent('viewer:runtime-context', { detail: window.__3D_MARKUP_VIEWER_RUNTIME__ || {} })),
    panel: () => document.getElementById(PANEL_ID),
    button: () => document.getElementById(RIBBON_TREE_ID) || document.getElementById(FLOATING_TOGGLE_ID)
  };
}

function setTreeOpen(open) {
  syncTreePanelHost();
  const panel = document.getElementById(PANEL_ID);
  const floatingToggle = document.getElementById(FLOATING_TOGGLE_ID);
  const ribbonButton = document.getElementById(RIBBON_TREE_ID);

  if (floatingToggle && panel && panel.classList.contains('tree-open') !== Boolean(open)) {
    floatingToggle.click();
  } else {
    panel?.classList.toggle('tree-open', Boolean(open));
    floatingToggle?.classList.toggle('tree-open', Boolean(open));
  }

  ribbonButton?.classList.toggle('tool-active', Boolean(open));
  window.dispatchEvent(new CustomEvent('viewer:tree-toggled', {
    detail: { open: Boolean(open), panel }
  }));
}

function isTreeOpen() {
  return Boolean(document.getElementById(PANEL_ID)?.classList.contains('tree-open'));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #viewer #${FLOATING_TOGGLE_ID}.model-tree-floating-toggle-bridged {
      display: none !important;
    }

    #viewer #${PANEL_ID}.model-tree-panel-bridged {
      left: 14px !important;
      top: 14px !important;
      bottom: 14px !important;
      z-index: 28 !important;
      max-height: calc(100% - 28px);
    }

    body.input-open #viewer #${PANEL_ID}.model-tree-panel-bridged {
      left: 14px !important;
    }

    .tree-ribbon-command {
      min-width: 54px;
    }

    .tree-ribbon-command.tool-active {
      border-color: rgba(247, 183, 92, .82) !important;
      color: #fff0cf !important;
      background: rgba(90, 67, 44, .34) !important;
    }
  `;
  document.head.appendChild(style);
}

function treeIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v5H6z"/><path d="M8 12h8v4H8z"/><path d="M10 20h4"/><path d="M12 9v3M12 16v4"/><path d="M7 20h10"/></svg>';
}

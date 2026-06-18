const STYLE_ID = 'toolbarRowOptimizerStyles';
const RETRY_COUNT = 16;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToolbarOptimizer, { once: true });
} else {
  initToolbarOptimizer();
}

window.addEventListener('markup:safe-ui-status', () => scheduleOptimize(2));
window.addEventListener('markup:app-ready', () => scheduleOptimize(4));

function initToolbarOptimizer() {
  injectStyles();
  scheduleOptimize(RETRY_COUNT);
}

function scheduleOptimize(remaining = 8) {
  window.requestAnimationFrame(() => {
    optimizeToolbar();
    if (remaining > 0) window.setTimeout(() => scheduleOptimize(remaining - 1), 180);
  });
}

function optimizeToolbar() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  const primaryRow = ensureRow(toolbar, 'toolbarPrimaryRow', 'toolbar-primary-row');
  const secondaryRow = ensureRow(toolbar, 'toolbarSecondaryRow', 'toolbar-secondary-row');

  const secondaryItems = new Set([
    document.querySelector('.navis-tag-tools'),
    document.querySelector('.color-control'),
    document.querySelector('.panel-toggles'),
    document.getElementById('runtimeStatus'),
    document.getElementById('safeUiStatus'),
    document.getElementById('uiDiagnosticsBtn')
  ].filter(Boolean));

  const directChildren = Array.from(toolbar.children).filter((child) => child !== primaryRow && child !== secondaryRow);
  directChildren.forEach((child) => {
    if (secondaryItems.has(child)) secondaryRow.appendChild(child);
    else primaryRow.appendChild(child);
  });

  // Some controls are inserted after runtime/safe chips. Pull them back into the compact row.
  secondaryItems.forEach((item) => {
    if (item && item.parentElement !== secondaryRow) secondaryRow.appendChild(item);
  });

  const grid = document.getElementById('gridToggleBtn');
  const fitSelection = document.getElementById('fitSelectionBtn');
  if (grid && fitSelection && grid.parentElement !== fitSelection.parentElement) {
    fitSelection.insertAdjacentElement('afterend', grid);
  }

  toolbar.classList.add('toolbar-row-optimized');
  window.dispatchEvent(new CustomEvent('markup:toolbar-optimized'));
}

function ensureRow(toolbar, id, className) {
  let row = document.getElementById(id);
  if (!row) {
    row = document.createElement('div');
    row.id = id;
    row.className = className;
    toolbar.appendChild(row);
  }
  return row;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .app-shell .toolbar.toolbar-row-optimized {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      justify-content: flex-start !important;
      gap: 7px !important;
      min-width: 0 !important;
    }

    .toolbar-primary-row,
    .toolbar-secondary-row {
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 7px !important;
      min-width: 0 !important;
      width: 100% !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
      scrollbar-width: thin !important;
      padding-bottom: 1px !important;
    }

    .toolbar-secondary-row {
      flex-wrap: nowrap !important;
      align-items: center !important;
    }

    .toolbar-secondary-row .navis-tag-tools {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      max-width: none !important;
      flex-wrap: nowrap !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
    }

    .toolbar-secondary-row .navis-tag-tools .tool-btn,
    .toolbar-secondary-row .panel-toggles .tool-btn,
    .toolbar-secondary-row #uiDiagnosticsBtn {
      min-height: 34px !important;
      padding: 7px 11px !important;
    }

    .toolbar-secondary-row .color-control {
      flex: 0 0 260px !important;
      min-width: 230px !important;
      max-width: 310px !important;
      height: 38px !important;
    }

    .toolbar-secondary-row .color-control select {
      min-width: 150px !important;
    }

    .toolbar-secondary-row #runtimeStatus,
    .toolbar-secondary-row #safeUiStatus {
      flex: 0 0 auto !important;
      height: 34px !important;
      min-width: 92px !important;
    }

    .toolbar-primary-row > .tool-group,
    .toolbar-primary-row > .toolbar-group {
      flex-wrap: nowrap !important;
    }

    @media (max-width: 1480px) {
      .toolbar-secondary-row .color-control { flex-basis: 230px !important; }
      .toolbar-secondary-row .navis-tag-tools .tool-btn { padding-inline: 9px !important; }
    }

    @media (max-width: 1180px) {
      .toolbar-primary-row,
      .toolbar-secondary-row {
        justify-content: flex-start !important;
      }
    }
  `;
  document.head.appendChild(style);
}

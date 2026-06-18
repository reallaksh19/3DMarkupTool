const STYLE_ID = 'twoRowFinalLayoutStyles';
const RETRIES = 18;

const SHORT_LABELS = {
  navisTagBtn: 'Tag',
  navisIsonoteBtn: 'ISONOTE',
  navisImportTagsBtn: 'Import',
  navisTagViewsBtn: 'Views',
  navisSessionSaveBtn: 'Save',
  navisSessionRestoreBtn: 'Restore',
  navisSessionClearBtn: 'Clear',
  navisXmlQaBtn: 'QA',
  navisExportTagsBtn: 'Export',
  toggleInputBtn: 'Input',
  togglePropsBtn: 'Props',
  uiDiagnosticsBtn: 'UI Tools'
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTwoRowFinalLayout, { once: true });
} else {
  initTwoRowFinalLayout();
}

window.addEventListener('markup:safe-ui-status', () => scheduleLayout(6));
window.addEventListener('markup:toolbar-optimized', () => scheduleLayout(5));
window.addEventListener('markup:secondary-row-compacted', () => scheduleLayout(5));
window.addEventListener('markup:app-ready', () => scheduleLayout(8));

function initTwoRowFinalLayout() {
  injectStyles();
  scheduleLayout(RETRIES);
}

function scheduleLayout(remaining = 8) {
  window.requestAnimationFrame(() => {
    applyTwoRowFinalLayout();
    if (remaining > 0) window.setTimeout(() => scheduleLayout(remaining - 1), 140);
  });
}

function applyTwoRowFinalLayout() {
  const shell = document.querySelector('.app-shell');
  const brand = document.querySelector('.brand-block');
  const toolbar = document.querySelector('.toolbar');
  if (!shell || !brand || !toolbar) return;

  const topMeta = ensureChild(toolbar, 'toolbarTopMeta', 'toolbar-top-meta');
  const commandRow = ensureChild(toolbar, 'toolbarCommandRow', 'toolbar-command-row');

  moveToTopMeta(topMeta);
  moveToCommandRow(toolbar, commandRow, topMeta);
  normalizeLabels();

  shell.classList.add('two-row-final-ready');
  toolbar.classList.add('two-row-toolbar-ready');
  commandRow.classList.add('two-row-command-ready');
  topMeta.classList.add('two-row-meta-ready');

  window.dispatchEvent(new CustomEvent('markup:two-row-final-layout'));
}

function ensureChild(parent, id, className) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('div');
    element.id = id;
    element.className = className;
    parent.appendChild(element);
  }
  return element;
}

function moveToTopMeta(topMeta) {
  const items = [
    document.querySelector('.color-control'),
    document.querySelector('.panel-toggles'),
    document.getElementById('runtimeStatus'),
    document.getElementById('safeUiStatus'),
    document.getElementById('uiDiagnosticsBtn')
  ];

  items.filter(Boolean).forEach((item) => {
    if (item.parentElement !== topMeta) topMeta.appendChild(item);
  });
}

function moveToCommandRow(toolbar, commandRow, topMeta) {
  const oldPrimary = document.getElementById('toolbarPrimaryRow');
  const oldSecondary = document.getElementById('toolbarSecondaryRow');
  const navisTools = document.querySelector('.navis-tag-tools');

  const candidates = [];
  if (oldPrimary) candidates.push(...Array.from(oldPrimary.children));
  if (oldSecondary) candidates.push(...Array.from(oldSecondary.children));
  candidates.push(...Array.from(toolbar.children));

  candidates.forEach((child) => {
    if (!child || child === topMeta || child === commandRow || child === oldPrimary || child === oldSecondary) return;
    if (isTopMetaItem(child)) return;
    if (child.parentElement !== commandRow) commandRow.appendChild(child);
  });

  if (navisTools && navisTools.parentElement !== commandRow) commandRow.appendChild(navisTools);

  // Keep previous row containers harmless if earlier layout modules recreate them.
  [oldPrimary, oldSecondary].filter(Boolean).forEach((row) => {
    if (row.parentElement === toolbar) row.classList.add('two-row-superseded-row');
  });
}

function isTopMetaItem(element) {
  return element.matches?.('.color-control, .panel-toggles, #runtimeStatus, #safeUiStatus, #uiDiagnosticsBtn');
}

function normalizeLabels() {
  Object.entries(SHORT_LABELS).forEach(([id, label]) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.dataset.twoRowFinalLabel = label;
    button.setAttribute('aria-label', label);
    const labelEl = button.querySelector('.ui-label') || button.querySelector('span:last-child');
    if (labelEl) labelEl.textContent = label;
    else if (!button.querySelector('.ui-icon')) button.textContent = label;
  });

  const colorText = document.querySelector('.color-control > span');
  if (colorText) colorText.textContent = 'Color By';
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .app-shell.two-row-final-ready {
      display: grid !important;
      grid-template-columns: minmax(360px, 1fr) auto !important;
      grid-template-areas:
        "brand meta"
        "commands commands" !important;
      align-items: center !important;
      row-gap: 9px !important;
      column-gap: 18px !important;
      padding: 10px 14px 11px !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    .app-shell.two-row-final-ready .brand-block {
      grid-area: brand !important;
      align-self: center !important;
      min-width: 320px !important;
      max-width: 620px !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .app-shell.two-row-final-ready .brand-block h1 {
      font-size: clamp(20px, 1.6vw, 30px) !important;
      line-height: 1.05 !important;
      margin: 2px 0 4px !important;
      white-space: nowrap !important;
    }

    .app-shell.two-row-final-ready .brand-block p {
      margin: 0 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    .app-shell.two-row-final-ready .toolbar.two-row-toolbar-ready {
      display: contents !important;
    }

    .toolbar-top-meta.two-row-meta-ready {
      grid-area: meta !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 8px !important;
      min-width: 0 !important;
      width: auto !important;
      overflow: visible !important;
    }

    .toolbar-command-row.two-row-command-ready {
      grid-area: commands !important;
      display: flex !important;
      align-items: stretch !important;
      justify-content: flex-end !important;
      gap: 7px !important;
      width: 100% !important;
      min-width: 0 !important;
      overflow: visible !important;
      flex-wrap: nowrap !important;
    }

    .two-row-superseded-row {
      display: contents !important;
    }

    .toolbar-command-row.two-row-command-ready > .tool-group,
    .toolbar-command-row.two-row-command-ready > .toolbar-group,
    .toolbar-command-row.two-row-command-ready > .navis-tag-tools {
      display: inline-flex !important;
      align-items: stretch !important;
      justify-content: center !important;
      flex-wrap: nowrap !important;
      gap: 5px !important;
      min-width: 0 !important;
      padding: 5px !important;
      border-radius: 14px !important;
      overflow: visible !important;
    }

    .toolbar-command-row.two-row-command-ready .navis-tag-tools {
      flex: 1 1 auto !important;
      justify-content: flex-end !important;
      max-width: none !important;
    }

    .toolbar-command-row.two-row-command-ready .navis-tag-tools .tool-btn {
      min-height: 54px !important;
      height: 54px !important;
      min-width: 54px !important;
      max-width: 92px !important;
      padding: 6px 8px !important;
      border-radius: 10px !important;
      flex-direction: column !important;
      gap: 4px !important;
    }

    .toolbar-command-row.two-row-command-ready .navis-tag-tools .tool-btn .ui-icon {
      width: 18px !important;
      height: 18px !important;
      margin: 0 !important;
    }

    .toolbar-command-row.two-row-command-ready .navis-tag-tools .tool-btn .ui-label {
      font-size: 10.5px !important;
      line-height: 1.05 !important;
      max-width: 82px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .toolbar-top-meta.two-row-meta-ready .color-control {
      flex: 0 0 250px !important;
      min-width: 230px !important;
      max-width: 260px !important;
      height: 38px !important;
      padding: 5px 8px !important;
    }

    .toolbar-top-meta.two-row-meta-ready .color-control select {
      min-width: 145px !important;
      height: 28px !important;
    }

    .toolbar-top-meta.two-row-meta-ready .panel-toggles {
      display: inline-flex !important;
      flex-wrap: nowrap !important;
      gap: 5px !important;
      padding: 4px !important;
    }

    .toolbar-top-meta.two-row-meta-ready .panel-toggles .tool-btn,
    .toolbar-top-meta.two-row-meta-ready #uiDiagnosticsBtn {
      min-height: 34px !important;
      height: 34px !important;
      padding: 6px 11px !important;
      flex-direction: row !important;
    }

    .toolbar-top-meta.two-row-meta-ready #runtimeStatus,
    .toolbar-top-meta.two-row-meta-ready #safeUiStatus {
      height: 34px !important;
      min-width: 82px !important;
      padding: 0 12px !important;
      white-space: nowrap !important;
    }

    .toolbar-top-meta.two-row-meta-ready #safeUiStatus {
      min-width: 70px !important;
    }

    .app-shell.two-row-final-ready .toolbar-primary-row,
    .app-shell.two-row-final-ready .toolbar-secondary-row {
      display: contents !important;
      overflow: visible !important;
      width: auto !important;
      padding: 0 !important;
    }

    @media (max-width: 1680px) {
      .app-shell.two-row-final-ready {
        grid-template-columns: minmax(300px, 1fr) auto !important;
      }
      .toolbar-command-row.two-row-command-ready {
        gap: 5px !important;
      }
      .toolbar-command-row.two-row-command-ready .tool-btn.icon-polished-primary,
      .toolbar-command-row.two-row-command-ready .navis-tag-tools .tool-btn {
        min-width: 50px !important;
        padding-inline: 6px !important;
      }
    }

    @media (max-width: 1280px) {
      .app-shell.two-row-final-ready {
        grid-template-columns: 1fr !important;
        grid-template-areas:
          "brand"
          "meta"
          "commands" !important;
      }
      .toolbar-top-meta.two-row-meta-ready,
      .toolbar-command-row.two-row-command-ready {
        justify-content: flex-start !important;
        flex-wrap: wrap !important;
      }
    }
  `;
  document.head.appendChild(style);
}

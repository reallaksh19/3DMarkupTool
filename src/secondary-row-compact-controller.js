const STYLE_ID = 'secondaryRowCompactStyles';
const RETRIES = 18;

const COMPACT_LABELS = {
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
  document.addEventListener('DOMContentLoaded', initSecondaryRowCompact, { once: true });
} else {
  initSecondaryRowCompact();
}

window.addEventListener('markup:safe-ui-status', () => scheduleCompact(5));
window.addEventListener('markup:toolbar-optimized', () => scheduleCompact(5));
window.addEventListener('markup:app-ready', () => scheduleCompact(8));

document.addEventListener('click', (event) => {
  if (event.target?.closest?.('.toolbar')) window.setTimeout(compactSecondaryRow, 0);
}, true);

function initSecondaryRowCompact() {
  injectStyles();
  scheduleCompact(RETRIES);
}

function scheduleCompact(remaining = 8) {
  window.requestAnimationFrame(() => {
    compactSecondaryRow();
    if (remaining > 0) window.setTimeout(() => scheduleCompact(remaining - 1), 160);
  });
}

function compactSecondaryRow() {
  const toolbar = document.querySelector('.toolbar');
  const row = document.getElementById('toolbarSecondaryRow');
  if (!toolbar || !row) return;

  const tagTools = document.querySelector('.navis-tag-tools');
  const color = document.querySelector('.color-control');
  const panels = document.querySelector('.panel-toggles');
  const runtime = document.getElementById('runtimeStatus');
  const safe = document.getElementById('safeUiStatus');
  const diagnostics = document.getElementById('uiDiagnosticsBtn');

  // Keep the complete review/output strip in one controlled row.
  [color, panels, runtime, safe, diagnostics, tagTools].filter(Boolean).forEach((item) => {
    if (item.parentElement !== row) row.appendChild(item);
  });

  row.classList.add('secondary-one-line-ready');
  tagTools?.classList.add('secondary-tag-strip');
  color?.classList.add('secondary-color-compact');
  panels?.classList.add('secondary-panel-compact');

  Object.entries(COMPACT_LABELS).forEach(([id, label]) => applyCompactLabel(id, label));

  window.dispatchEvent(new CustomEvent('markup:secondary-row-compacted'));
}

function applyCompactLabel(id, label) {
  const button = document.getElementById(id);
  if (!button) return;
  button.dataset.compactToolbarLabel = label;
  button.setAttribute('aria-label', label);

  const labelEl = button.querySelector('.ui-label') || button.querySelector('span:last-child');
  if (labelEl) {
    labelEl.textContent = label;
    return;
  }

  if (!button.querySelector('.ui-icon')) button.textContent = label;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .app-shell .toolbar.toolbar-row-optimized {
      gap: 6px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready {
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 6px !important;
      width: 100% !important;
      min-width: 0 !important;
      flex-wrap: nowrap !important;
      overflow: visible !important;
      padding-bottom: 0 !important;
      scrollbar-width: none !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready::-webkit-scrollbar,
    .toolbar-secondary-row.secondary-one-line-ready .navis-tag-tools::-webkit-scrollbar {
      display: none !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready > * {
      flex: 0 0 auto !important;
      min-width: 0 !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .navis-tag-tools.secondary-tag-strip {
      order: 20 !important;
      flex: 1 1 auto !important;
      max-width: 720px !important;
      min-width: 0 !important;
      display: inline-flex !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 5px !important;
      overflow: visible !important;
      padding: 4px !important;
      border-radius: 12px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .navis-tag-tools.secondary-tag-strip .tool-btn,
    .toolbar-secondary-row.secondary-one-line-ready .secondary-panel-compact .tool-btn,
    .toolbar-secondary-row.secondary-one-line-ready #uiDiagnosticsBtn {
      min-height: 31px !important;
      height: 31px !important;
      min-width: 0 !important;
      padding: 5px 8px !important;
      border-radius: 9px !important;
      gap: 4px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .navis-tag-tools.secondary-tag-strip .tool-btn .ui-icon,
    .toolbar-secondary-row.secondary-one-line-ready .secondary-panel-compact .tool-btn .ui-icon,
    .toolbar-secondary-row.secondary-one-line-ready #uiDiagnosticsBtn .ui-icon {
      width: 14px !important;
      height: 14px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .navis-tag-tools.secondary-tag-strip .tool-btn .ui-label,
    .toolbar-secondary-row.secondary-one-line-ready .secondary-panel-compact .tool-btn .ui-label,
    .toolbar-secondary-row.secondary-one-line-ready #uiDiagnosticsBtn .ui-label {
      font-size: 10.5px !important;
      letter-spacing: 0 !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .secondary-color-compact {
      order: 1 !important;
      flex: 0 0 220px !important;
      min-width: 210px !important;
      max-width: 225px !important;
      height: 32px !important;
      padding: 4px 8px !important;
      gap: 7px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .secondary-color-compact span {
      font-size: 10.5px !important;
      white-space: nowrap !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .secondary-color-compact select {
      min-width: 110px !important;
      height: 26px !important;
      font-size: 11px !important;
      padding-block: 2px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready .secondary-panel-compact {
      order: 2 !important;
      flex: 0 0 auto !important;
      padding: 3px !important;
      gap: 4px !important;
      border-radius: 11px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready #runtimeStatus,
    .toolbar-secondary-row.secondary-one-line-ready #safeUiStatus {
      order: 3 !important;
      height: 31px !important;
      min-width: 74px !important;
      padding: 0 12px !important;
      font-size: 10.5px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready #safeUiStatus {
      order: 4 !important;
      min-width: 64px !important;
    }

    .toolbar-secondary-row.secondary-one-line-ready #uiDiagnosticsBtn {
      order: 5 !important;
      flex: 0 0 auto !important;
    }

    @media (max-width: 1680px) {
      .toolbar-secondary-row.secondary-one-line-ready {
        flex-wrap: wrap !important;
      }
      .toolbar-secondary-row.secondary-one-line-ready .navis-tag-tools.secondary-tag-strip {
        flex-basis: 100% !important;
        max-width: 100% !important;
        justify-content: flex-end !important;
      }
    }
  `;
  document.head.appendChild(style);
}

const STYLE_ID = 'toolbarIconStyleStyles';
const PRIMARY_IDS = new Set([
  'selectToolBtn', 'orbitToolBtn', 'panToolBtn', 'measureBtn',
  'viewIsoBtn', 'viewTopBtn', 'viewFrontBtn', 'viewSideBtn',
  'resetCameraBtn', 'fitSelectionBtn', 'marqueeZoomBtn', 'gridToggleBtn',
  'clipBtn', 'clearSelectionBtn', 'previewGlbBtn', 'previewRvmBtn', 'rvmQaBtn'
]);

const BUTTONS = {
  selectToolBtn: { label: 'Select', icon: 'pointer' },
  orbitToolBtn: { label: 'Orbit', icon: 'orbit' },
  panToolBtn: { label: 'Pan', icon: 'hand' },
  measureBtn: { label: 'Measure', icon: 'ruler' },
  viewIsoBtn: { label: 'ISO', icon: 'cube' },
  viewTopBtn: { label: 'TOP', icon: 'top' },
  viewFrontBtn: { label: 'FRONT', icon: 'front' },
  viewSideBtn: { label: 'SIDE', icon: 'side' },
  resetCameraBtn: { label: 'Fit All', icon: 'fit' },
  fitSelectionBtn: { label: 'Fit Sel', icon: 'fit-select' },
  marqueeZoomBtn: { label: 'Marquee', icon: 'marquee' },
  gridToggleBtn: { label: 'Grid', icon: 'grid' },
  clipBtn: { label: 'Clip', icon: 'clip' },
  clearSelectionBtn: { label: 'Clear', icon: 'eraser' },
  previewGlbBtn: { label: 'GLB', icon: 'box' },
  previewRvmBtn: { label: 'RVM', icon: 'file' },
  rvmQaBtn: { label: 'RVM QA', icon: 'qa' },
  navisManualTagBtn: { label: 'Tag', icon: 'tag' },
  navisIsonoteBtn: { label: 'ISONOTE', icon: 'note' },
  navisImportTagsBtn: { label: 'Import XML', icon: 'import' },
  navisTagViewsBtn: { label: 'Tag Views', icon: 'list' },
  navisSessionSaveBtn: { label: 'Save', icon: 'save' },
  navisSessionRestoreBtn: { label: 'Restore', icon: 'restore' },
  navisSessionClearBtn: { label: 'Clear Session', icon: 'trash' },
  navisXmlQaBtn: { label: 'XML QA', icon: 'check' },
  navisExportTagsBtn: { label: 'Export XML', icon: 'export' },
  toggleInputBtn: { label: 'Input', icon: 'panel-left' },
  togglePropsBtn: { label: 'Props', icon: 'panel-right' },
  uiDiagnosticsBtn: { label: 'UI Tools', icon: 'settings' }
};

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
  'panel-left': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9 5v14"/>',
  'panel-right': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M15 5v14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToolbarIconStyle, { once: true });
} else {
  initToolbarIconStyle();
}

window.addEventListener('markup:safe-ui-status', () => scheduleDecorate(5));
window.addEventListener('markup:toolbar-optimized', () => scheduleDecorate(4));
window.addEventListener('markup:app-ready', () => scheduleDecorate(6));
document.addEventListener('click', (event) => {
  if (event.target?.closest?.('.tool-btn')) window.setTimeout(() => decorateToolbar(), 0);
}, true);

function initToolbarIconStyle() {
  injectStyles();
  scheduleDecorate(18);
}

function scheduleDecorate(remaining = 8) {
  window.requestAnimationFrame(() => {
    decorateToolbar();
    if (remaining > 0) window.setTimeout(() => scheduleDecorate(remaining - 1), 180);
  });
}

function decorateToolbar() {
  Object.entries(BUTTONS).forEach(([id, config]) => {
    const button = document.getElementById(id);
    if (!button) return;
    const isPrimary = PRIMARY_IDS.has(id) || button.closest('.toolbar-primary-row');
    decorateButton(button, config, isPrimary ? 'primary' : 'secondary');
  });
  document.querySelector('.toolbar')?.classList.add('toolbar-icon-style-ready');
}

function decorateButton(button, config, zone) {
  const iconSvg = icon(config.icon);
  const label = config.label;
  if (button.dataset.iconStyleKey === `${config.icon}:${label}:${zone}`) return;

  button.dataset.iconStyleKey = `${config.icon}:${label}:${zone}`;
  button.classList.add('icon-polished', zone === 'primary' ? 'icon-polished-primary' : 'icon-polished-secondary');
  button.setAttribute('aria-label', label);
  button.innerHTML = `<span class="ui-icon" aria-hidden="true">${iconSvg}</span><span class="ui-label">${escapeHtml(label)}</span>`;
}

function icon(name) {
  const path = ICONS[name] || ICONS.cube;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
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
    .toolbar-icon-style-ready .toolbar-primary-row {
      align-items: stretch !important;
    }

    .tool-btn.icon-polished {
      gap: 5px !important;
      font-weight: 850 !important;
      letter-spacing: .01em !important;
      line-height: 1.05 !important;
      white-space: nowrap !important;
    }

    .tool-btn.icon-polished .ui-icon {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #dfeeff !important;
      opacity: .95 !important;
      flex: 0 0 auto !important;
    }

    .tool-btn.icon-polished .ui-icon svg {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.35));
    }

    .tool-btn.icon-polished-primary {
      min-width: 66px !important;
      min-height: 62px !important;
      padding: 8px 10px !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
    }

    .tool-btn.icon-polished-primary .ui-icon {
      width: 24px !important;
      height: 24px !important;
      margin-bottom: 2px !important;
    }

    .tool-btn.icon-polished-primary .ui-label {
      font-size: 11px !important;
      max-width: 62px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    .tool-btn.icon-polished-secondary {
      min-height: 36px !important;
      padding: 7px 12px !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .tool-btn.icon-polished-secondary .ui-icon {
      width: 17px !important;
      height: 17px !important;
    }

    .tool-btn.icon-polished-secondary .ui-label {
      font-size: 12px !important;
    }

    #previewGlbBtn.icon-polished-primary,
    #previewRvmBtn.icon-polished-primary,
    #rvmQaBtn.icon-polished-primary {
      min-width: 68px !important;
    }

    #gridToggleBtn.icon-polished-primary,
    #clipBtn.icon-polished-primary {
      min-width: 68px !important;
    }

    .toolbar-secondary-row .navis-tag-tools .tool-btn.icon-polished-secondary {
      min-width: auto !important;
    }

    @media (max-width: 1280px) {
      .tool-btn.icon-polished-primary {
        min-width: 58px !important;
        padding-inline: 8px !important;
      }
      .tool-btn.icon-polished-primary .ui-icon { width: 21px !important; height: 21px !important; }
      .tool-btn.icon-polished-primary .ui-label { font-size: 10px !important; max-width: 54px !important; }
    }
  `;
  document.head.appendChild(style);
}
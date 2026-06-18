const SAFE_UI_VERSION = 'phase34-two-row-hotfix';

const ALL_MODULES = [
  {
    id: 'uiDiagnostics',
    label: 'UI diagnostics',
    src: './ui-diagnostics-controller.js?v=phase34-diagnostics'
  },
  {
    id: 'shellLayoutRecovery',
    label: 'Shell layout recovery',
    src: './shell-layout-recovery-controller.js?v=phase34-shell-layout'
  },
  {
    id: 'propertyTabs',
    label: 'Property tabs',
    src: './property-tabs-base-controller.js?v=phase34-property-tabs-base'
  },
  {
    id: 'consoleGuard',
    label: 'Input guard',
    src: './ui-console-guard.js?v=phase34-console-guard'
  },
  {
    id: 'conversionOptionsCompat',
    label: 'Conversion options compatibility',
    src: './conversion-options-compat-controller.js?v=phase34-conversion-options'
  },
  {
    id: 'fit',
    label: 'Fit',
    src: './fit-controller.js?v=phase34-fit'
  },
  {
    id: 'grid',
    label: 'Grid toggle',
    src: './grid-toggle-controller.js?v=phase34-grid'
  },
  {
    id: 'clipAdjuster',
    label: 'Clip adjuster',
    src: './clip-adjuster.js?v=phase34-clip-adjuster'
  },
  {
    id: 'clipVisuals',
    label: 'Clip / axis overlays',
    src: './clip-visual-overlays.js?v=phase34-clip-visuals'
  },
  {
    id: 'colorLegend',
    label: 'Color legend',
    src: './color-by-legend-safe-controller.js?v=phase34-safe-legend'
  },
  {
    id: 'treeVisibility',
    label: 'Tree + visibility',
    src: './visibility-context-menu.js?v=phase34-tree-visibility'
  },
  {
    id: 'selectionSync',
    label: 'Selection sync',
    src: './selection-sync-controller.js?v=phase34-selection-sync'
  },
  {
    id: 'marqueeZoom',
    label: 'Marquee zoom',
    src: './marquee-zoom-controller.js?v=phase34-marquee'
  },
  {
    id: 'originManager',
    label: 'Origin manager',
    src: './origin-manager-controller.js?v=phase34-origin'
  },
  {
    id: 'rvmQa',
    label: 'RVM QA',
    src: './rvm-compat-validator-controller.js?v=phase34-rvm-qa'
  },
  {
    id: 'rvmStrictProfile',
    label: 'RVM strict profile',
    src: './rvm-strict-mode-controller.js?v=phase34-rvm-strict'
  },
  {
    id: 'tagLiteHost',
    label: 'Tag toolbar host',
    src: './tag-lite-host-controller.js?v=phase34-tag-host'
  },
  {
    id: 'tagImportViews',
    label: 'Tag import/views',
    src: './navis-tag-import-controller.js?v=phase34-tag-import'
  },
  {
    id: 'manualTag',
    label: 'Manual tag',
    src: './navis-manual-tag-safe-controller.js?v=phase34-manual-tag'
  },
  {
    id: 'tagUsability',
    label: 'Tag usability',
    src: './navis-tag-usability-safe-controller.js?v=phase34-tag-usability'
  },
  {
    id: 'tagSession',
    label: 'Tag session',
    src: './navis-tag-session-safe-controller.js?v=phase34-tag-session'
  },
  {
    id: 'tagXmlQa',
    label: 'Tag XML QA',
    src: './navis-tag-xml-qa-mini-controller.js?v=phase34-tag-xml-qa'
  },
  {
    id: 'twoRowIconRibbon',
    label: 'Two-row icon ribbon',
    src: './two-row-icon-ribbon-controller.js?v=phase34-two-row-hotfix'
  }
];

const SAFE_MODE = new URLSearchParams(window.location.search).has('safe')
  || window.localStorage.getItem('3dmarkup.safeUiMode') === 'core';

const BATCH_MODULES = SAFE_MODE
  ? ALL_MODULES.filter((entry) => entry.id === 'uiDiagnostics')
  : ALL_MODULES;

const state = {
  version: SAFE_UI_VERSION,
  safeMode: SAFE_MODE,
  total: BATCH_MODULES.length,
  loaded: 0,
  failed: []
};

window.__3D_MARKUP_SAFE_UI__ = state;

runSafeLoader();

async function runSafeLoader() {
  for (const entry of BATCH_MODULES) {
    try {
      await import(entry.src);
      state.loaded += 1;
      updateStatus();
      window.dispatchEvent(new CustomEvent('markup:safe-ui-module-loaded', { detail: { ...entry, state: { ...state } } }));
    } catch (error) {
      state.failed.push({ id: entry.id, label: entry.label, message: error?.message || String(error) });
      console.warn(`[3DMarkupTool] Optional UI module failed: ${entry.label}`, error);
      updateStatus();
      window.dispatchEvent(new CustomEvent('markup:safe-ui-module-failed', { detail: { ...entry, error, state: { ...state } } }));
    }
  }

  updateStatus(true);
  window.dispatchEvent(new CustomEvent('markup:safe-ui-status', { detail: { ...state } }));
}

function updateStatus(done = false) {
  let status = document.getElementById('safeUiStatus');
  const toolbar = document.querySelector('.toolbar');
  if (!status && toolbar) {
    status = document.createElement('div');
    status.id = 'safeUiStatus';
    status.className = 'status-pill safe-ui-status';
    toolbar.appendChild(status);
  }
  if (!status) return;

  const failedText = state.failed.length ? ` / ${state.failed.length} failed` : '';
  status.textContent = state.safeMode
    ? `Safe UI ${state.loaded}/${state.total}${failedText}`
    : `UI ${state.loaded}/${state.total}${failedText}`;
  status.classList.toggle('warning', Boolean(state.failed.length));
  status.classList.toggle('done', done && !state.failed.length);
}
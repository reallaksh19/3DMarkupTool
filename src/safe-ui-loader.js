const SAFE_UI_VERSION = 'phase32-compact-secondary-row';

const ALL_MODULES = [
  {
    id: 'uiDiagnostics',
    label: 'UI diagnostics',
    src: './ui-diagnostics-controller.js?v=phase32-diagnostics'
  },
  {
    id: 'shellLayoutRecovery',
    label: 'Shell layout recovery',
    src: './shell-layout-recovery-controller.js?v=phase32-shell-layout'
  },
  {
    id: 'toolbarRowOptimizer',
    label: 'Toolbar row optimizer',
    src: './toolbar-row-optimizer-controller.js?v=phase32-toolbar-row'
  },
  {
    id: 'toolbarIconStyle',
    label: 'Toolbar icon style',
    src: './toolbar-icon-style-controller.js?v=phase32-toolbar-icons'
  },
  {
    id: 'secondaryRowCompact',
    label: 'Secondary row compact layout',
    src: './secondary-row-compact-controller.js?v=phase32-secondary-row'
  },
  {
    id: 'propertyTabs',
    label: 'Property tabs',
    src: './property-tabs-base-controller.js?v=phase32-property-tabs-base'
  },
  {
    id: 'consoleGuard',
    label: 'Input guard',
    src: './ui-console-guard.js?v=phase32-console-guard'
  },
  {
    id: 'conversionOptionsCompat',
    label: 'Conversion options compatibility',
    src: './conversion-options-compat-controller.js?v=phase32-conversion-options'
  },
  {
    id: 'fit',
    label: 'Fit',
    src: './fit-controller.js?v=phase32-fit'
  },
  {
    id: 'grid',
    label: 'Grid toggle',
    src: './grid-toggle-controller.js?v=phase32-grid'
  },
  {
    id: 'clipAdjuster',
    label: 'Clip adjuster',
    src: './clip-adjuster.js?v=phase32-clip-adjuster'
  },
  {
    id: 'clipVisuals',
    label: 'Clip / axis overlays',
    src: './clip-visual-overlays.js?v=phase32-clip-visuals'
  },
  {
    id: 'colorLegend',
    label: 'Color legend',
    src: './color-by-legend-safe-controller.js?v=phase32-safe-legend'
  },
  {
    id: 'treeVisibility',
    label: 'Tree + visibility',
    src: './visibility-context-menu.js?v=phase32-tree-visibility'
  },
  {
    id: 'selectionSync',
    label: 'Selection sync',
    src: './selection-sync-controller.js?v=phase32-selection-sync'
  },
  {
    id: 'marqueeZoom',
    label: 'Marquee zoom',
    src: './marquee-zoom-controller.js?v=phase32-marquee'
  },
  {
    id: 'originManager',
    label: 'Origin manager',
    src: './origin-manager-controller.js?v=phase32-origin'
  },
  {
    id: 'rvmQa',
    label: 'RVM QA',
    src: './rvm-compat-validator-controller.js?v=phase32-rvm-qa'
  },
  {
    id: 'rvmStrictProfile',
    label: 'RVM strict profile',
    src: './rvm-strict-mode-controller.js?v=phase32-rvm-strict'
  },
  {
    id: 'tagLiteHost',
    label: 'Tag toolbar host',
    src: './tag-lite-host-controller.js?v=phase32-tag-host'
  },
  {
    id: 'tagImportViews',
    label: 'Tag import/views',
    src: './navis-tag-import-controller.js?v=phase32-tag-import'
  },
  {
    id: 'manualTag',
    label: 'Manual tag',
    src: './navis-manual-tag-safe-controller.js?v=phase32-manual-tag'
  },
  {
    id: 'tagUsability',
    label: 'Tag usability',
    src: './navis-tag-usability-safe-controller.js?v=phase32-tag-usability'
  },
  {
    id: 'tagSession',
    label: 'Tag session',
    src: './navis-tag-session-safe-controller.js?v=phase32-tag-session'
  },
  {
    id: 'tagXmlQa',
    label: 'Tag XML QA',
    src: './navis-tag-xml-qa-mini-controller.js?v=phase32-tag-xml-qa'
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
  started: false,
  modules: BATCH_MODULES,
  results: []
};

startSafeUiLoader();

async function startSafeUiLoader() {
  if (state.started) return;
  state.started = true;

  ensureStatusBadge();
  updateStatusBadge();

  for (const moduleInfo of state.modules) {
    await loadGuarded(moduleInfo);
    updateStatusBadge();
  }

  window.dispatchEvent(new CustomEvent('markup:safe-ui-status', {
    detail: {
      version: state.version,
      safeMode: state.safeMode,
      results: [...state.results]
    }
  }));
}

async function loadGuarded(moduleInfo) {
  try {
    await import(moduleInfo.src);
    state.results.push({ ...moduleInfo, status: 'loaded' });
  } catch (error) {
    console.warn(`[3DMarkupTool] Optional UI module failed: ${moduleInfo.label}`, error);
    state.results.push({
      ...moduleInfo,
      status: 'failed',
      error: error?.message || String(error)
    });
  }
}

function ensureStatusBadge() {
  if (document.getElementById('safeUiStatus')) return;

  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  const badge = document.createElement('div');
  badge.id = 'safeUiStatus';
  badge.className = 'status-pill safe-ui-status';
  badge.textContent = 'UI 0/0';
  toolbar.appendChild(badge);
}

function updateStatusBadge() {
  const badge = document.getElementById('safeUiStatus');
  if (!badge) return;

  const loaded = state.results.filter((result) => result.status === 'loaded').length;
  const failed = state.results.filter((result) => result.status === 'failed').length;
  const total = state.modules.length;

  badge.textContent = failed ? `UI ${loaded}/${total} · ${failed} failed` : `UI ${loaded}/${total}`;
  badge.classList.toggle('warn', failed > 0);
  badge.title = state.results.map((result) => {
    const suffix = result.error ? ` — ${result.error}` : '';
    return `${result.label}: ${result.status}${suffix}`;
  }).join('\n') || 'Optional UI modules pending';

  window.__3D_MARKUP_SAFE_UI_STATUS__ = {
    version: state.version,
    safeMode: state.safeMode,
    loaded,
    failed,
    total,
    results: [...state.results]
  };
}

const SAFE_UI_VERSION = 'phase28-rvm-strict-foundation';

const ALL_MODULES = [
  {
    id: 'uiDiagnostics',
    label: 'UI diagnostics',
    src: './ui-diagnostics-controller.js?v=phase28-diagnostics'
  },
  {
    id: 'shellLayoutRecovery',
    label: 'Shell layout recovery',
    src: './shell-layout-recovery-controller.js?v=phase28-shell-layout'
  },
  {
    id: 'propertyTabs',
    label: 'Property tabs',
    src: './property-tabs-base-controller.js?v=phase28-property-tabs-base'
  },
  {
    id: 'consoleGuard',
    label: 'Input guard',
    src: './ui-console-guard.js?v=phase28-console-guard'
  },
  {
    id: 'fit',
    label: 'Fit',
    src: './fit-controller.js?v=phase28-fit'
  },
  {
    id: 'grid',
    label: 'Grid toggle',
    src: './grid-toggle-controller.js?v=phase28-grid'
  },
  {
    id: 'clipAdjuster',
    label: 'Clip adjuster',
    src: './clip-adjuster.js?v=phase28-clip-adjuster'
  },
  {
    id: 'clipVisuals',
    label: 'Clip / axis overlays',
    src: './clip-visual-overlays.js?v=phase28-clip-visuals'
  },
  {
    id: 'colorLegend',
    label: 'Color legend',
    src: './color-by-legend-safe-controller.js?v=phase28-safe-legend'
  },
  {
    id: 'treeVisibility',
    label: 'Tree + visibility',
    src: './visibility-context-menu.js?v=phase28-tree-visibility'
  },
  {
    id: 'selectionSync',
    label: 'Selection sync',
    src: './selection-sync-controller.js?v=phase28-selection-sync'
  },
  {
    id: 'marqueeZoom',
    label: 'Marquee zoom',
    src: './marquee-zoom-controller.js?v=phase28-marquee'
  },
  {
    id: 'originManager',
    label: 'Origin manager',
    src: './origin-manager-controller.js?v=phase28-origin'
  },
  {
    id: 'rvmQa',
    label: 'RVM QA',
    src: './rvm-compat-validator-controller.js?v=phase28-rvm-qa'
  },
  {
    id: 'rvmStrictProfile',
    label: 'RVM strict profile',
    src: './rvm-strict-mode-controller.js?v=phase28-rvm-strict'
  },
  {
    id: 'tagLiteHost',
    label: 'Tag toolbar host',
    src: './tag-lite-host-controller.js?v=phase28-tag-host'
  },
  {
    id: 'tagImportViews',
    label: 'Tag import/views',
    src: './navis-tag-import-controller.js?v=phase28-tag-import'
  },
  {
    id: 'manualTag',
    label: 'Manual tag',
    src: './navis-manual-tag-safe-controller.js?v=phase28-manual-tag'
  },
  {
    id: 'tagUsability',
    label: 'Tag usability',
    src: './navis-tag-usability-safe-controller.js?v=phase28-tag-usability'
  },
  {
    id: 'tagSession',
    label: 'Tag session',
    src: './navis-tag-session-safe-controller.js?v=phase28-tag-session'
  },
  {
    id: 'tagXmlQa',
    label: 'Tag XML QA',
    src: './navis-tag-xml-qa-mini-controller.js?v=phase28-tag-xml-qa'
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

window.__3D_MARKUP_SAFE_UI_LOADER__ = state;

bootSafeLoader();

async function bootSafeLoader() {
  if (state.started) return;
  state.started = true;

  await waitForCoreApp();
  ensureStatusChip();

  if (SAFE_MODE) {
    updateStatusChip('warning', 'UI safe mode');
  } else {
    updateStatusChip('loading', 'UI loading…');
  }
  dispatchStatus();

  for (const entry of BATCH_MODULES) {
    await nextFrame();
    await loadModule(entry);
    updateStatusChip('loading', statusText());
    dispatchStatus();
  }

  const failures = state.results.filter((item) => item.status === 'failed');
  updateStatusChip(failures.length || SAFE_MODE ? 'warning' : 'ok', statusText());
  dispatchStatus();
}

function waitForCoreApp(timeoutMs = 5000) {
  if (window.__3D_MARKUP_APP_READY__) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('markup:app-ready', finish);
      resolve();
    };

    window.addEventListener('markup:app-ready', finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
}

async function loadModule(entry) {
  if (state.results.some((item) => item.id === entry.id)) return;

  const result = { id: entry.id, label: entry.label, status: 'loading' };
  state.results.push(result);
  dispatchStatus();

  try {
    await import(entry.src);
    result.status = 'loaded';
  } catch (error) {
    result.status = 'failed';
    result.error = error?.message || String(error);
    console.warn(`[3DMarkupTool] Optional UI module failed: ${entry.label}`, error);
  }
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function statusText() {
  const loaded = state.results.filter((item) => item.status === 'loaded').length;
  const failed = state.results.filter((item) => item.status === 'failed').length;
  const suffix = SAFE_MODE ? ' safe' : '';
  return failed
    ? `UI ${loaded}/${BATCH_MODULES.length}, ${failed} failed${suffix}`
    : `UI ${loaded}/${BATCH_MODULES.length}${suffix}`;
}

function ensureStatusChip() {
  if (document.getElementById('safeUiStatus')) return;

  const chip = document.createElement('div');
  chip.id = 'safeUiStatus';
  chip.className = 'safe-ui-status-chip loading';
  chip.textContent = 'UI loading…';
  chip.title = 'Optional UI module loader status';

  const runtimeStatus = document.getElementById('runtimeStatus');
  runtimeStatus?.insertAdjacentElement('afterend', chip);

  if (!document.getElementById('safeUiLoaderStyles')) {
    const style = document.createElement('style');
    style.id = 'safeUiLoaderStyles';
    style.textContent = `
      .safe-ui-status-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 68px;
        height: 32px;
        border-radius: 18px;
        padding: 0 13px;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .02em;
        color: #dcecff;
        border: 1px solid rgba(133,190,255,.3);
        background: rgba(6,18,34,.9);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
        white-space: nowrap;
      }
      .safe-ui-status-chip.ok {
        color: #40f7af;
        border-color: rgba(64,247,175,.35);
        background: rgba(0,48,41,.82);
      }
      .safe-ui-status-chip.warning {
        color: #ffd166;
        border-color: rgba(255,209,102,.55);
        background: rgba(65,42,0,.82);
      }
      .safe-ui-status-chip.loading {
        color: #a8d8ff;
      }
    `;
    document.head.appendChild(style);
  }
}

function updateStatusChip(stateName, text) {
  const chip = document.getElementById('safeUiStatus');
  if (!chip) return;
  chip.classList.remove('ok', 'warning', 'loading');
  chip.classList.add(stateName);
  chip.textContent = text;
}

function dispatchStatus() {
  window.dispatchEvent(new CustomEvent('markup:safe-ui-status', {
    detail: {
      version: state.version,
      safeMode: state.safeMode,
      modules: state.modules,
      results: state.results
    }
  }));
}

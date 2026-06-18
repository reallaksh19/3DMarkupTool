const BATCH_MODULES = [
  {
    id: 'fit',
    label: 'Fit',
    src: './fit-controller.js?v=phase26-safe-fit'
  },
  // Grid is intentionally not imported here. index.html still contains the
  // direct grid-toggle-controller module, and importing it again with a
  // different cache key creates a duplicate Grid button.
  {
    id: 'colorLegend',
    label: 'Color legend',
    src: './color-by-legend-safe-controller.js?v=phase26-safe-legend'
  },
  {
    id: 'treeVisibility',
    label: 'Tree + visibility',
    src: './visibility-context-menu.js?v=phase26-safe-tree-visibility'
  },
  {
    id: 'selectionSync',
    label: 'Selection sync',
    src: './selection-sync-controller.js?v=phase26-safe-selection-sync'
  },
  {
    id: 'marqueeZoom',
    label: 'Marquee zoom',
    src: './marquee-zoom-controller.js?v=phase26-safe-marquee'
  },
  {
    id: 'originManager',
    label: 'Origin manager',
    src: './origin-manager-controller.js?v=phase26-safe-origin'
  },
  {
    id: 'rvmQa',
    label: 'RVM QA',
    src: './rvm-compat-validator-controller.js?v=phase26-safe-rvm-qa'
  },
  {
    id: 'tagLiteHost',
    label: 'Tag toolbar host',
    src: './tag-lite-host-controller.js?v=phase26-batch5c-host'
  },
  {
    id: 'tagImportViews',
    label: 'Tag import/views',
    src: './navis-tag-import-controller.js?v=phase26-batch5a-import'
  },
  {
    id: 'manualTag',
    label: 'Manual tag',
    src: './navis-manual-tag-safe-controller.js?v=phase26-batch5c-manual'
  }
];

const state = {
  started: false,
  results: []
};

window.__3D_MARKUP_SAFE_UI_LOADER__ = state;

bootSafeLoader();

async function bootSafeLoader() {
  if (state.started) return;
  state.started = true;

  await waitForCoreApp();
  ensureStatusChip();
  updateStatusChip('loading', 'UI loading…');

  for (const entry of BATCH_MODULES) {
    await nextFrame();
    await loadModule(entry);
    updateStatusChip('loading', statusText());
  }

  const failures = state.results.filter((item) => item.status === 'failed');
  updateStatusChip(failures.length ? 'warning' : 'ok', statusText());
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
  return failed ? `UI ${loaded}/${BATCH_MODULES.length}, ${failed} failed` : `UI ${loaded}/${BATCH_MODULES.length}`;
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
        min-width: 74px;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid rgba(125, 172, 222, .24);
        background: rgba(9, 20, 33, .72);
        color: #a7bdd4;
        font-size: 11px;
        font-weight: 800;
        text-align: center;
        white-space: nowrap;
      }
      .safe-ui-status-chip.ok { color: #39f5a5; border-color: rgba(57,245,165,.28); }
      .safe-ui-status-chip.warning { color: #ffd166; border-color: rgba(255,209,102,.35); }
      .safe-ui-status-chip.loading { color: #a9d5ff; }
    `;
    document.head.appendChild(style);
  }
}

function updateStatusChip(status, text) {
  const chip = document.getElementById('safeUiStatus');
  if (!chip) return;
  chip.className = `safe-ui-status-chip ${status}`;
  chip.textContent = text;
  chip.title = state.results.map((item) => `${item.label}: ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n');
}

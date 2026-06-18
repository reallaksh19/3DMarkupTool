const SAFE_UI_VERSION = window.__3D_MARKUP_SAFE_UI_VERSION__ || 'static-professional-shell-20260618';

// The professional shell is now static HTML/CSS in index.html. This loader must
// only add behavior modules; it must not load layout/ribbon rewrite controllers.
const ALL_MODULES = [
  { id: 'uiDiagnostics', label: 'UI diagnostics', src: `./ui-diagnostics-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'inputDrawer', label: 'Input drawer', src: `./input-drawer-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'viewerRuntimeBridge', label: 'Viewer runtime bridge', src: `./viewer-runtime-bridge-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'consoleGuard', label: 'Input guard', src: `./ui-console-guard.js?v=${SAFE_UI_VERSION}` },
  { id: 'coreAppSafety', label: 'Core app safety', src: `./core-app-safety-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'fit', label: 'Fit', src: `./fit-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'grid', label: 'Grid toggle', src: `./grid-toggle-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'clipAdjuster', label: 'Clip adjuster', src: `./clip-adjuster.js?v=${SAFE_UI_VERSION}` },
  { id: 'viewerClipBox', label: '3D Clip Box', src: `./viewer-clipbox-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'clipVisuals', label: 'Clip / axis overlays', src: `./clip-visual-overlays.js?v=${SAFE_UI_VERSION}` },
  { id: 'colorLegend', label: 'Color legend', src: `./color-by-legend-safe-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'modelTreePanel', label: 'Model tree panel', src: `./model-tree-panel.js?v=${SAFE_UI_VERSION}` },
  { id: 'treeVisibility', label: 'Visibility context menu', src: `./visibility-context-menu.js?v=${SAFE_UI_VERSION}` },
  { id: 'treePanelBridge', label: 'Tree panel bridge', src: `./tree-panel-bridge-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'treeSelectionBridge', label: 'Tree selection bridge', src: `./tree-selection-bridge-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'selectionSync', label: 'Selection sync', src: `./selection-sync-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'marqueeZoom', label: 'Marquee zoom', src: `./marquee-zoom-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'originManager', label: 'Origin manager', src: `./origin-manager-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'rvmQa', label: 'RVM QA', src: `./rvm-compat-validator-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'rvmStrictProfile', label: 'RVM strict profile', src: `./rvm-strict-mode-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'tagLiteHost', label: 'Tag toolbar host', src: `./tag-lite-host-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'tagImportViews', label: 'Tag import/views', src: `./navis-tag-import-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'manualTag', label: 'Manual tag', src: `./navis-manual-tag-safe-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'tagUsability', label: 'Tag usability', src: `./navis-tag-usability-safe-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'tagSession', label: 'Tag session', src: `./navis-tag-session-safe-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'tagXmlQa', label: 'Tag XML QA', src: `./navis-tag-xml-qa-mini-controller.js?v=${SAFE_UI_VERSION}` }
];

const ACCEPTANCE_MODE = new URLSearchParams(window.location.search).has('uiAcceptance')
  || window.localStorage.getItem('3dmarkup.uiAcceptance') === '1';

const ACCEPTANCE_MODULE = {
  id: 'uiAcceptanceHarness',
  label: 'UI acceptance harness',
  src: `./ui-acceptance-harness.js?v=${SAFE_UI_VERSION}`
};

const ACTIVE_MODULES = ACCEPTANCE_MODE ? [...ALL_MODULES, ACCEPTANCE_MODULE] : ALL_MODULES;

const DEPRECATED_MODULES = [
  'shell-layout-recovery-controller.js',
  'property-tabs-base-controller.js',
  'two-row-icon-ribbon-controller.js',
  'ribbon-menu-polish-controller.js',
  'professional-ui-shell-controller.js',
  'phase35-ui-cleanup-controller.js',
  'phase36-input-drawer-fix-controller.js',
  'phase37-input-drawer-stack-controller.js',
  'phase38-clipbox-ui-cleanup-controller.js',
  'phase40-legacy-hint-compat-controller.js',
  'phase41-tree-clip-controls-controller.js',
  'conversion-options-compat-controller.js'
];

const SAFE_MODE = new URLSearchParams(window.location.search).has('safe')
  || window.localStorage.getItem('3dmarkup.safeUiMode') === 'core';

const BATCH_MODULES = SAFE_MODE
  ? ACTIVE_MODULES.filter((entry) => entry.id === 'uiDiagnostics' || entry.id === 'uiAcceptanceHarness')
  : ACTIVE_MODULES;

const state = {
  version: SAFE_UI_VERSION,
  safeMode: SAFE_MODE,
  acceptanceMode: ACCEPTANCE_MODE,
  started: false,
  modules: BATCH_MODULES,
  deprecatedModules: DEPRECATED_MODULES,
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
      acceptanceMode: state.acceptanceMode,
      deprecatedModules: [...state.deprecatedModules],
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
    state.results.push({ ...moduleInfo, status: 'failed', error: error?.message || String(error) });
  }
}

function ensureStatusBadge() {
  if (document.getElementById('safeUiStatus')) return;
  const host = document.querySelector('.topbar-actions') || document.querySelector('.toolbar');
  if (!host) return;
  const badge = document.createElement('div');
  badge.id = 'safeUiStatus';
  badge.className = 'status-pill safe-ui-status';
  badge.textContent = 'UI 0/0';
  host.insertBefore(badge, document.getElementById('runtimeStatus')?.nextSibling || null);
}

function updateStatusBadge() {
  const badge = document.getElementById('safeUiStatus');
  if (!badge) return;
  const loaded = state.results.filter((item) => item.status === 'loaded').length;
  const failed = state.results.filter((item) => item.status === 'failed').length;
  const total = state.modules.length;
  badge.textContent = failed ? `UI ${loaded}/${total} (${failed} failed)` : `UI ${loaded}/${total}`;
  badge.classList.toggle('failed', failed > 0);
  badge.title = failed
    ? `${failed} optional UI module(s) failed. Open UI Tools for details.`
    : `${loaded}/${total} optional UI behavior modules loaded.`;
}

window.__3D_MARKUP_SAFE_UI_LOADER__ = state;

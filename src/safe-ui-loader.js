const SAFE_UI_VERSION = window.__3D_MARKUP_SAFE_UI_VERSION__ || 'static-shell-responsive-core-20260618';

// index.html owns the shell. Default startup must stay small and deterministic.
// Heavy/retry-based extras are opt-in until browser acceptance proves they are safe.
const CORE_MODULES = [
  { id: 'staticShellGuard', label: 'Static shell guard', src: `./static-shell-responsive-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'uiDiagnostics', label: 'UI diagnostics', src: `./ui-diagnostics-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'inputDrawer', label: 'Input drawer', src: `./input-drawer-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'viewerRuntimeBridge', label: 'Viewer runtime bridge', src: `./viewer-runtime-bridge-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'selectionResolver', label: 'Selection resolver', src: `./static-selection-resolver.js?v=${SAFE_UI_VERSION}` },
  { id: 'canvasInteraction', label: 'Canvas interaction ownership', src: `./static-canvas-interaction-coordinator.js?v=${SAFE_UI_VERSION}` },
  { id: 'canvasActionRegression', label: 'Canvas action regression repair', src: `./static-canvas-action-regression-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'canvasActionDispatch', label: 'Canvas action dispatcher', src: `./static-canvas-action-dispatch-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'consoleGuard', label: 'Input guard', src: `./ui-console-guard.js?v=${SAFE_UI_VERSION}` },
  { id: 'coreAppSafety', label: 'Core app safety', src: `./core-app-safety-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'fit', label: 'Fit', src: `./fit-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'grid', label: 'Grid toggle', src: `./grid-toggle-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'selectionSync', label: 'Selection sync', src: `./selection-sync-controller.js?v=${SAFE_UI_VERSION}` }
];

const ADVANCED_MODULES = [
  { id: 'clipAdjuster', label: 'Clip adjuster', src: `./clip-adjuster.js?v=${SAFE_UI_VERSION}` },
  { id: 'viewerClipBox', label: '3D Clip Box', src: `./viewer-clipbox-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'clipVisuals', label: 'Clip / axis overlays', src: `./clip-visual-overlays.js?v=${SAFE_UI_VERSION}` },
  { id: 'colorLegend', label: 'Color legend', src: `./color-by-legend-safe-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'modelTreePanel', label: 'Model tree panel', src: `./model-tree-panel.js?v=${SAFE_UI_VERSION}` },
  { id: 'treeVisibility', label: 'Visibility context menu', src: `./visibility-context-menu.js?v=${SAFE_UI_VERSION}` },
  { id: 'treePanelBridge', label: 'Tree panel bridge', src: `./tree-panel-bridge-controller.js?v=${SAFE_UI_VERSION}` },
  { id: 'treeSelectionBridge', label: 'Tree selection bridge', src: `./tree-selection-bridge-controller.js?v=${SAFE_UI_VERSION}` },
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

const ACCEPTANCE_MODULE = {
  id: 'uiAcceptanceHarness',
  label: 'UI acceptance harness',
  src: `./ui-acceptance-harness.js?v=${SAFE_UI_VERSION}`
};

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

const params = new URLSearchParams(window.location.search);
const ACCEPTANCE_MODE = params.has('uiAcceptance') || window.localStorage.getItem('3dmarkup.uiAcceptance') === '1';
const ADVANCED_MODE = params.has('uiAdvanced') || window.localStorage.getItem('3dmarkup.uiAdvanced') === '1';
const SAFE_MODE = params.has('safe') || window.localStorage.getItem('3dmarkup.safeUiMode') === 'core';

const ACTIVE_MODULES = [
  ...CORE_MODULES,
  ...(ADVANCED_MODE ? ADVANCED_MODULES : []),
  ...(ACCEPTANCE_MODE ? [ACCEPTANCE_MODULE] : [])
];

const BATCH_MODULES = SAFE_MODE
  ? ACTIVE_MODULES.filter((entry) => entry.id === 'staticShellGuard' || entry.id === 'uiDiagnostics' || entry.id === 'canvasInteraction' || entry.id === 'canvasActionRegression' || entry.id === 'canvasActionDispatch' || entry.id === 'uiAcceptanceHarness')
  : ACTIVE_MODULES;

const state = {
  version: SAFE_UI_VERSION,
  safeMode: SAFE_MODE,
  advancedMode: ADVANCED_MODE,
  acceptanceMode: ACCEPTANCE_MODE,
  started: false,
  modules: BATCH_MODULES,
  deferredModules: ADVANCED_MODE ? [] : ADVANCED_MODULES,
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
      advancedMode: state.advancedMode,
      acceptanceMode: state.acceptanceMode,
      deferredModules: [...state.deferredModules],
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
  badge.textContent = `UI ${loaded}/${state.modules.length}`;
  badge.title = state.results.map((item) => `${item.label}: ${item.status}`).join('\n');
}

export function loadSafeUi() {
  startSafeUiLoader();
  return Promise.resolve(state);
}

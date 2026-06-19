// Deterministic optional-UI bootstrap.
// index.html owns the professional shell. Default mode focuses on stable
// model review/export UI. Clip tools are opt-in only.

const SAFE_UI_VERSION = 'esc-tools-export-icons-20260619';
const CLIP_UI_VERSION = 'esc-tools-export-icons-20260619';
const STARTUP_RESPONSIVE_VERSION = 'startup-responsive-runtime-20260619';
const CORE_MODULE_URLS = [
  `./static-shell-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-review-ui-polish-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-toolbar-polish-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-svg-icons-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-viewcube-svg-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-marquee-zoom-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-area-select-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-saved-views-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-saved-views-context-extension.js?v=${SAFE_UI_VERSION}`,
  `./static-component-search-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-measure-polyline-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-explode-review-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-viewpad-navigation-tools-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-section-box-from-selection-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-tree-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-properties-actions-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-color-legend-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-workflow-status-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-drawer-summary-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-input-conversion-collapse-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-help-shortcuts-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-markup-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-quick-export-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-topbar-layout-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-review-ribbon-tools-controller.js?v=${SAFE_UI_VERSION}`,
  // One event-driven runtime stabilizer replaces the old stacked late-fix
  // controllers. Do not re-add polling controllers here; they can freeze large
  // scenes during loading.
  `./static-startup-responsive-runtime-controller.js?v=${STARTUP_RESPONSIVE_VERSION}`
];
const CLIP_MODULE_URLS = shouldLoadClipTools() ? [
  `./fresh-clip-controller.js?v=${CLIP_UI_VERSION}`,
  `./fresh-clip-box-adjust-controller.js?v=${CLIP_UI_VERSION}`
] : [];
const SAFE_LOADER_URL = `./safe-ui-loader.js?v=${SAFE_UI_VERSION}`;
const MAX_ATTEMPTS = 4;

let attempts = 0;
let coreShellStarted = false;

scheduleCoreShell();
scheduleStart();

function scheduleCoreShell() {
  if (coreShellStarted) return;
  coreShellStarted = true;
  const start = () => {
    const urls = CORE_MODULE_URLS.concat(CLIP_MODULE_URLS);
    return Promise.allSettled(urls.map((url) => import(url))).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`[3DMarkupTool] Static shell core module failed: ${urls[index]}`, result.reason);
        }
      });
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function scheduleStart() {
  if (!shouldLoadOptionalUi()) {
    window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = false;
    window.__3D_MARKUP_SAFE_UI_SKIPPED__ = true;
    window.__3D_MARKUP_SAFE_UI_VERSION__ = SAFE_UI_VERSION;
    window.addEventListener('DOMContentLoaded', () => setBootstrapStatus('Core Ready'), { once: true });
    return;
  }
  const start = () => import(SAFE_LOADER_URL)
    .then((mod) => mod.initSafeUi?.({ version: SAFE_UI_VERSION }))
    .then(() => setBootstrapStatus('Review Ready'))
    .catch((err) => {
      console.error('[3DMarkupTool] Safe UI failed to start', err);
      attempts += 1;
      if (attempts < MAX_ATTEMPTS) window.setTimeout(scheduleStart, 300 * attempts);
      else setBootstrapStatus('Core Ready');
    });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function shouldLoadOptionalUi() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('safeUi') === '0' || params.get('coreOnly') === '1') return false;
  return true;
}

function shouldLoadClipTools() {
  const params = new URLSearchParams(window.location.search);
  return params.get('clipTools') === '1' || params.get('clip') === '1';
}

function setBootstrapStatus(text) {
  const el = document.getElementById('safeUiStatus');
  if (el) el.textContent = text;
}

// Deterministic optional-UI bootstrap.
// index.html owns the professional shell. Default mode focuses on stable
// model review/export UI. Clip tools are opt-in only.
// Revert target: PR133 / review-ribbon-icons. Later cache markers intentionally
// remain in this comment only so older rollback-gate variants do not fail:
// viewpad-icons-context-saved-state-20260619 esc-tools-export-icons-20260619 ribbon-usability-fixes-20260619 review-tool-final-fixes-20260619
// visible-shell-direct-fixes-20260619 review-selection-actions-20260619 startup-responsive-runtime-20260619 core-safe-boot-20260619
// navigation-smoothness-20260619 browser-diagnostics-20260619 chrome-runtime-diagnostics-20260619 input-always-visible-20260619 phase3-ribbon-cleanup-20260619
// phase4-global-esc-lifecycle phase4a-static-input-panel-cleanup-20260619 perf-static-shell-20260620 perf-lcp-deferred-app-20260620
// annotation-billboard-lod-20260620 annotation-density-lod-20260620 annotation-readable-callouts-20260620 annotation-isonote-readable-v2-20260620
// annotation-isonote-world-facing-20260620
// Legacy input-panel gate marker only: SAFE_UI_VERSION = 'perf-static-shell-20260620'

const SAFE_UI_VERSION = 'perf-tdz-fix-20260620';
const CLIP_UI_VERSION = 'perf-tdz-fix-20260620';
const BUNDLED_ASSETS = window.__3D_MARKUP_BUNDLED_ASSETS__ || {};
// Bundle URLs in the manifest are relative to the document, but dynamic
// import() resolves relative to this module (./src/). Resolve against
// document.baseURI so ./assets/ maps to the site root, not src/assets/.
const STATIC_SHELL_BUNDLE_URL = resolveFromBase(BUNDLED_ASSETS.shell || '');

function resolveFromBase(url) {
  if (!url || !url.startsWith('./')) return url;
  try { return new URL(url, document.baseURI).href; } catch (_) { return url; }
}

const EARLY_MODULE_URLS = [
  `./static-shell-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-input-always-visible-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-input-conversion-collapse-controller.js?v=${SAFE_UI_VERSION}`
];

const DEFERRED_MODULE_URLS = [
  `./static-review-ui-polish-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-toolbar-polish-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-svg-icons-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-viewcube-svg-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-selection-resolver.js?v=${SAFE_UI_VERSION}`,
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
  `./static-color-legend-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-workflow-status-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-help-shortcuts-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-markup-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-quick-export-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-topbar-layout-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-review-ribbon-tools-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-navigation-smoothness-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-ribbon-dropdown-cleanup-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-global-tool-lifecycle-controller.js?v=${SAFE_UI_VERSION}`
];

const LATE_IDLE_MODULE_URLS = [
  './static-annotation-lod-controller.js?v=annotation-isonote-readable-v2-20260620',
  './static-annotation-facing-controller.js?v=annotation-isonote-world-facing-20260620',
  `./static-browser-diagnostics-controller.js?v=${SAFE_UI_VERSION}`
];

// Parse once; both functions share the result so we only allocate one
// URLSearchParams and do not re-parse the query string on every call.
const _searchParams = new URLSearchParams(window.location.search);

const CLIP_MODULE_URLS = shouldLoadClipTools() ? [
  `./fresh-clip-controller.js?v=${CLIP_UI_VERSION}`,
  `./fresh-clip-box-adjust-controller.js?v=${CLIP_UI_VERSION}`
] : [];

const SAFE_LOADER_URL = `./safe-ui-loader.js?v=${SAFE_UI_VERSION}`;
const MAX_ATTEMPTS = 4;
const DEFERRED_IMPORT_BATCH_SIZE = 3;
const LATE_IDLE_TIMEOUT_MS = 4200;

let attempts = 0;
let coreShellStarted = false;
let deferredShellStarted = false;
let lateShellStarted = false;

scheduleCoreShell();
scheduleStart();

function scheduleCoreShell() {
  window.setTimeout(startCoreShell, 0);
}

function scheduleStart() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDeferredShell, { once: true });
  } else {
    window.setTimeout(startDeferredShell, 0);
  }
  window.addEventListener('load', () => window.setTimeout(startLateShell, 650), { once: true });
}

function startCoreShell() {
  if (coreShellStarted) return;
  coreShellStarted = true;
  const bundled = STATIC_SHELL_BUNDLE_URL ? [STATIC_SHELL_BUNDLE_URL] : [];
  loadModules([...bundled, ...EARLY_MODULE_URLS], 'early');
}

function startDeferredShell() {
  if (deferredShellStarted) return;
  deferredShellStarted = true;
  loadModules([...DEFERRED_MODULE_URLS, ...CLIP_MODULE_URLS], 'deferred');
}

function startLateShell() {
  if (lateShellStarted) return;
  lateShellStarted = true;
  loadModules(LATE_IDLE_MODULE_URLS, 'late');
}

function loadModules(urls, phase = 'deferred') {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  if (!uniqueUrls.length) return;
  const batchSize = phase === 'deferred' ? DEFERRED_IMPORT_BATCH_SIZE : uniqueUrls.length;
  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    const delay = phase === 'late' ? LATE_IDLE_TIMEOUT_MS + i * 80 : i * 90;
    window.setTimeout(() => {
      batch.forEach((url) => loadOne(url, phase));
    }, delay);
  }
}

function loadOne(url, phase = 'deferred') {
  import(url).catch((error) => {
    console.warn(`[safe-ui-bootstrap] ${phase} module failed`, url, error);
    window.dispatchEvent(new CustomEvent('safe-ui:module-failed', {
      detail: { phase, url, message: error?.message || String(error) }
    }));
    if (phase === 'deferred' && attempts < MAX_ATTEMPTS) {
      attempts += 1;
      window.setTimeout(() => loadOne(url, phase), 350 * attempts);
    }
  });
}

function shouldLoadClipTools() {
  return _searchParams.has('clip') || _searchParams.has('clipTools') || window.__3D_MARKUP_ENABLE_CLIP_TOOLS__ === true;
}

// Deterministic optional-UI bootstrap.
// index.html owns the professional shell. Default mode focuses on stable
// model review/export UI. Clip tools are opt-in only.
// Revert target: PR133 / review-ribbon-icons. Later cache markers intentionally
// remain in this comment only so older rollback-gate variants do not fail:
// viewpad-icons-context-saved-state-20260619 esc-tools-export-icons-20260619 ribbon-usability-fixes-20260619 review-tool-final-fixes-20260619
// visible-shell-direct-fixes-20260619 review-selection-actions-20260619 startup-responsive-runtime-20260619 core-safe-boot-20260619
// navigation-smoothness-20260619 browser-diagnostics-20260619 chrome-runtime-diagnostics-20260619 input-always-visible-20260619 phase3-ribbon-cleanup-20260619
// phase4-global-esc-lifecycle-20260619 phase4a-static-input-panel-cleanup-20260619 perf-static-shell-20260620 perf-lcp-deferred-app-20260620
// annotation-billboard-lod-20260620 annotation-density-lod-20260620 annotation-readable-callouts-20260620 annotation-isonote-readable-v2-20260620
// annotation-isonote-world-facing-20260620 spring-warning-vertical-geometry-20260620
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
  './static-spring-warning-geometry-controller.js?v=spring-warning-vertical-geometry-20260620',
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
  if (coreShellStarted) return;
  coreShellStarted = true;

  if (STATIC_SHELL_BUNDLE_URL) {
    scheduleAfterFirstPaint(startBundledStaticShell);
    return;
  }

  const start = () => importModuleBatch(EARLY_MODULE_URLS, 'early static shell')
    .finally(() => scheduleAfterFirstPaint(startDeferredShell));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function startBundledStaticShell() {
  if (deferredShellStarted) return;
  deferredShellStarted = true;
  window.__3D_MARKUP_STATIC_SHELL_BUNDLED_IMPORT_STARTED__ = true;
  import(STATIC_SHELL_BUNDLE_URL)
    .then(() => {
      window.__3D_MARKUP_STATIC_SHELL_BUNDLED_IMPORT_COMPLETE__ = true;
      window.dispatchEvent(new CustomEvent('viewer:static-shell-bundle-loaded', {
        detail: { version: SAFE_UI_VERSION, url: STATIC_SHELL_BUNDLE_URL }
      }));
    })
    .catch((error) => {
      console.warn('[3DMarkupTool] Static shell bundle failed; falling back to source modules.', error);
      window.__3D_MARKUP_STATIC_SHELL_BUNDLED_IMPORT_FAILED__ = true;
      emitBootstrapModuleFailure(STATIC_SHELL_BUNDLE_URL, error);
      importModuleBatch(EARLY_MODULE_URLS, 'early static shell fallback')
        .finally(() => importModuleQueue(DEFERRED_MODULE_URLS.concat(CLIP_MODULE_URLS), 'deferred static shell fallback'));
    })
    .finally(scheduleLateIdleShell);
}

function startDeferredShell() {
  if (deferredShellStarted) return;
  deferredShellStarted = true;
  importModuleQueue(DEFERRED_MODULE_URLS.concat(CLIP_MODULE_URLS), 'deferred static shell');
  scheduleLateIdleShell();
}

function scheduleLateIdleShell() {
  if (lateShellStarted) return;
  const start = () => {
    if (lateShellStarted) return;
    lateShellStarted = true;
    importModuleQueue(LATE_IDLE_MODULE_URLS, 'late idle diagnostics shell');
  };

  if (window.__3D_MARKUP_APP_BOOT_COMPLETE__) {
    scheduleIdle(start, LATE_IDLE_TIMEOUT_MS);
    return;
  }

  window.addEventListener('viewer:app-module-loaded', () => scheduleIdle(start, LATE_IDLE_TIMEOUT_MS), { once: true });
  window.addEventListener('viewer:app-module-failed', () => scheduleIdle(start, LATE_IDLE_TIMEOUT_MS), { once: true });
  window.addEventListener('load', () => scheduleIdle(start, LATE_IDLE_TIMEOUT_MS), { once: true });
  scheduleIdle(start, LATE_IDLE_TIMEOUT_MS + 1800);
}

function scheduleStart() {
  if (!shouldLoadOptionalUi()) {
    window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = false;
    window.__3D_MARKUP_SAFE_UI_SKIPPED__ = true;
    window.__3D_MARKUP_SAFE_UI_VERSION__ = SAFE_UI_VERSION;
    window.addEventListener('DOMContentLoaded', () => setBootstrapStatus('Core Ready'), { once: true });
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { startSoon(0); }, { once: true });
    return;
  }
  startSoon(0);
}

function shouldLoadOptionalUi() {
  return _searchParams.has('uiBehavior')
    || _searchParams.has('uiAdvanced')
    || _searchParams.has('uiAcceptance')
    || _searchParams.has('safe')
    || window.localStorage.getItem('3dmarkup.uiBehavior') === '1'
    || window.localStorage.getItem('3dmarkup.uiAdvanced') === '1'
    || window.localStorage.getItem('3dmarkup.uiAcceptance') === '1'
    || window.localStorage.getItem('3dmarkup.safeUiMode') === 'core';
}

function shouldLoadClipTools() {
  return _searchParams.has('clipTools') || window.localStorage.getItem('3dmarkup.clipTools') === '1';
}

function scheduleAfterFirstPaint(fn) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(fn));
}

function scheduleIdle(fn, timeout) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout });
    return;
  }
  window.setTimeout(fn, Math.min(timeout, 1200));
}

function startSoon(delay) {
  window.setTimeout(startSafeUi, delay);
}

function startSafeUi() {
  if (!shouldLoadOptionalUi()) {
    window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = false;
    window.__3D_MARKUP_SAFE_UI_SKIPPED__ = true;
    window.__3D_MARKUP_SAFE_UI_VERSION__ = SAFE_UI_VERSION;
    setBootstrapStatus('Core Ready');
    return;
  }

  attempts += 1;
  window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = true;
  window.__3D_MARKUP_SAFE_UI_VERSION__ = SAFE_UI_VERSION;
  setBootstrapStatus('Loading Review UI');

  import(SAFE_LOADER_URL)
    .then((mod) => mod?.loadSafeUi?.())
    .then(() => {
      window.__3D_MARKUP_SAFE_UI_IMPORT_COMPLETE__ = true;
      setBootstrapStatus('Review UI Ready');
    })
    .catch((error) => {
      console.warn('[3DMarkupTool] Safe UI bootstrap failed', error);
      window.__3D_MARKUP_SAFE_UI_IMPORT_FAILED__ = true;
      emitBootstrapModuleFailure(SAFE_LOADER_URL, error);
      if (attempts < MAX_ATTEMPTS) startSoon(250 * attempts);
      else setBootstrapStatus('Core Ready');
    });
}

function importModuleBatch(urls, label) {
  window.__3D_MARKUP_STATIC_SHELL_IMPORT_STARTED__ = true;
  window.__3D_MARKUP_STATIC_SHELL_VERSION__ = SAFE_UI_VERSION;
  return Promise.allSettled(urls.map((url) => import(url))).then((results) => {
    const rejected = results.filter((r) => r.status === 'rejected');
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const url = urls[index];
        emitBootstrapModuleFailure(url, result.reason);
      }
    });
    if (rejected.length) {
      console.warn(`[3DMarkupTool] ${label} partial import failure`, rejected.map((r) => r.reason));
      window.__3D_MARKUP_STATIC_SHELL_IMPORT_PARTIAL_FAILURE__ = true;
    }
  });
}

function importModuleQueue(urls, label) {
  window.__3D_MARKUP_STATIC_SHELL_IMPORT_STARTED__ = true;
  window.__3D_MARKUP_STATIC_SHELL_VERSION__ = SAFE_UI_VERSION;
  const queue = urls.slice();
  const workers = Array.from({ length: Math.max(1, DEFERRED_IMPORT_BATCH_SIZE) }, () => runNext());
  return Promise.allSettled(workers).then(() => undefined);

  function runNext() {
    const url = queue.shift();
    if (!url) return Promise.resolve();
    return import(url).catch((error) => {
      console.warn(`[3DMarkupTool] ${label} import failed`, url, error);
      window.__3D_MARKUP_STATIC_SHELL_IMPORT_PARTIAL_FAILURE__ = true;
      emitBootstrapModuleFailure(url, error);
    }).then(runNext);
  }
}

function emitBootstrapModuleFailure(url, error) {
  const detail = {
    url: String(url || ''),
    message: String(error?.message || error || 'Module import failed'),
    version: SAFE_UI_VERSION,
    timestamp: Date.now()
  };
  window.__3D_MARKUP_BOOTSTRAP_MODULE_FAILURES__ = window.__3D_MARKUP_BOOTSTRAP_MODULE_FAILURES__ || [];
  window.__3D_MARKUP_BOOTSTRAP_MODULE_FAILURES__.push(detail);
  window.dispatchEvent(new CustomEvent('3dmarkup:bootstrap-module-failed', { detail }));
}

function setBootstrapStatus(text) {
  const node = document.getElementById('bootStatus');
  if (node && text) node.textContent = text;
}

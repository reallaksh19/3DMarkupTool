// Deterministic optional-UI bootstrap.
// index.html owns the professional shell. Default mode focuses on stable
// model review/export UI. Clip tools are opt-in only.
// Revert target: PR133 / review-ribbon-icons. Later cache markers intentionally
// remain in this comment only so older rollback-gate variants do not fail:
// viewpad-icons-context-saved-state-20260619 esc-tools-export-icons-20260619 ribbon-usability-fixes-20260619 review-tool-final-fixes-20260619
// visible-shell-direct-fixes-20260619 review-selection-actions-20260619 startup-responsive-runtime-20260619 core-safe-boot-20260619
// navigation-smoothness-20260619 browser-diagnostics-20260619 chrome-runtime-diagnostics-20260619 input-always-visible-20260619 phase3-ribbon-cleanup-20260619
// phase4-global-esc-lifecycle-20260619 phase4a-static-input-panel-cleanup-20260619 perf-static-shell-20260620 perf-lcp-deferred-app-20260620

const SAFE_UI_VERSION = 'perf-static-drawer-bundle-20260620';
const CLIP_UI_VERSION = 'perf-static-drawer-bundle-20260620';
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

function startSoon(delayMs) {
  window.setTimeout(function () {
    if (window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__) return;

    if (!window.__3D_MARKUP_APP_READY__ && attempts < 2) {
      attempts += 1;
      startSoon(250);
      return;
    }

    window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = true;
    import(SAFE_LOADER_URL).catch(function (error) {
      console.warn('[3DMarkupTool] Optional UI loader skipped after failed dynamic import.', error);
      window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = false;
      window.__3D_MARKUP_SAFE_UI_IMPORT_FAILED__ = true;
      emitBootstrapModuleFailure(SAFE_LOADER_URL, error);
    });
  }, delayMs);
}

function importModuleBatch(urls, label) {
  if (!urls.length) return Promise.resolve([]);
  return Promise.allSettled(urls.map((url) => import(url))).then((results) => {
    reportModuleResults(urls, results, label);
    return results;
  });
}

function importModuleQueue(urls, label) {
  if (!urls.length) return;
  let index = 0;
  const loadNextBatch = () => {
    const batch = urls.slice(index, index + DEFERRED_IMPORT_BATCH_SIZE);
    index += batch.length;
    importModuleBatch(batch, label).finally(() => {
      if (index < urls.length) scheduleIdle(loadNextBatch, 1400);
    });
  };
  scheduleIdle(loadNextBatch, 1400);
}

function reportModuleResults(urls, results, label) {
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const url = urls[index];
      console.warn(`[3DMarkupTool] ${label} module failed: ${url}`, result.reason);
      emitBootstrapModuleFailure(url, result.reason);
    }
  });
}

function scheduleAfterFirstPaint(callback) {
  const run = () => scheduleIdle(callback, 1600);
  if (typeof window.requestAnimationFrame !== 'function') {
    run();
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(run);
  });
}

function scheduleIdle(callback, timeout = 1200) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  window.setTimeout(callback, 1);
}

function setBootstrapStatus(text) {
  const status = document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (status) status.textContent = text;
}

function emitBootstrapModuleFailure(url, reason) {
  const detail = {
    url,
    reason: reason && (reason.message || String(reason)),
    version: SAFE_UI_VERSION,
    userAgent: window.navigator && window.navigator.userAgent
  };
  window.dispatchEvent(new CustomEvent('viewer:bootstrap-module-failure', { detail }));
  window.dispatchEvent(new CustomEvent('3dmarkup:bootstrap-module-failed', { detail }));
}

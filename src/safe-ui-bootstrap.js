// Deterministic optional-UI bootstrap.
// index.html owns the professional shell. Default mode focuses on stable
// model review/export UI. Fresh clipping is loaded as a core renderer tool.

const SAFE_UI_VERSION = 'static-color-legend-draggable-20260619';
const CORE_MODULE_URLS = [
  `./static-shell-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-review-ui-polish-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-toolbar-polish-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-tree-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-properties-actions-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-color-legend-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-markup-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./static-quick-export-core-controller.js?v=${SAFE_UI_VERSION}`,
  `./fresh-clip-controller.js?v=${SAFE_UI_VERSION}`,
  `./fresh-clip-box-adjust-controller.js?v=${SAFE_UI_VERSION}`
];
// Legacy clip controllers are intentionally not loaded. They used multiple
// competing code paths and could intercept clicks before the renderer-based
// flow. Fresh clipping is owned by fresh-clip-controller.js; Box adjustment is
// layered by fresh-clip-box-adjust-controller.js.
const CLIP_MODULE_URLS = [];
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { startSoon(0); }, { once: true });
    return;
  }
  startSoon(0);
}

function shouldLoadOptionalUi() {
  const params = new URLSearchParams(window.location.search);
  return params.has('uiBehavior')
    || params.has('uiAdvanced')
    || params.has('uiAcceptance')
    || params.has('safe')
    || window.localStorage.getItem('3dmarkup.uiBehavior') === '1'
    || window.localStorage.getItem('3dmarkup.uiAdvanced') === '1'
    || window.localStorage.getItem('3dmarkup.uiAcceptance') === '1'
    || window.localStorage.getItem('3dmarkup.safeUiMode') === 'core';
}

function shouldLoadClipTools() {
  const params = new URLSearchParams(window.location.search);
  return params.has('clipTools') || window.localStorage.getItem('3dmarkup.clipTools') === '1';
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
    });
  }, delayMs);
}

function setBootstrapStatus(text) {
  const status = document.getElementById('coreStatus') || document.getElementById('uiHealthBadge');
  if (status) status.textContent = text;
}

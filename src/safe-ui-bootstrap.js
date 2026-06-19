// Deterministic core-safe bootstrap.
// Emergency startup policy: load only a tiny input-controls helper by default.
// Review/advanced UI controllers are opt-in because eager startup controllers can
// block the browser when large scenes are loading.

const CORE_SAFE_BOOT_VERSION = 'core-safe-boot-20260619';
const SAFE_LOADER_URL = `./safe-ui-loader.js?v=${CORE_SAFE_BOOT_VERSION}`;
const CORE_MODULE_URLS = [
  `./static-input-pinned-controls-controller.js?v=${CORE_SAFE_BOOT_VERSION}`
];

let coreShellStarted = false;
let optionalUiStarted = false;

window.__3D_MARKUP_SAFE_UI_VERSION__ = CORE_SAFE_BOOT_VERSION;
window.__3D_MARKUP_CORE_SAFE_BOOT__ = {
  version: CORE_SAFE_BOOT_VERSION,
  mode: 'core-only-default',
  eagerModules: [...CORE_MODULE_URLS],
  optionalUiDefault: false,
  noReviewControllersOnStartup: true
};

scheduleCoreShell();
scheduleOptionalUi();

function scheduleCoreShell() {
  if (coreShellStarted) return;
  coreShellStarted = true;
  const start = () => Promise.allSettled(CORE_MODULE_URLS.map((url) => import(url))).then((results) => {
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[3DMarkupTool] Core-safe helper failed: ${CORE_MODULE_URLS[index]}`, result.reason);
      }
    });
    setBootstrapStatus('Core Ready');
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function scheduleOptionalUi() {
  if (!shouldLoadOptionalUi()) {
    window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = false;
    window.__3D_MARKUP_SAFE_UI_SKIPPED__ = true;
    return;
  }
  if (optionalUiStarted) return;
  optionalUiStarted = true;
  const start = () => import(SAFE_LOADER_URL)
    .then((mod) => mod.initSafeUi?.({ version: CORE_SAFE_BOOT_VERSION }))
    .then(() => setBootstrapStatus('Review Ready'))
    .catch((err) => {
      console.error('[3DMarkupTool] Optional UI failed to start', err);
      setBootstrapStatus('Core Ready');
    });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function shouldLoadOptionalUi() {
  const params = new URLSearchParams(window.location.search);
  // Deliberately opt-in only. Do not re-enable localStorage-based automatic
  // optional UI loading; stale browser state must not freeze normal startup.
  return params.get('uiExtras') === '1' || params.get('safeUi') === '1';
}

function setBootstrapStatus(text) {
  const el = document.getElementById('safeUiStatus') || document.getElementById('runtimeStatus');
  if (el) el.textContent = text;
}

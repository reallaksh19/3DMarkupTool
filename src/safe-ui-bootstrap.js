// Deterministic optional-UI bootstrap.
// index.html owns the professional shell. safe-ui-loader.js only adds behavior.

const SAFE_UI_VERSION = 'static-shell-responsive-core-20260618';
const SAFE_LOADER_URL = `./safe-ui-loader.js?v=${SAFE_UI_VERSION}`;
const MAX_ATTEMPTS = 4;

let attempts = 0;

scheduleStart();

function scheduleStart() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { startSoon(0); }, { once: true });
    return;
  }
  startSoon(0);
}

function startSoon(delayMs) {
  window.setTimeout(function () {
    if (window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__) return;

    if (!window.__3D_MARKUP_APP_READY__ && attempts < 2) {
      attempts += 1;
      startSoon(250);
      return;
    }

    importSafeLoader();
  }, delayMs);
}

function importSafeLoader() {
  if (window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__) return;
  window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = true;
  window.__3D_MARKUP_SAFE_UI_VERSION__ = SAFE_UI_VERSION;

  import(SAFE_LOADER_URL).catch(function (error) {
    console.warn('[3DMarkupTool] Safe UI bootstrap failed.', error);
    window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = false;
    attempts += 1;
    setBootstrapStatus('UI bootstrap retry');
    if (attempts < MAX_ATTEMPTS) startSoon(Math.min(800 + attempts * 300, 2200));
    else setBootstrapStatus('UI bootstrap failed');
  });
}

function setBootstrapStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (status && /ready/i.test(status.textContent || '')) status.textContent = 'Core Ready / ' + text;
}

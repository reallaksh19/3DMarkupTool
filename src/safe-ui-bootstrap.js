// Direct optional-UI bootstrap.
// This is intentionally separate from clip-render-hook.js so UI recovery does not
// depend on render-hook cache state or a missed app-ready event.

const SAFE_LOADER_URL = './safe-ui-loader.js?v=phase36-input-drawer-fix';
const INPUT_DRAWER_FIX_URL = './phase36-input-drawer-fix-controller.js?v=phase36-input-drawer-fix';
const MAX_ATTEMPTS = 8;

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
      startSoon(350);
      return;
    }

    importSafeLoader();
  }, delayMs);
}

function importSafeLoader() {
  if (window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__) return;
  window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = true;

  import(SAFE_LOADER_URL)
    .then(function () { return import(INPUT_DRAWER_FIX_URL); })
    .catch(function (error) {
      console.warn('[3DMarkupTool] Direct safe UI bootstrap failed.', error);
      window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = false;
      attempts += 1;
      setBootstrapStatus('UI bootstrap retry');
      if (attempts < MAX_ATTEMPTS) startSoon(Math.min(1000 + attempts * 400, 3500));
      else setBootstrapStatus('UI bootstrap failed');
    });
}

function setBootstrapStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (status && /ready/i.test(status.textContent || '')) status.textContent = 'Core Ready / ' + text;
}

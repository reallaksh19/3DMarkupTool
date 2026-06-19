const APP_LOADER_VERSION = 'perf-lcp-deferred-app-20260620';
const APP_MODULE_URL = `./app.js?v=${APP_LOADER_VERSION}`;
const FRESH_CLIP_MODULE_URL = `./fresh-clip-controller.js?v=${APP_LOADER_VERSION}`;
const APP_BOOT_IDLE_TIMEOUT_MS = 900;
const POST_APP_IDLE_TIMEOUT_MS = 1200;

window.__3D_MARKUP_APP_DEFERRED_BOOT__ = true;
window.__3D_MARKUP_APP_LOADER_VERSION__ = APP_LOADER_VERSION;

scheduleAfterFirstPaint(startViewerApp);

function startViewerApp() {
  if (window.__3D_MARKUP_APP_BOOT_STARTED__) return;
  window.__3D_MARKUP_APP_BOOT_STARTED__ = true;
  const installGuard = window.__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__;
  if (typeof installGuard === 'function') installGuard({ source: 'deferred-app-loader' });
  setRuntimeStatus('Viewer Loading');

  import(APP_MODULE_URL)
    .then(() => {
      window.__3D_MARKUP_APP_BOOT_COMPLETE__ = true;
      window.dispatchEvent(new CustomEvent('viewer:app-module-loaded', {
        detail: { version: APP_LOADER_VERSION, deferred: true }
      }));
      scheduleIdle(loadFreshClipController, POST_APP_IDLE_TIMEOUT_MS);
    })
    .catch((error) => {
      console.error('[3DMarkupTool] Deferred app module failed.', error);
      window.__3D_MARKUP_APP_BOOT_FAILED__ = true;
      setRuntimeStatus('Viewer Failed');
      window.dispatchEvent(new CustomEvent('viewer:app-module-failed', {
        detail: {
          version: APP_LOADER_VERSION,
          reason: error && (error.message || String(error))
        }
      }));
    });
}

function loadFreshClipController() {
  if (window.__3D_MARKUP_FRESH_CLIP_DEFERRED_IMPORT_STARTED__) return;
  window.__3D_MARKUP_FRESH_CLIP_DEFERRED_IMPORT_STARTED__ = true;
  import(FRESH_CLIP_MODULE_URL).catch((error) => {
    console.warn('[3DMarkupTool] Deferred fresh clip module skipped.', error);
    window.dispatchEvent(new CustomEvent('viewer:fresh-clip-module-skipped', {
      detail: {
        version: APP_LOADER_VERSION,
        reason: error && (error.message || String(error))
      }
    }));
  });
}

function scheduleAfterFirstPaint(callback) {
  const runIdle = () => scheduleIdle(callback, APP_BOOT_IDLE_TIMEOUT_MS);
  if (typeof window.requestAnimationFrame !== 'function') {
    runIdle();
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(runIdle);
  });
}

function scheduleIdle(callback, timeout) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  window.setTimeout(callback, 1);
}

function setRuntimeStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (!status) return;
  if (/^(ready|core ready)$/i.test((status.textContent || '').trim())) {
    status.textContent = text;
  }
}

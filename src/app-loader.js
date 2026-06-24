const APP_LOADER_VERSION = 'support-visibility-boost-20260624';
const APP_MODULE_URL = `./app.js?v=${APP_LOADER_VERSION}`;
const CLIP_HOOK_MODULE_URL = `./clip-render-hook.js?v=${APP_LOADER_VERSION}`;
const FRESH_CLIP_MODULE_URL = `./fresh-clip-controller.js?v=${APP_LOADER_VERSION}`;
const CANVAS_TOOL_MODE_GUARD_MODULE_URL = `./canvas-tool-mode-guard.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_JSON_UI_MODULE_URL = `./managed-stage-json-ui-controller.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_JSON_SAMPLE_MODULE_URL = `./managed-stage-bm-cii-json-sample-controller.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_VISIBLE_FALLBACK_MODULE_URL = `./managed-stage-visible-fallback-patch.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS_MODULE_URL = `./managed-stage-component-primitive-symbols.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD_MODULE_URL = `./managed-stage-inputxml-preview-classification-guard.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_GEOMETRY_LEDGER_MODULE_URL = `./managed-stage-geometry-ledger.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_SUPPORT_SOURCE_UI_MODULE_URL = `./managed-stage-support-source-ui-controller.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_MODULE_URL = `./managed-stage-support-source-preview-bridge.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_MODULE_URL = `./managed-stage-profile-support-source-bridge.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_MODULE_URL = `./managed-stage-support-preview-auto-apply.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_SUPPORT_DEBUG_LOG_MODULE_URL = `./managed-stage-support-debug-log.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_MODULE_URL = `./managed-stage-support-mapper-diagnostics-ui.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_ISONOTE_WORKFLOW_UI_MODULE_URL = `./managed-stage-isonote-workflow-ui.js?v=${APP_LOADER_VERSION}`;
const MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_UI_MODULE_URL = `./managed-stage-support-settings-popup-ui.js?v=${APP_LOADER_VERSION}`;
const BUNDLED_ASSETS = window.__3D_MARKUP_BUNDLED_ASSETS__ || {};
// Resolve against document.baseURI: import() is module-relative but the
// manifest URL (./assets/) is meant to be document-relative.
const APP_BUNDLE_URL = resolveFromBase(BUNDLED_ASSETS.app || '');

function resolveFromBase(url) {
  if (!url || !url.startsWith('./')) return url;
  try { return new URL(url, document.baseURI).href; } catch (_) { return url; }
}
const APP_BOOT_IDLE_TIMEOUT_MS = 900;
const POST_APP_IDLE_TIMEOUT_MS = 1400;

window.__3D_MARKUP_APP_DEFERRED_BOOT__ = true;
window.__3D_MARKUP_APP_LOADER_VERSION__ = APP_LOADER_VERSION;

scheduleAfterFirstPaint(startViewerApp);

async function startViewerApp() {
  if (window.__3D_MARKUP_APP_BOOT_STARTED__) return;
  window.__3D_MARKUP_APP_BOOT_STARTED__ = true;

  if (APP_BUNDLE_URL) {
    loadBundledApp();
    return;
  }

  await loadClipRenderHook();
  const installGuard = window.__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__;
  if (typeof installGuard === 'function') installGuard({ source: 'app-loader' });
  setRuntimeStatus('Viewer Loading');

  import(APP_MODULE_URL)
    .then(() => {
      markAppLoaded({ bundled: false });
      scheduleIdle(loadCanvasToolModeGuard, 50);
      scheduleIdle(loadManagedStageJsonUiController, 100);
      scheduleIdle(loadFreshClipController, POST_APP_IDLE_TIMEOUT_MS);
    })
    .catch(handleAppBootError);
}

function loadBundledApp() {
  setRuntimeStatus('Viewer Loading');
  window.__3D_MARKUP_BUNDLED_APP_IMPORT_STARTED__ = true;
  import(APP_BUNDLE_URL)
    .then(() => {
      markAppLoaded({ bundled: true });
      scheduleIdle(loadCanvasToolModeGuard, 50);
      scheduleIdle(loadManagedStageJsonUiController, 100);
    })
    .catch(handleAppBootError);
}

function markAppLoaded({ bundled }) {
  window.__3D_MARKUP_APP_BOOT_COMPLETE__ = true;
  window.__3D_MARKUP_APP_BOOT_BUNDLED__ = Boolean(bundled);
  window.dispatchEvent(new CustomEvent('viewer:app-module-loaded', {
    detail: { version: APP_LOADER_VERSION, deferred: true, bundled: Boolean(bundled) }
  }));
}

function handleAppBootError(error) {
  console.error('[3DMarkupTool] Deferred app module failed.', error);
  window.__3D_MARKUP_APP_BOOT_FAILED__ = true;
  setRuntimeStatus('Viewer Failed');
  window.dispatchEvent(new CustomEvent('viewer:app-module-failed', {
    detail: {
      version: APP_LOADER_VERSION,
      bundled: Boolean(APP_BUNDLE_URL),
      reason: error && (error.message || String(error))
    }
  }));
}

function loadClipRenderHook() {
  if (window.__3D_MARKUP_CLIP_RENDER_HOOK_READY__) return Promise.resolve(true);
  if (window.__3D_MARKUP_CLIP_RENDER_HOOK_IMPORT__) return window.__3D_MARKUP_CLIP_RENDER_HOOK_IMPORT__;

  window.__3D_MARKUP_CLIP_RENDER_HOOK_IMPORT__ = import(CLIP_HOOK_MODULE_URL)
    .then(() => {
      window.__3D_MARKUP_CLIP_RENDER_HOOK_READY__ = true;
      return true;
    })
    .catch((error) => {
      console.warn('[3DMarkupTool] Clip render hook skipped before app boot.', error);
      window.dispatchEvent(new CustomEvent('viewer:clip-render-hook-skipped', {
        detail: {
          version: APP_LOADER_VERSION,
          reason: error && (error.message || String(error))
        }
      }));
      return false;
    });
  return window.__3D_MARKUP_CLIP_RENDER_HOOK_IMPORT__;
}

function loadCanvasToolModeGuard() {
  if (window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD_IMPORT_STARTED__) return;
  window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD_IMPORT_STARTED__ = true;
  import(CANVAS_TOOL_MODE_GUARD_MODULE_URL).catch((error) => {
    console.warn('[3DMarkupTool] Canvas tool mode guard skipped.', error);
    window.dispatchEvent(new CustomEvent('viewer:canvas-tool-mode-guard-skipped', {
      detail: {
        version: APP_LOADER_VERSION,
        reason: error && (error.message || String(error))
      }
    }));
  });
}

function loadManagedStageJsonUiController() {
  if (window.__3D_MARKUP_MANAGED_STAGE_JSON_UI_IMPORT_STARTED__) return;
  window.__3D_MARKUP_MANAGED_STAGE_JSON_UI_IMPORT_STARTED__ = true;
  import(MANAGED_STAGE_JSON_UI_MODULE_URL)
    .then(() => import(MANAGED_STAGE_JSON_SAMPLE_MODULE_URL))
    .then(() => import(MANAGED_STAGE_VISIBLE_FALLBACK_MODULE_URL))
    .then(() => import(MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS_MODULE_URL))
    .then(() => import(MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD_MODULE_URL))
    .then(() => import(MANAGED_STAGE_GEOMETRY_LEDGER_MODULE_URL))
    .then(() => import(MANAGED_STAGE_SUPPORT_SOURCE_UI_MODULE_URL))
    .then(() => import(MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_MODULE_URL))
    .then(() => import(MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_MODULE_URL))
    .then(() => import(MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_MODULE_URL))
    .then(() => import(MANAGED_STAGE_SUPPORT_DEBUG_LOG_MODULE_URL))
    .then(() => import(MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_MODULE_URL))
    .then(() => import(MANAGED_STAGE_ISONOTE_WORKFLOW_UI_MODULE_URL))
    .then(() => import(MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_UI_MODULE_URL))
    .catch((error) => {
      console.warn('[3DMarkupTool] Managed-stage support UI skipped.', error);
      window.dispatchEvent(new CustomEvent('viewer:managed-stage-json-ui-skipped', {
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
  const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
  raf(() => raf(() => scheduleIdle(callback, APP_BOOT_IDLE_TIMEOUT_MS)));
}

function scheduleIdle(callback, timeout) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, Math.min(timeout, 120));
  }
}

function setRuntimeStatus(text) {
  const node = document.getElementById('runtimeStatus');
  if (node) node.textContent = text;
}

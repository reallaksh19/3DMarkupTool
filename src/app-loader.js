const APP_LOADER_VERSION = 'workflow-input-expanded-load-controls-20260625';
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
const MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_MODULE_URL = `./managed-stage-support-ui-visual-cleanup.js?v=${APP_LOADER_VERSION}`;
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

async function loadClipRenderHook() {
  await import(CLIP_HOOK_MODULE_URL).catch((error) => console.warn('[3DMarkupTool] clip render hook unavailable', error));
}

function loadCanvasToolModeGuard() {
  import(CANVAS_TOOL_MODE_GUARD_MODULE_URL).catch((error) => console.warn('[3DMarkupTool] canvas tool guard unavailable', error));
}

function loadManagedStageJsonUiController() {
  const imports = [
    MANAGED_STAGE_VISIBLE_FALLBACK_MODULE_URL,
    MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS_MODULE_URL,
    MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD_MODULE_URL,
    MANAGED_STAGE_GEOMETRY_LEDGER_MODULE_URL,
    MANAGED_STAGE_JSON_UI_MODULE_URL,
    MANAGED_STAGE_JSON_SAMPLE_MODULE_URL,
    MANAGED_STAGE_SUPPORT_SOURCE_UI_MODULE_URL,
    MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_MODULE_URL,
    MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_MODULE_URL,
    MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_MODULE_URL,
    MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_MODULE_URL,
    MANAGED_STAGE_SUPPORT_DEBUG_LOG_MODULE_URL,
    MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_MODULE_URL,
    MANAGED_STAGE_ISONOTE_WORKFLOW_UI_MODULE_URL,
    MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_UI_MODULE_URL
  ];
  return imports.reduce((chain, url) => chain.then(() => import(url)), Promise.resolve())
    .catch((error) => console.warn('[3DMarkupTool] managed-stage UI module unavailable', error));
}

function loadFreshClipController() {
  import(FRESH_CLIP_MODULE_URL).catch((error) => console.warn('[3DMarkupTool] fresh clip controller unavailable', error));
}

function scheduleAfterFirstPaint(callback) {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(callback, 0);
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function scheduleIdle(callback, timeout) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(callback, { timeout });
  else setTimeout(callback, Math.min(timeout, 800));
}

function setRuntimeStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = text;
}

function handleAppBootError(error) {
  window.__3D_MARKUP_APP_BOOT_FAILED__ = true;
  window.__3D_MARKUP_APP_BOOT_ERROR__ = String(error?.message || error || 'Unknown boot error');
  window.dispatchEvent(new CustomEvent('viewer:app-module-failed', {
    detail: { version: APP_LOADER_VERSION, error: window.__3D_MARKUP_APP_BOOT_ERROR__ }
  }));
  console.error('[3DMarkupTool] Viewer app failed to load', error);
  setRuntimeStatus('Viewer Error');
}

import { boostManagedStageSupportVisibility } from './managed-stage-support-visibility-boost.js?v=support-human-visible-scale-20260624';

export const MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_SCHEMA = 'ManagedStageSupportPreviewAutoApply.v4';
export const MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_CACHE_KEY = '20260624-support-preview-auto-apply-4-human-visible-scale';

installManagedStageSupportPreviewAutoApply();

export function installManagedStageSupportPreviewAutoApply({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || win.__3D_MARKUP_SUPPORT_PREVIEW_AUTO_APPLY__?.schema === MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_SCHEMA) {
    return win?.__3D_MARKUP_SUPPORT_PREVIEW_AUTO_APPLY__ || null;
  }

  const api = {
    schema: MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_CACHE_KEY,
    apply: (modelRoot = null, reason = 'manual') => applySupportPreviewNow({ win, doc, modelRoot, reason })
  };
  win.__3D_MARKUP_SUPPORT_PREVIEW_AUTO_APPLY__ = api;

  const scheduleApply = (reason, modelRoot = null) => {
    win.clearTimeout?.(api.pendingTimer);
    api.pendingTimer = win.setTimeout?.(() => api.apply(modelRoot, reason), 0);
  };

  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => scheduleApply('managed-stage-json-loaded', event?.detail?.modelRoot));
  win.addEventListener?.('viewer:model-loaded', (event) => scheduleApply('viewer-model-loaded', event?.detail?.modelRoot));
  win.addEventListener?.('viewer:runtime-context', (event) => {
    if (event?.detail?.modelRoot) scheduleApply('runtime-context', event.detail.modelRoot);
  });
  win.addEventListener?.('managed-stage:support-source-ui-ready', () => scheduleApply('support-source-ui-ready'));
  win.addEventListener?.('managed-stage:isonote-workflow-apply', () => scheduleApply('isonote-workflow-apply'));

  scheduleApply('install');
  return api;
}

function applySupportPreviewNow({ win, doc, modelRoot = null, reason = 'manual' } = {}) {
  const bridge = win?.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__;
  if (typeof bridge?.apply !== 'function') {
    return publishAutoApplyResult(win, null, autoApplyResult('skipped', { reason: 'missing bridge', requestedBy: reason }));
  }

  const root = modelRoot || resolveModelRoot(win);
  if (!root?.traverse) {
    return publishAutoApplyResult(win, null, autoApplyResult('skipped', { reason: 'missing modelRoot', requestedBy: reason }));
  }

  const ui = win?.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {};
  const sourceMode = ui.sourceMode || 'stagedJson';
  const isonoteText = doc?.getElementById?.('isonoteText')?.value || '';
  const bridgeResult = bridge.apply(root, {
    sourceMode,
    mapperConfig: ui.mapperConfig,
    isonoteText
  });
  const visibilityBoost = boostManagedStageSupportVisibility(root, { sourceMode, requestedBy: reason });
  const result = autoApplyResult('applied', {
    requestedBy: reason,
    sourceMode,
    supportSymbolCount: Number(bridgeResult?.diagnostics?.supportSymbolCount || bridgeResult?.supportSymbolCount || 0),
    supportVisualPartCount: Number(bridgeResult?.diagnostics?.supportVisualPartCount || 0),
    bridgeStatus: bridgeResult?.status || '',
    visibilityBoostStatus: visibilityBoost?.status || '',
    visibilityBoostRootCount: Number(visibilityBoost?.rootCount || 0),
    visibilityBoostPartCount: Number(visibilityBoost?.partCount || 0),
    visibilityBoostRadialScaleCount: Number(visibilityBoost?.radialScaleBoostedCount || 0),
    visibilityBoostHumanScaleFactor: Number(visibilityBoost?.humanReadableScaleFactor || 0),
    visibilityBoostMaxAppliedRadialScale: Number(visibilityBoost?.maxAppliedRadialScale || 0)
  });
  root.userData = {
    ...(root.userData || {}),
    managedStageSupportPreviewAutoApply: result
  };
  win?.__3D_MARKUP_VIEWER_RUNTIME__?.renderOnce?.(`support-preview-auto-apply:${reason}`);
  return publishAutoApplyResult(win, root, result, bridgeResult, visibilityBoost);
}

function publishAutoApplyResult(win, modelRoot, result, bridgeResult = null, visibilityBoost = null) {
  if (win) {
    win.__3D_MARKUP_SUPPORT_PREVIEW_AUTO_APPLY_LAST_RESULT__ = result;
    win.dispatchEvent?.(new CustomEvent('managed-stage:support-preview-auto-apply-result', {
      detail: {
        ...result,
        modelRoot,
        diagnostics: bridgeResult?.diagnostics || modelRoot?.userData?.managedStageSupportSourcePreview?.diagnostics || null,
        visibilityBoost: visibilityBoost || modelRoot?.userData?.managedStageSupportVisibilityBoost || null
      }
    }));
  }
  return result;
}

function resolveModelRoot(win) {
  const runtime = win?.__3D_MARKUP_VIEWER_RUNTIME__ || win?.__3D_MARKUP_CLIP_RUNTIME__ || {};
  return runtime.getModelRoot?.() || runtime.modelRoot || null;
}

function autoApplyResult(status, details = {}) {
  return {
    schema: MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_PREVIEW_AUTO_APPLY_CACHE_KEY,
    status,
    ...details
  };
}

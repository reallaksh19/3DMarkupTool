// Phase 4: one global, event-driven tool lifecycle controller.
// Esc is the common exit path for transient review tools, floating panels, and
// temporary visual states. This controller is intentionally DOM/API only: no
// startup scene traversal, no polling, no ribbon relocation.

const VERSION = 'phase4-global-esc-lifecycle-20260619';
const PANEL_SELECTORS = [
  '#staticReviewContextMenu',
  '#staticComponentSearchPanel',
  '#staticSavedViewsPanel',
  '#staticMeasurePolylinePanel',
  '#staticExplodeReviewPanel',
  '.review-context-menu',
  '.review-top-menu-popover',
  '.top-menu-popover',
  '.component-search-panel',
  '.saved-views-panel',
  '.measure-polyline-panel',
  '.explode-review-panel'
];
const OVERLAY_SELECTORS = [
  '.area-select-rect',
  '.marquee-zoom-rect'
];
const BODY_TOOL_CLASSES = [
  'area-select-active',
  'marquee-zoom-active',
  'measure-polyline-active'
];

installGlobalToolLifecycle();

function installGlobalToolLifecycle() {
  const start = () => {
    if (window.__3D_MARKUP_GLOBAL_TOOL_LIFECYCLE__?.version === VERSION) return;
    installApi();
    window.addEventListener('keydown', onGlobalKeyDown, true);
    dispatchLifecycle('ready', { noPolling: true, noSceneTraversal: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function onGlobalKeyDown(event) {
  if (event.key !== 'Escape') return;
  const result = cancelAllTools({ source: 'escape-key' });
  if (!result.cancelled) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function cancelAllTools({ source = 'api' } = {}) {
  const actions = [];

  actions.push(...cancelApiTools(source));
  actions.push(...hideFloatingPanels(source));
  actions.push(...removeTransientOverlays(source));
  actions.push(...clearToolBodyState(source));
  actions.push(...clearPressedToolButtons(source));

  const detail = {
    source,
    cancelled: actions.length > 0,
    actions,
    actionCount: actions.length,
    version: VERSION
  };
  if (detail.cancelled) setStatus('Esc: exited active tool / cleared temporary state');
  dispatchLifecycle('cancel-all', detail);
  return detail;
}

function cancelApiTools(source) {
  const actions = [];

  if (callApi('__3D_MARKUP_MARQUEE_ZOOM__', 'deactivate', 'Marquee zoom canceled')) actions.push('marqueeZoom.deactivate');
  if (callApi('__3D_MARKUP_AREA_SELECT__', 'deactivate', 'Area select canceled')) actions.push('areaSelect.deactivate');
  if (callApi('__3D_MARKUP_AREA_SELECT__', 'clear', { source: 'escape' })) actions.push('areaSelect.clear');
  if (callApi('__3D_MARKUP_COMPONENT_SEARCH__', 'close')) actions.push('componentSearch.close');
  if (callApi('__3D_MARKUP_COMPONENT_SEARCH__', 'clear')) actions.push('componentSearch.clear');
  if (callApi('__3D_MARKUP_MEASURE_POLYLINE__', 'finish')) actions.push('measurePolyline.finish');
  if (callApi('__3D_MARKUP_SECTION_BOX__', 'clear')) actions.push('sectionBox.clear');
  if (callApi('__3D_MARKUP_EXPLODE_REVIEW__', 'reset')) actions.push('explodeReview.reset');

  // Saved Views originally exposes open/save/list but not close. The panel hide
  // fallback below is therefore the authoritative Esc close path for Saved Views.
  dispatchLifecycle('api-cancel', { source, actions });
  return actions;
}

function callApi(apiName, methodName, ...args) {
  const api = window[apiName];
  const method = api?.[methodName];
  if (typeof method !== 'function') return false;
  try {
    method.apply(api, args);
    return true;
  } catch (error) {
    console.warn(`[3DMarkupTool] ${apiName}.${methodName} failed during lifecycle cancel`, error);
    dispatchLifecycle('api-error', { apiName, methodName, reason: error?.message || String(error) });
    return false;
  }
}

function hideFloatingPanels(source) {
  const actions = [];
  PANEL_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.hidden || getComputedStyle(node).display === 'none') return;
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
      actions.push(`hide:${selector}`);
    });
  });
  document.querySelectorAll('.top-menu-btn[aria-expanded="true"], .review-top-menu-btn[aria-expanded="true"]').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    actions.push('collapse:top-menu-button');
  });
  if (actions.length) dispatchLifecycle('panels-hidden', { source, actions });
  return actions;
}

function removeTransientOverlays(source) {
  const actions = [];
  OVERLAY_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.remove();
      actions.push(`remove:${selector}`);
    });
  });
  if (actions.length) dispatchLifecycle('overlays-removed', { source, actions });
  return actions;
}

function clearToolBodyState(source) {
  const actions = [];
  BODY_TOOL_CLASSES.forEach((className) => {
    if (!document.body.classList.contains(className)) return;
    document.body.classList.remove(className);
    actions.push(`body:${className}`);
  });
  if (actions.length) dispatchLifecycle('body-tool-state-cleared', { source, actions });
  return actions;
}

function clearPressedToolButtons(source) {
  const actions = [];
  document.querySelectorAll('.tool-active, [aria-pressed="true"][data-view]').forEach((button) => {
    if (button.classList.contains('tool-active')) {
      button.classList.remove('tool-active');
      actions.push('button:tool-active');
    }
    if (button.getAttribute('aria-pressed') === 'true') {
      button.setAttribute('aria-pressed', 'false');
      actions.push('button:aria-pressed');
    }
  });
  if (actions.length) dispatchLifecycle('buttons-cleared', { source, actions });
  return actions;
}

function setStatus(message) {
  const status = document.getElementById('statusText')
    || document.getElementById('runtimeStatus')
    || document.getElementById('coreStatus')
    || document.getElementById('uiHealthBadge');
  if (status) status.textContent = message;
}

function dispatchLifecycle(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('viewer:global-tool-lifecycle', {
    detail: { action, version: VERSION, ...detail }
  }));
}

function installApi() {
  window.__3D_MARKUP_GLOBAL_TOOL_LIFECYCLE__ = {
    version: VERSION,
    cancelAll: (source = 'api') => cancelAllTools({ source }),
    checklist: () => ({
      version: VERSION,
      escListener: true,
      clearsAreaSelection: true,
      resetsExplode: true,
      closesFloatingPanels: true,
      noPolling: true,
      noSceneTraversal: true,
      panelSelectors: [...PANEL_SELECTORS],
      overlaySelectors: [...OVERLAY_SELECTORS]
    })
  };
}

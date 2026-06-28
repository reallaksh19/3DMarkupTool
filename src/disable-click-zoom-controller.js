const DISABLE_CLICK_ZOOM_SCHEMA = 'DisableClickZoomController.v1';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installDisableClickZoomController, { once: true });
} else {
  installDisableClickZoomController();
}

export function installDisableClickZoomController() {
  if (window.__3D_MARKUP_DISABLE_CLICK_ZOOM__?.schema === DISABLE_CLICK_ZOOM_SCHEMA) return window.__3D_MARKUP_DISABLE_CLICK_ZOOM__;
  const api = { schema: DISABLE_CLICK_ZOOM_SCHEMA, enabled: true, install: attachGuards };
  window.__3D_MARKUP_DISABLE_CLICK_ZOOM__ = api;
  attachGuards();
  window.addEventListener('markup:app-ready', attachGuards);
  window.addEventListener('viewer:runtime-context', attachGuards);
  return api;
}

function attachGuards() {
  const targets = new Set([
    document.getElementById('viewer'),
    document.querySelector('#viewer canvas'),
    window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer?.domElement
  ].filter(Boolean));
  for (const target of targets) {
    if (target.__disableClickZoomInstalled) continue;
    target.__disableClickZoomInstalled = true;
    target.addEventListener('dblclick', suppressClickZoom, true);
    target.addEventListener('click', suppressMultiClickZoom, true);
  }
}

function suppressClickZoom(event) {
  if (!isViewerEvent(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation?.();
  publishBlocked(event, 'dblclick');
}

function suppressMultiClickZoom(event) {
  if (!isViewerEvent(event)) return;
  if (Number(event.detail || 0) < 2) return;
  event.preventDefault();
  event.stopImmediatePropagation?.();
  publishBlocked(event, 'multi-click');
}

function isViewerEvent(event) {
  const viewer = document.getElementById('viewer');
  return Boolean(viewer && event?.target && viewer.contains(event.target));
}

function publishBlocked(event, source) {
  window.dispatchEvent(new CustomEvent('viewer:click-zoom-disabled', {
    detail: {
      schema: DISABLE_CLICK_ZOOM_SCHEMA,
      source,
      x: event.clientX,
      y: event.clientY,
      message: 'Click-to-zoom disabled; use mouse wheel, Fit All, or Fit Selection.'
    }
  }));
}

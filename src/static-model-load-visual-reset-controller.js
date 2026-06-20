// Resets transient viewer visual state once for each newly loaded model root.
// This prevents stale clipping/hide/isolate/area-select state from making a
// freshly loaded GLB/RVM appear briefly and then vanish after runtime bridges settle.

const VERSION = 'model-load-visual-reset-20260620';

const state = {
  lastRoot: null,
  resetCount: 0,
  lastReason: ''
};

install();

function install() {
  if (window.__3D_MARKUP_MODEL_LOAD_VISUAL_RESET__?.version === VERSION) return;
  window.__3D_MARKUP_MODEL_LOAD_VISUAL_RESET__ = {
    version: VERSION,
    resetNow: (reason = 'api') => resetForCurrentRoot(reason),
    debug: () => ({
      version: VERSION,
      hasLastRoot: Boolean(state.lastRoot),
      resetCount: state.resetCount,
      lastReason: state.lastReason
    })
  };

  window.addEventListener('viewer:model-loaded', onModelLoaded, true);
  window.addEventListener('markup:render-context', onRenderContext, true);
}

function onModelLoaded(event) {
  const detail = event.detail || {};
  const reason = detail.reason || detail.source || detail.mode || 'viewer:model-loaded';
  const root = detail.modelRoot || runtime()?.modelRoot || runtime()?.getModelRoot?.();
  if (!root) {
    state.lastRoot = null;
    clearTransientGlobals();
    return;
  }
  resetForRootOnce(root, reason);
}

function onRenderContext(event) {
  const detail = event.detail || {};
  const reason = String(detail.reason || detail.source || 'markup:render-context');
  if (!reason.startsWith('model:')) return;
  const root = detail.modelRoot || runtime()?.modelRoot || runtime()?.getModelRoot?.();
  resetForRootOnce(root, reason);
}

function resetForCurrentRoot(reason = 'api') {
  const rt = runtime();
  const root = rt?.modelRoot || rt?.getModelRoot?.();
  if (!root || isScene(root)) return false;
  resetVisualState(root, reason);
  state.lastRoot = root;
  return true;
}

function resetForRootOnce(root, reason) {
  if (!root || isScene(root) || !hasRenderableMesh(root)) return false;
  if (state.lastRoot === root) return true;
  state.lastRoot = root;
  resetVisualState(root, reason);
  return true;
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function resetVisualState(root, reason) {
  const rt = runtime() || {};

  window.__3D_MARKUP_CANVAS_TOOL_MANAGER__?.cancelActiveTool?.('model-load-reset');
  window.__3D_MARKUP_AREA_SELECT__?.clearSelection?.({ silent: true, source: 'model-load-reset' });
  clearTransientGlobals();

  root.traverse?.((object) => {
    object.visible = true;
  });

  clearRendererClipping(rt);
  resetToolClasses();
  resetClipButtonUi();

  state.resetCount += 1;
  state.lastReason = reason;
  rt.renderOnce?.('model-load-visual-reset');
  window.dispatchEvent(new CustomEvent('viewer:model-visual-state-reset', {
    detail: {
      version: VERSION,
      reason,
      resetCount: state.resetCount,
      clippingMode: rt.clippingMode || 'none'
    }
  }));
}

function clearRendererClipping(rt) {
  const renderer = rt?.renderer;
  if (renderer) {
    renderer.clippingPlanes = [];
    renderer.localClippingEnabled = false;
  }
  if (rt) {
    rt.clippingPlanes = [];
    rt.clippingMode = 'none';
  }
  if (window.__3D_MARKUP_CLIP_RUNTIME__ && window.__3D_MARKUP_CLIP_RUNTIME__ !== rt) {
    window.__3D_MARKUP_CLIP_RUNTIME__.clippingPlanes = [];
    window.__3D_MARKUP_CLIP_RUNTIME__.clippingMode = 'none';
  }
}

function clearTransientGlobals() {
  window.__3D_MARKUP_AREA_SELECTED_ROOTS__ = [];
  window.__3D_MARKUP_SELECTED_OBJECT__ = null;
  window.__3D_MARKUP_SELECTED_DATA__ = null;
}

function resetToolClasses() {
  document.body?.classList?.remove(
    'area-select-active',
    'canvas-review-pick-active',
    'canvas-review-pick-active--sectionBox',
    'canvas-review-pick-active--hide',
    'canvas-review-pick-active--isolate',
    'visibility-tool-active',
    'visibility-isolate-active',
    'visibility-hide-active'
  );
}

function resetClipButtonUi() {
  const button = document.getElementById('clipBtn');
  if (!button) return;
  button.classList.remove('tool-active');
  button.setAttribute('aria-pressed', 'false');
  const label = button.querySelector('span');
  if (label) label.textContent = 'Clip Off';
}

function hasRenderableMesh(root) {
  let found = false;
  root.traverse?.((object) => {
    if (object?.isMesh) found = true;
  });
  return found;
}

function isScene(object) {
  return Boolean(object?.isScene || object?.type === 'Scene');
}

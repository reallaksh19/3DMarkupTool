// Phase 14: central canvas interaction ownership for tools that need pointer input.
// The app creates OrbitControls before optional UI tools finish loading. If a tool
// loads before the renderer canvas exists, it can miss binding its canvas listener;
// if OrbitControls remains enabled, drag gestures rotate the model instead of
// drawing/selecting/tagging. This coordinator is deterministic, event-driven, and
// does not traverse the scene at startup.

const VERSION = 'canvas-interaction-phase14-20260620';
const REBIND_VERSION = 'canvas-ready-phase14-20260620';
const RUNTIME_EVENTS = [
  'viewer:runtime-context',
  'markup:render-context',
  'viewer:model-loaded',
  'viewer:app-module-loaded',
  'viewer:static-shell-bundle-ready'
];
const TOOL_BODY_CLASSES = [
  'area-select-active',
  'marquee-zoom-active',
  'measure-polyline-active'
];
const REBIND_MODULES = [
  './static-area-select-controller.js',
  './static-measure-polyline-controller.js',
  './navis-manual-tag-safe-controller.js'
];
const MIN_DRAG_PX = 10;

const state = {
  version: VERSION,
  canvas: null,
  controls: null,
  controlsSnapshot: null,
  lockReason: '',
  rebindStarted: false,
  rebindComplete: false,
  fallbackDrag: null,
  fallbackOverlay: null,
  fallbackTool: '',
  lastTool: '',
  lastAction: 'init'
};

installCanvasInteractionCoordinator();

function installCanvasInteractionCoordinator() {
  if (window.__3D_MARKUP_CANVAS_INTERACTION__?.version === VERSION) return;
  installApi();
  bindCurrentCanvas('init');
  for (const eventName of RUNTIME_EVENTS) {
    window.addEventListener(eventName, () => bindCurrentCanvas(eventName), { passive: true });
  }
  window.addEventListener('keydown', onGlobalKeyDown, true);
}

function installApi() {
  window.__3D_MARKUP_CANVAS_INTERACTION__ = {
    version: VERSION,
    bindCurrentCanvas,
    runtime,
    runtimeCanvas,
    activeToolName,
    lockOrbitControls,
    restoreOrbitControls,
    debug: () => ({
      version: VERSION,
      hasCanvas: Boolean(state.canvas),
      hasControls: Boolean(currentControls()),
      controlsLocked: Boolean(state.controlsSnapshot),
      lockReason: state.lockReason,
      activeTool: activeToolName(),
      rebindStarted: state.rebindStarted,
      rebindComplete: state.rebindComplete,
      fallbackTool: state.fallbackTool,
      lastTool: state.lastTool,
      lastAction: state.lastAction,
      noPolling: true,
      noMutationObserver: true,
      noStartupSceneTraversal: true
    })
  };
}

function bindCurrentCanvas(reason = 'runtime') {
  const canvas = runtimeCanvas();
  if (!canvas) return false;
  if (state.canvas !== canvas) {
    state.canvas = canvas;
    bindCanvas(canvas);
  }
  rebindCanvasToolsAfterCanvasReady(reason);
  return true;
}

function bindCanvas(canvas) {
  if (!canvas || canvas.__canvasInteractionCoordinatorAttached) return;
  canvas.__canvasInteractionCoordinatorAttached = true;
  canvas.addEventListener('pointerdown', onCanvasPointerDownCapture, true);
  canvas.addEventListener('pointermove', onCanvasPointerMoveCapture, true);
  canvas.addEventListener('pointerup', onCanvasPointerUpCapture, true);
  canvas.addEventListener('pointercancel', onCanvasPointerCancelCapture, true);
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function runtimeCanvas() {
  return runtime()?.renderer?.domElement || document.querySelector('#viewer canvas');
}

function currentControls() {
  return runtime()?.controls || state.controls || null;
}

function activeToolName() {
  for (const className of TOOL_BODY_CLASSES) {
    if (document.body.classList.contains(className)) return className.replace(/-active$/, '');
  }
  if (document.getElementById('navisTagBtn')?.classList.contains('tool-active')) return 'manual-tag';
  if (document.querySelector('[name="NAVIS_TAG_PENDING_ANCHOR"]')) return 'manual-tag';
  return '';
}

function onCanvasPointerDownCapture(event) {
  const tool = activeToolName();
  if (!tool || event.button !== 0) return;
  state.lastTool = tool;
  state.lastAction = 'pointerdown';
  lockOrbitControls(`canvas-tool:${tool}`);
  maybeStartFallbackDrag(tool, event);
}

function onCanvasPointerMoveCapture(event) {
  const tool = activeToolName();
  if (tool) lockOrbitControls(`canvas-tool:${tool}:move`);
  if (!state.fallbackDrag) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  state.fallbackDrag.currentX = event.clientX;
  state.fallbackDrag.currentY = event.clientY;
  updateFallbackOverlay();
}

function onCanvasPointerUpCapture(event) {
  const hadFallback = Boolean(state.fallbackDrag);
  if (hadFallback) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    finishFallbackDrag(event);
  }
  queueRestoreIfIdle('pointerup');
}

function onCanvasPointerCancelCapture(event) {
  if (state.fallbackDrag) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    clearFallbackDrag('pointercancel');
  }
  queueRestoreIfIdle('pointercancel');
}

function onGlobalKeyDown(event) {
  if (event.key !== 'Escape') return;
  clearFallbackDrag('escape');
  queueRestoreIfIdle('escape');
}

function lockOrbitControls(reason = 'canvas-tool') {
  const controls = currentControls();
  if (!controls) return false;
  state.controls = controls;
  if (!state.controlsSnapshot || state.controlsSnapshot.controls !== controls) {
    state.controlsSnapshot = {
      controls,
      enabled: controls.enabled,
      enableRotate: controls.enableRotate,
      enablePan: controls.enablePan,
      enableZoom: controls.enableZoom,
      mouseButtons: controls.mouseButtons ? { ...controls.mouseButtons } : null
    };
  }
  controls.enabled = false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = false;
  state.lockReason = reason;
  return true;
}

function restoreOrbitControls(reason = 'canvas-tool-release') {
  if (activeToolName()) return false;
  const snapshot = state.controlsSnapshot;
  if (!snapshot?.controls) return false;
  const controls = snapshot.controls;
  controls.enabled = snapshot.enabled;
  controls.enableRotate = snapshot.enableRotate;
  controls.enablePan = snapshot.enablePan;
  controls.enableZoom = snapshot.enableZoom;
  if (snapshot.mouseButtons) controls.mouseButtons = { ...snapshot.mouseButtons };
  state.controlsSnapshot = null;
  state.lockReason = '';
  state.lastAction = reason;
  return true;
}

function queueRestoreIfIdle(reason) {
  queueMicrotask(() => {
    if (!activeToolName()) restoreOrbitControls(`restore:${reason}`);
  });
}

function maybeStartFallbackDrag(tool, event) {
  const canvas = state.canvas || runtimeCanvas();
  if (!canvas) return false;
  if (tool === 'area-select' && canvas.__areaSelectAttached) return false;
  if (tool === 'marquee-zoom' && canvas.__marqueeZoomAttached) return false;
  if (tool !== 'area-select' && tool !== 'marquee-zoom') return false;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  state.fallbackTool = tool;
  state.fallbackDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY
  };
  canvas.setPointerCapture?.(event.pointerId);
  createFallbackOverlay(tool);
  return true;
}

function finishFallbackDrag(event) {
  const drag = state.fallbackDrag;
  const tool = state.fallbackTool;
  const canvas = state.canvas || runtimeCanvas();
  if (!drag) return false;
  canvas?.releasePointerCapture?.(drag.pointerId);
  const rect = normalizedClientRect(drag.startX, drag.startY, event.clientX, event.clientY);
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  clearFallbackDrag('finish');
  if (width < MIN_DRAG_PX || height < MIN_DRAG_PX) {
    deactivateTool(tool, `${labelForTool(tool)} canceled`);
    return false;
  }
  if (tool === 'area-select') {
    const selected = window.__3D_MARKUP_AREA_SELECT__?.selectInClientRect?.(rect, { source: 'canvas-coordinator-fallback' }) || [];
    deactivateTool(tool, `Area selected ${selected.length} component${selected.length === 1 ? '' : 's'}`);
    return true;
  }
  if (tool === 'marquee-zoom') {
    const ok = window.__3D_MARKUP_MARQUEE_ZOOM__?.zoomToClientRect?.(rect);
    deactivateTool(tool, ok ? 'Marquee zoom applied' : 'Marquee zoom failed');
    return Boolean(ok);
  }
  return false;
}

function clearFallbackDrag(reason = 'clear') {
  if (!state.fallbackDrag && !state.fallbackOverlay) return;
  state.fallbackDrag = null;
  removeFallbackOverlay();
  state.lastAction = `fallback:${reason}`;
}

function deactivateTool(tool, message = '') {
  if (tool === 'area-select') window.__3D_MARKUP_AREA_SELECT__?.deactivate?.(message);
  if (tool === 'marquee-zoom') window.__3D_MARKUP_MARQUEE_ZOOM__?.deactivate?.(message);
}

function createFallbackOverlay(tool) {
  removeFallbackOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  const overlay = document.createElement('div');
  overlay.className = `canvas-tool-fallback-rect canvas-tool-fallback-rect--${tool}`;
  overlay.style.position = 'absolute';
  overlay.style.zIndex = '36';
  overlay.style.pointerEvents = 'none';
  overlay.style.border = tool === 'area-select'
    ? '2px solid rgba(61, 220, 151, .98)'
    : '2px solid rgba(55, 216, 255, .95)';
  overlay.style.borderRadius = '4px';
  overlay.style.background = tool === 'area-select'
    ? 'rgba(61, 220, 151, .14)'
    : 'rgba(43, 140, 255, .16)';
  overlay.style.boxShadow = '0 0 0 1px rgba(4, 12, 23, .7), 0 10px 30px rgba(0, 0, 0, .26)';
  viewer.appendChild(overlay);
  state.fallbackOverlay = overlay;
  updateFallbackOverlay();
}

function updateFallbackOverlay() {
  const overlay = state.fallbackOverlay;
  const drag = state.fallbackDrag;
  const viewer = document.getElementById('viewer');
  if (!overlay || !drag || !viewer) return;
  const viewport = viewer.getBoundingClientRect();
  const rect = clampRectToViewport(normalizedClientRect(drag.startX, drag.startY, drag.currentX, drag.currentY), viewport);
  overlay.style.left = `${rect.left - viewport.left}px`;
  overlay.style.top = `${rect.top - viewport.top}px`;
  overlay.style.width = `${Math.max(rect.right - rect.left, 1)}px`;
  overlay.style.height = `${Math.max(rect.bottom - rect.top, 1)}px`;
}

function removeFallbackOverlay() {
  state.fallbackOverlay?.remove?.();
  state.fallbackOverlay = null;
}

function rebindCanvasToolsAfterCanvasReady(reason = 'runtime') {
  if (state.rebindStarted || !runtimeCanvas()) return;
  state.rebindStarted = true;
  Promise.allSettled(REBIND_MODULES.map((src) => import(`${src}?v=${REBIND_VERSION}`)))
    .then((results) => {
      state.rebindComplete = true;
      window.dispatchEvent(new CustomEvent('viewer:canvas-tools-rebound', {
        detail: {
          version: VERSION,
          reason,
          ok: results.filter((result) => result.status === 'fulfilled').length,
          failed: results.filter((result) => result.status === 'rejected').length
        }
      }));
    });
}

function normalizedClientRect(x1, y1, x2, y2) {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2)
  };
}

function clampRectToViewport(rect, viewport) {
  return {
    left: Math.min(Math.max(rect.left, viewport.left), viewport.right),
    top: Math.min(Math.max(rect.top, viewport.top), viewport.bottom),
    right: Math.min(Math.max(rect.right, viewport.left), viewport.right),
    bottom: Math.min(Math.max(rect.bottom, viewport.top), viewport.bottom)
  };
}

function labelForTool(tool) {
  if (tool === 'area-select') return 'Area select';
  if (tool === 'marquee-zoom') return 'Marquee zoom';
  return 'Canvas tool';
}

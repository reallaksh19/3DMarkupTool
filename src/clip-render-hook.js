// Emergency production recovery guard.
// Keep the core app.js path alive without monkey-patching THREE.WebGLRenderer.render
// and without starting optional UI controllers. safe-ui-bootstrap.js is the single
// owner for optional controller startup.
//
// Important: do NOT monkey-patch THREE.WebGLRenderer.prototype.render here.
// Some Three.js builds define/assign renderer.render as a read-only own property
// during WebGLRenderer construction; patching the prototype can make
// new WebGLRenderer() throw "Cannot assign to read only property 'render'".
//
// LCP note: this module must stay light. The rAF throttle/freeze guard is exposed
// for the deferred app loader and is installed immediately only when explicitly
// requested by URL/localStorage. That keeps the initial text paint free of guard
// setup and wrapper self-time.

const CORE_RECOVERY_MODE = true;
const DEFAULT_FRAME_MS = 66; // ~15 FPS; enough for review UI and prevents browser hangs on weak WebGL paths.

const OPTIONAL_CONTROLLER_FRAGMENTS = [
  'fit-controller.js',
  'grid-toggle-controller.js',
  'ui-console-guard.js',
  'clip-adjuster.js',
  'clip-visual-overlays.js',
  'visibility-context-menu.js',
  'selection-sync-controller.js',
  'property-tabs-controller.js',
  'model-tree-panel.js',
  'navis-tag-',
  'tag-lite-host-controller.js',
  'toolbar-cleanup-controller.js',
  'professional-ui-shell-controller.js',
  'two-row-ribbon-controller.js',
  'two-row-icon-ribbon-controller.js',
  'color-by-legend',
  'origin-manager-controller.js',
  'marquee-zoom-controller.js',
  'phase24b-ui-exposure-controller.js',
  'phase35-ui-cleanup-controller.js',
  'phase36-input-drawer-fix-controller.js',
  'phase37-input-drawer-stack-controller.js',
  'phase38-clipbox-ui-cleanup-controller.js',
  'phase40-legacy-hint-compat-controller.js',
  'phase41-tree-clip-controls-controller.js',
  'rvm-compat-validator-controller.js',
  'ui-diagnostics-controller.js'
];

window.__3D_MARKUP_CORE_RECOVERY__ = CORE_RECOVERY_MODE;
window.__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__ = installStartupFreezeGuard;
if (shouldInstallFreezeGuardImmediately()) installStartupFreezeGuard({ source: 'explicit-early-startup' });

const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {
  renderer: null,
  scene: null,
  camera: null,
  frame: 0
};
window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

// Safe optional API for app.js or future modules to publish render context
// without patching Three.js internals. Do not replace the richer prebridge
// publisher when this module is deferred until after render-context-prebridge.js.
if (typeof window.__3D_MARKUP_RECORD_RENDER_CONTEXT__ !== 'function') {
  window.__3D_MARKUP_RECORD_RENDER_CONTEXT__ = function recordRenderContext(detail = {}) {
    if (detail.renderer) runtime.renderer = detail.renderer;
    if (detail.scene) runtime.scene = detail.scene;
    if (detail.camera) runtime.camera = detail.camera;
    runtime.frame += 1;
    window.dispatchEvent(new CustomEvent('markup:render-context', {
      detail: {
        renderer: runtime.renderer,
        scene: runtime.scene,
        camera: runtime.camera,
        frame: runtime.frame
      }
    }));
  };
}

if (CORE_RECOVERY_MODE) {
  disableOptionalControllerScripts();
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('core-recovery-mode');
    const status = document.getElementById('runtimeStatus');
    if (status && /ready/i.test(status.textContent || '')) status.textContent = 'Core Ready';
    console.warn('[3DMarkupTool] Core recovery mode: optional UI scripts in markup are disabled; optional behavior modules are opt-in only.');
  }, { once: true });
}

function shouldInstallFreezeGuardImmediately() {
  const params = new URLSearchParams(window.location.search);
  return params.has('earlyFreezeGuard') || window.localStorage.getItem('3dmarkup.earlyFreezeGuard') === '1';
}

function installStartupFreezeGuard(meta = {}) {
  if (window.__3D_MARKUP_RAF_THROTTLE_INSTALLED__) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('fullFps') || window.localStorage.getItem('3dmarkup.fullFps') === '1') return false;
  if (typeof window.requestAnimationFrame !== 'function') return false;

  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const originalCancelAnimationFrame = typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame.bind(window)
    : null;

  let nextId = 1;
  let lastFrameTime = 0;
  const handles = new Map();

  window.requestAnimationFrame = function throttledRequestAnimationFrame(callback) {
    const id = nextId++;
    const schedule = () => {
      const rafId = originalRequestAnimationFrame((timestamp) => {
        const elapsed = timestamp - lastFrameTime;
        const waitMs = Math.max(0, DEFAULT_FRAME_MS - elapsed);
        if (waitMs <= 1) {
          handles.delete(id);
          lastFrameTime = timestamp;
          callback(timestamp);
          return;
        }

        const timeoutId = window.setTimeout(() => {
          handles.delete(id);
          const syntheticTimestamp = performance.now();
          lastFrameTime = syntheticTimestamp;
          callback(syntheticTimestamp);
        }, waitMs);
        handles.set(id, { timeoutId });
      });
      handles.set(id, { rafId });
    };

    schedule();
    return id;
  };

  window.cancelAnimationFrame = function throttledCancelAnimationFrame(id) {
    const handle = handles.get(id);
    if (!handle) return;
    if (handle.rafId && originalCancelAnimationFrame) originalCancelAnimationFrame(handle.rafId);
    if (handle.timeoutId) window.clearTimeout(handle.timeoutId);
    handles.delete(id);
  };

  window.__3D_MARKUP_RAF_THROTTLE_INSTALLED__ = true;
  window.__3D_MARKUP_RAF_THROTTLE_MS__ = DEFAULT_FRAME_MS;
  window.__3D_MARKUP_RAF_THROTTLE_SOURCE__ = meta.source || 'deferred';
  return true;
}

function disableOptionalControllerScripts() {
  const scripts = Array.from(document.querySelectorAll('script[type="module"][src]'));
  for (const script of scripts) {
    const src = script.getAttribute('src') || '';
    if (!OPTIONAL_CONTROLLER_FRAGMENTS.some((fragment) => src.includes(fragment))) continue;
    script.setAttribute('data-disabled-by-core-recovery', 'true');
    script.type = 'text/plain';
    script.remove();
  }
}

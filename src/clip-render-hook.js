const OPTIONAL_CONTROLLER_FRAGMENTS = [
  'clip-adjuster.js',
  'clip-visual-overlays.js',
  'visibility-context-menu.js',
  'ui-console-guard.js',
  'fit-controller.js',
  'model-tree-panel.js',
  'selection-sync-controller.js',
  'property-tabs-controller.js',
  'grid-toggle-controller.js',
  'navis-tag-',
  'tag-lite-host-controller.js',
  'toolbar-cleanup-controller.js',
  'professional-ui-shell-controller.js',
  'two-row-ribbon-controller.js',
  'color-by-legend',
  'origin-manager-controller.js',
  'marquee-zoom-controller.js',
  'phase24b-ui-exposure-controller.js',
  'rvm-compat-validator-controller.js'
];

enterCoreRecoveryMode();
queueSafeUiLoader();

function enterCoreRecoveryMode() {
  window.__3D_MARKUP_CORE_RECOVERY__ = true;
  window.__3D_MARKUP_DISABLED_OPTIONAL_CONTROLLERS__ = OPTIONAL_CONTROLLER_FRAGMENTS.slice();
  disableOptionalControllerScripts();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', disableOptionalControllerScripts, { once: true });
  }
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

function queueSafeUiLoader() {
  const loadSafeUi = () => {
    if (window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__) return;
    window.__3D_MARKUP_SAFE_UI_IMPORT_STARTED__ = true;
    import('./safe-ui-loader.js?v=phase26-batch5b-46').catch((error) => {
      console.warn('[3DMarkupTool] Safe UI loader failed to start.', error);
      const status = document.getElementById('runtimeStatus');
      if (status) status.textContent = 'Core Ready / UI loader failed';
    });
  };

  if (window.__3D_MARKUP_APP_READY__) {
    window.requestAnimationFrame(loadSafeUi);
    return;
  }

  window.addEventListener('markup:app-ready', () => window.requestAnimationFrame(loadSafeUi), { once: true });
  window.setTimeout(() => {
    if (window.__3D_MARKUP_APP_READY__) loadSafeUi();
  }, 6000);
}

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || {
  renderer: null,
  scene: null,
  camera: null,
  lastFrameAt: 0
};

window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

const originalRenderDescriptor = Object.getOwnPropertyDescriptor(WebGLRenderer.prototype, 'render');
const originalRender = originalRenderDescriptor?.value || WebGLRenderer.prototype.render;

WebGLRenderer.prototype.render = function patchedRender(scene, camera, ...rest) {
  runtime.renderer = this;
  runtime.scene = scene;
  runtime.camera = camera;
  runtime.lastFrameAt = performance.now();
  window.dispatchEvent(new CustomEvent('markup:render-context', { detail: runtime }));
  return originalRender.call(this, scene, camera, ...rest);
};

// Emergency production recovery mode.
// Keep the core app.js path alive and prevent late optional UI controllers from
// executing until they can be re-enabled one by one under a guarded loader.
//
// Important: do NOT monkey-patch THREE.WebGLRenderer.prototype.render here.
// Some Three.js builds define/assign renderer.render as a read-only own property
// during WebGLRenderer construction; patching the prototype can make
// new WebGLRenderer() throw "Cannot assign to read only property 'render'".

const CORE_RECOVERY_MODE = true;

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
  'color-by-legend',
  'origin-manager-controller.js',
  'marquee-zoom-controller.js',
  'phase24b-ui-exposure-controller.js',
  'rvm-compat-validator-controller.js'
];

window.__3D_MARKUP_CORE_RECOVERY__ = CORE_RECOVERY_MODE;

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || {
  renderer: null,
  scene: null,
  camera: null,
  frame: 0
};
window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

// Safe optional API for app.js or future modules to publish render context
// without patching Three.js internals.
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

if (CORE_RECOVERY_MODE) {
  disableOptionalControllerScripts();
  queueSafeUiLoader();
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('core-recovery-mode');
    const status = document.getElementById('runtimeStatus');
    if (status && /ready/i.test(status.textContent || '')) status.textContent = 'Core Ready';
    console.warn('[3DMarkupTool] Core recovery mode: optional UI controllers disabled; guarded UI batch will load after core startup.');
  }, { once: true });
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
    import('./safe-ui-loader.js?v=hotfix57-render-safe-loader').catch((error) => {
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
  window.setTimeout(() => loadSafeUi(), 2000);
}

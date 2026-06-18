import * as THREE from 'three';

// Emergency production recovery mode.
// Keep the core app.js path alive and prevent late optional UI controllers from
// executing until they can be re-enabled one by one under a guarded loader.
const CORE_RECOVERY_MODE = true;

const OPTIONAL_CONTROLLER_FRAGMENTS = [
  'fit-controller.js',
  'grid-toggle-controller.js',
  'ui-console-guard.js',
  'clip-adjuster.js',
  'clip-visual-overlays.js',
  'visibility-context-menu.js',
  'selection-sync-controller.js',
  'property-tabs-controller.js'
];

window.__3D_MARKUP_CORE_RECOVERY__ = CORE_RECOVERY_MODE;

if (CORE_RECOVERY_MODE) {
  disableOptionalControllerScripts();
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('core-recovery-mode');
    const status = document.getElementById('runtimeStatus');
    if (status && /ready/i.test(status.textContent || '')) status.textContent = 'Core Ready';
    console.warn('[3DMarkupTool] Core recovery mode: optional UI controllers disabled.');
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

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || {
  renderer: null,
  scene: null,
  camera: null,
  frame: 0
};

window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

const proto = THREE.WebGLRenderer?.prototype;

if (proto && !proto.__MARKUP_CLIP_RENDER_HOOK__) {
  const renderStore = new WeakMap();

  Object.defineProperty(proto, 'render', {
    configurable: true,
    get() {
      return renderStore.get(this);
    },
    set(renderFn) {
      if (typeof renderFn !== 'function') {
        renderStore.set(this, renderFn);
        return;
      }

      const wrappedRender = function markupClipRenderBridge(scene, camera) {
        runtime.renderer = this;
        runtime.scene = scene;
        runtime.camera = camera;
        runtime.frame += 1;

        window.dispatchEvent(new CustomEvent('markup:render-context', {
          detail: { renderer: this, scene, camera, frame: runtime.frame }
        }));

        return renderFn.call(this, scene, camera);
      };

      renderStore.set(this, wrappedRender);
    }
  });

  Object.defineProperty(proto, '__MARKUP_CLIP_RENDER_HOOK__', {
    value: true,
    configurable: false
  });
}

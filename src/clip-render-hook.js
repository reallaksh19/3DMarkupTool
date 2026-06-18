import * as THREE from 'three';

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

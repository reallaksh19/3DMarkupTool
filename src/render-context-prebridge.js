import * as THREE from 'three';

// Publish renderer/scene context for optional UI controllers without touching
// WebGLRenderer.render(). This avoids the read-only render-property regression
// seen in earlier recovery work while still giving clip tools access to the
// active renderer and scene.

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || {
  renderer: null,
  scene: null,
  camera: null,
  frame: 0
};
window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

installRendererSetSizeHook();
installSceneAddHook();

function installRendererSetSizeHook() {
  const proto = THREE.WebGLRenderer?.prototype;
  if (!proto || proto.__phase38ContextSetSizeHooked) return;

  const original = proto.setSize;
  if (typeof original !== 'function') return;

  Object.defineProperty(proto, '__phase38ContextSetSizeHooked', {
    value: true,
    configurable: true
  });

  proto.setSize = function phase38SetSizeContextBridge(...args) {
    runtime.renderer = this;
    publishContext();
    return original.apply(this, args);
  };
}

function installSceneAddHook() {
  const proto = THREE.Scene?.prototype;
  if (!proto || proto.__phase38ContextSceneAddHooked) return;

  const original = proto.add;
  if (typeof original !== 'function') return;

  Object.defineProperty(proto, '__phase38ContextSceneAddHooked', {
    value: true,
    configurable: true
  });

  proto.add = function phase38SceneAddContextBridge(...objects) {
    runtime.scene = this;
    publishContext();
    return original.apply(this, objects);
  };
}

function publishContext() {
  runtime.frame = (runtime.frame || 0) + 1;
  window.dispatchEvent(new CustomEvent('markup:render-context', {
    detail: {
      renderer: runtime.renderer,
      scene: runtime.scene,
      camera: runtime.camera,
      frame: runtime.frame
    }
  }));
}

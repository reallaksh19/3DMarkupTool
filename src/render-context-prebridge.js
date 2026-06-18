import * as THREE from 'three';

// Publish renderer/scene context for optional UI controllers without touching
// WebGLRenderer.render(). This avoids the read-only render-property regression
// seen in earlier recovery work while still giving clip/tree tools access to the
// active renderer and scene.
//
// This prebridge is loaded before src/app.js, so it also keeps the small legacy
// DOM contract that app.js still expects. The newer compact UI removed #hint,
// but app.js still toggles el('hint').style after conversion and Clear All.

const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
runtime.renderer = runtime.renderer || null;
runtime.scene = runtime.scene || null;
runtime.camera = runtime.camera || null;
runtime.controls = runtime.controls || null;
runtime.modelRoot = runtime.modelRoot || null;
runtime.selectedObject = runtime.selectedObject || null;
runtime.selectedData = runtime.selectedData || null;
runtime.clippingPlanes = runtime.clippingPlanes || [];
runtime.frame = runtime.frame || 0;
runtime.source = runtime.source || 'prebridge';

window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

ensureLegacyHintElement();
installRendererSetSizeHook();
installSceneAddHook();

function ensureLegacyHintElement() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('hint')) return;

  const create = () => {
    if (document.getElementById('hint')) return;
    const hint = document.createElement('div');
    hint.id = 'hint';
    hint.className = 'hint legacy-hint-compat';
    hint.textContent = '';
    hint.style.display = 'none';
    hint.setAttribute('aria-hidden', 'true');

    const viewer = document.getElementById('viewer') || document.body;
    viewer.appendChild(hint);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', create, { once: true });
  } else {
    create();
  }
}

function installRendererSetSizeHook() {
  const proto = THREE.WebGLRenderer?.prototype;
  if (!proto || proto.__markupContextSetSizeHooked) return;

  const original = proto.setSize;
  if (typeof original !== 'function') return;

  Object.defineProperty(proto, '__markupContextSetSizeHooked', {
    value: true,
    configurable: true
  });

  proto.setSize = function markupSetSizeContextBridge(...args) {
    runtime.renderer = this;
    runtime.source = 'renderer.setSize';
    publishContext();
    return original.apply(this, args);
  };
}

function installSceneAddHook() {
  const proto = THREE.Scene?.prototype;
  if (!proto || proto.__markupContextSceneAddHooked) return;

  const original = proto.add;
  if (typeof original !== 'function') return;

  Object.defineProperty(proto, '__markupContextSceneAddHooked', {
    value: true,
    configurable: true
  });

  proto.add = function markupSceneAddContextBridge(...objects) {
    runtime.scene = this;
    runtime.source = 'scene.add';
    publishContext(objects);
    return original.apply(this, objects);
  };
}

function publishContext(objects = []) {
  runtime.frame = (runtime.frame || 0) + 1;
  const detail = {
    renderer: runtime.renderer,
    scene: runtime.scene,
    camera: runtime.camera,
    controls: runtime.controls,
    modelRoot: runtime.modelRoot,
    selectedObject: runtime.selectedObject,
    selectedData: runtime.selectedData,
    clippingPlanes: runtime.clippingPlanes,
    source: runtime.source,
    objects,
    frame: runtime.frame
  };

  window.dispatchEvent(new CustomEvent('markup:render-context', { detail }));
  window.dispatchEvent(new CustomEvent('viewer:runtime-context', { detail }));
}
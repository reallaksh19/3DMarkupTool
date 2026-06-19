import * as THREE from 'three';

// Publish renderer/scene context for static UI controllers without touching
// WebGLRenderer.render(). This avoids the read-only render-property regression
// seen in earlier recovery work while still giving clip/tree tools stable access
// to the active renderer and scene.
//
// This prebridge is loaded before src/app.js, so it also owns the few remaining
// legacy DOM contracts that app.js still reads directly. Keep this list small and
// explicit; do not use this file as a general patch-controller.

const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
runtime.renderer = runtime.renderer || null;
runtime.scene = runtime.scene || null;
runtime.camera = runtime.camera || null;
runtime.controls = runtime.controls || null;
runtime.modelRoot = runtime.modelRoot || null;
runtime.selectedObject = runtime.selectedObject || null;
runtime.selectedData = runtime.selectedData || null;
runtime.clippingPlanes = runtime.clippingPlanes || [];
runtime.clippingMode = runtime.clippingMode || 'none';
runtime.frame = runtime.frame || 0;
runtime.source = runtime.source || 'prebridge';
runtime.applyClipping = runtime.applyClipping || applyClipping;
runtime.clearClipping = runtime.clearClipping || clearClipping;
runtime.getModelRoot = runtime.getModelRoot || (() => runtime.modelRoot || runtime.scene || null);

window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
window.__3D_MARKUP_RECORD_RENDER_CONTEXT__ = recordRenderContext;

ensureLegacyHintElement();
ensureLegacySupportModeContract();
installRendererMethodHook('setPixelRatio');
installRendererMethodHook('setSize');
installRendererMethodHook('setViewport');
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

function ensureLegacySupportModeContract() {
  if (typeof document === 'undefined') return;

  const create = () => {
    const root = ensureCompatibilityRoot();
    const supportMode = ensureHiddenSelect(root, 'supportMode', [
      'compare',
      'inputxml-actual',
      'isonote-expected',
      'none'
    ], 'compare');

    const sync = () => {
      const actual = isChecked('renderActualSupport', true);
      const expected = isChecked('renderExpectedSupport', true);
      supportMode.value = actual && expected
        ? 'compare'
        : actual
          ? 'inputxml-actual'
          : expected
            ? 'isonote-expected'
            : 'none';

      const showSupportLabel = document.getElementById('showSupportLabel');
      const legacySupportLabels = document.getElementById('supportLabels');
      if (showSupportLabel && legacySupportLabels && showSupportLabel !== legacySupportLabels) {
        legacySupportLabels.checked = Boolean(showSupportLabel.checked);
      }

      window.__3D_MARKUP_CONVERSION_OPTIONS_COMPAT__ = {
        installed: true,
        owner: 'render-context-prebridge',
        supportMode: supportMode.value
      };
    };

    ['renderActualSupport', 'renderExpectedSupport', 'showSupportLabel', 'supportLabels']
      .forEach((id) => document.getElementById(id)?.addEventListener('change', sync));
    sync();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', create, { once: true });
  } else {
    create();
  }
}

function ensureCompatibilityRoot() {
  let root = document.getElementById('preAppCompatibilityRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'preAppCompatibilityRoot';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  root.style.display = 'none';
  document.body.appendChild(root);
  return root;
}

function ensureHiddenSelect(root, id, values, defaultValue) {
  let select = document.getElementById(id);
  if (select) return select;
  select = document.createElement('select');
  select.id = id;
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = defaultValue;
  root.appendChild(select);
  return select;
}

function isChecked(id, fallback) {
  const node = document.getElementById(id);
  return node ? Boolean(node.checked) : Boolean(fallback);
}

function installRendererMethodHook(methodName) {
  const proto = THREE.WebGLRenderer?.prototype;
  if (!proto) return;
  const flag = `__markupContext_${methodName}_hooked`;
  if (proto[flag]) return;

  const original = proto[methodName];
  if (typeof original !== 'function') return;

  Object.defineProperty(proto, flag, {
    value: true,
    configurable: true
  });

  proto[methodName] = function markupRendererContextBridge(...args) {
    runtime.renderer = this;
    runtime.source = `renderer.${methodName}`;
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
    for (const object of objects) {
      if (!object) continue;
      if (object.type === 'PerspectiveCamera' || object.isCamera) runtime.camera = object;
      if (object.name && !object.userData?.isDisplayHelper && !object.isLight && !object.isCamera) runtime.modelRoot = object;
    }
    publishContext(objects);
    return original.apply(this, objects);
  };
}

function recordRenderContext(detail = {}) {
  if (detail.renderer) runtime.renderer = detail.renderer;
  if (detail.scene) runtime.scene = detail.scene;
  if (detail.camera) runtime.camera = detail.camera;
  if (detail.controls) runtime.controls = detail.controls;
  if (detail.modelRoot) runtime.modelRoot = detail.modelRoot;
  if (detail.selectedObject !== undefined) runtime.selectedObject = detail.selectedObject;
  if (detail.selectedData !== undefined) runtime.selectedData = detail.selectedData;
  if (Array.isArray(detail.clippingPlanes)) runtime.clippingPlanes = detail.clippingPlanes;
  if (detail.clippingMode) runtime.clippingMode = detail.clippingMode;
  runtime.source = detail.source || runtime.source || 'recordRenderContext';
  publishContext();
}

function applyClipping(planes = [], detail = {}) {
  const renderer = runtime.renderer;
  const safePlanes = Array.isArray(planes) ? planes : [];
  if (renderer) {
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = safePlanes;
  }
  runtime.clippingPlanes = safePlanes;
  runtime.clippingMode = detail.mode || (safePlanes.length ? 'custom' : 'none');
  runtime.source = detail.source || 'runtime.applyClipping';
  publishContext();
  window.dispatchEvent(new CustomEvent('viewer:clipping-changed', {
    detail: { mode: runtime.clippingMode, source: runtime.source, planes: safePlanes }
  }));
}

function clearClipping(detail = {}) {
  applyClipping([], { mode: 'none', source: detail.source || 'runtime.clearClipping' });
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
    clippingMode: runtime.clippingMode,
    source: runtime.source,
    objects,
    frame: runtime.frame
  };

  window.dispatchEvent(new CustomEvent('markup:render-context', { detail }));
  window.dispatchEvent(new CustomEvent('viewer:runtime-context', { detail }));
}

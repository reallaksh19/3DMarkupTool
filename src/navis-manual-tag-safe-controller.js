import * as THREE from 'three';
import { createTextPlane } from './geometry.js?v=professional-viewer-3';

const TAG_RED = 0xff2b2b;
const TAG_YELLOW = 0xffd166;
const PENDING_ANCHOR_NAME = 'NAVIS_TAG_PENDING_ANCHOR';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  canvas: null,
  active: false,
  anchor: null,
  tempLayer: null,
  tempHelper: null,
  counter: 1
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initManualTagTool, { once: true });
} else {
  initManualTagTool();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
  if (renderer?.domElement) bindCanvas(renderer.domElement);
});

function initManualTagTool() {
  ensureStyles();
  ensureButton();
  bindCanvas((runtime || window.__3D_MARKUP_CLIP_RUNTIME__)?.renderer?.domElement);
}

function ensureButton() {
  if (document.getElementById('navisTagBtn')) {
    document.getElementById('navisTagBtn')?.addEventListener('click', toggleManualTagMode);
    return;
  }

  const group = document.querySelector('.navis-tag-tools');
  if (!group) {
    window.setTimeout(ensureButton, 250);
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'navisTagBtn';
  btn.type = 'button';
  btn.className = 'tool-btn';
  btn.title = 'Manual leader annotation: click leader point, then annotation location';
  btn.textContent = 'Tag';
  btn.addEventListener('click', toggleManualTagMode);

  const isonoteBtn = document.getElementById('navisIsonoteBtn');
  group.insertBefore(btn, isonoteBtn || group.firstChild);
}

function bindCanvas(canvas) {
  if (!canvas || state.canvas === canvas) return;
  if (state.canvas) {
    state.canvas.removeEventListener('pointerdown', handlePointer, true);
    state.canvas.removeEventListener('pointermove', blockCanvasMotion, true);
    state.canvas.removeEventListener('pointerup', blockCanvasMotion, true);
    state.canvas.removeEventListener('pointercancel', cancelManualTagMode, true);
  }
  state.canvas = canvas;
  canvas.addEventListener('pointerdown', handlePointer, true);
  canvas.addEventListener('pointermove', blockCanvasMotion, true);
  canvas.addEventListener('pointerup', blockCanvasMotion, true);
  canvas.addEventListener('pointercancel', cancelManualTagMode, true);
}

function toggleManualTagMode() {
  if (state.active) {
    cancelManualTagMode();
    return;
  }

  const ctx = getContext();
  if (!ctx) {
    toast('Load/convert a model before placing a tag.');
    return;
  }

  state.active = true;
  state.anchor = null;
  setPendingAnchor(false);
  setButtonActive(true);
  setStatus('Manual Tag: click leader/arrow point.');
  toast('Manual Tag: click the leader point, then click the annotation box location.');
}

function handlePointer(event) {
  if (!state.active) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const ctx = getContext();
  if (!ctx) {
    cancelManualTagMode();
    return;
  }

  const point = pickPoint(event, ctx);
  if (!point) {
    toast('Could not pick a 3D point. Try clicking nearer to model geometry.');
    return;
  }

  if (!state.anchor) {
    state.anchor = point;
    setPendingAnchor(true);
    drawTemporaryAnchor(point, ctx.scene);
    setStatus('Manual Tag: now click annotation box location.');
    toast('Leader point set. Now click where the annotation box should appear.');
    return;
  }

  const body = window.prompt('Annotation text:', 'Manual tag');
  if (!body || !body.trim()) {
    cancelManualTagMode();
    return;
  }

  createManualTag(state.anchor, point, body.trim(), ctx);
  cancelManualTagMode({ keepToast: true });
  document.getElementById('navisTagViewsBtn')?.click();
  window.setTimeout(() => document.getElementById('navisTagViewsBtn')?.click(), 80);
  toast('Manual tag viewpoint added.');
}

function blockCanvasMotion(event) {
  if (!state.active && !state.anchor) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function createManualTag(anchor, labelPoint, body, ctx) {
  const layer = ensureManualLayer(ctx.scene);
  if (!layer) return;

  const id = `manual-${Date.now()}-${state.counter++}`;
  const group = new THREE.Group();
  group.name = `NAVIS_MANUAL_TAG_${id}`;
  group.userData = {
    isDisplayHelper: true,
    TYPE: 'NAVIS_TAG_MARKUP',
    source: 'MANUAL',
    body
  };

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([anchor, labelPoint]),
    new THREE.LineBasicMaterial({ color: TAG_RED, depthTest: false, depthWrite: false })
  );
  line.name = `NAVIS_TAG_LEADER_${id}`;
  line.renderOrder = 1240;

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(anchor), 18, 10),
    new THREE.MeshBasicMaterial({ color: TAG_RED, depthTest: false })
  );
  marker.name = `NAVIS_TAG_ANCHOR_${id}`;
  marker.position.copy(anchor);
  marker.renderOrder = 1241;
  marker.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_ANCHOR', source: 'MANUAL' };

  const label = createTextPlane(body, {
    width: 760,
    height: 220,
    fontSize: 30,
    scale: Math.max(markerRadius(anchor) * 12, 0.85),
    bg: 'rgba(34, 12, 12, 0.94)',
    border: '#ff2b2b',
    name: `NAVIS_TAG_TEXT_${id}`
  });
  label.position.copy(labelPoint);
  label.renderOrder = 1242;
  label.material.depthTest = false;
  label.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', source: 'MANUAL', body };
  if (ctx.camera) label.lookAt(ctx.camera.position);

  group.add(line, marker, label);
  layer.add(group);
  window.__3D_MARKUP_SELECTED_OBJECT__ = group;
  window.dispatchEvent(new CustomEvent('markup:selected-object-changed', {
    detail: { object: group, source: 'manual-tag' }
  }));
}

function pickPoint(event, ctx) {
  const rect = ctx.renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, ctx.camera);

  const candidates = [];
  ctx.scene.traverse((object) => {
    if (!object.visible) return;
    if (object.userData?.isDisplayHelper || object.userData?.ignoreBounds) return;
    if (object.name?.startsWith('NAVIS_')) return;
    if (object.isMesh || object.isLine || object.isPoints) candidates.push(object);
  });

  const hit = raycaster.intersectObjects(candidates, false)[0];
  if (hit?.point) return hit.point.clone();

  const box = new THREE.Box3();
  for (const object of candidates) box.expandByObject(object);
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const planeNormal = ctx.camera.getWorldDirection(new THREE.Vector3()).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, center);
  const fallback = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, fallback) ? fallback : null;
}

function drawTemporaryAnchor(point, scene) {
  removeTemporaryAnchor();
  const layer = ensureManualLayer(scene);
  if (!layer) return;
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(point) * 1.25, 18, 10),
    new THREE.MeshBasicMaterial({ color: TAG_YELLOW, depthTest: false })
  );
  marker.name = 'NAVIS_TAG_PENDING_ANCHOR_MARKER';
  marker.position.copy(point);
  marker.renderOrder = 1235;
  marker.userData = { isDisplayHelper: true, ignoreBounds: true };
  layer.add(marker);
  state.tempHelper = marker;
}

function removeTemporaryAnchor() {
  if (state.tempHelper?.parent) state.tempHelper.parent.remove(state.tempHelper);
  disposeObject(state.tempHelper);
  state.tempHelper = null;
}

function ensureManualLayer(scene) {
  if (!scene) return null;
  let layer = scene.getObjectByName('NAVIS_MANUAL_TAG_DISPLAY_LAYER');
  if (!layer) {
    layer = new THREE.Group();
    layer.name = 'NAVIS_MANUAL_TAG_DISPLAY_LAYER';
    layer.userData = { isDisplayHelper: true, ignoreBounds: true };
    scene.add(layer);
  }
  return layer;
}

function setPendingAnchor(enabled) {
  let marker = document.querySelector(`[name="${PENDING_ANCHOR_NAME}"]`);
  if (enabled) {
    if (!marker) {
      marker = document.createElement('input');
      marker.type = 'hidden';
      marker.name = PENDING_ANCHOR_NAME;
      marker.value = '1';
      document.body.appendChild(marker);
    }
    return;
  }
  marker?.remove();
}

function cancelManualTagMode(options = {}) {
  if (!state.active && !state.anchor) return;
  state.active = false;
  state.anchor = null;
  setPendingAnchor(false);
  setButtonActive(false);
  removeTemporaryAnchor();
  setStatus('Manual Tag cancelled.');
  if (!options.keepToast) toast('Manual tag cancelled.');
}

function setButtonActive(active) {
  const btn = document.getElementById('navisTagBtn');
  btn?.classList.toggle('tool-active', Boolean(active));
  if (btn) btn.textContent = active ? 'Tag…' : 'Tag';
}

function getContext() {
  const live = window.__3D_MARKUP_CLIP_RUNTIME__ || runtime || {};
  const renderer = state.renderer || live.renderer;
  const scene = state.scene || live.scene;
  const camera = state.camera || live.camera;
  if (!renderer?.domElement || !scene || !camera) return null;
  return { renderer, scene, camera };
}

function markerRadius(point) {
  const camera = state.camera || runtime?.camera;
  if (!camera || !point) return 0.18;
  return Math.max(camera.position.distanceTo(point) * 0.006, 0.12);
}

function disposeObject(object) {
  if (!object) return;
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    const material = child.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose?.());
    else material?.dispose?.();
  });
}

function setStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = text;
}

function toast(message) {
  const log = document.getElementById('log');
  if (log) log.textContent = message;
  const status = document.getElementById('runtimeStatus');
  if (status && /manual tag|tag viewpoint|cancelled|leader point/i.test(message)) status.textContent = message;
}

function ensureStyles() {
  if (document.getElementById('navisManualTagSafeStyles')) return;
  const style = document.createElement('style');
  style.id = 'navisManualTagSafeStyles';
  style.textContent = `
    #navisTagBtn.tool-active {
      border-color: rgba(255, 43, 43, .75);
      background: rgba(255, 43, 43, .16);
      color: #ffd6d6;
    }
    body:has([name="${PENDING_ANCHOR_NAME}"]) .viewer-stage,
    body:has(#navisTagBtn.tool-active) .viewer-stage {
      cursor: crosshair;
    }
  `;
  document.head.appendChild(style);
}

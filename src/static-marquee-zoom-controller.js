import * as THREE from 'three';

// Adds a self-contained Marquee Zoom tool to the in-canvas right-side view pad.
// This intentionally avoids src/app.js so selection/orbit/conversion seams remain stable.

const TOOL_VIEW = 'marqueeZoom';
const MIN_DRAG_PX = 12;
const STYLE_ID = 'static-marquee-zoom-style';

let active = false;
let drag = null;
let overlay = null;
let button = null;

installMarqueeZoom();

function installMarqueeZoom() {
  const start = () => {
    injectStyles();
    ensureButton();
    attachCanvasListeners();
    window.__3D_MARKUP_MARQUEE_ZOOM__ = {
      activate,
      deactivate,
      isActive: () => active,
      zoomToClientRect
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function ensureButton() {
  const pad = document.querySelector('.view-pad');
  if (!pad) return;

  pad.classList.add('view-pad-with-marquee-zoom');
  button = pad.querySelector(`[data-view="${TOOL_VIEW}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = TOOL_VIEW;
    button.className = 'marquee-zoom-pad-btn';
    button.title = 'Marquee Zoom: drag a window to zoom into that area';
    button.setAttribute('aria-label', 'Marquee zoom');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span class="marquee-zoom-icon" aria-hidden="true">â–¢</span><span>MZ</span>';

    const zoomButton = pad.querySelector('[data-view="zoom"]');
    pad.insertBefore(button, zoomButton || null);
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    active ? deactivate('Marquee zoom off') : activate();
  });
}

function attachCanvasListeners() {
  const canvas = runtimeCanvas();
  if (!canvas || canvas.__marqueeZoomAttached) return;
  canvas.__marqueeZoomAttached = true;
  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointermove', onPointerMove, true);
  canvas.addEventListener('pointerup', onPointerUp, true);
  canvas.addEventListener('pointercancel', onPointerCancel, true);
  window.addEventListener('keydown', onKeyDown, true);
}

function runtimeCanvas() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer?.domElement
    || document.querySelector('#viewer canvas');
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function activate() {
  active = true;
  document.body.classList.add('marquee-zoom-active');
  if (button) {
    button.classList.add('tool-active');
    button.setAttribute('aria-pressed', 'true');
  }
  setStatus('Marquee zoom: drag a window in the canvas');
}

function deactivate(message = '') {
  active = false;
  drag = null;
  removeOverlay();
  document.body.classList.remove('marquee-zoom-active');
  if (button) {
    button.classList.remove('tool-active');
    button.setAttribute('aria-pressed', 'false');
  }
  if (message) setStatus(message);
}

function onPointerDown(event) {
  if (!active || event.button !== 0) return;
  const rt = runtime();
  if (!rt?.camera || !rt?.controls) {
    setStatus('Marquee zoom unavailable: viewer runtime missing');
    deactivate();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY
  };

  runtimeCanvas()?.setPointerCapture?.(event.pointerId);
  createOverlay(event.clientX, event.clientY);
}

function onPointerMove(event) {
  if (!active || !drag) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  drag.currentX = event.clientX;
  drag.currentY = event.clientY;
  updateOverlay();
}

function onPointerUp(event) {
  if (!active || !drag) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const rect = normalizedClientRect(drag.startX, drag.startY, event.clientX, event.clientY);
  const dragWidth = rect.right - rect.left;
  const dragHeight = rect.bottom - rect.top;
  runtimeCanvas()?.releasePointerCapture?.(drag.pointerId);
  removeOverlay();
  drag = null;

  if (dragWidth < MIN_DRAG_PX || dragHeight < MIN_DRAG_PX) {
    deactivate('Marquee zoom canceled');
    return;
  }

  const ok = zoomToClientRect(rect);
  deactivate(ok ? 'Marquee zoom applied' : 'Marquee zoom failed');
}

function onPointerCancel(event) {
  if (!active) return;
  runtimeCanvas()?.releasePointerCapture?.(event.pointerId);
  deactivate('Marquee zoom canceled');
}

function onKeyDown(event) {
  if (!active || event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  deactivate('Marquee zoom canceled');
}

function zoomToClientRect(clientRect) {
  const rt = runtime();
  const camera = rt?.camera;
  const controls = rt?.controls;
  const viewer = document.getElementById('viewer');
  if (!camera || !controls || !viewer) return false;

  const viewport = viewer.getBoundingClientRect();
  if (viewport.width <= 0 || viewport.height <= 0) return false;

  const clamped = clampRectToViewport(clientRect, viewport);
  const widthRatio = Math.max((clamped.right - clamped.left) / viewport.width, 0.01);
  const heightRatio = Math.max((clamped.bottom - clamped.top) / viewport.height, 0.01);
  const zoomRatio = Math.min(Math.max(Math.max(widthRatio, heightRatio) * 1.08, 0.035), 0.98);

  const centerClientX = (clamped.left + clamped.right) / 2;
  const centerClientY = (clamped.top + clamped.bottom) / 2;
  const ndc = new THREE.Vector2(
    ((centerClientX - viewport.left) / viewport.width) * 2 - 1,
    -(((centerClientY - viewport.top) / viewport.height) * 2 - 1)
  );

  const target = controls.target?.clone?.() || new THREE.Vector3();
  const viewDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const targetPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewDirection, target);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const nextTarget = new THREE.Vector3();
  const hitTargetPlane = raycaster.ray.intersectPlane(targetPlane, nextTarget);
  if (!hitTargetPlane) nextTarget.copy(target);

  const backVector = camera.position.clone().sub(target).normalize();
  const currentDistance = Math.max(camera.position.distanceTo(target), camera.near * 10, 0.001);
  const nextDistance = Math.max(currentDistance * zoomRatio, camera.near * 10, 0.001);

  camera.position.copy(nextTarget).add(backVector.multiplyScalar(nextDistance));
  controls.target.copy(nextTarget);
  controls.update?.();
  camera.updateProjectionMatrix?.();

  rt.renderOnce?.('marquee-zoom');
  window.dispatchEvent(new CustomEvent('viewer:marquee-zoom', {
    detail: {
      rect: {
        left: clamped.left,
        top: clamped.top,
        right: clamped.right,
        bottom: clamped.bottom,
        width: clamped.right - clamped.left,
        height: clamped.bottom - clamped.top
      },
      zoomRatio,
      rendererReady: Boolean(rt.renderer)
    }
  }));
  return true;
}

function createOverlay(clientX, clientY) {
  removeOverlay();
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  overlay = document.createElement('div');
  overlay.className = 'marquee-zoom-rect';
  viewer.appendChild(overlay);
  updateOverlay(clientX, clientY);
}

function updateOverlay() {
  if (!overlay || !drag) return;
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  const viewport = viewer.getBoundingClientRect();
  const rect = normalizedClientRect(drag.startX, drag.startY, drag.currentX, drag.currentY);
  const clamped = clampRectToViewport(rect, viewport);
  overlay.style.left = `${clamped.left - viewport.left}px`;
  overlay.style.top = `${clamped.top - viewport.top}px`;
  overlay.style.width = `${Math.max(clamped.right - clamped.left, 1)}px`;
  overlay.style.height = `${Math.max(clamped.bottom - clamped.top, 1)}px`;
}

function removeOverlay() {
  overlay?.remove?.();
  overlay = null;
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

function setStatus(text) {
  const node = document.getElementById('runtimeStatus');
  if (node) node.textContent = text;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .view-pad.view-pad-with-marquee-zoom {
      height: auto;
      min-height: 168px;
      grid-auto-rows: minmax(46px, 1fr);
    }
    .view-pad .marquee-zoom-pad-btn {
      color: #cfe8ff;
      border-color: rgba(55, 216, 255, .48);
    }
    .view-pad .marquee-zoom-pad-btn .marquee-zoom-icon {
      font-size: 15px;
      line-height: 1;
    }
    body.marquee-zoom-active #viewer canvas {
      cursor: crosshair !important;
    }
    .marquee-zoom-rect {
      position: absolute;
      z-index: 32;
      pointer-events: none;
      border: 2px solid rgba(55, 216, 255, .95);
      border-radius: 4px;
      background: rgba(43, 140, 255, .16);
      box-shadow: 0 0 0 1px rgba(4, 12, 23, .68), 0 10px 30px rgba(0, 0, 0, .26);
    }
  `;
  document.head.appendChild(style);
}

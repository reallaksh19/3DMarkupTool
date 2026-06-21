import * as THREE from 'three';

const VERSION = 'canvas-tool-mode-guard-20260621';

installCanvasToolModeGuard();

export function installCanvasToolModeGuard() {
  if (window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD__?.version === VERSION) return window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD__;
  const api = { version: VERSION, apply: applyGuardedControlMode, currentMode, debug: debugState };
  window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD__ = api;

  onReady(() => {
    bindToolButton('selectToolBtn');
    bindToolButton('orbitToolBtn');
    bindToolButton('panToolBtn');
    bindToolButton('measureBtn');
    applySoon('ready');
  });

  ['viewer:runtime-context', 'markup:render-context', 'viewer:model-loaded', 'viewer:app-module-loaded'].forEach((eventName) => {
    window.addEventListener(eventName, () => applySoon(eventName), { passive: true });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    window.setTimeout(() => {
      setActiveButton('select');
      applyGuardedControlMode('escape');
    }, 0);
  }, true);

  return api;
}

function onReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function bindToolButton(id) {
  const button = document.getElementById(id);
  if (!button || button.__canvasToolModeGuardBound) return;
  button.__canvasToolModeGuardBound = VERSION;
  button.addEventListener('click', () => window.setTimeout(() => applyGuardedControlMode(`button:${id}`), 0), true);
}

function applySoon(reason) {
  window.setTimeout(() => applyGuardedControlMode(reason), 0);
}

function applyGuardedControlMode(reason = 'guard') {
  const rt = runtime();
  const controls = rt.controls;
  if (!controls || canvasToolLocked()) return false;
  const mode = currentMode();
  controls.enabled = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = mode === 'orbit';
  controls.mouseButtons = {
    LEFT: mode === 'orbit' ? THREE.MOUSE.ROTATE : mode === 'pan' ? THREE.MOUSE.PAN : undefined,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  const canvas = rt.renderer?.domElement;
  if (canvas) canvas.dataset.canvasToolMode = mode;
  window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD_LAST__ = { reason, mode };
  return true;
}

function currentMode() {
  if (document.getElementById('measureBtn')?.classList.contains('active')) return 'measure';
  if (document.getElementById('panToolBtn')?.classList.contains('active')) return 'pan';
  if (document.getElementById('orbitToolBtn')?.classList.contains('active')) return 'orbit';
  return 'select';
}

function setActiveButton(mode) {
  const ids = { select: 'selectToolBtn', orbit: 'orbitToolBtn', pan: 'panToolBtn', measure: 'measureBtn' };
  Object.entries(ids).forEach(([candidate, id]) => {
    const button = document.getElementById(id);
    if (!button) return;
    const active = candidate === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function canvasToolLocked() {
  if (document.body.classList.contains('area-select-active')) return true;
  if (document.body.classList.contains('marquee-zoom-active')) return true;
  if (document.body.classList.contains('measure-polyline-active')) return true;
  if (document.body.classList.contains('canvas-review-pick-active')) return true;
  const interaction = window.__3D_MARKUP_CANVAS_INTERACTION__?.debug?.();
  const dispatch = window.__3D_MARKUP_CANVAS_ACTION_DISPATCH__?.debug?.();
  return Boolean(interaction?.controlsLocked || dispatch?.controlsLocked);
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function debugState() {
  const controls = runtime().controls;
  return {
    version: VERSION,
    mode: currentMode(),
    leftMouseAction: controls?.mouseButtons?.LEFT === THREE.MOUSE.ROTATE ? 'ROTATE' : controls?.mouseButtons?.LEFT === THREE.MOUSE.PAN ? 'PAN' : 'NONE',
    selectDisablesLeftOrbit: true,
    last: window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD_LAST__ || null
  };
}

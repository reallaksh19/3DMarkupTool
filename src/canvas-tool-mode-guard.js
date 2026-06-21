import * as THREE from 'three';

const VERSION = 'canvas-tool-mode-guard-20260621b';

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

  window.addEventListener('pointerdown', (event) => {
    if (event?.button === 0 && currentMode() !== 'orbit') applyGuardedControlMode('capture:pointerdown');
  }, true);
  window.addEventListener('pointerup', () => applySoon('capture:pointerup'), true);
  window.addEventListener('pointercancel', () => applySoon('capture:pointercancel'), true);
  window.addEventListener('blur', () => applySoon('window:blur'), true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    window.setTimeout(() => {
      setActiveButton('select');
      hardReleaseCanvasPointerState();
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
  const orbitMode = mode === 'orbit';
  const panMode = mode === 'pan';
  controls.enabled = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = orbitMode;
  controls.mouseButtons = {
    LEFT: orbitMode ? THREE.MOUSE.ROTATE : panMode ? THREE.MOUSE.PAN : undefined,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  const canvas = rt.renderer?.domElement;
  if (canvas) {
    canvas.dataset.canvasToolMode = mode;
    canvas.dataset.leftMouseAction = orbitMode ? 'ROTATE' : panMode ? 'PAN' : 'NONE';
  }
  window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD_LAST__ = { reason, mode, leftMouseAction: orbitMode ? 'ROTATE' : panMode ? 'PAN' : 'NONE' };
  return true;
}

function currentMode() {
  if (buttonActive('measureBtn')) return 'measure';
  if (buttonActive('panToolBtn')) return 'pan';
  if (buttonActive('orbitToolBtn')) return 'orbit';
  return 'select';
}

function buttonActive(id) {
  const button = document.getElementById(id);
  if (!button) return false;
  return button.classList?.contains?.('active')
    || button.classList?.contains?.('tool-active')
    || button.getAttribute?.('aria-pressed') === 'true';
}

function setActiveButton(mode) {
  const ids = { select: 'selectToolBtn', orbit: 'orbitToolBtn', pan: 'panToolBtn', measure: 'measureBtn' };
  Object.entries(ids).forEach(([candidate, id]) => {
    const button = document.getElementById(id);
    if (!button) return;
    const active = candidate === mode;
    button.classList.toggle('active', active);
    button.classList.toggle('tool-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function hardReleaseCanvasPointerState() {
  const rt = runtime();
  const canvas = rt.renderer?.domElement;
  if (!canvas) return;
  try {
    for (let pointerId = 1; pointerId <= 16; pointerId += 1) canvas.releasePointerCapture?.(pointerId);
  } catch {
    // Some browsers throw for pointer IDs that are not captured; ignore.
  }
  // Re-asserting non-orbit buttons after a missed pointerup prevents OrbitControls from
  // starting a new rotate gesture on the next left-drag in Select/Measure mode.
  if (currentMode() !== 'orbit') {
    rt.controls.enableRotate = false;
    rt.controls.mouseButtons = {
      LEFT: undefined,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
  }
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
  const left = controls?.mouseButtons?.LEFT;
  return {
    version: VERSION,
    mode: currentMode(),
    leftMouseAction: left === THREE.MOUSE.ROTATE ? 'ROTATE' : left === THREE.MOUSE.PAN ? 'PAN' : 'NONE',
    selectDisablesLeftOrbit: true,
    recognizesToolActiveClass: true,
    last: window.__3D_MARKUP_CANVAS_TOOL_MODE_GUARD_LAST__ || null
  };
}

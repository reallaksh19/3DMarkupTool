import assert from 'node:assert/strict';
import * as THREE from 'three';

function classList(active = false) {
  return {
    active,
    toolActive: active,
    contains(name) {
      if (name === 'active') return this.active;
      if (name === 'tool-active') return this.toolActive;
      return false;
    },
    toggle(name, value) {
      if (name === 'active') this.active = Boolean(value);
      if (name === 'tool-active') this.toolActive = Boolean(value);
    }
  };
}

function button(active = false) {
  return {
    ariaPressed: active ? 'true' : 'false',
    classList: classList(active),
    setAttribute(name, value) { if (name === 'aria-pressed') this.ariaPressed = String(value); },
    getAttribute(name) { return name === 'aria-pressed' ? this.ariaPressed : null; },
    addEventListener() {}
  };
}

const buttons = {
  selectToolBtn: button(true),
  orbitToolBtn: button(false),
  panToolBtn: button(false),
  measureBtn: button(false)
};
const canvas = { dataset: {}, releasePointerCapture() {} };
const controls = { enabled: true, enableZoom: true, enablePan: true, enableRotate: true, mouseButtons: {} };

const listeners = [];
global.document = {
  readyState: 'complete',
  body: { classList: { contains: () => false } },
  getElementById(id) { return buttons[id] || null; },
  addEventListener() {}
};
global.window = {
  addEventListener(name, fn, options) { listeners.push({ name, fn, options }); },
  setTimeout(fn) { fn(); return 0; },
  __3D_MARKUP_VIEWER_RUNTIME__: { controls, renderer: { domElement: canvas } }
};

const { installCanvasToolModeGuard } = await import('../src/canvas-tool-mode-guard.js');
const api = installCanvasToolModeGuard();

assert.equal(api.currentMode(), 'select');
assert.equal(api.apply('test-select'), true);
assert.equal(controls.enableRotate, false);
assert.equal(controls.mouseButtons.LEFT, undefined);
assert.equal(canvas.dataset.leftMouseAction, 'NONE');

buttons.selectToolBtn.classList.active = false;
buttons.selectToolBtn.classList.toolActive = false;
buttons.selectToolBtn.ariaPressed = 'false';
buttons.orbitToolBtn.classList.toolActive = true;
assert.equal(api.currentMode(), 'orbit');
assert.equal(api.apply('test-orbit'), true);
assert.equal(controls.enableRotate, true);
assert.equal(controls.mouseButtons.LEFT, THREE.MOUSE.ROTATE);
assert.equal(canvas.dataset.leftMouseAction, 'ROTATE');

buttons.orbitToolBtn.classList.toolActive = false;
buttons.panToolBtn.classList.toolActive = true;
assert.equal(api.currentMode(), 'pan');
assert.equal(api.apply('test-pan'), true);
assert.equal(controls.enableRotate, false);
assert.equal(controls.mouseButtons.LEFT, THREE.MOUSE.PAN);
assert.equal(canvas.dataset.leftMouseAction, 'PAN');

buttons.panToolBtn.classList.toolActive = false;
buttons.measureBtn.classList.toolActive = true;
assert.equal(api.currentMode(), 'measure');
assert.equal(api.apply('test-measure'), true);
assert.equal(controls.enableRotate, false);
assert.equal(controls.mouseButtons.LEFT, undefined);
assert.equal(canvas.dataset.leftMouseAction, 'NONE');

console.log(JSON.stringify({
  schema: 'canvas-tool-mode-guard-test',
  selectLeftMouse: 'NONE',
  orbitLeftMouse: 'ROTATE',
  panLeftMouse: 'PAN',
  measureLeftMouse: 'NONE',
  listenerCount: listeners.length
}, null, 2));

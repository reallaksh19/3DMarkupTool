import assert from 'node:assert/strict';
import * as THREE from 'three';

function classList(active = false) {
  return {
    active,
    contains(name) { return name === 'active' && this.active; },
    toggle(name, value) { if (name === 'active') this.active = Boolean(value); }
  };
}

const buttons = {
  selectToolBtn: { classList: classList(true), setAttribute() {}, addEventListener() {} },
  orbitToolBtn: { classList: classList(false), setAttribute() {}, addEventListener() {} },
  panToolBtn: { classList: classList(false), setAttribute() {}, addEventListener() {} },
  measureBtn: { classList: classList(false), setAttribute() {}, addEventListener() {} }
};
const controls = { enabled: true, enableZoom: true, enablePan: true, enableRotate: true, mouseButtons: {} };

global.document = {
  readyState: 'complete',
  body: { classList: { contains: () => false } },
  getElementById(id) { return buttons[id] || null; },
  addEventListener() {}
};
global.window = {
  addEventListener() {},
  setTimeout(fn) { fn(); return 0; },
  __3D_MARKUP_VIEWER_RUNTIME__: { controls, renderer: { domElement: { dataset: {} } } }
};

const { installCanvasToolModeGuard } = await import('../src/canvas-tool-mode-guard.js');
const api = installCanvasToolModeGuard();

assert.equal(api.currentMode(), 'select');
assert.equal(api.apply('test-select'), true);
assert.equal(controls.enableRotate, false);
assert.equal(controls.mouseButtons.LEFT, undefined);

buttons.selectToolBtn.classList.active = false;
buttons.orbitToolBtn.classList.active = true;
assert.equal(api.currentMode(), 'orbit');
assert.equal(api.apply('test-orbit'), true);
assert.equal(controls.enableRotate, true);
assert.equal(controls.mouseButtons.LEFT, THREE.MOUSE.ROTATE);

buttons.orbitToolBtn.classList.active = false;
buttons.panToolBtn.classList.active = true;
assert.equal(api.currentMode(), 'pan');
assert.equal(api.apply('test-pan'), true);
assert.equal(controls.enableRotate, false);
assert.equal(controls.mouseButtons.LEFT, THREE.MOUSE.PAN);

console.log(JSON.stringify({
  schema: 'canvas-tool-mode-guard-test',
  selectLeftMouse: 'NONE',
  orbitLeftMouse: 'ROTATE',
  panLeftMouse: 'PAN'
}, null, 2));

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const manager = readFileSync('src/static-canvas-tool-manager.js', 'utf8');
const shellBundle = readFileSync('src/static-shell-bundle-entry.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');
const safeLoader = readFileSync('src/safe-ui-loader.js', 'utf8');
const buildPages = readFileSync('scripts/build-pages.mjs', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(manager, /const VERSION = 'canvas-tool-manager-20260620'/);
assert.match(manager, /window\.__3D_MARKUP_VIEWER_READY__/);
assert.match(manager, /3dmarkup:viewer-ready/);
assert.match(manager, /canvas\.addEventListener\('pointerdown', onCanvasPointerDown, true\)/);
assert.match(manager, /event\.stopImmediatePropagation\?\.\(\)/);
assert.match(manager, /controls\.enabled = false/);
assert.match(manager, /controls\.enableRotate = false/);
assert.match(manager, /pickSafeComponentFromClientPoint/);
assert.match(manager, /selectSafeComponentsInClientRect/);
assert.match(manager, /selectionRule: 'safe-root-center-in-rect'/);
assert.match(manager, /coversMostOfModel/);
assert.match(manager, /startPickMode\('sectionBox'\)/);
assert.match(manager, /runVisibilityAction\('isolate'\)/);
assert.match(manager, /runVisibilityAction\('hide'\)/);
assert.match(manager, /staticTagBtn/);
assert.match(manager, /navis-manual-tag-safe-controller\.js/);
assert.doesNotMatch(manager, /MutationObserver\s*\(/);
assert.doesNotMatch(manager, /setInterval\s*\(/);

for (const stale of [
  'static-canvas-interaction-coordinator.js',
  'static-canvas-action-regression-controller.js',
  'static-canvas-action-dispatch-controller.js'
]) {
  assert.doesNotMatch(shellBundle, new RegExp(stale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${stale} must not be bundled into the production static shell`);
  assert.doesNotMatch(bootstrap, new RegExp(stale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${stale} must not be imported by the source bootstrap`);
}

assert.match(shellBundle, /static-canvas-tool-manager\.js/);
assert.match(shellBundle, /navis-manual-tag-safe-controller\.js/);
assert.ok(
  shellBundle.indexOf('static-canvas-tool-manager.js') > shellBundle.indexOf('static-review-ribbon-tools-controller.js'),
  'manager must load after review buttons so it can capture/own their actions in bundle mode'
);
assert.match(bootstrap, /static-canvas-tool-manager\.js/);
assert.match(bootstrap, /navis-manual-tag-safe-controller\.js/);
assert.match(safeLoader, /canvasToolManager/);
assert.doesNotMatch(safeLoader, /canvasActionDispatch/);
assert.match(buildPages, /selection-first-tools-20260620/);
assert.match(pkg.scripts.test, /canvas-action-dispatch-phase16\.test\.mjs/);

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
}

class FakeNode {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.classList = new ClassList();
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.textContent = '';
  }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  insertBefore(child) { return this.appendChild(child); }
  remove() { this.parentElement = null; }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item !== handler));
  }
  setAttribute(name, value) { this[name] = String(value); }
  getAttribute(name) { return this[name]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  click() { (this.listeners.get('click') || []).forEach((handler) => handler({ preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, target: this })); }
  getBoundingClientRect() { return { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

const windowTarget = new EventTarget();
globalThis.window = windowTarget;
window.location = { search: '' };
window.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
window.queueMicrotask = queueMicrotask;
window.setTimeout = setTimeout;
window.clearTimeout = clearTimeout;
window.console = console;
window.CSS = { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&') };
if (typeof globalThis.CustomEvent !== 'function') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.detail = init.detail;
    }
  };
}
window.CustomEvent = globalThis.CustomEvent;

const canvas = new FakeNode('canvas');
const viewer = new FakeNode('div', 'viewer');
viewer.appendChild(canvas);
const runtimeStatus = new FakeNode('div', 'runtimeStatus');
const body = new FakeNode('body');
const head = new FakeNode('head');
const nodes = new Map([
  ['viewer', viewer],
  ['runtimeStatus', runtimeStatus]
]);

globalThis.document = {
  readyState: 'complete',
  body,
  head,
  activeElement: null,
  baseURI: 'http://localhost/',
  addEventListener() {},
  removeEventListener() {},
  createElement: (tag) => new FakeNode(tag),
  getElementById: (id) => nodes.get(id) || null,
  querySelector: (selector) => (selector === '#viewer canvas' ? canvas : null),
  querySelectorAll: () => []
};

const scene = new THREE.Scene();
const modelRoot = new THREE.Group();
modelRoot.name = 'MODEL_ROOT';
scene.add(modelRoot);
const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 1000);
const controls = { enabled: true, enableRotate: true, enablePan: true, enableZoom: true, mouseButtons: { LEFT: 0 }, target: new THREE.Vector3(), update() {} };
const renderer = { domElement: canvas, localClippingEnabled: false, clippingPlanes: [] };
const runtime = {
  renderer,
  scene,
  camera,
  controls,
  modelRoot,
  getModelRoot: () => modelRoot,
  renderOnce() {},
  applyClipping(planes) { renderer.clippingPlanes = planes; },
  clearClipping() { renderer.clippingPlanes = []; }
};
window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

await import(`../src/static-canvas-tool-manager.js?runtime-smoke=${Date.now()}`);

assert.ok(window.__3D_MARKUP_VIEWER_READY__, 'manager should publish viewer-ready once runtime has canvas/camera/scene/controls');
assert.equal(canvas.listeners.get('pointerdown')?.length, 1, 'manager should bind one capture pointerdown listener to the runtime canvas');
assert.equal(typeof window.__3D_MARKUP_AREA_SELECT__.activate, 'function');
assert.equal(typeof window.__3D_MARKUP_SECTION_BOX__.apply, 'function');
assert.equal(typeof window.__3D_MARKUP_VIEWPAD_TOOLS__.hideSelected, 'function');

window.__3D_MARKUP_AREA_SELECT__.activate();
assert.equal(controls.enabled, false, 'Area Select must suppress OrbitControls');
assert.equal(controls.enableRotate, false, 'Area Select must suppress camera rotation');
window.__3D_MARKUP_CANVAS_TOOL_MANAGER__.cancelActiveTool('test');
assert.equal(controls.enabled, true, 'cancelActiveTool must restore OrbitControls enabled state');
assert.equal(controls.enableRotate, true, 'cancelActiveTool must restore rotation state');

console.log('canvas tool manager phase16 gate passed');

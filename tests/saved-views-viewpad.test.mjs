import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-saved-views-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-saved-views-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the saved views viewpad controller');
assert.match(bootstrap, /measure-polyline-viewpad-20260619/, 'safe bootstrap cache key must bump for the current view pad tool pack');

assert.match(controller, /const TOOL_VIEW = 'savedViews'/, 'controller must define a stable saved-views data-view key');
assert.match(controller, /Saved Views: save\/restore camera and clipping/, 'controller must expose a user-facing saved views tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /STORAGE_KEY = '3dmarkup\.savedViews\.v1'/, 'saved views must use a stable localStorage key');
assert.match(controller, /captureViewSnapshot/, 'controller must capture camera snapshots');
assert.match(controller, /captureClipping/, 'controller must capture clipping planes with saved views');
assert.match(controller, /restoreClipping/, 'controller must restore clipping planes with saved views');
assert.match(controller, /new THREE\.Plane/, 'saved clipping restoration must hydrate real THREE.Plane objects');
assert.match(controller, /viewer:saved-view/, 'saved view operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_SAVED_VIEWS__/, 'controller must publish a small runtime API for diagnostics');
assert.match(controller, /localStorage\.setItem\(STORAGE_KEY/, 'saved views must persist to localStorage');
assert.match(controller, /renderOnce|viewer:request-render/, 'saved view restore must request a render');

assert.match(pkg.scripts.test, /saved-views-viewpad\.test\.mjs/, 'npm test must include saved views viewpad gate');

console.log('saved-views-viewpad gate passed');

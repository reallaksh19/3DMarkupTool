import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync('src/static-marquee-zoom-controller.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(bootstrap, /static-marquee-zoom-controller\.js/, 'safe bootstrap must load marquee zoom controller');
assert.match(bootstrap, /viewpad-icons-context-saved-state-20260619/, 'safe bootstrap cache key must bump for the current view pad tool pack');

assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /Marquee Zoom: drag a window/, 'controller must expose a user-facing marquee zoom tooltip');
assert.match(controller, /viewer:marquee-zoom/, 'controller must dispatch a viewer marquee zoom event');
assert.match(controller, /setPointerCapture/, 'controller must capture pointer drag while marquee zoom is active');
assert.match(controller, /intersectPlane/, 'controller must frame the drag center on the current target plane');
assert.match(controller, /renderOnce\?\.\('marquee-zoom'\)/, 'controller must request a render after applying zoom');
assert.match(controller, /stopImmediatePropagation/, 'controller must stop app selection/orbit handlers during the marquee drag');
assert.match(controller, /__3D_MARKUP_MARQUEE_ZOOM__/, 'controller must publish a small runtime API for diagnostics');

assert.match(pkg.scripts.test, /marquee-zoom-viewpad\.test\.mjs/, 'npm test must include marquee zoom view-pad gate');

console.log('marquee-zoom-viewpad gate passed');

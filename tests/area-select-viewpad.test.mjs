import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-area-select-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-area-select-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the area select viewpad controller');
assert.match(bootstrap, /component-search-viewpad-20260619/, 'safe bootstrap cache key must bump for area select');

assert.match(controller, /const TOOL_VIEW = 'areaSelect'/, 'controller must define a stable area-select data-view key');
assert.match(controller, /Area Select: drag a window/, 'controller must expose a user-facing area select tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /setPointerCapture/, 'controller must capture pointer drag while area select is active');
assert.match(controller, /stopImmediatePropagation/, 'controller must stop app selection/orbit handlers during the area-select drag');
assert.match(controller, /new THREE\.Box3\(\)\.setFromObject/, 'controller must derive selection bounds from component objects');
assert.match(controller, /corner\.project\(camera\)/, 'controller must project component bounds to screen space');
assert.match(controller, /rectsIntersect/, 'controller must compare projected component rectangles to the marquee rectangle');
assert.match(controller, /new THREE\.BoxHelper/, 'controller must highlight selected components with helper boxes');
assert.match(controller, /viewer:area-select/, 'area select operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_AREA_SELECT__/, 'controller must publish a small runtime API for diagnostics');
assert.match(controller, /areaSelectHelper/, 'highlight helpers must be tagged so they are not selected recursively');

assert.match(pkg.scripts.test, /area-select-viewpad\.test\.mjs/, 'npm test must include area select viewpad gate');

console.log('area-select-viewpad gate passed');

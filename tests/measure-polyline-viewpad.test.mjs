import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-measure-polyline-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-measure-polyline-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the measure polyline viewpad controller');
assert.match(bootstrap, /explode-review-viewpad-20260619/, 'safe bootstrap cache key must bump for measure polyline');

assert.match(controller, /const TOOL_VIEW = 'measurePolyline'/, 'controller must define a stable measure-polyline data-view key');
assert.match(controller, /Measure Polyline: click points\/components/, 'controller must expose a user-facing measure tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /setPointerCapture|pointerdown/, 'controller must own pointer interaction while measuring');
assert.match(controller, /stopImmediatePropagation/, 'controller must stop app selection\/orbit handlers while measuring');
assert.match(controller, /raycaster\.intersectObjects/, 'controller must pick points from model/component surfaces');
assert.match(controller, /intersectPlane/, 'controller must fall back to the target plane when no geometry is hit');
assert.match(controller, /new THREE\.Line/, 'controller must draw segment helpers');
assert.match(controller, /new THREE\.SphereGeometry/, 'controller must draw point markers');
assert.match(controller, /distanceTo/, 'controller must calculate segment lengths using world distance');
assert.match(controller, /formatLength/, 'controller must format totals for the panel/status');
assert.match(controller, /viewer:measure-polyline/, 'measure operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_MEASURE_POLYLINE__/, 'controller must publish a small runtime API for diagnostics');
assert.match(controller, /measurePolylineHelper/, 'helper objects must be tagged so they are ignored by picking');

assert.match(pkg.scripts.test, /measure-polyline-viewpad\.test\.mjs/, 'npm test must include measure polyline viewpad gate');

console.log('measure-polyline-viewpad gate passed');

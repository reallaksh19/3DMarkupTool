import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-measure-polyline-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-measure-polyline-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the measure polyline viewpad controller');
assert.match(bootstrap, /esc-tools-export-icons-20260619/, 'safe bootstrap cache key must preserve the historical ESC/export/icon marker for rollback gates');

assert.match(controller, /const TOOL_VIEW = 'measurePolyline'/, 'controller must define a stable measure-polyline data-view key');
assert.match(controller, /Measure Polyline: click points\/components/, 'controller must expose a user-facing measure tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /setPointerCapture|pointerdown/, 'controller must own pointer interaction while measuring');
assert.match(controller, /stopImmediatePropagation/, 'controller must stop app selection\/orbit handlers while measuring');
assert.match(controller, /raycaster\.intersectObjects/, 'controller must pick points from model/component surfaces');
assert.match(controller, /intersectPlane/, 'controller must fall back to the target plane when no geometry is hit');
assert.match(controller, /new THREE\.Line/, 'controller must draw segment helpers');
assert.match(controller, /new THREE\.Points\(/, 'controller must draw point markers as screen-size points');
assert.match(controller, /new THREE\.PointsMaterial\([\s\S]*sizeAttenuation:\s*false/, 'point markers must not scale with model/world size');
assert.match(controller, /const POINT_MARKER_PIXEL_SIZE\s*=\s*8/, 'point marker size must be bounded in screen pixels');
assert.doesNotMatch(controller, /new THREE\.SphereGeometry/, 'measure markers must not use world-space spheres that can flash as large disks');
assert.doesNotMatch(controller, /pointMarkerRadius/, 'measure markers must not derive radius from full model bounds');
assert.match(controller, /distanceTo/, 'controller must calculate segment lengths using world distance');
assert.match(controller, /formatLength/, 'controller must format totals for the panel/status');
assert.match(controller, /viewer:measure-polyline/, 'measure operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_MEASURE_POLYLINE__/, 'controller must publish a small runtime API for diagnostics');
assert.match(controller, /markerMode:\s*'screen-size-points'/, 'diagnostics must report screen-size marker mode');
assert.match(controller, /measurePolylineHelper/, 'helper objects must be tagged so they are ignored by picking');
assert.match(controller, /function cancelMeasure\(\)/, 'Escape must have an explicit cancel path');
assert.match(controller, /requestRender\('measure-polyline-escape-clear'\)/, 'Escape must clear markers and request a render');
assert.match(controller, /cancel:\s*cancelMeasure/, 'runtime API must expose cancel for diagnostics/tests');

assert.match(pkg.scripts.test, /measure-polyline-viewpad\.test\.mjs/, 'npm test must include measure polyline viewpad gate');

console.log('measure-polyline-viewpad gate passed');

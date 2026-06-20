import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dispatch = readFileSync('src/static-canvas-action-dispatch-controller.js', 'utf8');
const shellBundle = readFileSync('src/static-shell-bundle-entry.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');
const safeLoader = readFileSync('src/safe-ui-loader.js', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(dispatch, /const VERSION = 'canvas-action-dispatch-phase16-20260620'/);
assert.match(dispatch, /patchAreaSelectApi\(\)/);
assert.match(dispatch, /api\.activate = .*activateAreaSelect/s);
assert.match(dispatch, /api\.selectInClientRect = .*selectAreaInClientRect/s);
assert.match(dispatch, /document\.body\.classList\.add\(AREA_CLASS\)/);
assert.match(dispatch, /canvas\.addEventListener\('pointerdown', onCanvasPointerDown, true\)/);
assert.match(dispatch, /event\.stopImmediatePropagation\?\.\(\)/);
assert.match(dispatch, /controls\.enabled = false/);
assert.match(dispatch, /controls\.enableRotate = false/);

assert.match(dispatch, /projectedObjectCenter\(/);
assert.match(dispatch, /pointInRect\(point, rect\)/);
assert.doesNotMatch(dispatch, /rectsIntersect\(/, 'Area Select must not select every object whose large projected box intersects the drag window.');

assert.match(dispatch, /patchSectionBoxApi\(\)/);
assert.match(dispatch, /api\.apply = \(\) => runSectionBoxAction\(\)/);
assert.match(dispatch, /startPickMode\('sectionBox'\)/);
assert.match(dispatch, /planesForBox\(/);
assert.match(dispatch, /new THREE\.Plane/g);

assert.match(dispatch, /patchViewpadApi\(\)/);
assert.match(dispatch, /api\.isolateSelected = \(\) => runVisibilityAction\('isolate'\)/);
assert.match(dispatch, /api\.hideSelected = \(\) => runVisibilityAction\('hide'\)/);
assert.match(dispatch, /isUnsafeRoot\(object\)/);
assert.match(dispatch, /object === root/);
assert.match(dispatch, /data\.TYPE === 'MODEL_ROOT'/);
assert.match(dispatch, /hideObject\(object\)/);
assert.match(dispatch, /if \(!object \|\| isUnsafeRoot\(object\)\) return/);

assert.doesNotMatch(dispatch, /MutationObserver\s*\(/);
assert.doesNotMatch(dispatch, /setInterval\s*\(/);
assert.doesNotMatch(dispatch, /viewer canvas.*traverse/s, 'No startup canvas binding should traverse the model.');

const order = [
  'static-canvas-action-regression-controller.js',
  'static-canvas-action-dispatch-controller.js',
  'static-navigation-smoothness-controller.js'
];
let last = -1;
for (const token of order) {
  const index = shellBundle.indexOf(token);
  assert.notEqual(index, -1, `${token} missing from bundle entry`);
  assert.ok(index > last, `${token} must load after previous canvas action layer`);
  last = index;
}

assert.match(bootstrap, /static-canvas-action-dispatch-controller\.js/);
assert.ok(
  bootstrap.indexOf('static-canvas-action-dispatch-controller.js') > bootstrap.indexOf('static-canvas-action-regression-controller.js'),
  'source bootstrap must load dispatch repair after phase15 regression repair'
);

assert.match(safeLoader, /canvasActionDispatch/);
assert.ok(
  safeLoader.indexOf('canvasActionDispatch') > safeLoader.indexOf('canvasActionRegression'),
  'legacy safe loader must load dispatch repair after phase15 regression repair'
);

assert.match(pkg.scripts.test, /canvas-action-dispatch-phase16\.test\.mjs/);
console.log('canvas action dispatch phase16 gate passed');

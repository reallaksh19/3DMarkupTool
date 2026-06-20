import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const action = readFileSync('src/static-canvas-action-regression-controller.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');
const bundle = readFileSync('src/static-shell-bundle-entry.js', 'utf8');
const markup = readFileSync('src/static-markup-core-controller.js', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(bootstrap, /static-canvas-action-regression-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Source bootstrap must load the canvas action regression controller.');
assert.match(bundle, /import '\.\/static-canvas-action-regression-controller\.js';/, 'Bundled static shell must load the canvas action regression controller.');
assert.ok(bundle.indexOf("./static-canvas-action-regression-controller.js") > bundle.indexOf("./static-review-ribbon-tools-controller.js"), 'Action regression controller must load after review ribbon APIs are available.');

assert.match(action, /staticTagBtn/, 'Regression controller must repair the grouped Tag button.');
assert.match(action, /navis-manual-tag-safe-controller\.js/, 'Tag group must load the real manual leader controller.');
assert.match(action, /launchManualLeaderTool/, 'Tag group must call the real manual leader action, not the placeholder.');
assert.match(action, /menu\.insertBefore\(button, note \|\| null\)/, 'Existing grouped buttons must be moved into their >> menu.');
assert.doesNotMatch(markup, /MutationObserver|setInterval\(/, 'Static markup core must not use layout observer/polling for grouped controls.');

assert.match(action, /patchAreaSelectApi/, 'Area Select API must be patched to expose safe roots.');
assert.match(action, /sanitizeRoots/, 'Area Select roots must be sanitized before Hide/Isolate/CSV.');
assert.match(action, /isRootSizedObject/, 'Area Select must reject model-root-sized selections.');
assert.match(action, /replaceAreaHighlights/, 'Unsafe Area Select highlights must be replaced with safe component highlights.');
assert.match(action, /AREA_SELECT_SAFE_/, 'Filtered Area Select helpers must be explicit and distinguishable.');

assert.match(action, /viewpad\.isolateSelected = \(\) => runVisibilityAction\('isolate'\)/, 'Isolate must route through safe action/pick mode.');
assert.match(action, /viewpad\.hideSelected = \(\) => runVisibilityAction\('hide'\)/, 'Hide must route through safe action/pick mode.');
assert.match(action, /sectionBox\.apply = \(\) => runSectionBoxAction\(\)/, 'Section Box must route through safe action/pick mode.');
assert.match(action, /startPickMode\('sectionBox'\)/, 'Section Box must enter canvas pick mode when no valid selection exists.');
assert.match(action, /startPickMode\(mode\)/, 'Hide/Isolate must enter canvas pick mode when no valid selection exists.');
assert.match(action, /lockControls/, 'Canvas pick mode must lock OrbitControls.');
assert.match(action, /controls\.enabled = false/, 'Canvas pick mode must disable OrbitControls.');
assert.match(action, /event\.stopImmediatePropagation\?\.\(\)/, 'Canvas pick pointer events must consume propagation before OrbitControls.');
assert.match(action, /raycaster\.intersectObject\(root, true\)/, 'Canvas pick mode must pick from model geometry on user action.');
assert.match(action, /applySectionBoxToTarget/, 'Section Box must apply six clipping planes from a picked component.');
assert.match(action, /new THREE\.Plane/g, 'Section Box repair must construct clipping planes.');
assert.equal((action.match(/new THREE\.Plane/g) || []).length, 6, 'Section Box must use exactly six clipping planes.');

assert.doesNotMatch(action, /setInterval\(/, 'Regression controller must not poll.');
assert.doesNotMatch(action, /new MutationObserver|MutationObserver\(/, 'Regression controller must not use MutationObserver.');
assert.doesNotMatch(action, /installCanvasActionRegression\(\)[\s\S]{0,240}\.traverse\(/, 'Regression controller must not traverse scene during startup.');
assert.match(action, /noPolling: true/, 'Diagnostics must state no polling.');
assert.match(action, /noMutationObserver: true/, 'Diagnostics must state no MutationObserver.');
assert.match(action, /noStartupSceneTraversal: true/, 'Diagnostics must state no startup scene traversal.');

assert.ok(pkg.scripts.test.includes('tests/canvas-action-regression-phase15.test.mjs'), 'npm test must include Phase 15 canvas action regression gate.');

console.log('canvas action regression phase15 gate passed');

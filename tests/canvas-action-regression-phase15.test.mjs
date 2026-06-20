import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync('src/static-canvas-tool-manager.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');
const bundle = readFileSync('src/static-shell-bundle-entry.js', 'utf8');
const markup = readFileSync('src/static-markup-core-controller.js', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(bootstrap, /static-canvas-tool-manager\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Source bootstrap must load the canvas tool manager.');
assert.match(bundle, /import '\.\/static-canvas-tool-manager\.js';/, 'Bundled static shell must load the canvas tool manager.');
assert.ok(bundle.indexOf("./static-canvas-tool-manager.js") > bundle.indexOf("./static-review-ribbon-tools-controller.js"), 'Manager must load after review ribbon APIs are available.');
assert.doesNotMatch(bootstrap, /static-canvas-action-regression-controller\.js/, 'Source bootstrap must not stack the old action regression controller.');
assert.doesNotMatch(bundle, /static-canvas-action-regression-controller\.js/, 'Bundle must not stack the old action regression controller.');

assert.match(manager, /staticTagBtn/, 'Manager must repair the grouped Tag button.');
assert.match(manager, /navis-manual-tag-safe-controller\.js/, 'Tag group must load the real manual leader controller.');
assert.match(manager, /startRealManualTag/, 'Tag group must call the real manual leader action, not the placeholder.');
assert.match(manager, /onDocumentClickCapture/, 'Manager must capture grouped/review clicks even if buttons render after manager load.');
assert.doesNotMatch(markup, /MutationObserver|setInterval\(/, 'Static markup core must not use layout observer/polling for grouped controls.');

assert.match(manager, /patchAreaSelectApi/, 'Area Select API must be patched to expose safe roots.');
assert.match(manager, /sanitizeTargets/, 'Area Select roots must be sanitized before Hide/Isolate/CSV.');
assert.match(manager, /coversMostOfModel/, 'Area Select must reject model-root-sized selections.');
assert.match(manager, /applyAreaHighlights/, 'Unsafe Area Select highlights must be replaced with safe component highlights.');
assert.match(manager, /AREA_SELECT_/, 'Filtered Area Select helpers must be explicit and distinguishable.');

assert.match(manager, /api\.isolateSelected = \(\) => runVisibilityAction\('isolate'\)/, 'Isolate must route through safe action/pick mode.');
assert.match(manager, /api\.hideSelected = \(\) => runVisibilityAction\('hide'\)/, 'Hide must route through safe action/pick mode.');
assert.match(manager, /api\.apply = \(\) => runSectionBoxAction\(\)/, 'Section Box must route through safe action/pick mode.');
assert.match(manager, /startPickMode\('sectionBox'\)/, 'Section Box must enter canvas pick mode when no valid selection exists.');
assert.match(manager, /startPickMode\(mode\)/, 'Hide/Isolate must enter canvas pick mode when no valid selection exists.');
assert.match(manager, /lockControls/, 'Canvas pick mode must lock OrbitControls.');
assert.match(manager, /controls\.enabled = false/, 'Canvas pick mode must disable OrbitControls.');
assert.match(manager, /event\.stopImmediatePropagation\?\.\(\)/, 'Canvas pick pointer events must consume propagation before OrbitControls.');
assert.match(manager, /raycaster\.intersectObject\(root, true\)/, 'Canvas pick mode must pick from model geometry on user action.');
assert.match(manager, /applySectionBox/, 'Section Box must apply six clipping planes from a picked component.');
assert.match(manager, /new THREE\.Plane/g, 'Section Box repair must construct clipping planes.');
assert.equal((manager.match(/new THREE\.Plane/g) || []).length, 6, 'Section Box must use exactly six clipping planes.');

assert.doesNotMatch(manager, /setInterval\(/, 'Manager must not poll.');
assert.doesNotMatch(manager, /new MutationObserver|MutationObserver\(/, 'Manager must not use MutationObserver.');
assert.doesNotMatch(manager.slice(0, manager.indexOf('function selectSafeComponentsInClientRect')), /\.traverse\s*\(/, 'Manager must not traverse scene during startup.');
assert.match(manager, /noPolling: true/, 'Diagnostics must state no polling.');
assert.match(manager, /noMutationObserver: true/, 'Diagnostics must state no MutationObserver.');
assert.match(manager, /noStartupSceneTraversal: true/, 'Diagnostics must state no startup scene traversal.');

assert.ok(pkg.scripts.test.includes('tests/canvas-action-regression-phase15.test.mjs'), 'npm test must include Phase 15 canvas action regression gate.');

console.log('canvas action regression phase15 gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const manager = read('src/static-canvas-tool-manager.js');
const bootstrap = read('src/safe-ui-bootstrap.js');
const bundle = read('src/static-shell-bundle-entry.js');
const safeLoader = read('src/safe-ui-loader.js');
const marquee = read('src/static-marquee-zoom-controller.js');
const area = read('src/static-area-select-controller.js');
const measure = read('src/static-measure-polyline-controller.js');
const manualTag = read('src/navis-manual-tag-safe-controller.js');
const pkg = JSON.parse(read('package.json'));

assert.match(manager, /canvas-tool-manager-20260620/, 'manager must carry the authoritative canvas tool version.');
assert.match(manager, /3dmarkup:viewer-ready/, 'manager must publish/listen to a stable viewer-ready contract.');
assert.match(manager, /viewer:runtime-context/, 'manager must listen for runtime context after deferred app boot.');
assert.match(manager, /markup:render-context/, 'manager must support render-context publication.');
assert.match(manager, /viewer:app-module-loaded/, 'manager must bind after the deferred app module loads.');
assert.match(manager, /runtime\(\)\?\.renderer\?\.domElement/, 'manager must bind to the real renderer canvas, not a guessed shell element.');
assert.match(manager, /canvas\.__canvasToolManagerVersion/, 'manager must bind canvas listeners idempotently.');
assert.match(manager, /controls\.enabled = false/, 'manager must disable OrbitControls while a canvas tool owns pointer input.');
assert.match(manager, /controls\.enableRotate = false/, 'manager must disable rotation during canvas-tool interaction.');
assert.match(manager, /controls\.enablePan = false/, 'manager must disable pan during canvas-tool interaction.');
assert.match(manager, /controls\.enableZoom = false/, 'manager must disable zoom during canvas-tool interaction.');
assert.match(manager, /restoreControls/, 'manager must restore the previous OrbitControls state.');
assert.match(manager, /state\.mode/, 'manager must expose one authoritative active canvas mode.');
assert.match(manager, /area-select-active/, 'Area Select must be treated as a canvas-owning mode.');
assert.match(manager, /navisTagBtn/, 'Manual Tag Leader must be bridged to the real controller.');
assert.match(manager, /selectSafeComponentsInClientRect/, 'manager must provide Area Select drag selection against the runtime canvas.');
assert.match(manager, /pickSafeComponentFromClientPoint/, 'manager must provide one-click pick for Box/Hide/Isolate.');
assert.match(manager, /stopImmediatePropagation/, 'manager must stop app/orbit handlers when it owns a pointer stream.');
assert.match(manager, /noPolling:\s*true/, 'manager diagnostics must declare no polling.');
assert.match(manager, /noMutationObserver:\s*true/, 'manager diagnostics must declare no MutationObserver.');
assert.match(manager, /noStartupSceneTraversal:\s*true/, 'manager diagnostics must declare no startup scene traversal.');
assert.doesNotMatch(manager, /setInterval\s*\(/, 'manager must not poll.');
assert.doesNotMatch(manager, /new\s+MutationObserver|MutationObserver\s*\(/, 'manager must not instantiate MutationObserver.');

assert.ok(bootstrap.indexOf('static-canvas-tool-manager.js') > bootstrap.indexOf('static-review-ribbon-tools-controller.js'), 'bootstrap must load manager after review ribbon so it can capture tool actions.');
assert.ok(bundle.indexOf("./static-canvas-tool-manager.js") > bundle.indexOf("./static-review-ribbon-tools-controller.js"), 'static shell bundle must import manager after review ribbon.');
assert.ok(bundle.includes("./navis-manual-tag-safe-controller.js"), 'static shell bundle must load the real manual tag controller for Tag >>.');
assert.match(safeLoader, /id:\s*'canvasToolManager'/, 'legacy safe UI loader must include the canvas tool manager.');
assert.doesNotMatch(bootstrap, /static-canvas-interaction-coordinator\.js/, 'source bootstrap must not stack the old coordinator over the manager.');
assert.doesNotMatch(bundle, /static-canvas-interaction-coordinator\.js/, 'bundle must not stack the old coordinator over the manager.');

assert.match(marquee, /canvas\.__marqueeZoomAttached/, 'Marquee Zoom must still expose its idempotent canvas attachment marker.');
assert.match(area, /canvas\.__areaSelectAttached/, 'Area Select must still expose its idempotent canvas attachment marker.');
assert.match(measure, /canvas\.__measurePolylineAttached/, 'Measure Polyline must still expose its idempotent canvas attachment marker.');
assert.match(manualTag, /pointerdown/, 'Manual Tag must still own pointerdown on the real canvas after manager bridge.');

assert.match(pkg.scripts.test, /canvas-interaction-tools-phase14\.test\.mjs/, 'npm test must include the Phase 14 canvas interaction gate.');

console.log('canvas interaction tools phase14 gate passed');

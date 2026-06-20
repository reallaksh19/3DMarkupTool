import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const coordinator = read('src/static-canvas-interaction-coordinator.js');
const bootstrap = read('src/safe-ui-bootstrap.js');
const bundle = read('src/static-shell-bundle-entry.js');
const safeLoader = read('src/safe-ui-loader.js');
const marquee = read('src/static-marquee-zoom-controller.js');
const area = read('src/static-area-select-controller.js');
const measure = read('src/static-measure-polyline-controller.js');
const manualTag = read('src/navis-manual-tag-safe-controller.js');
const pkg = JSON.parse(read('package.json'));

assert.match(coordinator, /canvas-interaction-phase14-20260620/, 'coordinator must carry the Phase 14 version.');
assert.match(coordinator, /viewer:runtime-context/, 'coordinator must listen for runtime context after deferred app boot.');
assert.match(coordinator, /markup:render-context/, 'coordinator must support render-context publication.');
assert.match(coordinator, /viewer:app-module-loaded/, 'coordinator must bind after the deferred app module loads.');
assert.match(coordinator, /runtime\(\)\?\.renderer\?\.domElement/, 'coordinator must bind to the real renderer canvas, not a guessed shell element.');
assert.match(coordinator, /canvas\.__canvasInteractionCoordinatorAttached/, 'coordinator must bind canvas listeners idempotently.');
assert.match(coordinator, /controls\.enabled = false/, 'coordinator must disable OrbitControls while a canvas tool owns pointer input.');
assert.match(coordinator, /controls\.enableRotate = false/, 'coordinator must disable rotation during canvas-tool interaction.');
assert.match(coordinator, /controls\.enablePan = false/, 'coordinator must disable pan during canvas-tool interaction.');
assert.match(coordinator, /controls\.enableZoom = false/, 'coordinator must disable zoom during canvas-tool interaction.');
assert.match(coordinator, /restoreOrbitControls/, 'coordinator must restore the previous OrbitControls state.');
assert.match(coordinator, /activeToolName/, 'coordinator must resolve active canvas tools from deterministic UI state.');
assert.match(coordinator, /area-select-active/, 'Area Select must be treated as a canvas-owning mode.');
assert.match(coordinator, /marquee-zoom-active/, 'Marquee Zoom must be treated as a canvas-owning mode.');
assert.match(coordinator, /measure-polyline-active/, 'Measure Polyline must be treated as a canvas-owning mode.');
assert.match(coordinator, /navisTagBtn/, 'Manual Tag Leader must be treated as a canvas-owning mode.');
assert.match(coordinator, /REBIND_MODULES = \[/, 'coordinator must re-arm tools that loaded before the canvas existed.');
assert.match(coordinator, /static-area-select-controller\.js/, 'coordinator must re-arm Area Select after canvas readiness.');
assert.match(coordinator, /static-measure-polyline-controller\.js/, 'coordinator must re-arm Measure Polyline after canvas readiness.');
assert.match(coordinator, /navis-manual-tag-safe-controller\.js/, 'coordinator must re-arm Manual Tag Leader after canvas readiness.');
assert.match(coordinator, /zoomToClientRect/, 'coordinator must provide a fallback Marquee Zoom drag path if the original canvas listener missed binding.');
assert.match(coordinator, /selectInClientRect/, 'coordinator must provide a fallback Area Select drag path if the original canvas listener missed binding.');
assert.match(coordinator, /stopImmediatePropagation/, 'coordinator fallback must stop app/orbit handlers when it owns a drag.');
assert.match(coordinator, /noPolling:\s*true/, 'coordinator diagnostics must declare no polling.');
assert.match(coordinator, /noMutationObserver:\s*true/, 'coordinator diagnostics must declare no MutationObserver.');
assert.match(coordinator, /noStartupSceneTraversal:\s*true/, 'coordinator diagnostics must declare no startup scene traversal.');
assert.doesNotMatch(coordinator, /setInterval\s*\(/, 'coordinator must not poll.');
assert.doesNotMatch(coordinator, /MutationObserver/, 'coordinator must not use MutationObserver.');
assert.doesNotMatch(coordinator, /\.traverse\s*\(/, 'coordinator must not traverse the scene.');

assert.ok(bootstrap.indexOf('static-canvas-interaction-coordinator.js') > bootstrap.indexOf('static-selection-resolver.js'), 'bootstrap must load coordinator after resolver.');
assert.ok(bootstrap.indexOf('static-canvas-interaction-coordinator.js') < bootstrap.indexOf('static-marquee-zoom-controller.js'), 'bootstrap must load coordinator before Marquee Zoom.');
assert.ok(bootstrap.indexOf('static-canvas-interaction-coordinator.js') < bootstrap.indexOf('static-area-select-controller.js'), 'bootstrap must load coordinator before Area Select.');
assert.ok(bootstrap.indexOf('static-canvas-interaction-coordinator.js') < bootstrap.indexOf('static-measure-polyline-controller.js'), 'bootstrap must load coordinator before Measure Polyline.');

assert.ok(bundle.indexOf("./static-canvas-interaction-coordinator.js") < bundle.indexOf("./static-marquee-zoom-controller.js"), 'static shell bundle must import coordinator before Marquee Zoom.');
assert.ok(bundle.indexOf("./static-canvas-interaction-coordinator.js") < bundle.indexOf("./static-area-select-controller.js"), 'static shell bundle must import coordinator before Area Select.');
assert.ok(bundle.indexOf("./static-canvas-interaction-coordinator.js") < bundle.indexOf("./static-measure-polyline-controller.js"), 'static shell bundle must import coordinator before Measure Polyline.');

assert.match(safeLoader, /id:\s*'canvasInteraction'/, 'legacy safe UI loader must include the canvas interaction coordinator.');
assert.ok(safeLoader.indexOf("id: 'canvasInteraction'") < safeLoader.indexOf("id: 'manualTag'"), 'canvas coordinator must load before Manual Tag in advanced safe UI mode.');

assert.match(marquee, /canvas\.__marqueeZoomAttached/, 'Marquee Zoom must still expose its idempotent canvas attachment marker.');
assert.match(area, /canvas\.__areaSelectAttached/, 'Area Select must still expose its idempotent canvas attachment marker.');
assert.match(measure, /canvas\.__measurePolylineAttached/, 'Measure Polyline must still expose its idempotent canvas attachment marker.');
assert.match(manualTag, /pointerdown/, 'Manual Tag must still own pointerdown on the real canvas after re-arm.');

assert.match(pkg.scripts.test, /canvas-interaction-tools-phase14\.test\.mjs/, 'npm test must include the Phase 14 canvas interaction gate.');

console.log('canvas interaction tools phase14 gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const manager = read('src/static-canvas-tool-manager.js');
const bootstrap = read('src/safe-ui-bootstrap.js');
const bundle = read('src/static-shell-bundle-entry.js');
const safeLoader = read('src/safe-ui-loader.js');
const marquee = read('src/static-marquee-zoom-controller.js');
const measure = read('src/static-measure-polyline-controller.js');
const manualTag = read('src/navis-manual-tag-safe-controller.js');
const pkg = JSON.parse(read('package.json'));

assert.match(manager, /canvas-tool-manager-20260620/);
assert.match(manager, /3dmarkup:viewer-ready/);
assert.match(manager, /viewer:runtime-context/);
assert.match(manager, /markup:render-context/);
assert.match(manager, /viewer:app-module-loaded/);
assert.match(manager, /runtime\(\)\?\.renderer\?\.domElement/);
assert.match(manager, /canvas\.__canvasToolManagerVersion/);
assert.match(manager, /controls\.enabled = false/);
assert.match(manager, /controls\.enableRotate = false/);
assert.match(manager, /controls\.enablePan = false/);
assert.match(manager, /controls\.enableZoom = false/);
assert.match(manager, /restoreControls/);
assert.match(manager, /state\.mode/);
assert.match(manager, /area-select-active/);
assert.match(manager, /navisTagBtn/);
assert.match(manager, /selectSafeComponentsInClientRect/);
assert.match(manager, /pickSafeComponentFromClientPoint/);
assert.match(manager, /stopImmediatePropagation/);
assert.match(manager, /patchAreaSelectApi/);
assert.match(manager, /patchSectionBoxApi/);
assert.match(manager, /runVisibilityAction\('hide'\)/);
assert.match(manager, /runVisibilityAction\('isolate'\)/);
assert.match(manager, /noPolling:\s*true/);
assert.match(manager, /noMutationObserver:\s*true/);
assert.match(manager, /noStartupSceneTraversal:\s*true/);
assert.doesNotMatch(manager, /setInterval\s*\(/);
assert.doesNotMatch(manager, /new\s+MutationObserver|MutationObserver\s*\(/);

assert.ok(bootstrap.indexOf('static-canvas-tool-manager.js') > bootstrap.indexOf('static-review-ribbon-tools-controller.js'));
assert.ok(bundle.indexOf('./static-canvas-tool-manager.js') > bundle.indexOf('./static-review-ribbon-tools-controller.js'));
assert.ok(bundle.includes('./navis-manual-tag-safe-controller.js'));
assert.match(safeLoader, /id:\s*'canvasToolManager'/);
assert.doesNotMatch(bootstrap, /static-canvas-interaction-coordinator\.js/);
assert.doesNotMatch(bundle, /static-canvas-interaction-coordinator\.js/);
assert.doesNotMatch(bootstrap, /static-area-select-controller\.js/);
assert.doesNotMatch(bundle, /static-area-select-controller\.js/);
assert.doesNotMatch(bootstrap, /static-section-box-from-selection-controller\.js/);
assert.doesNotMatch(bundle, /static-section-box-from-selection-controller\.js/);

assert.match(marquee, /canvas\.__marqueeZoomAttached/);
assert.match(measure, /canvas\.__measurePolylineAttached/);
assert.match(manualTag, /pointerdown/);
assert.match(pkg.scripts.test, /canvas-interaction-tools-phase14\.test\.mjs/);

console.log('canvas interaction tools phase14 gate passed');

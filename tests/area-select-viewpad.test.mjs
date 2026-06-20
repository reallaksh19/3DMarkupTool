import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync(new URL('../src/static-canvas-tool-manager.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const bundleEntry = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.doesNotMatch(bootstrap, /static-area-select-controller\.js/);
assert.doesNotMatch(bundleEntry, /static-area-select-controller\.js/);
assert.match(bootstrap, /static-canvas-tool-manager\.js\?v=\$\{SAFE_UI_VERSION\}/);
assert.match(bundleEntry, /static-canvas-tool-manager\.js/);
assert.match(manager, /areaSelect/);
assert.match(manager, /Area Select/);
assert.match(manager, /patchAreaSelectApi/);
assert.match(manager, /patchReviewButtons/);
assert.match(manager, /onDocumentClickCapture/);
assert.match(manager, /setPointerCapture/);
assert.match(manager, /stopImmediatePropagation/);
assert.match(manager, /new THREE\.Box3\(\)\.setFromObject/);
assert.match(manager, /project\(camera\)/);
assert.match(manager, /rectsIntersect|pointInRect/);
assert.match(manager, /new THREE\.BoxHelper/);
assert.match(manager, /viewer:area-select/);
assert.match(manager, /__3D_MARKUP_AREA_SELECT__/);
assert.match(manager, /areaSelectHelper/);
assert.match(pkg.scripts.test, /area-select-viewpad\.test\.mjs/);

console.log('area-select viewpad manager gate passed');

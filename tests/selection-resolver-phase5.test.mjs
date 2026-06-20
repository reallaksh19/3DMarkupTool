import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const resolver = read('src/static-selection-resolver.js');
const viewpad = read('src/static-viewpad-navigation-tools-controller.js');
const manager = read('src/static-canvas-tool-manager.js');
const bootstrap = read('src/safe-ui-bootstrap.js');
const bundleEntry = read('src/static-shell-bundle-entry.js');
const pkg = JSON.parse(read('package.json'));

['resolveSelectedObject', 'resolveComponentRoot', 'resolveSafeHideTarget', 'getAreaSelectedRoots', 'getSelectionSummary'].forEach((name) => {
  assert.match(resolver, new RegExp(`export function ${name}\\b`));
});

assert.match(resolver, /window\.__3D_MARKUP_SELECTION_RESOLVER__/);
assert.match(resolver, /data\.TYPE === 'MODEL_ROOT'/);
assert.match(resolver, /object === modelRoot/);
assert.doesNotMatch(resolver, /\.traverse\(/);
assert.doesNotMatch(resolver, /setInterval\(/);
assert.doesNotMatch(resolver, /MutationObserver/);

const resolverIndex = bootstrap.indexOf('static-selection-resolver.js');
assert.ok(resolverIndex > 0);
assert.ok(resolverIndex < bootstrap.indexOf('static-canvas-tool-manager.js'));
assert.ok(resolverIndex < bootstrap.indexOf('static-viewpad-navigation-tools-controller.js'));
assert.doesNotMatch(bootstrap, /static-area-select-controller\.js/);
assert.doesNotMatch(bootstrap, /static-section-box-from-selection-controller\.js/);
assert.match(bundleEntry, /static-selection-resolver\.js/);
assert.match(bundleEntry, /static-canvas-tool-manager\.js/);
assert.doesNotMatch(bundleEntry, /static-area-select-controller\.js/);
assert.doesNotMatch(bundleEntry, /static-section-box-from-selection-controller\.js/);
assert.match(viewpad, /static-selection-resolver\.js/);
assert.match(viewpad, /resolveSafeHideTarget/);
assert.doesNotMatch(viewpad, /function selectedComponentRoot/);
assert.doesNotMatch(viewpad, /function selectedObject/);
assert.doesNotMatch(viewpad, /setInterval\(/);
assert.match(manager, /static-selection-resolver\.js/);
assert.match(manager, /resolveSafeHideTarget/);
assert.match(manager, /isForbiddenRoot/);
assert.match(manager, /coversMostOfModel/);
assert.match(manager, /sanitizeTargets/);
assert.match(pkg.scripts.test, /selection-resolver-phase5\.test\.mjs/);

console.log('selection resolver phase 5 gate passed');

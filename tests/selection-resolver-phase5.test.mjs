import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const resolver = read('src/static-selection-resolver.js');
const viewpad = read('src/static-viewpad-navigation-tools-controller.js');
const sectionBox = read('src/static-section-box-from-selection-controller.js');
const bootstrap = read('src/safe-ui-bootstrap.js');
const bundleEntry = read('src/static-shell-bundle-entry.js');
const pkg = JSON.parse(read('package.json'));

for (const name of [
  'resolveSelectedObject',
  'resolveComponentRoot',
  'resolveSafeHideTarget',
  'getAreaSelectedRoots',
  'getSelectionSummary'
]) {
  assert.match(resolver, new RegExp(`export function ${name}\\b`), `resolver must export ${name}`);
}

assert.match(resolver, /window\.__3D_MARKUP_SELECTION_RESOLVER__/, 'resolver must expose a small runtime diagnostic API');
assert.match(resolver, /data\.TYPE === 'MODEL_ROOT'/, 'resolver must reject explicit model-root nodes');
assert.match(resolver, /object === modelRoot/, 'resolver must reject the model root itself');
assert.doesNotMatch(resolver, /\.traverse\(/, 'resolver must not traverse the scene at startup or during generic resolution');
assert.doesNotMatch(resolver, /setInterval\(/, 'resolver must not poll');
assert.doesNotMatch(resolver, /MutationObserver/, 'resolver must not use mutation observers');

const resolverIndex = bootstrap.indexOf('static-selection-resolver.js');
assert.ok(resolverIndex > 0, 'safe bootstrap must load the shared resolver');
assert.ok(resolverIndex < bootstrap.indexOf('static-area-select-controller.js'), 'resolver must load before area select');
assert.ok(resolverIndex < bootstrap.indexOf('static-viewpad-navigation-tools-controller.js'), 'resolver must load before viewpad tools');
assert.ok(resolverIndex < bootstrap.indexOf('static-section-box-from-selection-controller.js'), 'resolver must load before section box tools');
assert.match(bundleEntry, /import '\.\/static-selection-resolver\.js';[\s\S]*import '\.\/static-area-select-controller\.js';/, 'bundle entry must include resolver before tools');

assert.match(viewpad, /from '\.\/static-selection-resolver\.js'/, 'viewpad tools must use the shared resolver');
assert.match(viewpad, /resolveSafeHideTarget\(undefined, \{ runtime: rt \}\)/, 'hide/isolate must resolve a safe component target');
assert.doesNotMatch(viewpad, /function selectedComponentRoot/, 'viewpad must not carry a duplicate component resolver');
assert.doesNotMatch(viewpad, /function selectedObject/, 'viewpad must not carry a duplicate selected-object resolver');
assert.doesNotMatch(viewpad, /setInterval\(/, 'viewpad tools must not poll');
assert.match(viewpad, /Select a component\/part before Hide/, 'hide must reject missing/full-model selection with a user-facing message');

assert.match(sectionBox, /from '\.\/static-selection-resolver\.js'/, 'section box must use the shared resolver');
assert.match(sectionBox, /resolveSafeHideTarget\(undefined, \{ runtime: rt \}\)/, 'section box must refuse full-model unsafe targets');
assert.doesNotMatch(sectionBox, /function selectedComponentRoot/, 'section box must not carry a duplicate component resolver');
assert.doesNotMatch(sectionBox, /function selectedObject/, 'section box must not carry a duplicate selected-object resolver');
assert.match(sectionBox, /missing-safe-selection/, 'section box diagnostics must distinguish unsafe or missing selections');

assert.match(pkg.scripts.test, /selection-resolver-phase5\.test\.mjs/, 'npm test must include the selection resolver phase gate');

console.log('selection resolver phase 5 gate passed');

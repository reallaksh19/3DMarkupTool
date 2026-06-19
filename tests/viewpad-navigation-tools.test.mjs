import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-viewpad-navigation-tools-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(controller, /viewPrevious/, 'previous-view tool must be present');
assert.match(controller, /viewNext/, 'next-view tool must be present');
assert.match(controller, /isolateSelected/, 'isolate-selected tool must be present');
assert.match(controller, /hideSelected/, 'hide-selected tool must be present');
assert.match(controller, /showAll/, 'show-all tool must be present');
assert.match(controller, /__3D_MARKUP_VIEWPAD_TOOLS__/, 'diagnostic API must be exposed');
assert.match(controller, /viewer:visibility-tools/, 'visibility operations must dispatch diagnostics');
assert.match(controller, /viewer:view-history/, 'view history operations must dispatch diagnostics');
assert.match(controller, /renderOnce\?\.\('isolate-selected'\)/, 'isolate must request a render');
assert.match(controller, /renderOnce\?\.\('hide-selected'\)/, 'hide must request a render');
assert.match(controller, /renderOnce\?\.\('show-all'\)/, 'show all must request a render');
assert.match(controller, /view-pad-with-navigation-tools/, 'viewpad CSS hook must be installed');

assert.match(bootstrap, /static-viewpad-navigation-tools-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load viewpad navigation controller');
assert.match(bootstrap, /area-select-viewpad-20260619/, 'bootstrap cache key must be bumped for current viewpad tools');
assert.ok(pkg.scripts.test.includes('tests/viewpad-navigation-tools.test.mjs'), 'npm test must include viewpad navigation tools gate');

console.log('viewpad-navigation-tools gate passed');

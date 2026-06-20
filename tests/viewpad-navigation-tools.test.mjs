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
assert.match(controller, /'show-all'/, 'show all must retain the normal show-all render reason');
assert.match(controller, /'show-all-escape'/, 'Esc restore must retain a distinct show-all-escape render reason');
assert.match(controller, /view-pad-with-navigation-tools/, 'viewpad CSS hook must be installed');

assert.match(controller, /const visibilitySession = \{/, 'Phase 7 must track a reversible visibility session');
assert.match(controller, /clearVisibility:\s*\(\) => showAll\('api-clear-visibility'\)/, 'diagnostic API must expose explicit visibility clear');
assert.match(controller, /visibility:\s*getVisibilityState/, 'diagnostic API must expose visibility state');
assert.match(controller, /attachVisibilityEsc\(\)/, 'visibility tools must install Esc lifecycle handler');
assert.match(controller, /document\.addEventListener\('keydown', onVisibilityEscape, \{ capture: true \}\)/, 'Esc handler must be bounded and event-driven');
assert.match(controller, /event\.key !== 'Escape' \|\| !visibilitySession\.active/, 'Esc must only act when visibility session is active');
assert.match(controller, /showAll\('escape'\)/, 'Esc must restore visibility through Show All path');
assert.match(controller, /beginVisibilitySession\('isolate', selected, 'isolate-selected'/, 'isolate must start a visibility session');
assert.match(controller, /beginVisibilitySession\('hide', selected, 'hide-selected'/, 'hide must start or append to a visibility session');
assert.match(controller, /visibility-tool-active/, 'visibility session must expose a body state hook');
assert.match(controller, /visibility-isolate-active/, 'isolate state hook must be present');
assert.match(controller, /visibility-hide-active/, 'hide state hook must be present');
assert.match(controller, /resolveSafeHideTarget\(undefined, \{ runtime: rt \}\)/, 'hide/isolate must use the shared safe resolver');
assert.match(controller, /if \(!root \|\| !targets\.length \|\| !selected\)/, 'isolate must reject missing root or unsafe selection');
assert.match(controller, /getAreaSelectedRoots/, 'Phase 8 must support Area Select multi-target visibility actions.');
assert.doesNotMatch(controller, /root\.visible\s*=\s*false/, 'normal visibility tools must never hide the model root directly');
assert.doesNotMatch(controller, /setInterval\s*\(/, 'viewpad visibility lifecycle must not poll');
assert.doesNotMatch(controller, /MutationObserver/, 'viewpad visibility lifecycle must not use MutationObserver');

assert.match(bootstrap, /static-viewpad-navigation-tools-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load viewpad navigation controller');
assert.match(bootstrap, /perf-tdz-fix-20260620/, 'bootstrap cache key must remain date-stamped and auditable');
assert.ok(pkg.scripts.test.includes('tests/viewpad-navigation-tools.test.mjs'), 'npm test must include viewpad navigation tools gate');

console.log('viewpad-navigation-tools gate passed');

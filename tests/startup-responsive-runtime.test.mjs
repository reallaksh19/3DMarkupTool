import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-startup-responsive-runtime-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /STARTUP_RESPONSIVE_VERSION = 'startup-responsive-runtime-20260619'/, 'bootstrap must define the startup responsive cache key');
assert.match(bootstrap, /static-startup-responsive-runtime-controller\.js\?v=\$\{STARTUP_RESPONSIVE_VERSION\}/, 'bootstrap must load the startup responsive runtime controller');
assert.match(bootstrap, /static-review-ribbon-tools-controller\.js\?v=\$\{SAFE_UI_VERSION\}[\s\S]*static-startup-responsive-runtime-controller\.js\?v=\$\{STARTUP_RESPONSIVE_VERSION\}/, 'responsive runtime must load after the review ribbon integration');

const removedLateControllers = [
  'static-ui-stability-fixes-controller',
  'static-ribbon-usability-fixes-controller',
  'static-visible-shell-direct-fixes-controller',
  'static-review-tool-final-fixes-controller',
  'static-review-selection-actions-controller'
];
for (const name of removedLateControllers) {
  assert.doesNotMatch(bootstrap, new RegExp(name), `${name} must not be loaded during startup`);
}

assert.doesNotMatch(controller, /setInterval\s*\(/, 'startup responsive runtime must not use polling intervals');
assert.doesNotMatch(controller, /patchLoop|refreshAll|refreshVisibleShell|refreshActions/, 'controller must not use repeated patch-loop functions');
assert.match(controller, /\[40, 180, 600\]/, 'controller may only use bounded delayed refreshes for concurrent module startup');

assert.match(controller, /__3D_MARKUP_STARTUP_RESPONSIVE_RUNTIME__/, 'controller must expose diagnostics');
assert.match(controller, /noPolling: true/, 'diagnostics must report noPolling');
assert.match(controller, /forceInputControlsVisible/, 'input controls must be forced visible once/event-driven');
assert.match(controller, /No file chosen/, 'input status must show No file chosen');
assert.match(controller, /stabilizePreviewButtons/, 'GLB/RVM preview buttons must be stabilized without alias polling');
assert.match(controller, /window\.__3D_MARKUP_AREA_SELECT__ = \{/, 'Area Select API must be provided');
assert.match(controller, /window\.__3D_MARKUP_SECTION_BOX__ = \{/, 'Section Box API must be provided');
assert.match(controller, /window\.__3D_MARKUP_VIEWPAD_TOOLS__ = \{/, 'visibility tools API must be provided');
assert.match(controller, /window\.__3D_MARKUP_EXPLODE_REVIEW__ = \{/, 'Explode API must be provided');
assert.match(controller, /window\.__3D_MARKUP_SELECTED_PROPERTIES_EXPORT__ = \{/, 'selected properties export API must be provided');
assert.match(controller, /installGlobalEscape/, 'global Escape handler must be installed');

const testScript = pkg.scripts.test;
assert.match(testScript, /startup-responsive-runtime\.test\.mjs/, 'npm test must include the startup responsive runtime gate');
for (const oldGate of ['ui-stability-fixes', 'ribbon-usability-fixes', 'review-tool-final-fixes', 'visible-shell-direct-fixes', 'review-selection-actions']) {
  assert.doesNotMatch(testScript, new RegExp(`${oldGate}\\.test\\.mjs`), `${oldGate} gate must be replaced by the startup responsive gate`);
}

console.log('startup responsive runtime gate passed');

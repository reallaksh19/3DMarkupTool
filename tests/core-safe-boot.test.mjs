import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../src/static-input-pinned-controls-controller.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /CORE_SAFE_BOOT_VERSION = 'core-safe-boot-20260619'/, 'bootstrap must use the core-safe boot cache key');
assert.match(bootstrap, /static-input-pinned-controls-controller\.js\?v=\$\{CORE_SAFE_BOOT_VERSION\}/, 'only the tiny input helper should load in the default core startup path');
assert.match(bootstrap, /optionalUiDefault: false/, 'optional UI must be disabled by default');
assert.match(bootstrap, /noReviewControllersOnStartup: true/, 'review controllers must not be eager-loaded');
assert.match(bootstrap, /params\.get\('uiExtras'\) === '1'/, 'advanced UI must be explicit opt-in');

const eagerForbidden = [
  'static-review-ribbon-tools-controller',
  'static-startup-responsive-runtime-controller',
  'static-area-select-controller',
  'static-section-box-from-selection-controller',
  'static-explode-review-controller',
  'static-measure-polyline-controller',
  'static-review-selection-actions-controller',
  'static-visible-shell-direct-fixes-controller',
  'static-ribbon-usability-fixes-controller',
  'static-ui-stability-fixes-controller'
];
for (const name of eagerForbidden) {
  assert.doesNotMatch(bootstrap, new RegExp(name), `${name} must not be in the default startup import path`);
}

assert.doesNotMatch(bootstrap, /setInterval\s*\(/, 'bootstrap must not poll');
assert.doesNotMatch(helper, /setInterval\s*\(/, 'input helper must not poll');
assert.doesNotMatch(helper, /new THREE|traverse\s*\(/, 'input helper must not touch the scene');
assert.match(helper, /No file chosen/, 'input helper must expose the requested file status');
assert.match(helper, /panel-section:first-of-type/, 'input helper must pin the first input section');
assert.match(helper, /__3D_MARKUP_CORE_INPUT_PINNED__/, 'input helper must expose diagnostics');
assert.match(pkg.scripts.test, /core-safe-boot\.test\.mjs/, 'npm test must include the core-safe boot gate');

const disabledUiGates = [
  'input-drawer-collapse-contract',
  'marquee-zoom-viewpad',
  'viewpad-navigation-tools',
  'section-box-viewpad',
  'area-select-viewpad',
  'saved-views-viewpad',
  'component-search-viewpad',
  'measure-polyline-viewpad',
  'explode-review-viewpad',
  'saved-views-context-extension',
  'viewpad-icons-context-menu',
  'startup-responsive-runtime'
];
for (const gate of disabledUiGates) {
  assert.doesNotMatch(pkg.scripts.test, new RegExp(`${gate}\\.test\\.mjs`), `${gate} must not run in emergency core-safe npm test`);
}

console.log('core safe boot startup gate passed');

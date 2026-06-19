import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-section-box-from-selection-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-section-box-from-selection-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the section box viewpad controller');
assert.match(bootstrap, /viewpad-icons-context-saved-state-20260619/, 'safe bootstrap cache key must bump for the current viewpad tool pack');

assert.match(controller, /const TOOL_VIEW = 'sectionBoxSelected'/, 'controller must define a stable viewpad data-view key');
assert.match(controller, /Section Box from selected component/, 'controller must expose a user-facing tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /new THREE\.Box3\(\)\.setFromObject/, 'controller must derive bounds from the selected object');
assert.match(controller, /new THREE\.Plane/g, 'section box must generate planes');
assert.match(controller, /viewer:section-box/, 'section box operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_SECTION_BOX__/, 'controller must publish a small runtime API for diagnostics');
assert.match(controller, /renderOnce|viewer:request-render/, 'controller must request render after applying section box');

assert.match(pkg.scripts.test, /section-box-viewpad\.test\.mjs/, 'npm test must include section box viewpad gate');

console.log('section-box-viewpad gate passed');

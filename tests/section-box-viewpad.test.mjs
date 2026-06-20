import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-section-box-from-selection-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const bundleEntry = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-section-box-from-selection-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the section box viewpad controller');
assert.match(bootstrap, /esc-tools-export-icons-20260619/, 'safe bootstrap cache key must preserve rollback/cache audit markers');
assert.match(bundleEntry, /static-section-box-from-selection-controller\.js/, 'production static-shell bundle must include section box controller');

assert.match(controller, /const VERSION = 'section-box-phase6-20260620'/, 'section box must have the phase 6 version marker');
assert.match(controller, /const TOOL_VIEW = 'sectionBoxSelected'/, 'controller must define a stable viewpad data-view key');
assert.match(controller, /Section Box from selected component/, 'controller must expose a user-facing tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /resolveSafeHideTarget\(undefined, \{ runtime: rt \}\)/, 'section box must use the shared safe selection resolver');
assert.doesNotMatch(controller, /runtime\.selectedObject\s*\|\|/, 'section box must not depend on stale runtime.selectedObject fallback chains');
assert.doesNotMatch(controller, /selectedMesh\s*\|\|/, 'section box must not implement its own selectedMesh fallback chain');
assert.match(controller, /new THREE\.Box3\(\)\.setFromObject/, 'controller must derive bounds from the selected safe component object');
assert.match(controller, /new THREE\.Plane/g, 'section box must generate six clipping planes');
assert.match(controller, /planes\.length/, 'section box state/diagnostics must record plane count');
assert.match(controller, /renderer\.clippingPlanes = planes/, 'section box must apply planes to the renderer');
assert.match(controller, /renderer\.localClippingEnabled = true/, 'section box must enable local renderer clipping when applied');
assert.match(controller, /clearSectionBox\(\{ source: 'escape' \}\)/, 'Esc must clear an active section box');
assert.match(controller, /STATE\.active/, 'controller must track active section box lifecycle');
assert.match(controller, /escapeClears: true/, 'debug snapshot must report Esc clear support');
assert.match(controller, /viewer:section-box/, 'section box operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_SECTION_BOX__/, 'controller must publish a small runtime API for diagnostics');
assert.match(controller, /renderOnce|viewer:request-render/, 'controller must request render after applying section box');

assert.doesNotMatch(controller, /setInterval\s*\(/, 'section box must not use polling loops');
assert.doesNotMatch(controller, /MutationObserver/, 'section box must not use MutationObserver');
assert.doesNotMatch(controller, /scene\.traverse|\.traverse\s*\(/, 'section box must not traverse scene at startup or tool install');

assert.match(pkg.scripts.test, /section-box-viewpad\.test\.mjs/, 'npm test must include section box viewpad gate');

console.log('section-box-viewpad phase 6 gate passed');

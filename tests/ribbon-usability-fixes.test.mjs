import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-ribbon-usability-fixes-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /USABILITY_FIX_VERSION = 'ribbon-usability-fixes-20260619'/, 'bootstrap must define a cache key for the ribbon usability fix pass');
assert.match(bootstrap, /static-ribbon-usability-fixes-controller\.js\?v=\$\{USABILITY_FIX_VERSION\}/, 'bootstrap must load the ribbon usability fixes after the existing tool controllers');

assert.match(controller, /removeTopReviewMenu/, 'review top dropdown duplication must be removed');
assert.match(controller, /#topReviewMenu \{ display: none !important; \}/, 'top Review menu must be hidden even if a previous controller recreates it');
assert.match(controller, /movePreviewButtonsToViewFit/, 'GLB\/RVM preview buttons must be moved into the View\/Fit group');
assert.match(controller, /viewFitCollapseToggleBtn/, 'View\/Fit group must have a >>\/<< collapse expander');
assert.match(controller, /data-view-collapse-extra/, 'secondary View\/Fit controls must be collapsible');
assert.match(controller, /input-drawer \.panel-section:first-of-type/, 'Input section must stay sticky and visible');

assert.match(controller, /window\.__3D_MARKUP_AREA_SELECT__ = \{/, 'area select API must be replaced by the robust runtime implementation');
assert.match(controller, /canvas\.addEventListener\('pointerdown', onAreaPointerDown, true\)/, 'area select must attach to the live canvas, not only a stale startup canvas');
assert.match(controller, /collectComponentRoots/, 'area select must use robust component-root discovery');

assert.match(controller, /window\.__3D_MARKUP_SECTION_BOX__ = \{/, 'section box API must be patched');
assert.match(controller, /rt\?\.getSelectedObject\?\.\(\)/, 'section box selection must use the runtime selection bridge');
assert.match(controller, /renderer\.clippingPlanes = planes/, 'section box must apply renderer clipping planes');

assert.match(controller, /window\.__3D_MARKUP_MEASURE_POLYLINE__ = \{/, 'measure polyline API must be replaced by the flicker-safe implementation');
assert.doesNotMatch(controller, /Math\.max\(size \* 0\.003, 5\)/, 'measure marker radius must not use the old absolute 5-unit minimum');
assert.match(controller, /return clamp\(size \* 0\.0007, size \* 0\.00025, size \* 0\.0025\)/, 'measure marker radius must be small and model-relative before marker creation');

assert.match(pkg.scripts.test, /ribbon-usability-fixes\.test\.mjs/, 'npm test must include ribbon usability regression gate');

console.log('ribbon-usability-fixes gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const stability = readFileSync(new URL('../src/static-ui-stability-fixes-controller.js', import.meta.url), 'utf8');
const quickExport = readFileSync(new URL('../src/static-quick-export-core-controller.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-ui-stability-fixes-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the UI stability fixes controller');
assert.match(bootstrap, /static-review-ribbon-tools-controller\.js\?v=\$\{SAFE_UI_VERSION\}[\s\S]*static-ui-stability-fixes-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'stability fixes must load after review ribbon tools so they can patch APIs');
assert.match(bootstrap, /esc-tools-export-icons-20260619/, 'bootstrap cache key must be bumped for the ESC/export/icon stability pass');

assert.match(stability, /window\.addEventListener\('keydown'[\s\S]*event\.key !== 'Escape'/, 'stability controller must install a global Escape key handler');
assert.match(stability, /runGlobalEscape/, 'stability controller must centralize Escape cleanup');
assert.match(stability, /__3D_MARKUP_UI_STABILITY_FIXES__/, 'stability controller must publish diagnostics API');
assert.match(stability, /__3D_MARKUP_MARQUEE_ZOOM__/, 'Escape cleanup must cancel marquee zoom');
assert.match(stability, /__3D_MARKUP_AREA_SELECT__/, 'Escape cleanup must cancel area select');
assert.match(stability, /__3D_MARKUP_MEASURE_POLYLINE__/, 'Escape cleanup must exit measure polyline');
assert.match(stability, /staticComponentSearchPanel/, 'Escape cleanup must close component search panel');
assert.match(stability, /staticSavedViewsPanel/, 'Escape cleanup must close saved views panel');
assert.match(stability, /staticExplodeReviewPanel/, 'Escape cleanup must close/reset explode panel');

assert.match(stability, /patchViewpadVisibilityApi/, 'stability controller must patch isolate/hide/show APIs');
assert.match(stability, /getSelectedObject\?\.\(\)/, 'selection lookup must use the runtime bridge getSelectedObject method');
assert.match(stability, /window\.__3D_MARKUP_SELECTED_OBJECT__/, 'selection lookup must support global selected object state');
assert.match(stability, /robustIsolateSelected/, 'stability controller must provide robust isolate behavior');
assert.match(stability, /robustHideSelected/, 'stability controller must provide robust hide behavior');
assert.match(stability, /robustShowAll/, 'stability controller must provide robust show-all behavior');

assert.match(stability, /robustApplyExplode/, 'stability controller must provide robust explode apply behavior');
assert.match(stability, /data-review-tool=\"explodeReview\"/, 'explode ribbon clicks must be intercepted so the tool applies from the ribbon');
assert.match(stability, /data-review-menu-tool=\"explodeReview\"/, 'explode menu clicks must be intercepted so the tool applies from menus');
assert.match(stability, /__ribbonExplodeOriginalPosition/, 'explode reset must restore original object positions');

assert.match(stability, /normalizeMeasureHelpers/, 'stability controller must normalize measure helper marker sizing');
assert.match(stability, /MEASURE_POINT_/, 'measure helper normalization must target point markers only');
assert.doesNotMatch(stability, /Math\.max\([^\n]*,\s*5\)/, 'stability marker sizing must not reintroduce a 5-unit absolute minimum');
assert.match(stability, /--review-ribbon-icon-size:\s*20px/, 'review ribbon icons must normalize to the same 20px size as base tool icons');
assert.match(stability, /#quickExportGroup \{ display: none !important; \}/, 'stability CSS must suppress any stale quick export group');

assert.match(quickExport, /topbar-export-menu-only/, 'quick export controller must operate in topbar Export menu only mode');
assert.match(quickExport, /removeQuickExportGroup/, 'quick export controller must remove the old duplicate ribbon export group');
assert.doesNotMatch(quickExport, /createQuickExportGroup/, 'quick export controller must not create a duplicate GLB/RVM/ATT/QA ribbon group');
assert.doesNotMatch(quickExport, /ribbon\.appendChild\(group\)|previewGroup\.after\(group\)/, 'quick export controller must not append a quick export group to the ribbon');

assert.match(pkg.scripts.test, /ui-stability-fixes\.test\.mjs/, 'npm test must include UI stability fixes gate');

console.log('ui-stability-fixes gate passed');

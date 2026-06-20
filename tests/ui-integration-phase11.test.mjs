import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const reviewRibbon = readFileSync(new URL('../src/static-review-ribbon-tools-controller.js', import.meta.url), 'utf8');
const topbar = readFileSync(new URL('../src/static-topbar-layout-controller.js', import.meta.url), 'utf8');
const phase3 = readFileSync(new URL('../src/static-ribbon-dropdown-cleanup-controller.js', import.meta.url), 'utf8');
const safeBootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const bundleEntry = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');

assert.match(index, /id="staticReviewRibbonGroup"[\s\S]*aria-label="Review tools"/);
assert.match(index, /id="topReviewMenu"[\s\S]*review-top-menu-popover/);

[
  'static-selection-resolver.js',
  'static-viewpad-navigation-tools-controller.js',
  'static-explode-review-controller.js',
  'static-measure-polyline-controller.js',
  'static-review-ribbon-tools-controller.js',
  'static-canvas-tool-manager.js'
].forEach((moduleName) => {
  assert.match(bundleEntry, new RegExp(moduleName.replace('.', '\\.')));
});

assert.doesNotMatch(bundleEntry, /static-area-select-controller\.js/);
assert.doesNotMatch(bundleEntry, /static-section-box-from-selection-controller\.js/);
assert.doesNotMatch(safeBootstrap, /static-area-select-controller\.js/);
assert.doesNotMatch(safeBootstrap, /static-section-box-from-selection-controller\.js/);

[
  ['topMarkupMenu', 'Markup', 'staticTagBtn', 'staticIsonoteXmlBtn', 'staticImportXmlBtn'],
  ['topSessionMenu', 'Session', 'staticSaveSessionBtn', 'staticRestoreSessionBtn', 'staticClearSessionBtn'],
  ['topExportMenu', 'Export', 'downloadGlbBtn', 'downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn']
].forEach(([menuId, label, ...expectedIds]) => {
  assert.match(topbar, new RegExp(`ensureMenu\\('${menuId}', '${label}'`));
  expectedIds.forEach((id) => assert.match(topbar, new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

assert.match(topbar, /menuItemHtml\(source, itemId\)/);
assert.match(topbar, /sourceIcon[\s\S]*<span>\$\{escapeHtml\(label\)\}<\/span>/);
assert.match(topbar, /mode:\s*shouldEnableFullTopbarLayout\(\) \? 'full-opt-in' : 'static-shell'/);

[
  'Zoom Box', 'Area Select', 'Clear Selection', 'Export Selected CSV', 'Search / Jump',
  'Section Box', 'Isolate Selected', 'Hide Selected', 'Show All', 'Saved Views',
  'Previous View', 'Next View', 'Measure Polyline', 'Explode Review', 'Reassemble / Reset'
].forEach((label) => assert.match(reviewRibbon, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));

assert.match(reviewRibbon, /api:\s*\['__3D_MARKUP_EXPLODE_REVIEW__', 'open'\]/);
assert.match(reviewRibbon, /api:\s*\['__3D_MARKUP_EXPLODE_REVIEW__', 'reassemble'\]/);
assert.match(reviewRibbon, /item\.appendChild\(iconNode\(tool\.icon/);
assert.match(reviewRibbon, /item\.appendChild\(textNode\('span', tool\.menuLabel \|\| tool\.label/);
assert.match(reviewRibbon, /button\.replaceChildren\(iconNode\(tool\.icon, 'review-ribbon-tool-icon'\), textNode\('span', tool\.label\)\)/);

['MZ', 'AS', 'XP', 'SR'].forEach((shortcut) => assert.doesNotMatch(reviewRibbon, new RegExp(`label:\\s*['"]${shortcut}['"]`)));

[
  ['review ribbon integration', reviewRibbon],
  ['topbar layout', topbar],
  ['phase3 ribbon cleanup', phase3]
].forEach(([name, source]) => {
  assert.doesNotMatch(source, /setInterval\(/, `${name} must not use polling.`);
  assert.doesNotMatch(source, /MutationObserver/, `${name} must not use MutationObserver for UI layout.`);
  assert.doesNotMatch(source, /\.traverse\(/, `${name} must not traverse scene content at startup.`);
});

assert.doesNotMatch(reviewRibbon, /RETRY_MS|MAX_RETRIES|retryRefresh/);
assert.match(reviewRibbon, /noPolling:\s*true/);
assert.match(reviewRibbon, /noRetryLoop:\s*true/);
assert.match(reviewRibbon, /noSceneTraversal:\s*true/);
assert.match(phase3, /removeDuplicateReviewDropdown/);
assert.match(phase3, /removeQuickExportRibbonDuplicates/);
assert.match(phase3, /#quickExportGroup,\s*\n\s*\.quick-export-group\s*\{\s*display:\s*none !important;/);
assert.match(phase3, /#topReviewMenu\s*\{\s*display:\s*none !important;/);
assert.match(safeBootstrap, /static-ribbon-dropdown-cleanup-controller\.js/);
assert.match(safeBootstrap, /static-review-ribbon-tools-controller\.js/);
assert.match(safeBootstrap, /static-canvas-tool-manager\.js/);
assert.match(pkg.scripts.test, /ui-integration-phase11\.test\.mjs/);

console.log('Phase 11 UI integration acceptance gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const reviewRibbon = readFileSync(new URL('../src/static-review-ribbon-tools-controller.js', import.meta.url), 'utf8');
const topbar = readFileSync(new URL('../src/static-topbar-layout-controller.js', import.meta.url), 'utf8');
const phase3 = readFileSync(new URL('../src/static-ribbon-dropdown-cleanup-controller.js', import.meta.url), 'utf8');
const safeBootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const bundleEntry = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');

assert.match(index, /id="staticReviewRibbonGroup"[\s\S]*aria-label="Review tools"/, 'Static Review ribbon host must exist in first-paint HTML.');
assert.match(index, /id="topReviewMenu"[\s\S]*review-top-menu-popover/, 'Static Review top-menu host must exist in first-paint HTML.');

[
  'static-selection-resolver.js',
  'static-area-select-controller.js',
  'static-viewpad-navigation-tools-controller.js',
  'static-section-box-from-selection-controller.js',
  'static-explode-review-controller.js',
  'static-measure-polyline-controller.js',
  'static-review-ribbon-tools-controller.js'
].forEach((moduleName) => {
  assert.match(bundleEntry, new RegExp(moduleName.replace('.', '\\.')), `Static shell bundle must include ${moduleName}.`);
});

[
  ['topMarkupMenu', 'Markup', 'Tag', 'ISONOTE XML', 'Import XML'],
  ['topSessionMenu', 'Session', 'Save Session', 'Restore Session', 'Clear Session'],
  ['topExportMenu', 'Export', 'GLB', 'RVM', 'ATT']
].forEach(([menuId, label, ...expectedLabels]) => {
  assert.match(topbar, new RegExp(`ensureMenu\\('${menuId}', '${label}'`), `${label} top menu must be built deterministically.`);
  expectedLabels.forEach((text) => {
    assert.match(topbar, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `${label} menu must preserve "${text}" label text.`);
  });
});

assert.match(topbar, /menuItemHtml\(source, itemId\)/, 'Topbar menus must build item markup through one deterministic menu item helper.');
assert.match(topbar, /sourceIcon[\s\S]*<span>\$\{escapeHtml\(label\)\}<\/span>/, 'Topbar menu rows must include icon plus escaped text label.');
assert.match(topbar, /mode:\s*shouldEnableFullTopbarLayout\(\) \? 'full-opt-in' : 'static-shell'/, 'Topbar layout must remain static-shell by default.');

[
  'Zoom Box',
  'Area Select',
  'Clear Selection',
  'Export Selected CSV',
  'Search / Jump',
  'Section Box',
  'Isolate Selected',
  'Hide Selected',
  'Show All',
  'Saved Views',
  'Previous View',
  'Next View',
  'Measure Polyline',
  'Explode Review',
  'Reassemble / Reset'
].forEach((label) => {
  assert.match(reviewRibbon, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Review integration must expose "${label}".`);
});

assert.match(reviewRibbon, /api:\s*\['__3D_MARKUP_EXPLODE_REVIEW__', 'open'\]/, 'Explode Review ribbon/menu action must call the explode API directly.');
assert.match(reviewRibbon, /api:\s*\['__3D_MARKUP_EXPLODE_REVIEW__', 'reassemble'\]/, 'Reassemble / Reset action must call the explode reset API directly.');
assert.match(reviewRibbon, /item\.appendChild\(iconNode\(tool\.icon/, 'Review menu/context rows must include an icon.');
assert.match(reviewRibbon, /item\.appendChild\(textNode\('span', tool\.menuLabel \|\| tool\.label/, 'Review menu/context rows must include a text label.');
assert.match(reviewRibbon, /button\.replaceChildren\(iconNode\(tool\.icon, 'review-ribbon-tool-icon'\), textNode\('span', tool\.label\)\)/, 'Review ribbon tiles must preserve Icon + Label grammar.');

['MZ', 'AS', 'XP', 'SR'].forEach((shortcut) => {
  assert.doesNotMatch(reviewRibbon, new RegExp(`label:\\s*['"]${shortcut}['"]`), `Review ribbon must not expose ${shortcut} shortcut text labels.`);
});

[
  ['review ribbon integration', reviewRibbon],
  ['topbar layout', topbar],
  ['phase3 ribbon cleanup', phase3]
].forEach(([name, source]) => {
  assert.doesNotMatch(source, /setInterval\(/, `${name} must not use polling.`);
  assert.doesNotMatch(source, /MutationObserver/, `${name} must not use MutationObserver for UI layout.`);
  assert.doesNotMatch(source, /\.traverse\(/, `${name} must not traverse scene content at startup.`);
});

assert.doesNotMatch(reviewRibbon, /RETRY_MS|MAX_RETRIES|retryRefresh/, 'Review integration must not use retry loops for post-load relocation.');
assert.match(reviewRibbon, /noPolling:\s*true/, 'Review integration diagnostics must declare no polling.');
assert.match(reviewRibbon, /noRetryLoop:\s*true/, 'Review integration diagnostics must declare no retry loop.');
assert.match(reviewRibbon, /noSceneTraversal:\s*true/, 'Review integration diagnostics must declare no scene traversal.');

assert.match(phase3, /removeDuplicateReviewDropdown/, 'Phase 3 cleanup must retain duplicate Review dropdown removal.');
assert.match(phase3, /removeQuickExportRibbonDuplicates/, 'Phase 3 cleanup must retain duplicate quick export removal.');
assert.match(phase3, /#quickExportGroup,\s*\n\s*\.quick-export-group\s*\{\s*display:\s*none !important;/, 'Legacy quick export ribbon duplicates must remain hidden.');
assert.match(phase3, /#topReviewMenu\s*\{\s*display:\s*none !important;/, 'Duplicate top Review dropdown must remain hidden by cleanup CSS.');

assert.match(safeBootstrap, /static-ribbon-dropdown-cleanup-controller\.js/, 'Safe UI bootstrap must still load dropdown/ribbon cleanup.');
assert.match(safeBootstrap, /static-review-ribbon-tools-controller\.js/, 'Safe UI bootstrap must still load review-ribbon integration.');
assert.match(pkg.scripts.test, /ui-integration-phase11\.test\.mjs/, 'npm test must include the Phase 11 UI integration gate.');

console.log('Phase 11 UI integration acceptance gate passed');

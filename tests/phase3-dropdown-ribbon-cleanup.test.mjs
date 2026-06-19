import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-ribbon-dropdown-cleanup-controller.js', import.meta.url), 'utf8');
const quickExport = readFileSync(new URL('../src/static-quick-export-core-controller.js', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-ribbon-dropdown-cleanup-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Bootstrap must load the Phase 3 cleanup controller.');
assert.match(bootstrap, /phase3-ribbon-cleanup-20260619/, 'Bootstrap comment must preserve the Phase 3 marker for cache/rollback diagnostics.');

assert.match(controller, /const VERSION = 'phase3-ribbon-cleanup-20260619'/, 'Controller must declare the Phase 3 version.');
assert.match(controller, /\.viewer-topbar,[\s\S]*overflow: visible !important/, 'Controller must allow topbar dropdown overflow to be visible.');
assert.match(controller, /top-menu-popover[\s\S]*position:\s*fixed !important/, 'Topbar dropdowns must be fixed-position popovers to avoid clipping.');
assert.match(controller, /max-height:[\s\S]*overflow-y:\s*auto !important/, 'Dropdowns must use bounded scroll instead of truncating.');
assert.match(controller, /removeDuplicateReviewDropdown/, 'Controller must remove the duplicate Review dropdown.');
assert.match(controller, /removeQuickExportRibbonDuplicates/, 'Controller must hide duplicate quick-export ribbon tiles.');
assert.match(controller, /movePreviewModesIntoViewFit/, 'Controller must move GLB/RVM mode buttons into the View/Fit group.');
assert.match(controller, /phase3ViewFitToggle/, 'Controller must add a View/Fit expand-collapse toggle.');
assert.match(controller, />>/, 'Collapsed View/Fit state must use >> affordance.');
assert.match(controller, /<</, 'Expanded View/Fit state must use << affordance.');
assert.match(controller, /width:\s*64px !important/, 'Ribbon button width must be normalized.');
assert.match(controller, /height:\s*56px !important/, 'Ribbon button height must be normalized.');
assert.match(controller, /width:\s*20px !important/, 'Ribbon icon width must be normalized.');
assert.match(controller, /height:\s*20px !important/, 'Ribbon icon height must be normalized.');
assert.match(controller, /noPolling: true/, 'Controller diagnostics must declare no polling.');
assert.match(controller, /noSceneTraversal: true/, 'Controller diagnostics must declare no scene traversal.');
assert.doesNotMatch(controller, /setInterval\(/, 'Phase 3 cleanup controller must not poll.');
assert.doesNotMatch(controller, /\.traverse\(/, 'Phase 3 cleanup controller must not traverse scene content.');

assert.match(quickExport, /menu-only mode|menuOnly: true/, 'Quick export controller must be menu-only.');
assert.doesNotMatch(quickExport, /createQuickExportGroup\(/, 'Quick export controller must not create duplicate ribbon export tiles.');
assert.match(quickExport, /#quickExportGroup, \.quick-export-group/, 'Quick export controller must hide any legacy duplicate export group.');

['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].forEach((id) => {
  assert.match(checklist, new RegExp(`\\| ✅ \\| ${id} —`), `Checklist must tick ${id}.`);
});
assert.match(pkg.scripts.test, /phase3-dropdown-ribbon-cleanup\.test\.mjs/, 'npm test must include the Phase 3 gate.');

console.log('Phase 3 dropdown / ribbon cleanup gate passed');

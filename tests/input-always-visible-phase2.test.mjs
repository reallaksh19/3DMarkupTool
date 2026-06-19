import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
const collapseController = readFileSync(new URL('../src/static-input-conversion-collapse-controller.js', import.meta.url), 'utf8');
const staticInputCss = readFileSync(new URL('../src/static-input-panel.css', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const cacheKeyPattern = /input-always-visible-20260619|phase3-ribbon-cleanup-20260619|phase4-global-esc-lifecycle-20260619|phase4a-static-input-panel-cleanup-20260619|static-input-deterministic-20260620/;

assert.match(index, /<link rel="stylesheet" href="\.\/src\/static-input-panel\.css\?v=static-input-deterministic-20260620" \/>/, 'Index must load the static input panel CSS before JS bootstrap.');
assert.match(index, /<div id="inputFileStatus" class="input-file-status" aria-live="polite">No file chosen<\/div>/, 'Input panel must statically show No file chosen.');
assert.match(index, /<span>Choose InputXML<\/span>/, 'Input panel must show Choose InputXML.');
assert.match(index, /id="loadSampleBtn"[\s\S]*Load BM_CII sample/, 'Input panel must expose the real Load BM_CII sample button.');
assert.match(index, /id="clearBtn"[\s\S]*Clear All/, 'Input panel must expose the real Clear All button.');
assert.match(index, /static-input-compact-section/, 'Input section must use the deterministic compact static class.');
assert.match(index, /data-section="conversion" data-collapsible="conversion"/, 'Conversion section must be statically marked as collapsible.');
assert.match(index, /id="conversion-options-body" class="conversion-collapsible-content"/, 'Conversion body must be statically collapsible before controller bootstrap.');
assert.match(index, /data-section="sideload" data-collapsible="sideload"/, 'Sideload section must be statically marked as collapsible.');
assert.match(index, /id="sideload-options-body" class="sideload-collapsible-content"/, 'Sideload body must be statically collapsible before controller bootstrap.');
assert.match(index, /safe-ui-bootstrap\.js\?v=static-input-deterministic-20260620/, 'Index must use the deterministic input cache key.');
assert.doesNotMatch(index, /core-safe-boot-20260619/, 'Index must not revert to the emergency core-safe startup shell.');

assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Bootstrap must load the input always-visible controller.');
assert.match(bootstrap, /SAFE_UI_VERSION = 'static-input-deterministic-20260620'/, 'Bootstrap must use the deterministic input cache key.');
assert.match(bootstrap, cacheKeyPattern, 'Bootstrap must retain Phase 2 or newer cache lineage.');

assert.match(staticInputCss, /#inputDrawer \.static-input-compact-section[\s\S]*gap:\s*6px/, 'Static CSS must own the compact input section geometry.');
assert.match(staticInputCss, /#inputFileStatus\.input-file-status[\s\S]*background:\s*transparent/, 'File status must render as compact text, not as a tall card.');
assert.match(staticInputCss, /\.panel-section\[data-section="input"\] > \.file-drop[\s\S]*min-height:\s*32px/, 'Choose InputXML must be a compact control, not a tall drop zone.');
assert.match(staticInputCss, /\.panel-section\[data-section="input"\] > \.input-primary-actions[\s\S]*flex-wrap:\s*nowrap/, 'Input primary actions must remain in one compact row.');
assert.match(staticInputCss, /data-collapsible="conversion"\][\s\S]*conversion-collapsible-content[\s\S]*display:\s*none/, 'Conversion section must be collapsed by default through static CSS.');
assert.match(staticInputCss, /data-collapsible="sideload"\][\s\S]*sideload-collapsible-content[\s\S]*display:\s*none/, 'Sideload Data must be collapsed by default through static CSS.');

assert.match(controller, /const VERSION = 'static-input-deterministic-20260620'/, 'Controller must declare deterministic input version.');
assert.match(controller, /No file chosen/, 'Controller must preserve No file chosen status.');
assert.match(controller, /Choose InputXML/, 'Controller must preserve Choose InputXML label.');
assert.match(controller, /Load BM_CII sample/, 'Controller must handle BM_CII sample action.');
assert.match(controller, /Clear All|clearBtn/, 'Controller must handle Clear All reset.');
assert.match(controller, /sampleStateSeparateFromFileStatus: true/, 'BM_CII sample state must not replace the local file chooser status.');
assert.match(controller, /compactStaticInputBlock: Boolean/, 'Controller must expose compact input checklist state.');
assert.match(controller, /runtimeStyleInjection: false/, 'Controller diagnostic must declare that runtime layout injection is disabled.');
assert.match(controller, /document\.body\.classList\.add\('input-open'\)/, 'Controller must keep the input drawer open.');
assert.match(controller, /__3D_MARKUP_INPUT_ALWAYS_VISIBLE__/, 'Controller must expose a diagnostic API.');
assert.match(controller, /noPolling: true/, 'Input visibility controller must be non-polling.');
assert.match(controller, /noSceneTraversal: true/, 'Input visibility controller must not traverse scene content.');
assert.doesNotMatch(controller, /MutationObserver/, 'Compact cleanup must not use MutationObserver.');
assert.doesNotMatch(controller, /setInterval\(/, 'Input visibility controller must not poll.');
assert.doesNotMatch(controller, /\.traverse\(/, 'Input visibility controller must not traverse the model scene.');
assert.doesNotMatch(controller, /document\.createElement\(['"]style['"]\)/, 'Input controller must not inject runtime style tags.');
assert.doesNotMatch(controller, /appendChild\(style\)/, 'Input controller must not append runtime style tags.');
assert.doesNotMatch(controller, /position:\s*sticky/, 'Input controller must not create a sticky card that changes drawer behavior.');
assert.doesNotMatch(controller, /!important/, 'Input controller must not fight static CSS with important runtime rules.');

assert.match(collapseController, /initSideloadSection/, 'Sideload section must have an explicit collapse path.');
assert.match(collapseController, /sideload-expanded/, 'Sideload section must be collapsed by default and expandable on demand.');
assert.match(collapseController, /staticCssOwned: true/, 'Collapse controller must declare static CSS ownership.');
assert.doesNotMatch(collapseController, /document\.createElement\(['"]style['"]\)/, 'Collapse controller must not inject runtime style tags.');
assert.doesNotMatch(collapseController, /MutationObserver/, 'Sideload collapse must not use MutationObserver.');
assert.doesNotMatch(collapseController, /setInterval\(/, 'Sideload collapse must not poll.');

assert.match(checklist, /\| ✅ \| C1 — Input controls must always remain visible \|/, 'Checklist must tick C1.');
assert.match(checklist, /\| ✅ \| C2 — Required visible input block \|/, 'Checklist must tick C2.');
assert.match(checklist, /\| ✅ \| C3 — Real browse\/sample controls hidden \|/, 'Checklist must tick C3.');
assert.match(checklist, /\| ✅ \| C4 — Compact static input panel cleanup \|/, 'Checklist must tick C4.');
assert.match(pkg.scripts.test, /input-always-visible-phase2\.test\.mjs/, 'npm test must include the input visibility gate.');

console.log('input always-visible deterministic static layout gate passed');

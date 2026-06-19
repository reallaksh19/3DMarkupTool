import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
const collapseController = readFileSync(new URL('../src/static-input-conversion-collapse-controller.js', import.meta.url), 'utf8');
const perfCss = readFileSync(new URL('../src/static-shell-performance.css', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(index, /<div id="inputFileStatus" class="input-file-status" aria-live="polite">No file chosen<\/div>/, 'Input panel must statically show No file chosen.');
assert.match(index, /<span>Choose InputXML<\/span>/, 'Input panel must show Choose InputXML.');
assert.match(index, /id="loadSampleBtn"[\s\S]*Load BM_CII sample/, 'Input panel must expose the real Load BM_CII sample button.');
assert.match(index, /id="clearBtn"[\s\S]*Clear All/, 'Input panel must expose the real Clear All button.');
assert.match(index, /phase2-input-sticky-section/, 'Input section must use the Phase 2 visible block class.');
assert.match(index, /phase4a-input-compact-section/, 'Input section must use the compact static block class.');
assert.match(index, /data-phase4a-input="compact-static"/, 'Input section must statically declare the compact layout contract.');
assert.match(index, /perf-static-shell-20260620|phase4a-static-input-panel-cleanup-20260619/, 'Index must use the performance/static shell cache key or newer cleanup key.');
assert.doesNotMatch(index, /core-safe-boot-20260619/, 'Index must not revert to the emergency core-safe startup shell.');

assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Bootstrap must load the input always-visible controller.');
assert.match(bootstrap, /SAFE_UI_VERSION = '(perf-static-shell-20260620|phase4a-static-input-panel-cleanup-20260619)'/, 'Bootstrap must use the performance/static shell cache key or newer cleanup key.');

assert.match(controller, /const VERSION = 'perf-static-shell-20260620'/, 'Controller must declare the performance static-shell version.');
assert.match(controller, /No file chosen/, 'Controller must preserve No file chosen status.');
assert.match(controller, /Choose InputXML/, 'Controller must preserve Choose InputXML label.');
assert.match(controller, /Load BM_CII sample/, 'Controller must handle BM_CII sample action.');
assert.match(controller, /Clear All|clearBtn/, 'Controller must handle Clear All reset.');
assert.match(controller, /sampleStateSeparateFromFileStatus: true/, 'BM_CII sample state must not replace the local file chooser status.');
assert.match(controller, /compactStaticInputBlock: Boolean/, 'Controller must expose compact input checklist state.');
assert.match(controller, /layoutOwner: section\?\.dataset\.layoutOwner \|\| 'static-css'/, 'Controller diagnostics must report static CSS as layout owner.');
assert.match(controller, /noRuntimeLayoutStyleInjection: true/, 'Controller must report that it does not inject runtime layout CSS.');
assert.match(controller, /document\.body\.classList\.add\('input-open'\)/, 'Controller must keep the input drawer open.');
assert.match(controller, /__3D_MARKUP_INPUT_ALWAYS_VISIBLE__/, 'Controller must expose a diagnostic API.');
assert.match(controller, /noPolling: true/, 'Input visibility controller must be non-polling.');
assert.match(controller, /noSceneTraversal: true/, 'Input visibility controller must not traverse scene content.');
assert.doesNotMatch(controller, /MutationObserver/, 'Compact cleanup must not use MutationObserver.');
assert.doesNotMatch(controller, /setInterval\(/, 'Input visibility controller must not poll.');
assert.doesNotMatch(controller, /appendChild\(style\)|createElement\('style'\)|createElement\("style"\)/, 'Input visibility controller must not inject layout styles after first paint.');
assert.doesNotMatch(controller, /position:\s*sticky\s*!important/, 'Input visibility controller must not reintroduce sticky runtime layout overrides.');
assert.doesNotMatch(controller, /\.traverse\(/, 'Input visibility controller must not traverse the model scene.');

assert.match(perfCss, /flex-wrap:\s*nowrap/, 'Static CSS must keep input primary actions in one compact row.');
assert.match(perfCss, /#inputFileStatus\.input-file-status/, 'Static CSS must own the input file status visual styling.');
assert.match(perfCss, /body:not\(\.conversion-expanded\)[\s\S]*conversion-collapsible-content/, 'Static CSS must collapse conversion by default before JS runs.');
assert.match(perfCss, /body:not\(\.sideload-expanded\)[\s\S]*sideload-collapsible-content/, 'Static CSS must collapse sideload by default before JS runs.');

assert.match(collapseController, /initSideloadSection/, 'Sideload section must have an explicit collapse path.');
assert.match(collapseController, /sideload-expanded/, 'Sideload section must be collapsed by default and expandable on demand.');
assert.match(collapseController, /data\.collapsible = name/, 'Sideload collapse must be marker-based, not positional.');
assert.match(collapseController, /layoutOwner: 'static-css'/, 'Collapse controller must declare static CSS ownership.');
assert.doesNotMatch(collapseController, /MutationObserver/, 'Sideload collapse must not use MutationObserver.');
assert.doesNotMatch(collapseController, /setInterval\(/, 'Sideload collapse must not poll.');
assert.doesNotMatch(collapseController, /appendChild\(style\)|createElement\('style'\)|createElement\("style"\)/, 'Collapse controller must not inject layout styles after first paint.');

assert.match(checklist, /\| ✅ \| C1 — Input controls must always remain visible \|/, 'Checklist must tick C1.');
assert.match(checklist, /\| ✅ \| C2 — Required visible input block \|/, 'Checklist must tick C2.');
assert.match(checklist, /\| ✅ \| C3 — Real browse\/sample controls hidden \|/, 'Checklist must tick C3.');
assert.match(checklist, /\| ✅ \| C4 — Compact static input panel cleanup \|/, 'Checklist must tick C4.');
assert.match(pkg.scripts.test, /input-always-visible-phase2\.test\.mjs/, 'npm test must include the input visibility gate.');

console.log('input always-visible Phase 2 / static shell performance gate passed');

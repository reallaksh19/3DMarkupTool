import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
const collapseController = readFileSync(new URL('../src/static-input-conversion-collapse-controller.js', import.meta.url), 'utf8');
const perfCss = readFileSync(new URL('../src/static-shell-performance.css', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const staticKeyPattern = /workflow-input-expanded-load-controls-20260625|staged-json-review-ui-rvm-fix-20260625|app-boot-dialog-conversion-hotfix-20260623|support-ui-render-export-fix-20260623|tool-fixes-v2-20260620|perf-tdz-fix-20260620|perf-static-drawer-bundle-20260620|perf-idle-diagnostics-20260620|perf-static-shell-20260620|phase4a-static-input-panel-cleanup-20260619/;

assert.match(index, /id="inputFileStatus"[\s\S]*No file chosen/, 'Input panel must statically show No file chosen.');
assert.match(index, /id="inputStatus"/, 'Input panel must expose a dedicated input status value for static and dynamic controllers.');
assert.match(index, /<span>Choose stagedJson<\/span>/, 'Input panel must show Choose stagedJson.');
assert.match(index, /id="loadSampleBtn"[\s\S]*Load BM_CII stagedJson/, 'Input panel must expose the real BM_CII stagedJson sample button.');
assert.match(index, /id="clearBtn"[\s\S]*Clear All/, 'Input panel must expose the real Clear All button.');
assert.match(index, /phase2-input-sticky-section/, 'Input section must use the Phase 2 visible block class.');
assert.match(index, /phase4a-input-compact-section/, 'Input section must use the compact static block class.');
assert.match(index, /data-phase4a-input="compact-static"/, 'Input section must statically declare the compact layout contract.');
assert.match(index, staticKeyPattern, 'Index must use the active input-expanded key, stagedJson review fix key, boot hotfix key, support UI/render/export key, or permitted static shell cache key.');
assert.doesNotMatch(index, /core-safe-boot-20260619/, 'Index must not revert to the emergency core-safe startup shell.');
assert.doesNotMatch(index, /Choose InputXML|Load InputXML|from InputXML/, 'Index must not expose retired InputXML file-selection wording.');

assert.match(bootstrap, /workflow-input-expanded-load-controls-20260625/, 'Bootstrap must carry the expanded INPUT load-controls cache key.');
assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Bootstrap must load the input always-visible controller.');
assert.match(bootstrap, new RegExp(`SAFE_UI_VERSION = '(${staticKeyPattern.source})'`), 'Bootstrap must use the performance/static shell cache key or newer cleanup key.');

assert.match(controller, /const VERSION = 'workflow-input-expanded-load-controls-20260625'/, 'Controller must declare the expanded INPUT load-controls version.');
assert.match(controller, /No file chosen/, 'Controller must preserve No file chosen status.');
assert.match(controller, /Choose stagedJson/, 'Controller must preserve Choose stagedJson label.');
assert.match(controller, /Load BM_CII stagedJson/, 'Controller must preserve BM_CII stagedJson sample action.');
assert.match(controller, /Clear All|clearBtn/, 'Controller must handle Clear All reset.');
assert.match(controller, /sampleStateSeparateFromFileStatus: true/, 'sample state must not replace the local file chooser status.');
assert.match(controller, /inputExpanded: section\?\.dataset\.inputExpanded === 'true'/, 'Controller diagnostics must report INPUT expanded state.');
assert.match(controller, /forceInputControlsExpanded\(section\)/, 'Controller must force INPUT load controls expanded at runtime.');
assert.match(controller, /INPUT_CONTENT_SELECTORS/, 'Controller must explicitly target INPUT content controls, not positional sections.');
assert.match(controller, /getElementById\('inputStatus'\) \|\| document\.getElementById\('inputFileStatus'\)/, 'Controller must preserve the nested input status span when updating status text.');
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
assert.doesNotMatch(controller, /Choose InputXML|Load InputXML|from InputXML/, 'Input visibility controller must not restore retired InputXML wording.');

assert.match(perfCss, /workflow-card\[data-section="input"\][\s\S]*min-height:\s*168px/, 'Static CSS must reserve enough height for visible INPUT load controls.');
assert.match(perfCss, /workflow-card\[data-section="input"\][\s\S]*max-height:\s*none\s*!important/, 'Static CSS must prevent INPUT card max-height collapse.');
assert.match(perfCss, /workflow-card\[data-section="input"\][\s\S]*\.workflow-card-hint[\s\S]*visibility:\s*visible\s*!important/, 'Static CSS must force INPUT content visible if a collapse class leaks in.');
assert.match(perfCss, /flex-wrap:\s*nowrap/, 'Static CSS must keep input primary actions in one compact row.');
assert.match(perfCss, /#inputFileStatus\.input-file-status/, 'Static CSS must own the input file status visual styling.');
assert.match(perfCss, /conversion-options-compat-root[\s\S]*display:\s*none\s*!important/, 'Compatibility conversion controls must stay hidden before JS and after JS.');
assert.match(perfCss, /support-workflow-card \.conversion-collapsible-content[\s\S]*display:\s*revert\s*!important/, 'Support Mapping controls must remain visible and must not inherit the hidden compatibility collapse state.');

assert.match(collapseController, /initSideloadSection/, 'Sideload section must have an explicit collapse path.');
assert.match(collapseController, /sideload-expanded/, 'Sideload section must be collapsed by default and expandable on demand.');
assert.match(collapseController, /dataset\.collapsible = name/, 'Sideload collapse must be marker-based, not positional.');
assert.match(collapseController, /layoutOwner: 'static-css'/, 'Collapse controller must declare static CSS ownership.');
assert.doesNotMatch(collapseController, /MutationObserver/, 'Sideload collapse must not use MutationObserver.');
assert.doesNotMatch(collapseController, /setInterval\(/, 'Sideload collapse must not poll.');
assert.doesNotMatch(collapseController, /appendChild\(style\)|createElement\('style'\)|createElement\("style"\)/, 'Collapse controller must not inject layout styles after first paint.');

assert.match(checklist, /\| ✅ \| C1 — Input controls must always remain visible \|/, 'Checklist must tick C1.');
assert.match(checklist, /\| ✅ \| C2 — Required visible input block \|/, 'Checklist must tick C2.');
assert.match(checklist, /\| ✅ \| C3 — Real browse\/sample controls hidden \|/, 'Checklist must tick C3.');
assert.match(checklist, /\| ✅ \| C4 — Compact static input panel cleanup \|/, 'Checklist must tick C4.');
assert.match(pkg.scripts.test, /input-always-visible-phase2\.test\.mjs/, 'npm test must include the input visibility gate.');

console.log('input always-visible Phase 2 / expanded load controls gate passed');

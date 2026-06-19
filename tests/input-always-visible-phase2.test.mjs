import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(index, /<div id="inputFileStatus" class="input-file-status" aria-live="polite">No file chosen<\/div>/, 'Input panel must statically show No file chosen.');
assert.match(index, /<span>Choose InputXML<\/span>/, 'Input panel must show Choose InputXML.');
assert.match(index, /id="loadSampleBtn"[\s\S]*Load BM_CII sample/, 'Input panel must expose the real Load BM_CII sample button.');
assert.match(index, /id="clearBtn"[\s\S]*Clear All/, 'Input panel must expose the real Clear All button.');
assert.match(index, /phase2-input-sticky-section/, 'Input section must use the Phase 2 sticky visible block class.');
assert.match(index, /input-always-visible-20260619|phase4-global-esc-lifecycle-20260619/, 'Index must use the Phase 2 or newer cache key.');
assert.doesNotMatch(index, /core-safe-boot-20260619/, 'Index must not revert to the emergency core-safe startup shell.');

assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Bootstrap must load the Phase 2 input always-visible controller.');
assert.match(bootstrap, /SAFE_UI_VERSION = '(input-always-visible-20260619|phase3-ribbon-cleanup-20260619|phase4-global-esc-lifecycle-20260619|phase4a-input-visible-20260619)'/, 'Bootstrap must use the Phase 2 or newer cache key.');

assert.match(controller, /const VERSION = 'phase4a-input-visible-20260619'/, 'Controller must declare Phase 4A version.');
assert.match(controller, /No file chosen/, 'Controller must preserve No file chosen status.');
assert.match(controller, /Choose InputXML/, 'Controller must preserve Choose InputXML label.');
assert.match(controller, /Load BM_CII sample|BM_CII sample selected/, 'Controller must handle BM_CII sample status.');
assert.match(controller, /Clear All|clearBtn/, 'Controller must handle Clear All reset.');
assert.match(controller, /position:\s*sticky\s*!important/, 'Input block must be sticky/always visible inside the drawer.');
assert.match(controller, /positionInputSectionFirst/, 'Controller must actively keep the real input section first in the drawer.');
assert.match(controller, /viewer:drawer-summary-ready/, 'Controller must respond after the drawer summary is inserted.');
assert.match(controller, /drawerSummaryCard/, 'Controller must place the workflow summary after the input block.');
assert.match(controller, /MutationObserver/, 'Controller must handle event-driven drawer child changes without polling.');
assert.match(controller, /document\.body\.classList\.add\('input-open'\)/, 'Controller must keep the input drawer open.');
assert.match(controller, /__3D_MARKUP_INPUT_ALWAYS_VISIBLE__/, 'Controller must expose a diagnostic API.');
assert.match(controller, /inputBeforeSummary/, 'Diagnostic checklist must verify the input block is before the summary card.');
assert.match(controller, /inputFirstAfterDrawerHead/, 'Diagnostic checklist must verify the input block is first after drawer head.');
assert.match(controller, /noPolling: true/, 'Input visibility controller must be non-polling.');
assert.match(controller, /noSceneTraversal: true/, 'Input visibility controller must not traverse scene content.');
assert.doesNotMatch(controller, /setInterval\(/, 'Input visibility controller must not poll.');
assert.doesNotMatch(controller, /\.traverse\(/, 'Input visibility controller must not traverse the model scene.');

assert.match(checklist, /\| ✅ \| C1 — Input controls must always remain visible \|/, 'Checklist must tick C1.');
assert.match(checklist, /\| ✅ \| C2 — Required visible input block \|/, 'Checklist must tick C2.');
assert.match(checklist, /\| ✅ \| C3 — Real browse\/sample controls hidden \|/, 'Checklist must tick C3.');
assert.match(checklist, /\| ✅ \| C4 — Input block still not practically visible \|/, 'Checklist must tick C4.');
assert.match(pkg.scripts.test, /input-always-visible-phase2\.test\.mjs/, 'npm test must include the Phase 2/4A input visibility gate.');

console.log('input always-visible Phase 2/4A gate passed');

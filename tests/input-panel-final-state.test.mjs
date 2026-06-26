import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const staticShellCss = readFileSync(new URL('../src/static-shell-performance.css', import.meta.url), 'utf8');
const inputController = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
const managedStageJsonUi = readFileSync(new URL('../src/managed-stage-json-ui-controller.js', import.meta.url), 'utf8');
const appLoader = readFileSync(new URL('../src/app-loader.js', import.meta.url), 'utf8');
const collapseController = readFileSync(new URL('../src/static-input-conversion-collapse-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const inputIndex = index.indexOf('data-section="input"');
const supportIndex = index.indexOf('data-section="support-mapping"');
const conversionIndex = index.indexOf('data-section="conversion"');
const exportIndex = index.indexOf('data-section="export"');

assert.ok(inputIndex > -1, 'raw HTML must mark the INPUT workflow card with data-section="input"');
assert.ok(supportIndex > inputIndex, 'raw HTML must keep 2 SUPPORT MAPPING after INPUT');
assert.ok(conversionIndex > supportIndex, 'raw HTML must keep 3 CONVERT after SUPPORT MAPPING');
assert.ok(exportIndex > conversionIndex, 'raw HTML must keep 4 EXPORT after CONVERT');
assert.match(index, /id="inputFileStatus"[\s\S]*No file chosen/, 'raw HTML must start with No file chosen');
assert.match(index, /id="xmlFile"/, 'raw HTML must keep the real #xmlFile control');
assert.match(index, /id="loadUnifiedModelFileBtn"[\s\S]*Import stagedJson/, 'raw HTML must source-own the real import stagedJson control');
assert.match(index, /id="loadSampleBtn"[\s\S]*Load BM_CII stagedJson/, 'raw HTML must keep the real #loadSampleBtn control');
assert.match(index, /id="clearBtn"[\s\S]*Clear All/, 'raw HTML must keep the real #clearBtn control');
assert.match(index, /data-owner="source-html"/, 'source HTML must explicitly own the INPUT action row');
assert.match(index, /Choose stagedJson/, 'raw HTML must expose stagedJson file selection wording');
assert.match(index, /id="supportMappingSettingsShell"/, 'raw HTML must host the support mapping launcher in the workflow card');
assert.match(index, /id="conversionOptionsCompatRoot"[\s\S]*hidden/, 'legacy conversion/sideload controls must be hidden in a compatibility root');
assert.doesNotMatch(index, /<h3[^>]*>[\s\S]*Sideload Data/, 'raw drawer must not expose a visible Sideload Data section');
assert.doesNotMatch(index, /Choose InputXML|Load InputXML|from InputXML/, 'raw HTML must not expose retired InputXML selection wording');

assert.match(staticShellCss, /#inputDrawer\s*>\s*#drawerSummaryCard\.drawer-summary-card\s*\{[\s\S]*display:\s*none\s*!important/, 'workflow summary must not appear above 1 INPUT in the default drawer');
assert.match(staticShellCss, /#inputDrawer \.workflow-card[\s\S]*display:\s*grid/, 'workflow cards must use static grid layout');
assert.match(staticShellCss, /workflow-card\[data-section="input"\][\s\S]*grid-template-rows:\s*auto auto auto auto\s*!important/, 'INPUT workflow card must reserve explicit visible rows for hint, status, choose, and action controls');
assert.match(staticShellCss, /workflow-card\[data-section="input"\][\s\S]*min-height:\s*168px/, 'INPUT workflow card must not collapse to heading-only height');
assert.match(staticShellCss, /workflow-card\[data-section="input"\][\s\S]*max-height:\s*none\s*!important/, 'INPUT workflow card must ignore leaked collapse max-height');
assert.match(staticShellCss, /workflow-card\[data-section="input"\][\s\S]*\.workflow-card-hint[\s\S]*visibility:\s*visible\s*!important/, 'INPUT text/load controls must stay visible if collapse classes leak in');
assert.match(staticShellCss, /workflow-card\[data-section="input"\]\s*>\s*\.file-drop[\s\S]*display:\s*grid\s*!important/, 'Choose stagedJson must be compact and statically visible');
assert.match(staticShellCss, /workflow-card\[data-section="input"\]\s*>\s*\.file-drop[\s\S]*min-height:\s*34px/, 'Choose stagedJson must not regress to a tall drop zone');
assert.match(staticShellCss, /#loadUnifiedModelFileBtn/, 'Static CSS must include the source-owned import stagedJson button in the compact action row');
assert.match(staticShellCss, /workflow-card\[data-section="input"\]\s*>\s*\.input-primary-actions[\s\S]*display:\s*flex\s*!important[\s\S]*flex-wrap:\s*nowrap/, 'INPUT actions must stay in one row');
assert.match(staticShellCss, /conversion-options-compat-root\s*\{\s*display:\s*none\s*!important/, 'compatibility controls must stay hidden from the drawer');

assert.match(inputController, /const VERSION = 'input-root-owner-20260626'/, 'input controller must use the root-owner version');
assert.match(inputController, /layoutOwner = 'source-html-static-css'|layoutOwner: section\?\.dataset\.layoutOwner \|\| 'source-html-static-css'/, 'input controller diagnostics must report source HTML/static CSS ownership');
assert.match(inputController, /#loadUnifiedModelFileBtn/, 'input controller must know the real source-owned import button');
assert.match(inputController, /importVisible:/, 'input controller checklist must expose import visibility');
assert.match(inputController, /forceInputControlsExpanded\(section\)/, 'input controller must preserve expanded INPUT state');
assert.match(inputController, /input\.id = 'xmlFile'/, 'input controller must preserve #xmlFile');
assert.match(inputController, /ensureButton\(actions, 'loadUnifiedModelFileBtn'/, 'input controller must preserve #loadUnifiedModelFileBtn');
assert.match(inputController, /ensureButton\(actions, 'loadSampleBtn'/, 'input controller must preserve #loadSampleBtn');
assert.match(inputController, /ensureButton\(actions, 'clearBtn'/, 'input controller must preserve #clearBtn');
assert.doesNotMatch(inputController, /new\s+MutationObserver|setInterval\(/, 'input controller must not use observers or polling');
assert.doesNotMatch(inputController, /document\.createElement\(['"]style['"]\)|style\.textContent|appendChild\(style\)/, 'input controller must not inject layout CSS');
assert.doesNotMatch(inputController, /Choose InputXML|Load InputXML|from InputXML/, 'input controller must not restore retired InputXML wording');

assert.doesNotMatch(managedStageJsonUi, /^import \* as THREE/m, 'managed-stage JSON UI must not eagerly import Three.js just to bind INPUT controls');
assert.doesNotMatch(managedStageJsonUi, /^import \{ convertManagedStageJsonToRvmAtt \}/m, 'managed-stage JSON UI must lazy-load conversion code');
assert.match(managedStageJsonUi, /getManagedStageRuntimeModules\(\)/, 'managed-stage conversion modules must be loaded only during file/sample conversion');
assert.match(appLoader, /import\(MANAGED_STAGE_JSON_UI_MODULE_URL\)[\s\S]*import\(MANAGED_STAGE_JSON_SAMPLE_MODULE_URL\)[\s\S]*loadManagedStageDecorators/, 'app-loader must bind INPUT JSON controls before heavy decorators');

assert.doesNotMatch(bootstrap, /early static shell source parity/, 'Pages shell must not execute bundled shell and then duplicate early source modules');
assert.doesNotMatch(collapseController, /sections\s*\[\s*1\s*\]/, 'collapse controller must not depend on DOM section positions');
assert.match(collapseController, /setSectionExpanded\('conversion', false\)/, 'legacy collapse controller may still initialize conversion collapsed when a legacy section exists');
assert.match(bootstrap, /input-root-owner-20260626/, 'input final-state controller must use the root-owner cache key');
assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'input final-state controller must be loaded through the deterministic early bootstrap path');
assert.match(pkg.scripts.test, /input-panel-final-state\.test\.mjs/, 'npm test must include the INPUT final-state gate');

console.log('input panel root-owner final-state gate passed');

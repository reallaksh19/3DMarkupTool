import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const staticShellCss = readFileSync(new URL('../src/static-shell-performance.css', import.meta.url), 'utf8');
const inputController = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
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
assert.match(index, /id="loadSampleBtn"/, 'raw HTML must keep the real #loadSampleBtn control');
assert.match(index, /id="clearBtn"/, 'raw HTML must keep the real #clearBtn control');
assert.match(index, /Choose stagedJson/, 'raw HTML must expose stagedJson file selection wording');
assert.match(index, /Load BM_CII stagedJson/, 'raw HTML must expose the compact BM_CII sample action');
assert.match(index, /id="supportMappingSettingsShell"/, 'raw HTML must host the support mapping launcher in the workflow card');
assert.match(index, /id="conversionOptionsCompatRoot"[\s\S]*hidden/, 'legacy conversion/sideload controls must be hidden in a compatibility root');
assert.doesNotMatch(index, /<h3[^>]*>[\s\S]*Sideload Data/, 'raw drawer must not expose a visible Sideload Data section');
assert.doesNotMatch(index, /Choose InputXML|Load InputXML|from InputXML/, 'raw HTML must not expose retired InputXML selection wording');

assert.match(staticShellCss, /#inputDrawer\s*>\s*#drawerSummaryCard\.drawer-summary-card\s*\{[\s\S]*display:\s*none\s*!important/, 'workflow summary must not appear above 1 INPUT in the default drawer');
assert.match(staticShellCss, /#inputDrawer \.workflow-card[\s\S]*display:\s*grid/, 'workflow cards must use static grid layout');
assert.match(staticShellCss, /workflow-card\[data-section="input"\]\s*>\s*\.file-drop[\s\S]*display:\s*grid\s*!important/, 'Choose stagedJson must be compact and statically visible');
assert.match(staticShellCss, /workflow-card\[data-section="input"\]\s*>\s*\.file-drop[\s\S]*min-height:\s*34px/, 'Choose stagedJson must not regress to a tall drop zone');
assert.match(staticShellCss, /workflow-card\[data-section="input"\]\s*>\s*\.input-primary-actions[\s\S]*display:\s*flex\s*!important[\s\S]*flex-wrap:\s*nowrap/, 'Load sample and Clear must stay in one row');
assert.match(staticShellCss, /conversion-options-compat-root\s*\{\s*display:\s*none\s*!important/, 'compatibility controls must stay hidden from the drawer');

assert.match(inputController, /setStatus\(file \? `File: \$\{file\.name\}` : 'No file chosen'\)/, 'file status must describe only the local file chooser');
assert.doesNotMatch(inputController, /BM_CII sample selected/, 'sample loading must not overwrite file status text');
assert.doesNotMatch(inputController, /document\.createElement\(['"]style['"]\)|style\.textContent|appendChild\(style\)/, 'input controller must not inject layout CSS');
assert.doesNotMatch(inputController, /MutationObserver|setInterval\(/, 'input controller must not use observers or polling for layout correction');
assert.doesNotMatch(inputController, /Choose InputXML|Load InputXML|from InputXML/, 'input controller must not restore retired InputXML UI wording');
assert.doesNotMatch(collapseController, /sections\s*\[\s*1\s*\]/, 'collapse controller must not depend on DOM section positions');
assert.match(collapseController, /setSectionExpanded\('conversion', false\)/, 'legacy collapse controller may still initialize conversion collapsed when a legacy section exists');
assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'input final-state controller must be loaded through the deterministic early bootstrap path');
assert.match(pkg.scripts.test, /input-panel-final-state\.test\.mjs/, 'npm test must include the INPUT final-state gate');

console.log('input panel workflow-revamp final-state gate passed');

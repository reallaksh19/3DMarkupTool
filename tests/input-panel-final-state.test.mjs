import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const staticShellCss = readFileSync(new URL('../src/static-shell-performance.css', import.meta.url), 'utf8');
const inputController = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
const collapseController = readFileSync(new URL('../src/static-input-conversion-collapse-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const inputIndex = index.indexOf('data-section="input"');
const conversionIndex = index.indexOf('data-collapsible="conversion"');
const sideloadIndex = index.indexOf('data-collapsible="sideload"');

assert.ok(inputIndex > -1, 'raw HTML must mark the INPUT section with data-section="input"');
assert.ok(conversionIndex > inputIndex, 'raw HTML must keep 2 CONVERSION after INPUT');
assert.ok(sideloadIndex > conversionIndex, 'raw HTML must keep 3 SIDELOAD DATA after CONVERSION');
assert.match(index, /id="inputFileStatus"[\s\S]*No file chosen/, 'raw HTML must start with No file chosen');
assert.match(index, /id="xmlFile"/, 'raw HTML must keep the real #xmlFile control');
assert.match(index, /id="loadSampleBtn"/, 'raw HTML must keep the real #loadSampleBtn control');
assert.match(index, /id="clearBtn"/, 'raw HTML must keep the real #clearBtn control');

assert.match(staticShellCss, /#inputDrawer\s*>\s*#drawerSummaryCard\.drawer-summary-card\s*\{[\s\S]*display:\s*none\s*!important/, 'workflow summary must not appear above 1 INPUT in the default drawer');
assert.match(staticShellCss, /panel-section\[data-section="input"\][\s\S]*display:\s*grid/, 'INPUT section must use compact static grid layout');
assert.match(staticShellCss, /panel-section\[data-section="input"\]\s*>\s*\.file-drop[\s\S]*display:\s*grid\s*!important/, 'Choose InputXML must be compact and statically visible');
assert.match(staticShellCss, /panel-section\[data-section="input"\]\s*>\s*\.file-drop[\s\S]*min-height:\s*32px/, 'Choose InputXML must not regress to a tall drop zone');
assert.match(staticShellCss, /panel-section\[data-section="input"\]\s*>\s*\.input-primary-actions[\s\S]*display:\s*flex\s*!important[\s\S]*flex-wrap:\s*nowrap/, 'Load sample and Clear All must stay in one row');
assert.match(staticShellCss, /data-collapsible="conversion"\]\s*>\s*\.conversion-collapsible-content[\s\S]*display:\s*none\s*!important/, 'Conversion content must be collapsed by default using explicit marker CSS');
assert.match(staticShellCss, /data-collapsible="sideload"\]\s*>\s*\.sideload-collapsible-content[\s\S]*display:\s*none\s*!important/, 'Sideload content must be collapsed by default using explicit marker CSS');

assert.match(inputController, /setStatus\(file \? `File: \$\{file\.name\}` : 'No file chosen'\)/, 'file status must describe only the local file chooser');
assert.doesNotMatch(inputController, /BM_CII sample selected/, 'sample loading must not overwrite file status text');
assert.doesNotMatch(inputController, /document\.createElement\(['"]style['"]\)|style\.textContent|appendChild\(style\)/, 'input controller must not inject layout CSS');
assert.doesNotMatch(inputController, /MutationObserver|setInterval\(/, 'input controller must not use observers or polling for layout correction');
assert.doesNotMatch(collapseController, /sections\s*\[\s*1\s*\]/, 'collapse controller must not depend on DOM section positions');
assert.match(collapseController, /setSectionExpanded\('conversion', false\)/, 'Conversion must initialize collapsed');
assert.match(collapseController, /setSectionExpanded\('sideload', false\)/, 'Sideload must initialize collapsed');
assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'input final-state controller must be loaded through the deterministic early bootstrap path');
assert.match(pkg.scripts.test, /input-panel-final-state\.test\.mjs/, 'npm test must include the INPUT final-state gate');

console.log('input panel final-state gate passed');

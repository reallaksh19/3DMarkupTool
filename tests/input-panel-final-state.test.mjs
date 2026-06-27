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
assert.ok(inputIndex > -1, 'raw HTML must mark the INPUT root card with data-section="input"');
assert.ok(supportIndex > inputIndex, 'raw HTML must keep 2 SUPPORT MAPPING after INPUT');
assert.ok(conversionIndex > supportIndex, 'raw HTML must keep 3 CONVERT after SUPPORT MAPPING');
assert.ok(exportIndex > conversionIndex, 'raw HTML must keep 4 EXPORT after CONVERT');
assert.match(index, /class="panel-section input-root-card[^"]*"[^>]*data-section="input"[^>]*data-input-root="persistent"/, 'INPUT must be a persistent root card, not a generic workflow-card');
assert.doesNotMatch(index, /class="panel-section workflow-card[^"]*"[^>]*data-section="input"/, 'INPUT must not remain in the workflow-card collapse path');
assert.match(index, /id="inputFileStatus"[\s\S]*No file chosen/);
assert.match(index, /id="xmlFile"/);
assert.match(index, /id="loadUnifiedModelFileBtn"[\s\S]*Import stagedJson/);
assert.match(index, /id="loadSampleBtn"[\s\S]*Load BM_CII stagedJson/);
assert.match(index, /id="clearBtn"[\s\S]*Clear All/);
assert.match(index, /data-owner="source-html"/);
assert.doesNotMatch(index, /Choose InputXML|Load InputXML|from InputXML/);

assert.match(staticShellCss, /input-root-card/);
assert.match(staticShellCss, /data-input-root="persistent"/);
assert.match(staticShellCss, /INPUT is not a collapsible workflow-card/);
assert.match(staticShellCss, /input-root-card\[data-section="input"\][\s\S]*min-height:\s*168px/);
assert.match(staticShellCss, /input-root-card\[data-section="input"\][\s\S]*file-drop[\s\S]*display:\s*grid\s*!important/);
assert.match(staticShellCss, /input-root-card\[data-section="input"\][\s\S]*input-primary-actions[\s\S]*display:\s*flex\s*!important/);
assert.match(staticShellCss, /conversion-options-compat-root\s*\{\s*display:\s*none\s*!important/);

assert.match(inputController, /const VERSION = 'input-persistent-root-card-20260629-c'/);
assert.match(inputController, /dataset\.inputRoot = 'persistent'/);
assert.match(inputController, /classList\.remove\('workflow-card'/);
assert.match(inputController, /inputIsNotWorkflowCard:/);
assert.match(inputController, /layoutOwner: section\?\.dataset\.layoutOwner \|\| 'source-html-static-css-persistent-root'/);
assert.match(inputController, /ensureButton\(actions, 'loadUnifiedModelFileBtn'/);
assert.match(inputController, /ensureButton\(actions, 'loadSampleBtn'/);
assert.match(inputController, /ensureButton\(actions, 'clearBtn'/);
assert.doesNotMatch(inputController, /new\s+MutationObserver|setInterval\(/);
assert.doesNotMatch(inputController, /document\.createElement\(['"]style['"]\)|style\.textContent|appendChild\(style\)/);
assert.doesNotMatch(inputController, /Choose InputXML|Load InputXML|from InputXML/);

assert.doesNotMatch(managedStageJsonUi, /^import \* as THREE/m);
assert.doesNotMatch(managedStageJsonUi, /^import \{ convertManagedStageJsonToRvmAtt \}/m);
assert.match(managedStageJsonUi, /getManagedStageRuntimeModules\(\)/);
assert.match(appLoader, /import\(MANAGED_STAGE_JSON_UI_MODULE_URL\)[\s\S]*import\(MANAGED_STAGE_JSON_SAMPLE_MODULE_URL\)[\s\S]*loadManagedStageDecorators/);
assert.doesNotMatch(bootstrap, /early static shell source parity/);
assert.doesNotMatch(collapseController, /sections\s*\[\s*1\s*\]/);
assert.match(collapseController, /setSectionExpanded\('conversion', false\)/);
assert.match(bootstrap, /input-persistent-root-card-20260629-c/);
assert.match(bootstrap, /static-input-always-visible-controller\.js\?v=\$\{SAFE_UI_VERSION\}/);
assert.match(pkg.scripts.test, /input-panel-final-state\.test\.mjs/);

console.log('input panel persistent root-card final-state gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const collapseController = readFileSync('src/static-input-conversion-collapse-controller.js', 'utf8');
const staticShellCss = readFileSync('src/static-shell-performance.css', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const inputController = readFileSync('src/static-input-always-visible-controller.js', 'utf8');

assert.match(collapseController, /ensureInputAlwaysExpanded\(\)/, 'Input drawer collapse controller must explicitly keep the Input section expanded.');
assert.match(collapseController, /section\.dataset\.section\s*=\s*['"]input['"]/, 'Input section must be tagged as data-section="input" for non-positional CSS overrides.');
assert.match(collapseController, /layoutOwner:\s*['"]static-css['"]|section\.dataset\.layoutOwner\s*=\s*['"]static-css['"]/, 'Collapse controller must declare static CSS as the layout owner.');
assert.doesNotMatch(collapseController, /sections\s*\[\s*1\s*\]/, 'Collapse logic must not use positional section fallback; summary cards can change section indexes.');
assert.doesNotMatch(collapseController, /document\.createElement\(['"]style['"]\)|style\.textContent|appendChild\(style\)/, 'Collapse controller must not inject layout CSS at runtime; layout belongs to static CSS.');

assert.match(index, /data-section="input"/, 'Workflow drawer must keep an explicit input section.');
assert.match(index, /data-input-root="persistent"/, 'INPUT must be a persistent root card outside generic workflow collapse.');
assert.doesNotMatch(index, /class="panel-section workflow-card[^"]*"[^>]*data-section="input"/, 'INPUT must not participate in the generic workflow-card collapse path.');
assert.match(index, /data-section="support-mapping"/, 'Workflow drawer must expose a support mapping card.');
assert.match(index, /data-section="conversion"/, 'Workflow drawer must expose a convert card.');
assert.match(index, /data-section="export"/, 'Workflow drawer must expose an export card.');
assert.match(index, /conversionOptionsCompatRoot[\s\S]*hidden/, 'Legacy conversion and sideload controls must remain hidden for controller compatibility.');
assert.doesNotMatch(index, /data-collapsible="sideload"/, 'Visible sideload collapsible section must not return to the drawer.');

assert.match(staticShellCss, /input-root-card\[data-section="input"\]\s*>\s*\.file-drop[\s\S]*display:\s*grid\s*!important/, 'Input file drop must be owned by persistent input-root-card CSS.');
assert.match(staticShellCss, /input-root-card\[data-section="input"\]\s*>\s*\.input-primary-actions[\s\S]*display:\s*flex\s*!important/, 'Input action row must remain visible and one-row through persistent input-root-card CSS.');
assert.match(staticShellCss, /INPUT is not a collapsible workflow-card/, 'CSS contract must document why INPUT is outside workflow-card collapse.');
assert.match(staticShellCss, /conversion-options-compat-root\s*\{\s*display:\s*none\s*!important/, 'Hidden compatibility controls must not consume visible drawer space.');
assert.match(staticShellCss, /#inputDrawer \.workflow-card[\s\S]*display:\s*grid/, 'Non-input workflow cards must reserve stable first-paint layout.');
assert.match(inputController, /classList\.remove\('workflow-card'/, 'Input controller must remove workflow-card from INPUT during stale DOM normalization.');

assert.match(bootstrap, /input-persistent-root-card-20260629-c|phase4a-static-input-panel-cleanup-20260619|phase4-global-esc-lifecycle-20260619|esc-tools-export-icons-20260619|perf-static-shell-20260620/, 'Safe UI bootstrap version must remain cache-busted so browsers fetch fixed drawer, view-pad, ESC, export, icon, and static-shell controllers.');
console.log('input drawer persistent root-card contract passed');

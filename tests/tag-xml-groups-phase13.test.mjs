import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const markupCore = readFileSync(new URL('../src/static-markup-core-controller.js', import.meta.url), 'utf8');
const safeBootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const bundleEntry = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');
const diagnosticPlan = readFileSync(new URL('../docs/UI_DIAGNOSTIC_LOG_PLAN.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(markupCore, /static-markup-grouped-controls-20260620/, 'Phase 13 markup-core version must be auditable.');
assert.match(markupCore, /const GROUPS = \[/, 'Tag/XML controls must be organized through an explicit group registry.');
assert.match(markupCore, /id:\s*'staticTagGroup'[\s\S]*label:\s*'Tag'[\s\S]*id:\s*'staticTagBtn'[\s\S]*id:\s*'staticTagViewsBtn'/, 'Tag-related tools must sit under one Tag group.');
assert.match(markupCore, /id:\s*'staticXmlGroup'[\s\S]*label:\s*'XML'[\s\S]*id:\s*'staticIsonoteXmlBtn'[\s\S]*id:\s*'staticImportXmlBtn'[\s\S]*id:\s*'staticXmlQaBtn'[\s\S]*id:\s*'staticExportXmlBtn'/, 'XML-related tools must sit under one XML group.');
assert.match(markupCore, /id:\s*'staticSessionGroup'[\s\S]*id:\s*'staticSaveSessionBtn'[\s\S]*id:\s*'staticRestoreSessionBtn'[\s\S]*id:\s*'staticClearSessionBtn'/, 'Session actions must remain grouped and available.');
assert.match(markupCore, /static-markup-expander[\s\S]*&gt;&gt;/, 'Grouped controls must show the requested >> expansion icon.');
assert.match(markupCore, /ensureGroupedMenu\(group, toolGroup\)/, 'Markup controls must be built by the deterministic group builder.');
assert.match(markupCore, /setAttribute\('role', 'menuitem'\)/, 'Expanded Tag/XML rows must be menu items.');

[
  'staticTagBtn',
  'staticTagViewsBtn',
  'staticIsonoteXmlBtn',
  'staticImportXmlBtn',
  'staticXmlQaBtn',
  'staticExportXmlBtn',
  'staticSaveSessionBtn',
  'staticRestoreSessionBtn',
  'staticClearSessionBtn'
].forEach((id) => {
  assert.match(markupCore, new RegExp(id), `Real source control ${id} must remain available for topbar proxies and tests.`);
});

assert.doesNotMatch(markupCore, /setInterval\(/, 'Grouped Tag/XML controls must not use polling.');
assert.doesNotMatch(markupCore, /MutationObserver/, 'Grouped Tag/XML controls must not use MutationObserver layout correction.');
assert.match(markupCore, /window\.addEventListener\('keydown'[\s\S]*Escape[\s\S]*closeGroups/, 'Esc must close expanded Tag/XML groups.');
assert.match(markupCore, /contain:\s*layout style;/, 'Grouped markup ribbon host must use layout/style containment only.');
assert.doesNotMatch(markupCore, /contain:\s*paint/, 'Grouped markup ribbon controls must not use paint containment because menus overflow.');

assert.match(safeBootstrap, /static-markup-core-controller\.js/, 'Safe UI bootstrap must still load grouped markup core.');
assert.match(bundleEntry, /static-markup-core-controller\.js/, 'Static shell bundle must still include grouped markup core.');

[
  'UI Diagnostic Log Plan',
  'Error',
  'Rendering issue',
  'Warning',
  'window.__3D_MARKUP_DIAGNOSTIC_LOG__',
  'No continuous polling',
  'No `setInterval`',
  'No startup scene traversal',
  'visible page, focused window, and accumulated Long Task evidence'
].forEach((needle) => {
  assert.match(diagnosticPlan, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Diagnostic log plan must include: ${needle}`);
});

assert.match(pkg.scripts.test, /tag-xml-groups-phase13\.test\.mjs/, 'npm test must include the Phase 13 Tag/XML grouping gate.');

console.log('Phase 13 Tag/XML grouping and diagnostic-log plan gate passed');

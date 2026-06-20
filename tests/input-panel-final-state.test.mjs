import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const finalCss = readFileSync(new URL('../src/input-panel-final-state.css', import.meta.url), 'utf8');
const inputController = readFileSync(new URL('../src/static-input-always-visible-controller.js', import.meta.url), 'utf8');
const collapseController = readFileSync(new URL('../src/static-input-conversion-collapse-controller.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(
  index,
  /static-shell-performance\.css\?v=[^"\s]+" \/>\n  <link rel="stylesheet" href="\.\/src\/input-panel-final-state\.css\?v=perf-input-final-20260620"/,
  'input-panel-final-state.css must load after static-shell-performance.css so it owns the final INPUT layout.'
);

assert.match(index, /<div id="inputFileStatus" class="input-file-status" aria-live="polite">No file chosen<\/div>/, 'Input status must start as No file chosen in raw HTML.');
assert.match(index, /<span>Choose InputXML<\/span>/, 'Real file-drop label must remain Choose InputXML.');
assert.match(index, /id="loadSampleBtn"[\s\S]*Load BM_CII sample/, 'Real sample button must remain present.');
assert.match(index, /id="clearBtn"[\s\S]*Clear All/, 'Real Clear All button must remain present.');
assert.match(index, /data-section="conversion" data-collapsible="conversion"/, 'Conversion must be marked explicitly, not positionally.');
assert.match(index, /data-section="sideload" data-collapsible="sideload"/, 'Sideload must be marked explicitly, not positionally.');

assert.match(finalCss, /#inputDrawer > #drawerSummaryCard\.drawer-summary-card[\s\S]*display:\s*none\s*!important/, 'Workflow summary card must not appear above the required 1 INPUT block.');
assert.match(finalCss, /panel-section\[data-section="input"\][\s\S]*padding:\s*8px 0 10px\s*!important/, 'Input section must use compact static padding.');
assert.match(finalCss, /panel-section\[data-section="input"\] > #inputFileStatus\.input-file-status[\s\S]*max-height:\s*26px/, 'Input status must stay compact.');
assert.match(finalCss, /panel-section\[data-section="input"\] > \.file-drop[\s\S]*display:\s*grid\s*!important[\s\S]*min-height:\s*32px\s*!important[\s\S]*max-height:\s*34px/, 'Choose InputXML file drop must stay compact after JS.');
assert.match(finalCss, /panel-section\[data-section="input"\] > \.input-primary-actions[\s\S]*display:\s*grid\s*!important[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/, 'Sample/Clear buttons must remain one compact row.');
assert.match(finalCss, /body:not\(\.conversion-expanded\)[\s\S]*data-collapsible="conversion"[\s\S]*display:\s*none\s*!important/, 'Conversion body must be collapsed by default through marker CSS.');
assert.match(finalCss, /body:not\(\.sideload-expanded\)[\s\S]*data-collapsible="sideload"[\s\S]*display:\s*none\s*!important/, 'Sideload body must be collapsed by default through marker CSS.');

assert.doesNotMatch(inputController, /MutationObserver|setInterval\(|appendChild\(style\)|createElement\(['"]style['"]\)|\.traverse\(/, 'Input controller must not use runtime correction, polling, style injection, or scene traversal.');
assert.doesNotMatch(collapseController, /MutationObserver|setInterval\(|appendChild\(style\)|createElement\(['"]style['"]\)|sections\s*\[\s*1\s*\]/, 'Collapse controller must remain event-driven and marker-based.');
assert.doesNotMatch(inputController, /BM_CII sample selected/, 'Sample button must not write BM_CII sample selected into file status.');
assert.match(inputController, /sampleStateSeparateFromFileStatus:\s*true/, 'Sample state must remain separate from local file chooser status.');
assert.match(inputController, /updateStatusFromInput/, 'File status must be derived from the real local file input.');

assert.match(pkg.scripts.test, /input-panel-final-state\.test\.mjs/, 'npm test must include the final INPUT panel regression gate.');

console.log('input panel final-state gate passed');

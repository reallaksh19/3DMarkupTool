import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-global-tool-lifecycle-controller.js', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /phase4-global-esc-lifecycle-20260619/, 'Bootstrap must use/preserve the Phase 4 cache marker.');
assert.match(bootstrap, /static-global-tool-lifecycle-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Bootstrap must load the global lifecycle controller.');

assert.match(controller, /const VERSION = 'phase4-global-esc-lifecycle-20260619'/, 'Controller must declare the Phase 4 version.');
assert.match(controller, /window\.addEventListener\('keydown', onGlobalKeyDown, true\)/, 'Controller must install a capture-phase global keydown handler.');
assert.match(controller, /event\.key !== 'Escape'/, 'Controller must key off Escape.');
assert.match(controller, /cancelAllTools/, 'Controller must expose a central cancel-all path.');
assert.match(controller, /__3D_MARKUP_GLOBAL_TOOL_LIFECYCLE__/, 'Controller must expose diagnostics API.');
assert.match(controller, /__3D_MARKUP_AREA_SELECT__', 'clear'/, 'Esc lifecycle must clear Area Select selection state when available.');
assert.match(controller, /__3D_MARKUP_AREA_SELECT__', 'deactivate'/, 'Esc lifecycle must deactivate active Area Select.');
assert.match(controller, /__3D_MARKUP_EXPLODE_REVIEW__', 'reset'/, 'Esc lifecycle must reset/reassemble exploded review state.');
assert.match(controller, /__3D_MARKUP_MEASURE_POLYLINE__', 'finish'/, 'Esc lifecycle must finish active measure mode.');
assert.match(controller, /\.area-select-rect/, 'Esc lifecycle must remove area-select drag overlays.');
assert.match(controller, /\.marquee-zoom-rect/, 'Esc lifecycle must remove marquee zoom overlays.');
assert.match(controller, /staticComponentSearchPanel/, 'Esc lifecycle must close component-search panel.');
assert.match(controller, /staticSavedViewsPanel/, 'Esc lifecycle must close saved-views panel.');
assert.match(controller, /staticExplodeReviewPanel/, 'Esc lifecycle must close explode panel.');
assert.match(controller, /noPolling: true/, 'Controller diagnostics must declare no polling.');
assert.match(controller, /noSceneTraversal: true/, 'Controller diagnostics must declare no scene traversal.');
assert.doesNotMatch(controller, /setInterval\(/, 'Phase 4 controller must not poll.');
assert.doesNotMatch(controller, /\.traverse\(/, 'Phase 4 controller must not traverse scene content.');

['E1', 'E2', 'E3'].forEach((id) => {
  assert.match(checklist, new RegExp(`\\| ✅ \\| ${id} —`), `Checklist must tick ${id}.`);
});
assert.match(pkg.scripts.test, /phase4-global-esc-lifecycle\.test\.mjs/, 'npm test must include the Phase 4 gate.');

console.log('Phase 4 global Esc lifecycle gate passed');

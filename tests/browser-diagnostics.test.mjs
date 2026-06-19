import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-browser-diagnostics-controller.js', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(index, /input-always-visible-20260619|phase4-global-esc-lifecycle-20260619/, 'index must use the Phase 2 or newer shell cache key');
assert.doesNotMatch(index, /fresh-clip-core-20260619/, 'index must not reference stale fresh-clip-core shell assets');
assert.match(index, /safe-ui-bootstrap\.js\?v=(input-always-visible-20260619|phase4-global-esc-lifecycle-20260619)/, 'outer bootstrap script must use the Phase 2 or newer shell cache key');

assert.match(bootstrap, /input-always-visible-20260619|phase4-global-esc-lifecycle-20260619/, 'bootstrap must use the Phase 2 or newer cache key');
assert.match(bootstrap, /static-browser-diagnostics-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load browser diagnostics controller');
assert.doesNotMatch(bootstrap, /static-properties-actions-controller\.js/, 'bootstrap must not import the missing static properties controller');
assert.match(bootstrap, /emitBootstrapModuleFailure\(url, result\.reason\)/, 'bootstrap must emit diagnostics for module failures');
assert.match(bootstrap, /3dmarkup:bootstrap-module-failed/, 'bootstrap must dispatch a module-failed event');

assert.match(controller, /BROWSER_DIAGNOSTICS_VERSION = 'chrome-runtime-diagnostics-20260619'/, 'diagnostic controller must retain the Chrome runtime diagnostics version');
assert.match(controller, /EXPECTED_SHELL_VERSION = 'chrome-runtime-diagnostics-20260619'/, 'diagnostic controller must retain the Chrome runtime diagnostics expected shell marker');
assert.match(controller, /STALE_SHELL_VERSION = 'fresh-clip-core-20260619'/, 'diagnostic controller must detect the stale shell key');
assert.match(controller, /detectStaleShellAssets/, 'diagnostic controller must detect stale shell assets');
assert.match(controller, /collectWebglInfo/, 'diagnostic controller must capture WebGL GPU information');
assert.match(controller, /sampleFrameTime/, 'diagnostic controller must sample frame time');
assert.match(controller, /installWheelLatencyProbe/, 'diagnostic controller must probe wheel latency');
assert.match(controller, /requestAnimationFrame/, 'runtime diagnostics must use bounded requestAnimationFrame sampling');
assert.match(controller, /isChrome/, 'diagnostic controller must detect Chrome/Chromium');
assert.match(controller, /isEdge/, 'diagnostic controller must distinguish Edge from Chrome');
assert.match(controller, /recordModuleFailure/, 'diagnostic controller must expose module failure recording');
assert.match(controller, /Chrome cache\/module issue detected/, 'Chrome users must receive a clear cache/module help message');
assert.match(controller, /Chrome frame-time lag detected/, 'Chrome users must receive frame-time lag guidance');
assert.match(controller, /Chrome wheel-event latency detected/, 'Chrome users must receive wheel latency guidance');
assert.match(controller, /Ctrl\+F5/, 'diagnostic help must include hard refresh guidance');
assert.match(controller, /Disable cache/, 'diagnostic help must include DevTools disable-cache guidance');
assert.match(controller, /clear site data/i, 'diagnostic help must include site-data reset guidance');
assert.match(controller, /__3D_MARKUP_BROWSER_DIAGNOSTICS__/, 'diagnostic controller must expose a runtime API');
assert.match(controller, /noIntervalPolling: true/, 'diagnostics must remain lightweight');
assert.match(controller, /frameTimeProbe: true/, 'runtime API must expose frame-time diagnostics');
assert.match(controller, /wheelLatencyProbe: true/, 'runtime API must expose wheel diagnostics');
assert.match(controller, /staleShellProbe: true/, 'runtime API must expose stale-shell diagnostics');
assert.doesNotMatch(controller, /setInterval\(/, 'browser diagnostics must not poll');

assert.match(checklist, /\| ✅ \| X1 — Chrome-only erratic response \|/, 'checklist must tick the Chrome-only diagnostics item');
assert.match(checklist, /\| ✅ \| X2 — Chrome runtime\/cache diagnostics \|/, 'checklist must tick the Chrome runtime diagnostics item');
assert.match(pkg.scripts.test, /browser-diagnostics\.test\.mjs/, 'npm test must include browser diagnostics gate');

console.log('browser-diagnostics gate passed');

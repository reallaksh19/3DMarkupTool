import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/static-browser-diagnostics-controller.js', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /browser-diagnostics-20260619/, 'bootstrap must use the browser diagnostics cache key');
assert.match(bootstrap, /static-browser-diagnostics-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load browser diagnostics controller');
assert.doesNotMatch(bootstrap, /static-properties-actions-controller\.js/, 'bootstrap must not import the missing static properties controller');
assert.match(bootstrap, /emitBootstrapModuleFailure\(url, result\.reason\)/, 'bootstrap must emit diagnostics for module failures');
assert.match(bootstrap, /3dmarkup:bootstrap-module-failed/, 'bootstrap must dispatch a module-failed event');

assert.match(controller, /BROWSER_DIAGNOSTICS_VERSION = 'browser-diagnostics-20260619'/, 'diagnostic controller must declare a stable version');
assert.match(controller, /isChrome/, 'diagnostic controller must detect Chrome/Chromium');
assert.match(controller, /isEdge/, 'diagnostic controller must distinguish Edge from Chrome');
assert.match(controller, /recordModuleFailure/, 'diagnostic controller must expose module failure recording');
assert.match(controller, /Chrome cache\/module issue detected/, 'Chrome users must receive a clear cache/module help message');
assert.match(controller, /Ctrl\+F5/, 'diagnostic help must include hard refresh guidance');
assert.match(controller, /Disable cache/, 'diagnostic help must include DevTools disable-cache guidance');
assert.match(controller, /clear site data/i, 'diagnostic help must include site-data reset guidance');
assert.match(controller, /__3D_MARKUP_BROWSER_DIAGNOSTICS__/, 'diagnostic controller must expose a runtime API');
assert.match(controller, /noIntervalPolling: true/, 'diagnostics must remain lightweight');
assert.doesNotMatch(controller, /setInterval\(/, 'browser diagnostics must not poll');

assert.match(checklist, /\| ✅ \| X1 — Chrome-only erratic response \|/, 'checklist must tick the Chrome-only diagnostics item');
assert.match(pkg.scripts.test, /browser-diagnostics\.test\.mjs/, 'npm test must include browser diagnostics gate');

console.log('browser-diagnostics gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTIVE_CACHE_KEY = 'perf-tdz-fix-20260620';
const dateStampedKey = /^perf-[a-z0-9-]+-20\d{6}$/;

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const index = read('index.html');
const safeBootstrap = read('src/safe-ui-bootstrap.js');
const appLoader = read('src/app-loader.js');
const diagnostics = read('src/static-browser-diagnostics-controller.js');
const shellCss = read('src/static-shell-performance.css');
const buildScript = read('scripts/build-pages.mjs');
const topbarLayout = read('src/static-topbar-layout-controller.js');
const gitignore = read('.gitignore');
const pkg = JSON.parse(read('package.json'));

function assertBefore(source, beforePattern, afterPattern, message) {
  const before = source.search(beforePattern);
  const after = source.search(afterPattern);
  assert.notEqual(before, -1, `${message}: missing first marker ${beforePattern}`);
  assert.notEqual(after, -1, `${message}: missing second marker ${afterPattern}`);
  assert.ok(before < after, message);
}

function extractActiveQueryKeys(html) {
  const keys = [];
  for (const match of html.matchAll(/[\s"'](?:href|src)=["'][^"']+\?v=([^"']+)/g)) {
    keys.push(match[1]);
  }
  return keys;
}

const htmlKeys = extractActiveQueryKeys(index);
assert.ok(htmlKeys.length >= 4, 'index must expose versioned first-paint assets');
assert.deepEqual([...new Set(htmlKeys)], [ACTIVE_CACHE_KEY], 'all active index ?v= keys must use the single current cache key');
assert.match(ACTIVE_CACHE_KEY, dateStampedKey, 'active cache key must be auditable/date-stamped');

for (const [name, source] of [
  ['safe-ui-bootstrap.js', safeBootstrap],
  ['app-loader.js', appLoader],
  ['static-browser-diagnostics-controller.js', diagnostics],
  ['build-pages.mjs', buildScript]
]) {
  assert.match(source, new RegExp(ACTIVE_CACHE_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} must use the active cache key`);
  assert.doesNotMatch(source, /perf-static-drawer-bundle-20260620/, `${name} must not keep the prior static-drawer bundle key active`);
}

assertBefore(safeBootstrap, /const SAFE_UI_VERSION/, /scheduleCoreShell\(\)/, 'safe-ui-bootstrap constants must be declared before module-init calls');
assertBefore(safeBootstrap, /const _searchParams/, /const CLIP_MODULE_URLS/, 'safe-ui-bootstrap query params must be declared before shouldLoadClipTools init-time use');
assertBefore(appLoader, /const APP_LOADER_VERSION/, /scheduleAfterFirstPaint\(startViewerApp\)/, 'app-loader constants must be declared before module-init calls');
assertBefore(diagnostics, /const BROWSER_DIAGNOSTICS_VERSION/, /window\.__3D_MARKUP_BROWSER_DIAGNOSTICS__/, 'diagnostic constants must be declared before runtime API creation');
assertBefore(diagnostics, /function shouldShowJankWarning/, /function sampleFrameTime/, 'jank warning gate must be declared before sample finalization can use it');

for (const required of ['/_site/', '/node_modules/', 'package-lock.json', '/coverage/']) {
  assert.match(gitignore, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `.gitignore must exclude ${required}`);
}

assert.match(diagnostics, /function shouldShowJankWarning\(sample, longTasks\)/, 'diagnostics must centralize user-visible jank warning gating');
assert.match(diagnostics, /sample\.visibilityState === 'visible'/, 'jank warnings must require a visible tab');
assert.match(diagnostics, /sample\.hadFocus === true/, 'jank warnings must require focused tab');
assert.match(diagnostics, /longTasks\.supported === true[\s\S]*longTasks\.totalMs >= JANK_LONG_TASK_MS_THRESHOLD/, 'jank warnings must require accumulated long-task evidence');
assert.doesNotMatch(diagnostics, /: true;\s*\/\/ unknown → fall back to legacy behaviour and warn/, 'unsupported Long Task API must not fall back to warning');
assert.doesNotMatch(diagnostics, /type:\s*['"]wheel-latency['"][\s\S]{0,240}recordRuntimeWarning/, 'wheel latency alone must not trigger a warning banner');
assert.match(diagnostics, /likelyCause/, 'slow-frame readings must include a likelyCause verdict');
assert.doesNotMatch(diagnostics, /setInterval\(/, 'diagnostics must not poll');

assert.match(shellCss, /\.main-ribbon\s*\{[\s\S]*contain:\s*layout style;/, 'main ribbon must use layout/style containment');
assert.match(shellCss, /\.main-ribbon \.tool-group,[\s\S]*contain:\s*layout style;/, 'toolbar groups must use layout/style containment');
assert.match(shellCss, /\.panel-section\s*\{[\s\S]*contain:\s*layout style;/, 'panel sections must use layout/style containment');
assert.match(shellCss, /\.markup-ribbon\s*\{[\s\S]*contain:\s*layout style;/, 'markup ribbon must use layout/style containment');
assert.doesNotMatch(shellCss, /contain:\s*paint/, 'toolbar/panel containment must not use contain: paint');
assert.doesNotMatch(shellCss, /will-change:\s*transform/, 'static shell must not allocate compositor layers with will-change: transform');

assert.match(index, /rel="preconnect" href="https:\/\/unpkg\.com"/, 'index must preconnect to boot-time third-party module origin');
assert.match(index, /rel="preload" href="\.\/src\/clip-adjuster\.css\?v=/, 'non-critical clip adjuster CSS must preload rather than block first paint');
assert.match(index, /rel="preload" href="\.\/src\/clip-visual-overlays\.css\?v=/, 'non-critical clip overlay CSS must preload rather than block first paint');
assert.match(buildScript, /rel="modulepreload" href="\.\/assets\/app\.bundle\.js\?v=\$\{VERSION\}"/, 'Pages build must modulepreload the app bundle');
assert.match(buildScript, /rel="modulepreload" href="\.\/assets\/static-shell\.bundle\.js\?v=\$\{VERSION\}"/, 'Pages build must modulepreload the static shell bundle');

assert.doesNotMatch(topbarLayout, /setInterval\(/, 'topbar layout must not poll');
assert.match(topbarLayout, /mode:\s*shouldEnableFullTopbarLayout\(\) \? 'full-opt-in' : 'static-shell'/, 'topbar layout must default to static shell mode');
assert.match(pkg.scripts.test, /rules-checklist-ci\.test\.mjs/, 'npm test must include the rules checklist CI gate');

console.log('rules checklist CI gate passed');

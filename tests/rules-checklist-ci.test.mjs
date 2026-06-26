import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTIVE_CACHE_KEY = 'input-postbootstrap-reassert-20260626';
const SOURCE_INDEX_CACHE_KEY = 'input-postbootstrap-reassert-20260626';
const LEGACY_FIRST_PAINT_CACHE_KEY = 'tool-fixes-v2-20260620';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = read('index.html');
const safeBootstrap = read('src/safe-ui-bootstrap.js');
const appLoader = read('src/app-loader.js');
const diagnostics = read('src/static-browser-diagnostics-controller.js');
const shellCss = read('src/static-shell-performance.css');
const buildScript = read('scripts/build-pages.mjs');
const topbarLayout = read('src/static-topbar-layout-controller.js');
const gitignore = read('.gitignore');
const pkg = JSON.parse(read('package.json'));

function assertBefore(source, firstText, secondText, message) {
  const before = source.indexOf(firstText);
  const after = source.indexOf(secondText);
  assert.notEqual(before, -1, message + ': missing first marker ' + firstText);
  assert.notEqual(after, -1, message + ': missing second marker ' + secondText);
  assert.ok(before < after, message);
}
function extractActiveQueryKeys(html) {
  const keys = [];
  for (const match of html.matchAll(/v=([^"'&]+)/g)) keys.push(match[1]);
  return keys.filter((key) => key.includes('202606'));
}
const htmlKeys = extractActiveQueryKeys(index);
assert.ok(htmlKeys.length >= 4, 'index must expose versioned first-paint assets');
assert.deepEqual([...new Set(htmlKeys)], [SOURCE_INDEX_CACHE_KEY], 'source index keys must use the active workflow input load-control cache key');
assert.ok(!index.includes(LEGACY_FIRST_PAINT_CACHE_KEY), 'source index must not keep stale root-serving cache keys');
for (const key of [ACTIVE_CACHE_KEY, SOURCE_INDEX_CACHE_KEY, LEGACY_FIRST_PAINT_CACHE_KEY]) assert.match(key, /^[a-z0-9-]+-20\d{6}$/);
for (const [name, source] of [['build-pages.mjs', buildScript], ['app-loader.js', appLoader]]) {
  assert.ok(source.includes(ACTIVE_CACHE_KEY), name + ' must use the active workflow input load-control cache key');
  assert.ok(!source.includes('perf-static-drawer-bundle-20260620'), name + ' must not keep the prior static-drawer bundle key active');
}
for (const [name, source] of [['safe-ui-bootstrap.js', safeBootstrap], ['static-browser-diagnostics-controller.js', diagnostics]]) assert.ok(source.includes(LEGACY_FIRST_PAINT_CACHE_KEY), name + ' must keep the stable first-paint shell cache key marker');
assert.ok(buildScript.includes('LEGACY_CACHE_KEYS = Object.freeze(['));
for (const key of ['app-boot-dialog-conversion-hotfix-20260623', 'support-axis-transform-generalized-20260624', 'support-ringless-input-panel-revamp-20260624', 'staged-json-review-ui-rvm-fix-20260625', 'input-load-controls-restored-20260626', ACTIVE_CACHE_KEY]) assert.ok(buildScript.includes(key), 'Pages build must include cache key ' + key);
assert.ok(diagnostics.includes("STALE_SHELL_VERSION = 'perf-static-drawer-bundle-20260620'"));
assertBefore(safeBootstrap, 'const SAFE_UI_VERSION', 'scheduleCoreShell()', 'safe-ui-bootstrap constants must be declared before module-init calls');
assertBefore(appLoader, 'const APP_LOADER_VERSION', 'scheduleAfterFirstPaint(startViewerApp)', 'app-loader constants must be declared before module-init calls');
for (const required of ['/_site/', '/node_modules/', 'package-lock.json', '/coverage/']) assert.ok(gitignore.includes(required));
assert.ok(diagnostics.includes('function shouldShowJankWarning(sample, longTasks)'));
assert.ok(diagnostics.includes("sample.visibilityState === 'visible'"));
assert.ok(diagnostics.includes('sample.hadFocus === true'));
assert.ok(diagnostics.includes('longTasks.supported === true'));
assert.ok(!diagnostics.includes('setInterval('));
assert.ok(shellCss.includes('contain: layout style;'));
assert.ok(!shellCss.includes('contain: paint'));
assert.ok(!shellCss.includes('will-change: transform'));
assert.ok(index.includes('rel="preconnect" href="https://unpkg.com"'));
assert.ok(index.includes('id="rulesDialog"'));
assert.ok(index.includes('id="closeRulesBtn"'));
assert.ok(index.includes('data-section="support-mapping"'), 'workflow drawer must expose the support mapping card');
assert.ok(index.includes('conversionOptionsCompatRoot'), 'legacy controls must remain available but hidden for controllers');
assert.ok(buildScript.includes('rel="modulepreload" href="./assets/app.bundle.js?v=${VERSION}"'));
assert.ok(buildScript.includes('rel="modulepreload" href="./assets/static-shell.bundle.js?v=${VERSION}"'));
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_MODULE_URL'));
assert.ok(appLoader.includes('MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_MODULE_URL'));
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_MODULE_URL'));
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_DEBUG_LOG_MODULE_URL'));
assert.ok(!topbarLayout.includes('setInterval('));
assert.ok(pkg.scripts.test);
console.log('rules checklist CI gate passed');

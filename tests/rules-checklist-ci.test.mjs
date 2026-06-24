import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTIVE_CACHE_KEY = 'support-axis-transform-generalized-20260624';
const SOURCE_INDEX_CACHE_KEY = 'app-boot-dialog-conversion-hotfix-20260623';
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
assert.deepEqual([...new Set(htmlKeys)], [SOURCE_INDEX_CACHE_KEY], 'source index keys must use the source boot-hotfix cache key that Pages rewrites');
assert.ok(!index.includes(LEGACY_FIRST_PAINT_CACHE_KEY), 'source index must not keep stale root-serving cache keys');
for (const key of [ACTIVE_CACHE_KEY, SOURCE_INDEX_CACHE_KEY, LEGACY_FIRST_PAINT_CACHE_KEY]) {
  assert.match(key, /^[a-z0-9-]+-20\d{6}$/, key + ' must be auditable/date-stamped');
}

for (const [name, source] of [['build-pages.mjs', buildScript], ['app-loader.js', appLoader]]) {
  assert.ok(source.includes(ACTIVE_CACHE_KEY), name + ' must use the active generalized support axis transform cache key');
  assert.ok(!source.includes('perf-static-drawer-bundle-20260620'), name + ' must not keep the prior static-drawer bundle key active');
}

for (const [name, source] of [['safe-ui-bootstrap.js', safeBootstrap], ['static-browser-diagnostics-controller.js', diagnostics]]) {
  assert.ok(source.includes(LEGACY_FIRST_PAINT_CACHE_KEY), name + ' must keep the stable first-paint shell cache key');
}
assert.ok(buildScript.includes('LEGACY_CACHE_KEYS = Object.freeze(['), 'Pages build must list source/deployed cache keys it rewrites');
for (const key of [
  SOURCE_INDEX_CACHE_KEY,
  'support-debug-log-20260623',
  'support-profile-source-bridge-20260624',
  'support-visibility-boost-20260624',
  'support-human-visible-scale-20260624',
  'support-od-offset-human-scale-20260624',
  'support-cone-can-catalogue-20260624',
  'support-disc-click-popup-cleanup-20260624',
  'support-preview-disc-source-fix-20260624',
  ACTIVE_CACHE_KEY
]) assert.ok(buildScript.includes(key), 'Pages build must include cache key ' + key);
assert.ok(diagnostics.includes("STALE_SHELL_VERSION = 'perf-static-drawer-bundle-20260620'"), 'diagnostics may retain the prior key only as stale-asset detection data');

assertBefore(safeBootstrap, 'const SAFE_UI_VERSION', 'scheduleCoreShell()', 'safe-ui-bootstrap constants must be declared before module-init calls');
assertBefore(safeBootstrap, 'const _searchParams', 'const CLIP_MODULE_URLS', 'safe-ui-bootstrap query params must be declared before shouldLoadClipTools init-time use');
assertBefore(appLoader, 'const APP_LOADER_VERSION', 'scheduleAfterFirstPaint(startViewerApp)', 'app-loader constants must be declared before module-init calls');
assertBefore(diagnostics, 'const BROWSER_DIAGNOSTICS_VERSION', 'window.__3D_MARKUP_BROWSER_DIAGNOSTICS__', 'diagnostic constants must be declared before runtime API creation');
assertBefore(diagnostics, 'function shouldShowJankWarning', 'function sampleFrameTime', 'jank warning gate must be declared before sample finalization can use it');

for (const required of ['/_site/', '/node_modules/', 'package-lock.json', '/coverage/']) assert.ok(gitignore.includes(required), '.gitignore must exclude ' + required);

assert.ok(diagnostics.includes('function shouldShowJankWarning(sample, longTasks)'), 'diagnostics must centralize user-visible jank warning gating');
assert.ok(diagnostics.includes("sample.visibilityState === 'visible'"), 'jank warnings must require a visible tab');
assert.ok(diagnostics.includes('sample.hadFocus === true'), 'jank warnings must require focused tab');
assert.ok(diagnostics.includes('longTasks.supported === true'), 'jank warnings must require supported long-task evidence');
assert.ok(diagnostics.includes('longTasks.totalMs >= JANK_LONG_TASK_MS_THRESHOLD'), 'jank warnings must require accumulated long-task evidence');
assert.ok(!diagnostics.includes('unknown → fall back to legacy behaviour and warn'), 'unsupported Long Task API must not fall back to warning');
assert.ok(!diagnostics.includes("type: 'wheel-latency'"), 'wheel latency alone must not trigger a warning banner');
assert.ok(diagnostics.includes('likelyCause'), 'slow-frame readings must include a likelyCause verdict');
assert.ok(!diagnostics.includes('setInterval('), 'diagnostics must not poll');

assert.ok(shellCss.includes('contain: layout style;'), 'static shell must use layout/style containment');
assert.ok(!shellCss.includes('contain: paint'), 'toolbar/panel containment must not use contain: paint');
assert.ok(!shellCss.includes('will-change: transform'), 'static shell must not allocate compositor layers with will-change: transform');

assert.ok(index.includes('rel="preconnect" href="https://unpkg.com"'), 'index must preconnect to boot-time third-party module origin');
assert.ok(index.includes('id="rulesDialog"'), 'index must provide the Mapping Rules dialog expected by app.js initUi');
assert.ok(index.includes('id="closeRulesBtn"'), 'index must provide the Mapping Rules close button expected by app.js initUi');
assert.ok(buildScript.includes('rel="modulepreload" href="./assets/app.bundle.js?v=${VERSION}"'), 'Pages build must modulepreload the app bundle');
assert.ok(buildScript.includes('rel="modulepreload" href="./assets/static-shell.bundle.js?v=${VERSION}"'), 'Pages build must modulepreload the static shell bundle');
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_MODULE_URL'), 'app-loader must load the support source preview bridge');
assert.ok(appLoader.includes('MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_MODULE_URL'), 'app-loader must load the profile support source bridge');
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_MODULE_URL'), 'app-loader must load the support UI visual cleanup module');
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_DEBUG_LOG_MODULE_URL'), 'app-loader must load the support debug log module');
assert.ok(!topbarLayout.includes('setInterval('), 'topbar layout must not poll');
assert.ok(pkg.scripts.test, 'package.json must define test script');
console.log('rules checklist CI gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTIVE_CACHE_KEY = 'bm-cii-code8-support-export-20260622';

const buildScript = readFileSync(new URL('../scripts/build-pages.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const appLoader = readFileSync(new URL('../src/app-loader.js', import.meta.url), 'utf8');
const safeBootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');

assert.match(buildScript, /rollup/, 'Pages build must use Rollup to bundle local module graphs.');
assert.match(buildScript, /src\/app-bundle-entry\.js/, 'Pages build must bundle the viewer app entry.');
assert.match(buildScript, /src\/static-shell-bundle-entry\.js/, 'Pages build must bundle the static shell entry.');
assert.match(buildScript, /inlineDynamicImports:\s*true/, 'Bundles must inline dynamic local imports to reduce request waterfalls.');
assert.match(buildScript, /__3D_MARKUP_BUNDLED_ASSETS__/, 'Pages build must inject the bundle manifest into the deployed index.');
assert.match(buildScript, /assets\/app\.bundle\.js/, 'Pages build must write the app bundle.');
assert.match(buildScript, /assets\/static-shell\.bundle\.js/, 'Pages build must write the shell bundle.');
assert.match(buildScript, /stripVersionQueryPlugin/, 'Pages build must strip cache query suffixes from local source imports.');
assert.match(buildScript, /id === 'three' \|\| id === 'lucide' \|\| id\.startsWith\('three\/'\)/, 'Rollup build must keep CDN/importmap vendor modules external.');
assert.match(buildScript, new RegExp(`const VERSION = '${ACTIVE_CACHE_KEY}'`), 'Pages bundle cache key must expose the active BM_CII support export release.');
assert.match(buildScript, /html = html\.replaceAll\(`\?v=\$\{LEGACY_CACHE_KEY\}`, `\?v=\$\{VERSION\}`\)/, 'Pages build must rewrite deployed source-module cache keys.');
assert.match(appLoader, new RegExp(`APP_LOADER_VERSION = '${ACTIVE_CACHE_KEY}'`), 'App loader cache key must expose the active BM_CII support export release.');
assert.match(appLoader, /MANAGED_STAGE_JSON_UI_MODULE_URL = `\.\/managed-stage-json-ui-controller\.js\?v=\$\{APP_LOADER_VERSION\}`/, 'Managed-stage JSON UI controller must be cache-busted through the active app loader key.');

assert.match(workflow, /npm install/, 'GitHub Pages workflow must install build dependencies.');
assert.match(workflow, /npm test/, 'GitHub Pages workflow must run regression tests before deploy.');
assert.match(workflow, /npm run build/, 'GitHub Pages workflow must build the bundled Pages artifact.');
assert.match(workflow, /_site\/assets\/app\.bundle\.js/, 'GitHub Pages workflow must validate the app bundle artifact.');
assert.match(workflow, /_site\/assets\/static-shell\.bundle\.js/, 'GitHub Pages workflow must validate the shell bundle artifact.');
assert.match(workflow, /__3D_MARKUP_BUNDLED_ASSETS__/, 'GitHub Pages workflow must validate bundle manifest injection.');

assert.match(packageJson.scripts.build, /scripts\/build-pages\.mjs/, 'package.json must expose the Pages bundle build.');
assert.ok(packageJson.devDependencies?.rollup, 'Rollup must be declared as a build dependency.');

assert.match(appLoader, /APP_BUNDLE_URL/, 'App loader must consume the built app bundle manifest.');
assert.match(safeBootstrap, /STATIC_SHELL_BUNDLE_URL/, 'Static UI bootstrap must consume the built shell bundle manifest.');
assert.match(safeBootstrap, /SAFE_UI_VERSION = 'tool-fixes-v2-20260620'/, 'Static UI fallback imports must keep the current stable shell cache key.');

console.log('Pages bundle build regression gate passed');

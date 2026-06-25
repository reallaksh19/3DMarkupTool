import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activeKey = 'staged-json-review-ui-rvm-fix-20260625';
const buildScript = readFileSync(new URL('../scripts/build-pages.mjs', import.meta.url), 'utf8');
const appLoader = readFileSync(new URL('../src/app-loader.js', import.meta.url), 'utf8');
const safeBootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.ok(buildScript.includes(`const VERSION = '${activeKey}'`));
assert.ok(buildScript.includes('support-axis-transform-generalized-20260624'));
assert.ok(buildScript.includes('support-ringless-input-panel-revamp-20260624'));
assert.ok(buildScript.includes('app-boot-dialog-conversion-hotfix-20260623'));
assert.ok(buildScript.includes('rollup'));
assert.ok(buildScript.includes('assets/app.bundle.js'));
assert.ok(buildScript.includes('assets/static-shell.bundle.js'));
assert.ok(appLoader.includes(`APP_LOADER_VERSION = '${activeKey}'`));
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_MODULE_URL'));
assert.ok(appLoader.includes('MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_UI_MODULE_URL'));
assert.ok(appLoader.includes('APP_BUNDLE_URL'));
assert.ok(safeBootstrap.includes('STATIC_SHELL_BUNDLE_URL'));
assert.ok(packageJson.scripts.build.includes('scripts/build-pages.mjs'));
assert.ok(packageJson.devDependencies?.rollup);

console.log('Pages bundle build regression gate passed');

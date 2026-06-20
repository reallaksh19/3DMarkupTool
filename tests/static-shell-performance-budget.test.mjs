import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const perfCss = readFileSync(new URL('../src/static-shell-performance.css', import.meta.url), 'utf8');
const appLoader = readFileSync(new URL('../src/app-loader.js', import.meta.url), 'utf8');
const deferredAppLoader = readFileSync(new URL('../src/deferred-app-loader.js', import.meta.url), 'utf8');
const clipHook = readFileSync(new URL('../src/clip-render-hook.js', import.meta.url), 'utf8');
const prebridge = readFileSync(new URL('../src/render-context-prebridge.js', import.meta.url), 'utf8');
const topbarLayout = readFileSync(new URL('../src/static-topbar-layout-controller.js', import.meta.url), 'utf8');
const drawerSummary = readFileSync(new URL('../src/static-drawer-summary-controller.js', import.meta.url), 'utf8');
const appBundleEntry = readFileSync(new URL('../src/app-bundle-entry.js', import.meta.url), 'utf8');
const shellBundleEntry = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const moduleScriptCount = (index.match(/<script\s+type="module"/g) || []).length;
const staticShellImports = (bootstrap.match(/\.js\?v=\$\{SAFE_UI_VERSION\}/g) || []).length;
const startupScriptBlock = index.slice(index.indexOf('<script type="module"'));

assert.ok(moduleScriptCount <= 3, `index.html should keep top-level module scripts bounded; found ${moduleScriptCount}.`);
assert.match(index, /static-shell-performance\.css\?v=(perf-tdz-fix-20260620|perf-static-drawer-bundle-20260620|perf-idle-diagnostics-20260620|perf-static-shell-20260620)/, 'Index must load static performance CSS before JS bootstrap.');
assert.match(index, /id="topReviewMenu"[\s\S]*review-top-menu-btn/, 'Top Review menu slot must be statically reserved before JS decorates it.');
assert.match(index, /id="staticReviewRibbonGroup"/, 'Review ribbon group must be statically reserved before JS decorates it.');
assert.match(index, /class="tool-group toolbar-group navis-tag-tools tag-lite-host static-markup-tools"/, 'Markup row host must be statically present before JS decorates it.');
assert.match(index, /data-collapsible="conversion"/, 'Conversion section must be marked collapsible in raw HTML.');
assert.match(index, /data-collapsible="sideload"/, 'Sideload section must be marked collapsible in raw HTML.');
assert.match(startupScriptBlock, /app-loader/, 'Index must use a lightweight post-paint app loader.');
assert.doesNotMatch(startupScriptBlock, /src="\.\/src\/app\.js/, 'Index must not evaluate app.js directly during the LCP window.');
assert.doesNotMatch(startupScriptBlock, /src="\.\/src\/fresh-clip-controller\.js/, 'Fresh clip controller must not run as a top-level pre-LCP module.');
assert.doesNotMatch(startupScriptBlock, /src="\.\/src\/clip-render-hook\.js/, 'Clip render hook and freeze guard must not run as a top-level pre-LCP module.');

assert.match(perfCss, /\.viewer-topbar \.markup-ribbon[\s\S]*min-height:\s*52px/, 'Markup ribbon row must reserve first-paint height.');
assert.match(perfCss, /\.viewer-topbar \.markup-ribbon:has\(\.navis-tag-tools:empty\)[\s\S]*display:\s*flex/, 'Static performance CSS must override the base hidden-empty markup row rule.');
assert.match(perfCss, /#staticReviewRibbonGroup:empty[\s\S]*min-width:\s*116px/, 'Review ribbon placeholder must reserve first-paint width.');
assert.match(perfCss, /\.topbar-actions \.top-menu-wrap[\s\S]*min-width:\s*86px/, 'Top Review menu must reserve first-paint width.');
assert.doesNotMatch(perfCss, /\.markup-ribbon:has\(\.navis-tag-tools:empty\)\s*\{\s*display:\s*none/, 'Markup ribbon must not be hidden while waiting for JS.');

assert.match(appLoader, /requestAnimationFrame/, 'App loader must yield paint frames before importing app.js.');
assert.match(appLoader, /requestIdleCallback/, 'App loader must use idle scheduling when available.');
assert.match(appLoader, /import\(APP_MODULE_URL\)/, 'Source-mode app loader must dynamically import the real app.');
assert.match(appLoader, /APP_BUNDLE_URL/, 'App loader must support a bundled production app asset.');
assert.match(appLoader, /import\(APP_BUNDLE_URL\)/, 'App loader must import the production app bundle when the Pages build injects it.');
assert.match(appLoader, /CLIP_HOOK_MODULE_URL/, 'App loader must defer-load the clip hook in source mode instead of relying on top-level HTML.');
assert.match(appLoader, /__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__/, 'App loader must install the freeze guard immediately before source-mode app boot.');
assert.doesNotMatch(appLoader, /deferred-app-loader\.js/, 'App loader must not chain through deferred-app-loader.js.');
assert.match(deferredAppLoader, /CLIP_HOOK_MODULE_URL/, 'Compatibility deferred loader must also defer-load the clip hook.');
assert.doesNotMatch(prebridge, /from ['"]three['"]/, 'Render prebridge must not import Three.js in the LCP path.');
assert.doesNotMatch(prebridge, /WebGLRenderer\?\.prototype/, 'Render prebridge must not patch Three.js prototypes before app boot.');
assert.match(clipHook, /__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__\s*=\s*installStartupFreezeGuard/, 'Freeze guard installer must be exposed for deferred boot.');
assert.doesNotMatch(clipHook, /\ninstallStartupFreezeGuard\(\);/, 'Freeze guard must not install unconditionally during the LCP window.');

assert.match(bootstrap, /const EARLY_MODULE_URLS = \[/, 'Bootstrap must keep source-mode early shell imports.');
assert.match(bootstrap, /const DEFERRED_MODULE_URLS = \[/, 'Bootstrap must keep source-mode deferred shell imports.');
assert.match(bootstrap, /const LATE_IDLE_MODULE_URLS = \[/, 'Bootstrap must reserve expensive diagnostics for late idle import.');
assert.match(bootstrap, /STATIC_SHELL_BUNDLE_URL/, 'Bootstrap must support production static-shell bundle loading.');
assert.match(bootstrap, /import\(STATIC_SHELL_BUNDLE_URL\)/, 'Bootstrap must import the static shell bundle in Pages build mode.');
assert.doesNotMatch(bootstrap, /static-drawer-summary-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Drawer summary must not be default-loaded because it can shift the drawer after paint.');
assert.match(bootstrap, /static-browser-diagnostics-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Browser diagnostics must remain available as a late idle module.');
assert.match(bootstrap, /scheduleAfterFirstPaint\(startDeferredShell\)/, 'Deferred shell imports must wait until after first paint scheduling.');
assert.match(bootstrap, /requestAnimationFrame/, 'Deferred shell imports must yield at least one frame before loading decorative controllers.');
assert.match(bootstrap, /requestIdleCallback/, 'Deferred shell imports must use idle scheduling when available.');
assert.match(bootstrap, /DEFERRED_IMPORT_BATCH_SIZE = 3/, 'Deferred imports must be chunked smaller to reduce long tasks.');
assert.doesNotMatch(bootstrap, /CORE_MODULE_URLS\s*=\s*\[/, 'Bootstrap must not regress to one large core module waterfall.');
assert.ok(staticShellImports >= 25, `Bootstrap should still reference source-mode static shell controllers; found ${staticShellImports}.`);

assert.doesNotMatch(drawerSummary, /new MutationObserver/, 'Drawer summary must not observe log DOM mutations.');
assert.doesNotMatch(drawerSummary, /document\.createElement\(['"]section['"]\)/, 'Drawer summary must not create late summary cards.');
assert.doesNotMatch(drawerSummary, /appendChild\(style\)|createElement\(['"]style['"]\)/, 'Drawer summary must not inject runtime CSS.');

assert.match(appBundleEntry, /await import\('\.\/app\.js'\)/, 'App bundle entry must include app.js through Rollup dynamic inlining.');
assert.match(appBundleEntry, /clip-render-hook\.js/, 'App bundle entry must include the clip hook before app boot.');
assert.match(shellBundleEntry, /static-tree-core-controller\.js/, 'Static shell bundle entry must include tree core controller.');
assert.doesNotMatch(shellBundleEntry, /static-browser-diagnostics-controller\.js/, 'Heavy browser diagnostics must stay outside the static shell bundle.');
assert.doesNotMatch(shellBundleEntry, /static-drawer-summary-controller\.js/, 'Drawer summary must stay outside the default shell bundle.');

assert.doesNotMatch(topbarLayout, /setInterval\(/, 'Topbar layout controller must not poll or repeatedly force layout.');
assert.match(topbarLayout, /shouldEnableFullTopbarLayout/, 'Topbar layout polishing must be opt-in rather than default layout mutation.');
assert.match(pkg.scripts.test, /static-shell-performance-budget\.test\.mjs/, 'npm test must include the static shell performance budget gate.');
assert.match(pkg.scripts.test, /build-pages-bundles\.test\.mjs/, 'npm test must include the Pages bundle build gate.');
assert.match(pkg.scripts.build, /build-pages\.mjs/, 'npm build must produce the bundled Pages artifact.');

console.log('static shell LCP/CLS performance budget gate passed');

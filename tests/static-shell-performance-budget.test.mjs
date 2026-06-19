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
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const moduleScriptCount = (index.match(/<script\s+type="module"/g) || []).length;
const staticShellImports = (bootstrap.match(/\.js\?v=\$\{SAFE_UI_VERSION\}/g) || []).length;
const startupScriptBlock = index.slice(index.indexOf('<script type="module"'));

assert.ok(moduleScriptCount <= 3, `index.html should keep top-level module scripts bounded; found ${moduleScriptCount}.`);
assert.match(index, /static-shell-performance\.css\?v=perf-idle-diagnostics-20260620/, 'Index must load static performance CSS before JS bootstrap.');
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
assert.match(appLoader, /import\(APP_MODULE_URL\)/, 'App loader must dynamically import the real app.');
assert.match(appLoader, /CLIP_HOOK_MODULE_URL/, 'App loader must defer-load the clip hook instead of relying on top-level HTML.');
assert.match(appLoader, /__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__/, 'App loader must install the freeze guard immediately before app boot.');
assert.doesNotMatch(appLoader, /deferred-app-loader\.js/, 'App loader must not chain through deferred-app-loader.js.');
assert.match(deferredAppLoader, /CLIP_HOOK_MODULE_URL/, 'Compatibility deferred loader must also defer-load the clip hook.');
assert.doesNotMatch(prebridge, /from ['"]three['"]/, 'Render prebridge must not import Three.js in the LCP path.');
assert.doesNotMatch(prebridge, /WebGLRenderer\?\.prototype/, 'Render prebridge must not patch Three.js prototypes before app boot.');
assert.match(clipHook, /__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__\s*=\s*installStartupFreezeGuard/, 'Freeze guard installer must be exposed for deferred boot.');
assert.doesNotMatch(clipHook, /\ninstallStartupFreezeGuard\(\);/, 'Freeze guard must not install unconditionally during the LCP window.');

assert.match(bootstrap, /const EARLY_MODULE_URLS = \[/, 'Bootstrap must split early shell imports.');
assert.match(bootstrap, /const DEFERRED_MODULE_URLS = \[/, 'Bootstrap must split deferred shell imports.');
assert.match(bootstrap, /const LATE_IDLE_MODULE_URLS = \[/, 'Bootstrap must reserve expensive diagnostics for late idle import.');
assert.match(bootstrap, /static-browser-diagnostics-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'Browser diagnostics must remain available as a late idle module.');
assert.match(bootstrap, /scheduleAfterFirstPaint\(startDeferredShell\)/, 'Deferred shell imports must wait until after first paint scheduling.');
assert.match(bootstrap, /requestAnimationFrame/, 'Deferred shell imports must yield at least one frame before loading decorative controllers.');
assert.match(bootstrap, /requestIdleCallback/, 'Deferred shell imports must use idle scheduling when available.');
assert.match(bootstrap, /DEFERRED_IMPORT_BATCH_SIZE = 3/, 'Deferred imports must be chunked smaller to reduce long tasks.');
assert.doesNotMatch(bootstrap, /CORE_MODULE_URLS\s*=\s*\[/, 'Bootstrap must not regress to one large core module waterfall.');
assert.ok(staticShellImports >= 26, `Bootstrap should still reference static shell controllers; found ${staticShellImports}.`);

assert.doesNotMatch(topbarLayout, /setInterval\(/, 'Topbar layout controller must not poll or repeatedly force layout.');
assert.match(topbarLayout, /shouldEnableFullTopbarLayout/, 'Topbar layout polishing must be opt-in rather than default layout mutation.');
assert.match(pkg.scripts.test, /static-shell-performance-budget\.test\.mjs/, 'npm test must include the static shell performance budget gate.');

console.log('static shell LCP/CLS performance budget gate passed');

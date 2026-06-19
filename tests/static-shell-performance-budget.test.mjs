import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const perfCss = readFileSync(new URL('../src/static-shell-performance.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const moduleScriptCount = (index.match(/<script\s+type="module"/g) || []).length;
const staticShellImports = (bootstrap.match(/\.js\?v=\$\{SAFE_UI_VERSION\}/g) || []).length;

assert.ok(moduleScriptCount <= 5, `index.html should keep top-level module scripts bounded; found ${moduleScriptCount}.`);
assert.match(index, /static-shell-performance\.css\?v=perf-static-shell-20260620/, 'Index must load static performance CSS before JS bootstrap.');
assert.match(index, /id="topReviewMenu"[\s\S]*review-top-menu-btn/, 'Top Review menu slot must be statically reserved before JS decorates it.');
assert.match(index, /id="staticReviewRibbonGroup"/, 'Review ribbon group must be statically reserved before JS decorates it.');
assert.match(index, /class="tool-group toolbar-group navis-tag-tools tag-lite-host static-markup-tools"/, 'Markup row host must be statically present before JS decorates it.');
assert.match(index, /data-collapsible="conversion"/, 'Conversion section must be marked collapsible in raw HTML.');
assert.match(index, /data-collapsible="sideload"/, 'Sideload section must be marked collapsible in raw HTML.');

assert.match(perfCss, /\.viewer-topbar \.markup-ribbon[\s\S]*min-height:\s*52px/, 'Markup ribbon row must reserve first-paint height.');
assert.match(perfCss, /\.viewer-topbar \.markup-ribbon:has\(\.navis-tag-tools:empty\)[\s\S]*display:\s*flex/, 'Static performance CSS must override the base hidden-empty markup row rule.');
assert.match(perfCss, /#staticReviewRibbonGroup:empty[\s\S]*min-width:\s*116px/, 'Review ribbon placeholder must reserve first-paint width.');
assert.match(perfCss, /\.topbar-actions \.top-menu-wrap[\s\S]*min-width:\s*86px/, 'Top Review menu must reserve first-paint width.');
assert.doesNotMatch(perfCss, /\.markup-ribbon:has\(\.navis-tag-tools:empty\)\s*\{\s*display:\s*none/, 'Markup ribbon must not be hidden while waiting for JS.');

assert.match(bootstrap, /const EARLY_MODULE_URLS = \[/, 'Bootstrap must split early shell imports.');
assert.match(bootstrap, /const DEFERRED_MODULE_URLS = \[/, 'Bootstrap must split deferred shell imports.');
assert.match(bootstrap, /scheduleAfterFirstPaint\(startDeferredShell\)/, 'Deferred shell imports must wait until after first paint scheduling.');
assert.match(bootstrap, /requestAnimationFrame/, 'Deferred shell imports must yield at least one frame before loading decorative controllers.');
assert.match(bootstrap, /requestIdleCallback/, 'Deferred shell imports must use idle scheduling when available.');
assert.match(bootstrap, /DEFERRED_IMPORT_BATCH_SIZE = 4/, 'Deferred imports must be chunked to avoid a single long bootstrap task.');
assert.doesNotMatch(bootstrap, /CORE_MODULE_URLS\s*=\s*\[/, 'Bootstrap must not regress to one large core module waterfall.');
assert.ok(staticShellImports >= 26, `Bootstrap should still reference static shell controllers; found ${staticShellImports}.`);
assert.match(pkg.scripts.test, /static-shell-performance-budget\.test\.mjs/, 'npm test must include the static shell performance budget gate.');

console.log('static shell LCP/CLS performance budget gate passed');

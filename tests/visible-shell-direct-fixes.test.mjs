import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-visible-shell-direct-fixes-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /VISIBLE_DIRECT_FIX_VERSION = 'visible-shell-direct-fixes-20260619'/, 'bootstrap must define a visible direct fixes cache key');
assert.match(bootstrap, /static-visible-shell-direct-fixes-controller\.js\?v=\$\{VISIBLE_DIRECT_FIX_VERSION\}/, 'bootstrap must load the visible direct fixes controller');
assert.ok(bootstrap.indexOf('static-visible-shell-direct-fixes-controller') < bootstrap.indexOf('static-review-tool-final-fixes-controller'), 'direct fixes must load before the older final guard');

assert.match(controller, /__3D_MARKUP_VISIBLE_SHELL_DIRECT_FIXES__/, 'controller must expose diagnostics');
assert.match(controller, /installEarlyReviewToolCapture/, 'controller must install review-tool capture');
assert.match(controller, /stopImmediatePropagation/, 'capture must prevent later duplicate handlers');

assert.match(controller, /stabilizePreviewModeButtons/, 'GLB and RVM preview buttons must be stabilized');
assert.match(controller, /viewModeGlbAliasBtn'\)\?\.remove/, 'old GLB alias must be removed');
assert.match(controller, /viewModeRvmAliasBtn'\)\?\.remove/, 'old RVM alias must be removed');
assert.match(controller, /#previewGlbBtn\.visible-mode-direct/, 'real GLB button must be made visible in View/Fit');
assert.match(controller, /\.final-mode-alias \{ display: none !important/, 'alias buttons must be hidden if recreated');

assert.match(controller, /alwaysVisibleInputBlock/, 'always-visible input block must be created');
assert.match(controller, /alwaysVisibleInputStatus/, 'always-visible input file status must exist');
assert.match(controller, /No file chosen/, 'empty input status must be visible');
assert.match(controller, /block\.appendChild\(fileDrop\)/, 'actual file input must move into always-visible block');
assert.match(controller, /block\.appendChild\(buttonRow\)/, 'sample and clear buttons must move into always-visible block');

assert.match(controller, /window\.__3D_MARKUP_AREA_SELECT__ = \{/, 'Area Select API must be replaced');
assert.match(controller, /addEventListener\('pointerdown', onViewerPointerDown, true\)/, 'Area Select must attach to visible viewer');
assert.match(controller, /selectInClientRect/, 'Area Select must support rectangle selection');
assert.match(controller, /projectedRect/, 'Area Select must use projected bounds');

assert.match(controller, /window\.__3D_MARKUP_SECTION_BOX__ = \{/, 'Section Box API must be exposed');
assert.match(controller, /rt\.renderer\.clippingPlanes = planes/, 'Section Box must set renderer clipping planes directly');

assert.match(controller, /window\.__3D_MARKUP_VIEWPAD_TOOLS__ = \{/, 'Visibility tool API must be patched');
assert.match(controller, /canHideObject/, 'Hide must have a safe root guard');
assert.match(controller, /Hide skipped: select a component\/part, not the full model/, 'Hide must refuse full model selections');
assert.match(controller, /objectVolume \/ rootVolume > 0\.92/, 'Hide must reject near-full-root selections');

assert.match(controller, /window\.__3D_MARKUP_EXPLODE_REVIEW__ = \{/, 'Explode API must be direct');
assert.match(controller, /__visibleShellDirectExplodeOriginalPosition/, 'Explode must record original positions for reset');

assert.match(controller, /removeLegacyMeasureFlashHelpers/, 'Measure flash cleanup must be present');
assert.doesNotMatch(controller, /new THREE\.SphereGeometry/, 'direct layer must not create sphere measure markers');

assert.match(pkg.scripts.test, /visible-shell-direct-fixes\.test\.mjs/, 'npm test must include the visible shell direct fixes gate');

console.log('visible shell direct fixes gate passed');

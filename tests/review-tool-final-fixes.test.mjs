import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-review-tool-final-fixes-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /FINAL_REVIEW_FIX_VERSION = 'review-tool-final-fixes-20260619'/, 'bootstrap must define a final review-tool cache key');
assert.match(bootstrap, /static-ribbon-usability-fixes-controller\.js\?v=\$\{USABILITY_FIX_VERSION\}[\s\S]*static-review-tool-final-fixes-controller\.js\?v=\$\{FINAL_REVIEW_FIX_VERSION\}/, 'final review-tool fixes must load after all previous ribbon/tool patches');

assert.match(controller, /__3D_MARKUP_REVIEW_TOOL_FINAL_FIXES__/, 'controller must publish a diagnostics API');
assert.match(controller, /ensureModeAliases/, 'GLB/RVM mode aliases must be created in View/Fit');
assert.match(controller, /#previewGlbBtn, #previewRvmBtn/, 'original moving GLB/RVM mode buttons must be hidden to stop flicker');
assert.match(controller, /viewModeGlbAliasBtn/, 'stable GLB alias must exist');
assert.match(controller, /viewModeRvmAliasBtn/, 'stable RVM alias must exist');

assert.match(controller, /inputFileChosenStatus/, 'Input panel must show a persistent file chosen status');
assert.match(controller, /No file chosen/, 'Input panel must show No file chosen when empty');
assert.match(controller, /document\.body\.classList\.add\('input-open'\)/, 'Input panel must be forced open');
assert.match(controller, /#inputDrawer \.panel-section:first-of-type/, 'first input section must stay sticky/visible');

assert.match(controller, /window\.__3D_MARKUP_AREA_SELECT__ = \{/, 'Area Select API must be replaced by the final runtime implementation');
assert.match(controller, /selectInClientRect/, 'Area Select must expose rectangle selection');
assert.match(controller, /projectedRect/, 'Area Select must use projected bounds against the drag rectangle');

assert.match(controller, /window\.__3D_MARKUP_COMPONENT_SEARCH__ = \{/, 'Search API must be replaced with a robust panel implementation');
assert.match(controller, /indexComponents/, 'Search must index runtime components');
assert.match(controller, /focusCameraOnObject/, 'Search must focus camera on selected result');

assert.match(controller, /window\.__3D_MARKUP_SECTION_BOX__ = \{/, 'Section Box API must be replaced');
assert.match(controller, /renderer\.clippingPlanes = planes/, 'Section Box must apply renderer clipping planes directly');

assert.match(controller, /window\.__3D_MARKUP_VIEWPAD_TOOLS__ = \{/, 'Visibility tools API must be patched');
assert.match(controller, /hideSelected/, 'Hide Selected must be implemented');
assert.match(controller, /Hide skipped: selection is the full model/, 'Hide must refuse to hide the full model root');
assert.doesNotMatch(controller, /object\?\.name\s*\|\|\s*''\s*\)/, 'component-root resolver must not treat every object name as component metadata');
assert.match(controller, /hasStrongComponentData/, 'component-root resolver must use explicit metadata, not arbitrary names');

assert.match(controller, /window\.__3D_MARKUP_EXPLODE_REVIEW__ = \{/, 'Explode API must be replaced');
assert.match(controller, /applyExplode/, 'Explode must apply directly from ribbon/menu');
assert.match(controller, /__finalReviewExplodeOriginalPosition/, 'Explode reset must restore original positions');

assert.match(controller, /window\.__3D_MARKUP_MEASURE_POLYLINE__ = \{/, 'Measure API must be replaced');
assert.match(controller, /THREE\.PointsMaterial\(\{ color: 0xffd166, size: 9, sizeAttenuation: false/, 'Measure markers must be pixel-sized point markers, not world-scale spheres');
assert.doesNotMatch(controller, /SphereGeometry/, 'Measure implementation must not create sphere markers that can flash as large disks');
assert.match(controller, /removeLegacyMeasureHelpers/, 'Legacy world-scale measure helpers must be removed');

assert.match(pkg.scripts.test, /review-tool-final-fixes\.test\.mjs/, 'npm test must include final review-tool fixes gate');

console.log('review-tool-final-fixes gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-review-selection-actions-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /SELECTION_ACTIONS_VERSION = 'review-selection-actions-20260619'/, 'bootstrap must define a cache key for review selection actions');
assert.match(bootstrap, /static-review-tool-final-fixes-controller\.js\?v=\$\{FINAL_REVIEW_FIX_VERSION\}[\s\S]*static-review-selection-actions-controller\.js\?v=\$\{SELECTION_ACTIONS_VERSION\}/, 'selection action layer must load after final review-tool fixes');

assert.match(controller, /__3D_MARKUP_REVIEW_SELECTION_ACTIONS__/, 'controller must publish a diagnostics API');
assert.match(controller, /data-review-tool=\"areaSelect\"/, 'Area Select ribbon button must be handled directly');
assert.match(controller, /clearAreaSelection/, 'controller must add clear selection behavior');
assert.match(controller, /Clear Sel/, 'controller must add a Clear Selection ribbon action');
assert.match(controller, /Esc: cleared selection \/ reassembled explode/, 'Esc must clear selection and reassemble exploded view');

assert.match(controller, /exportSelectedProperties/, 'controller must export selected properties');
assert.match(controller, /selected-properties-/, 'selected properties export must download CSV');
assert.match(controller, /property_key/, 'CSV export must include property keys');
assert.match(controller, /property_value/, 'CSV export must include property values');

assert.match(controller, /explodeReset/, 'controller must add explicit Explode reset action');
assert.match(controller, /Reassemble \/ Reset Explode/, 'context/menu must expose Reassemble wording');
assert.match(controller, /ExplodeOriginalPosition/i, 'reassemble must restore explode original positions from existing keys');

assert.match(controller, /selectedIds: \(\) => unique/, 'patched Area Select API must combine API ids with helper ids');
assert.match(controller, /clearAreaSelection\(\{ silent: true, keepApi: true \}\)/, 'starting Area Select must clear stale area helpers first');

assert.match(pkg.scripts.test, /review-selection-actions\.test\.mjs/, 'npm test must include review selection action gate');

console.log('review-selection-actions gate passed');

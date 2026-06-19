import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-explode-review-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-explode-review-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the explode review viewpad controller');
assert.match(bootstrap, /explode-review-viewpad-20260619/, 'safe bootstrap cache key must bump for explode review');

assert.match(controller, /const TOOL_VIEW = 'explodeReview'/, 'controller must define a stable explode-review data-view key');
assert.match(controller, /Explode Review: separate components by type or line number/, 'controller must expose a user-facing explode tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /collectComponentRoots/, 'controller must collect component roots from loaded model metadata');
assert.match(controller, /groupComponents/, 'controller must group components before exploding');
assert.match(controller, /LINE_NO|lineNo|lineNumber/, 'controller must support line-number grouping');
assert.match(controller, /componentClass|componentType|visualKey/, 'controller must support type/class grouping');
assert.match(controller, /ORIGINAL_POSITION_KEY/, 'controller must store original positions for reset');
assert.match(controller, /resetExplode/, 'controller must support resetting temporary explode positions');
assert.match(controller, /viewer:explode-review/, 'explode review operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_EXPLODE_REVIEW__/, 'controller must publish a small runtime API for diagnostics');
assert.doesNotMatch(controller, /localStorage\.(setItem|removeItem)/, 'explode review must not persist temporary scene transforms');

assert.match(pkg.scripts.test, /explode-review-viewpad\.test\.mjs/, 'npm test must include explode review viewpad gate');

console.log('explode-review-viewpad gate passed');

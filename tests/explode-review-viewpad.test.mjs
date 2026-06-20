import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-explode-review-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-explode-review-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the explode review viewpad controller');
assert.match(bootstrap, /perf-tdz-fix-20260620/, 'safe bootstrap cache key must remain date-stamped and auditable');

assert.match(controller, /const TOOL_VIEW = 'explodeReview'/, 'controller must define a stable explode-review data-view key');
assert.match(controller, /Explode Review: separate components by type or line number/, 'controller must expose a user-facing explode tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /collectComponentRoots/, 'controller must collect component roots from loaded model metadata');
assert.match(controller, /groupComponents/, 'controller must group components before exploding');
assert.match(controller, /LINE_NO|lineNo|lineNumber/, 'controller must support line-number grouping');
assert.match(controller, /componentClass|componentType|visualKey/, 'controller must support type/class grouping');
assert.match(controller, /const originalPositions = new Map\(\)/, 'Phase 9 must keep original positions in memory only');
assert.match(controller, /originalPositions\.set\(object, object\.position\.clone/, 'Phase 9 must capture original positions from object.position clones');
assert.match(controller, /originalPositions\.clear\(\)/, 'Phase 9 reset must clear memory-only position cache');
assert.match(controller, /reassembleExplode/, 'Phase 9 must expose an explicit Reassemble path');
assert.match(controller, /attachExplodeEsc\(\)/, 'Phase 9 must install bounded Esc lifecycle handling');
assert.match(controller, /document\.addEventListener\('keydown', onExplodeEscape, \{ capture: true \}\)/, 'Esc handler must be event-driven and bounded');
assert.match(controller, /event\.key !== 'Escape' \|\| !explodeActive/, 'Esc must only reassemble when an explode session is active');
assert.match(controller, /reassembleExplode\('escape'\)/, 'Esc must route through Reassemble instead of leaving offset objects');
assert.match(controller, /explode-review-active/, 'Phase 9 must expose active state as a body hook');
assert.match(controller, /viewer:explode-review/, 'explode review operations must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_EXPLODE_REVIEW__/, 'controller must publish a small runtime API for diagnostics');
assert.match(controller, /reassemble:\s*\(\) => reassembleExplode\('api'\)/, 'runtime API must expose Reassemble');
assert.match(controller, /active:\s*explodeActive/, 'runtime state must report active explode status');
assert.match(controller, /movedCount:\s*originalPositions\.size/, 'runtime state must report moved component count');

assert.doesNotMatch(controller, /ORIGINAL_POSITION_KEY/, 'Phase 9 must not store temporary original positions in userData');
assert.doesNotMatch(controller, /userData\?\.\[ORIGINAL_POSITION_KEY\]|userData\[ORIGINAL_POSITION_KEY\]/, 'Phase 9 must not write temporary explode state into object userData');
assert.doesNotMatch(controller, /localStorage\.(setItem|removeItem)/, 'explode review must not persist temporary scene transforms');
assert.doesNotMatch(controller, /setInterval\s*\(/, 'explode review must not poll');
assert.doesNotMatch(controller, /MutationObserver/, 'explode review must not use MutationObserver');

assert.match(pkg.scripts.test, /explode-review-viewpad\.test\.mjs/, 'npm test must include explode review viewpad gate');

console.log('explode-review-viewpad gate passed');

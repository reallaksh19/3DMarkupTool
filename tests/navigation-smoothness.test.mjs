import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-navigation-smoothness-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/post-pr133-recovery-checklist.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /navigation-smoothness-20260619/, 'bootstrap must use the Phase 1 navigation smoothness cache key');
assert.match(bootstrap, /static-navigation-smoothness-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the navigation smoothness controller');
assert.match(bootstrap, /static-review-ribbon-tools-controller[\s\S]*static-navigation-smoothness-controller/, 'navigation tuning must load after restored PR133 ribbon integration');

assert.match(controller, /NAVIGATION_SMOOTHNESS_VERSION = 'navigation-smoothness-20260619'/, 'controller must declare a stable Phase 1 version');
assert.match(controller, /controls\.enableDamping = true/, 'controller must enable OrbitControls damping');
assert.match(controller, /controls\.dampingFactor = 0\.045/, 'controller must use gentle damping for smooth orbit/zoom feel');
assert.match(controller, /controls\.zoomSpeed = 0\.42/, 'controller must reduce wheel zoom jumpiness');
assert.match(controller, /controls\.zoomToCursor = true/, 'controller must enable zoom-to-cursor for practical review navigation');
assert.match(controller, /fitBox\(/, 'controller must provide stable fit-box navigation');
assert.match(controller, /verticalDistance/, 'fit-box must consider vertical camera FOV');
assert.match(controller, /horizontalDistance/, 'fit-box must consider aspect ratio');
assert.match(controller, /__3D_MARKUP_NAVIGATION_SMOOTHNESS__/, 'controller must expose a diagnostics API');
assert.match(controller, /noIntervalPolling: true/, 'checklist must declare no interval polling');
assert.doesNotMatch(controller, /setInterval\(/, 'navigation smoothness controller must not use setInterval');

assert.match(checklist, /\| ✅ \| B1 — Zoom is not smooth \|/, 'Phase 1 checklist must tick the zoom smoothness comment');
assert.match(checklist, /\| ⬜ \| C1 — Input controls must always remain visible \|/, 'later phases must remain open until implemented');
assert.match(pkg.scripts.test, /navigation-smoothness\.test\.mjs/, 'npm test must include the navigation smoothness gate');

console.log('navigation-smoothness gate passed');

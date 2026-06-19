import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync('src/static-menu-label-text-controller.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');

assert.match(controller, /topbar-menu-label-text-reverted-20260619/, 'reverted menu-label controller should be a no-op placeholder');
assert.doesNotMatch(bootstrap, /static-menu-label-text-controller\.js/, 'bootstrap should not load the reverted menu-label controller');
assert.doesNotMatch(bootstrap, /topbar-menu-label-text-20260619/, 'bootstrap should not keep the active menu-label cache marker');
assert.doesNotMatch(controller, /MutationObserver/, 'reverted no-op controller must not observe or patch DOM');
assert.doesNotMatch(controller, /setInterval/, 'reverted no-op controller must not poll');

console.log('topbar menu label text revert gate passed');

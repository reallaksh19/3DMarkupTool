import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync(new URL('../src/static-canvas-tool-manager.js', import.meta.url), 'utf8');
const resolver = readFileSync(new URL('../src/static-selection-resolver.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(manager, /canvas-tool-manager-20260620/);
assert.match(manager, /selectedRoots/);
assert.match(manager, /getSelectedRoots/);
assert.match(manager, /__3D_MARKUP_AREA_SELECTED_ROOTS__/);
assert.match(manager, /clearSelection/);
assert.match(manager, /exportSelectedPropertiesCsv/);
assert.match(manager, /selected_index/);
assert.match(manager, /object_id/);
assert.match(manager, /property_value/);
assert.match(manager, /exportAreaSelectionCsv|exportSelectedPropertiesCsv/);
assert.match(manager, /action:\s*'clear'/);
assert.match(manager, /resolveSafeComponentRoot/);
assert.match(manager, /sanitizeTargets/);
assert.doesNotMatch(manager, /setInterval\s*\(/);
assert.doesNotMatch(manager, /new\s+MutationObserver|MutationObserver\s*\(/);
assert.doesNotMatch(bootstrap, /static-area-select-controller\.js/);
assert.doesNotMatch(bundle, /static-area-select-controller\.js/);
assert.match(resolver, /selectedRoots/);
assert.match(resolver, /getSelectedRoots/);
assert.match(manager, /runVisibilityAction\('hide'\)/);
assert.match(manager, /runVisibilityAction\('isolate'\)/);
assert.match(manager, /safeTargets\.map\(objectId\)\.filter\(Boolean\)/);
assert.match(pkg.scripts.test, /area-select-workflow-phase8\.test\.mjs/);

console.log('area-select workflow manager gate passed');

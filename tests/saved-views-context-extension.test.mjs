import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const extension = readFileSync(new URL('../src/static-saved-views-context-extension.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-saved-views-context-extension\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load saved-view context extension');
assert.match(extension, /__3D_MARKUP_SAVED_VIEWS__/, 'extension must connect to the saved views runtime API');
assert.match(extension, /api\.save\s*=\s*\(name\)/, 'extension must wrap saved-view save');
assert.match(extension, /api\.restore\s*=\s*\(id\)/, 'extension must wrap saved-view restore');
assert.match(extension, /captureReviewContext/, 'extension must capture review context');
assert.match(extension, /restoreReviewContext/, 'extension must restore review context');
assert.match(extension, /SavedViewReviewContext\.v1/, 'saved review context must have a versioned schema');
assert.match(extension, /selectedId/, 'saved review context must include selected component id');
assert.match(extension, /hiddenIds/, 'saved review context must include visibility state');
assert.match(extension, /colorBySelect/, 'saved review context must include Color By select value');
assert.match(extension, /activeViewpadTools/, 'saved review context must record active viewpad tool state for diagnostics');
assert.match(extension, /viewer:saved-view-context/, 'extension must dispatch saved-view context diagnostics');
assert.match(extension, /restoreVisibility/, 'extension must restore visibility state');
assert.match(extension, /restoreColorMode/, 'extension must restore Color By mode');
assert.match(extension, /restoreSelection/, 'extension must restore selected component reference');
assert.match(pkg.scripts.test, /saved-views-context-extension\.test\.mjs/, 'npm test must include saved views context extension gate');

console.log('saved-views-context-extension gate passed');

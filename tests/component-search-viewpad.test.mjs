import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-component-search-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(bootstrap, /static-component-search-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load the component search viewpad controller');
assert.match(bootstrap, /component-search-viewpad-20260619/, 'safe bootstrap cache key must bump for component search');

assert.match(controller, /const TOOL_VIEW = 'componentSearch'/, 'controller must define a stable component-search data-view key');
assert.match(controller, /Search \/ jump to component, node, line, support, or tag/, 'controller must expose a user-facing search tooltip');
assert.match(controller, /button\.dataset\.view = TOOL_VIEW/, 'controller must create a view-pad button with a data-view marker');
assert.match(controller, /buildSearchIndex/, 'controller must build a search index from the loaded model');
assert.match(controller, /SEARCHABLE_KEYS/, 'controller must search engineering metadata keys');
assert.match(controller, /fromNode|toNode|LINE_NO|SUPPORT_TAG/, 'controller must include node, line, and support metadata in search scope');
assert.match(controller, /new THREE\.Box3\(\)\.setFromObject/, 'controller must focus results using object bounds');
assert.match(controller, /controls\.target\.copy\(center\)/, 'controller must center OrbitControls on the focused object');
assert.match(controller, /new THREE\.BoxHelper/, 'controller must highlight focused search results');
assert.match(controller, /viewer:component-search/, 'component search must dispatch diagnostics');
assert.match(controller, /__3D_MARKUP_COMPONENT_SEARCH__/, 'controller must publish a small runtime API for diagnostics');
assert.doesNotMatch(controller, /localStorage\.(setItem|removeItem)/, 'component search must not write search terms to localStorage');

assert.match(pkg.scripts.test, /component-search-viewpad\.test\.mjs/, 'npm test must include component search viewpad gate');

console.log('component-search-viewpad gate passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync(new URL('../src/static-canvas-tool-manager.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const bundleEntry = readFileSync(new URL('../src/static-shell-bundle-entry.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.doesNotMatch(bootstrap, /static-section-box-from-selection-controller\.js/);
assert.doesNotMatch(bundleEntry, /static-section-box-from-selection-controller\.js/);
assert.match(bootstrap, /static-canvas-tool-manager\.js\?v=\$\{SAFE_UI_VERSION\}/);
assert.match(bundleEntry, /static-canvas-tool-manager\.js/);
assert.match(manager, /canvas-tool-manager-20260620/);
assert.match(manager, /sectionBoxSelected/);
assert.match(manager, /Section Box/);
assert.match(manager, /patchSectionBoxApi/);
assert.match(manager, /runSectionBoxAction/);
assert.match(manager, /startPickMode\('sectionBox'\)/);
assert.match(manager, /resolveSafeHideTarget/);
assert.match(manager, /new THREE\.Box3\(\)\.setFromObject/);
assert.equal((manager.match(/new THREE\.Plane/g) || []).length, 6);
assert.match(manager, /planes\.length|planeCount/);
assert.match(manager, /renderer\.clippingPlanes = planes/);
assert.match(manager, /renderer\.localClippingEnabled = true/);
assert.match(manager, /clearSectionBox/);
assert.match(manager, /sectionBoxActive/);
assert.match(manager, /escapeClears: true/);
assert.match(manager, /viewer:section-box/);
assert.match(manager, /__3D_MARKUP_SECTION_BOX__/);
assert.match(manager, /renderOnce|viewer:request-render/);
assert.doesNotMatch(manager, /setInterval\s*\(/);
assert.doesNotMatch(manager, /MutationObserver/);
assert.match(pkg.scripts.test, /section-box-viewpad\.test\.mjs/);

console.log('section-box manager gate passed');

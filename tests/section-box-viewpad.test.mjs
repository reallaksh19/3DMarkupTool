import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync(new URL('../src/static-canvas-tool-manager.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(manager, /sectionBoxSelected/);
assert.match(manager, /runSectionBoxAction/);
assert.match(manager, /startPickMode/);
assert.match(manager, /clearSectionBox/);
assert.match(manager, /viewer:section-box/);
assert.equal((manager.match(/new THREE\.Plane/g) || []).length, 6);
assert.match(pkg.scripts.test, /section-box-viewpad\.test\.mjs/);

console.log('section-box manager gate passed');

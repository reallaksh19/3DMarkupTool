import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const controller = fs.readFileSync(path.join(repoRoot, 'src/static-annotation-lod-controller.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(repoRoot, 'src/safe-ui-bootstrap.js'), 'utf8');

assert.match(controller, /annotation-density-lod-20260620/, 'annotation controller must expose the density LOD cache/version key');
assert.match(controller, /NODE_LABEL_MAX_VISIBLE\s*=\s*28/, 'node labels must have a hard visible-count cap');
assert.match(controller, /NODE_LABEL_MIN_SCREEN_PX\s*=\s*56/, 'node labels must be culled by screen-space spacing');
assert.match(controller, /NODE_LABEL_MAX_PER_GRID_CELL\s*=\s*1/, 'node label grid density must be capped');
assert.match(controller, /function updateNodeLabels\(/, 'controller must have a separate node-label LOD path');
assert.match(controller, /setManagedVisible\(candidate\.object, false\)/, 'culled node labels must be hidden, not merely resized');
assert.match(controller, /material\.depthTest\s*=\s*true/, 'leaders must depth-test so they do not draw as foreground wires through pipes');
assert.match(controller, /desiredScreenFraction = kind === 'isonote-board' \? 0\.048 : 0\.026/, 'ISONOTE and node labels must use compact screen-size fractions');
assert.match(bootstrap, /static-annotation-lod-controller\.js\?v=annotation-density-lod-20260620/, 'bootstrap must load the cache-busted density LOD controller');

console.log('static annotation LOD density policy OK');

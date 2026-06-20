import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const controller = fs.readFileSync(path.join(repoRoot, 'src/static-annotation-lod-controller.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(repoRoot, 'src/safe-ui-bootstrap.js'), 'utf8');

assert.match(controller, /annotation-isonote-readable-20260620/, 'annotation controller must expose the ISONOTE readable cache/version key');
assert.match(controller, /NODE_LABEL_MAX_VISIBLE\s*=\s*10/, 'node labels must have a tight readable-count cap');
assert.match(controller, /NODE_LABEL_MIN_SCREEN_PX\s*=\s*132/, 'node labels must be culled by larger screen-space spacing');
assert.match(controller, /NODE_LABEL_MAX_PER_GRID_CELL\s*=\s*1/, 'node label grid density must be capped');
assert.match(controller, /NODE_LABEL_TARGET_SCREEN_FRACTION\s*=\s*0\.056/, 'node labels must use a readable screen-size target');
assert.match(controller, /ISONOTE_TARGET_SCREEN_FRACTION\s*=\s*0\.13/, 'ISONOTE boards must use a larger readable screen-size target');
assert.match(controller, /ISONOTE_CANVAS_WIDTH\s*=\s*1280/, 'ISONOTE canvas must be redrawn at higher resolution');
assert.match(controller, /ISONOTE_MAX_TEXT_LINES\s*=\s*3/, 'ISONOTE board text must be limited to readable lines');
assert.match(controller, /function redrawIsonoteBoard\(/, 'controller must redraw ISONOTE canvas text instead of only scaling old texture');
assert.match(controller, /drawRoundRect\(ctx, 34, 30, 300, 62/, 'ISONOTE board must include a readable title pill');
assert.match(controller, /material\.map\.generateMipmaps\s*=\s*false/, 'ISONOTE text texture must avoid mipmap blur');
assert.match(controller, /function updateNodeLabels\(/, 'controller must have a separate node-label LOD path');
assert.match(controller, /setManagedVisible\(candidate\.object, false\)/, 'culled node labels must be hidden, not merely resized');
assert.match(controller, /applyNodeLabelOffset\(object, item\.distance\)/, 'accepted node labels must be offset away from component silhouettes');
assert.match(controller, /cameraRightVector\(/, 'labels must use a camera-right offset to avoid sitting on pipe centerlines');
assert.match(controller, /material\.depthTest\s*=\s*true/, 'leaders must depth-test so they do not draw as foreground wires through pipes');
assert.match(controller, /material\.opacity[^\n]+0\.10/, 'leaders must be faint enough not to dominate annotations');
assert.match(controller, /clamp\(rawScale, ISONOTE_MIN_SCALE, ISONOTE_MAX_SCALE\)/, 'ISONOTE scale must use explicit readable clamp constants');
assert.match(controller, /clamp\(rawScale, 0\.82, 1\.65\)/, 'node label scale must be readable, not tiny');
assert.match(bootstrap, /static-annotation-lod-controller\.js\?v=annotation-isonote-readable-20260620/, 'bootstrap must load the cache-busted readable ISONOTE controller');

console.log('static annotation ISONOTE readable callout policy OK');

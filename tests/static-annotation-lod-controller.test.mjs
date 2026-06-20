import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const controller = fs.readFileSync(path.join(repoRoot, 'src/static-annotation-lod-controller.js'), 'utf8');
const facingController = fs.readFileSync(path.join(repoRoot, 'src/static-annotation-facing-controller.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(repoRoot, 'src/safe-ui-bootstrap.js'), 'utf8');

assert.match(controller, /annotation-isonote-readable-v2-20260620/, 'annotation controller must expose the legible ISONOTE cache/version key');
assert.match(controller, /NODE_LABEL_MAX_VISIBLE\s*=\s*10/, 'node labels must keep the readable-count cap');
assert.match(controller, /NODE_LABEL_MIN_SCREEN_PX\s*=\s*132/, 'node labels must be culled by larger screen-space spacing');
assert.match(controller, /NODE_LABEL_MAX_PER_GRID_CELL\s*=\s*1/, 'node label grid density must be capped');
assert.match(controller, /NODE_LABEL_TARGET_SCREEN_FRACTION\s*=\s*0\.056/, 'node labels must use a readable screen-size target');
assert.match(controller, /ISONOTE_TARGET_SCREEN_FRACTION\s*=\s*0\.18/, 'ISONOTE boards must use a larger readable screen-size target');
assert.match(controller, /ISONOTE_CANVAS_WIDTH\s*=\s*1600/, 'ISONOTE boards must redraw to a high-resolution texture canvas');
assert.match(controller, /ISONOTE_MAX_VISIBLE\s*=\s*3/, 'ISONOTE callouts must be capped to avoid unreadable board clutter');
assert.match(controller, /function redrawIsonoteBoard\(/, 'controller must redraw ISONOTE boards, not only scale existing GLB textures');
assert.match(controller, /document\.createElement\('canvas'\)/, 'redraw must create a fresh canvas even when the imported texture image is not a canvas');
assert.match(controller, /installCanvasTexture\(material, canvas\)/, 'redraw must replace the material texture image with the fresh readable canvas');
assert.match(controller, /updateIsonoteBoards\(\)/, 'controller must have a separate ISONOTE LOD path');
assert.match(controller, /setManagedVisible\(candidate\.object, false\)/, 'culled node labels must be hidden, not merely resized');
assert.match(controller, /applyNodeLabelOffset\(object, item\.distance\)/, 'accepted node labels must be offset away from component silhouettes');
assert.match(controller, /cameraRightVector\(/, 'node labels must use a camera-right offset to avoid sitting on pipe centerlines');
assert.match(controller, /material\.depthTest\s*=\s*true/, 'leaders must depth-test so they do not draw as foreground wires through pipes');
assert.match(controller, /material\.opacity[^\n]+0\.08/, 'leaders must be faint enough not to dominate annotations');
assert.match(controller, /clamp\(rawScale, ISONOTE_MIN_SCALE, ISONOTE_MAX_SCALE\)/, 'ISONOTE scale must use explicit readable clamps');
assert.match(controller, /clamp\(rawScale, 0\.82, 1\.65\)/, 'node label scale must stay readable, not tiny');
assert.match(facingController, /annotation-isonote-world-facing-20260620/, 'facing controller must expose the ISONOTE world-facing cache/version key');
assert.match(facingController, /function faceCameraInWorldSpace\(/, 'ISONOTE boards must use a dedicated world-facing orientation path');
assert.match(facingController, /getWorldQuaternion\(parentWorldQuaternion\)/, 'world-facing path must account for rotated model/parent groups');
assert.match(facingController, /parentInverse\.multiply\(targetWorldQuaternion\)/, 'camera quaternion must be converted from world space into the board parent local space');
assert.match(facingController, /material\.side\s*=\s*2/, 'ISONOTE boards must be double-sided so the imported plane normal cannot show the back/underside');
assert.match(bootstrap, /static-annotation-lod-controller\.js\?v=annotation-isonote-readable-v2-20260620/, 'bootstrap must load the cache-busted legible ISONOTE annotation controller');
assert.match(bootstrap, /static-annotation-facing-controller\.js\?v=annotation-isonote-world-facing-20260620/, 'bootstrap must load the ISONOTE facing correction after the LOD controller');

console.log('static annotation legible ISONOTE policy OK');

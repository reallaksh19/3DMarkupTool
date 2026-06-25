import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge = fs.readFileSync('src/managed-stage-viewer-api-bridge.js', 'utf8');
const sampleController = fs.readFileSync('src/managed-stage-bm-cii-json-sample-controller.js', 'utf8');
const managedController = fs.readFileSync('src/managed-stage-json-ui-controller.js', 'utf8');

assert.match(bridge, /ManagedStageViewerApiBridge\.v1/);
assert.match(bridge, /__THREED_MARKUP_VIEWER__/);
assert.match(bridge, /__viewerApi/);
assert.match(bridge, /__3D_MARKUP_VIEWER_RUNTIME__/);
assert.match(bridge, /setModelRoot\(modelRoot, meta = \{\}\)/);
assert.match(bridge, /clearModelRoot\(meta = \{\}\)/);
assert.match(bridge, /runtime\.scene\.add\(modelRoot\)/);
assert.match(bridge, /fitRuntimeModel\(runtime, modelRoot\)/);
assert.match(bridge, /viewer:model-loaded/);
assert.match(bridge, /viewer:managed-stage-viewer-api-ready/);

assert.match(sampleController, /import '\.\/managed-stage-viewer-api-bridge\.js';/);
assert.match(managedController, /Viewer API unavailable for managed-stage preview/);
assert.match(managedController, /api\.setModelRoot\(root, \{ source: 'managed-stage-json'/);
assert.match(managedController, /api\.clearModelRoot\(\{ source: 'managed-stage-json'/);

console.log('managed-stage viewer API bridge exposes setModelRoot for bundled JSON preview');

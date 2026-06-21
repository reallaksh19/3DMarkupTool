import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync('src/app-loader.js', 'utf8');
const controller = fs.readFileSync('src/managed-stage-json-ui-controller.js', 'utf8');
const preview = fs.readFileSync('src/rvm-preview.js', 'utf8');

assert.match(loader, /MANAGED_STAGE_JSON_UI_MODULE_URL/);
assert.match(loader, /loadManagedStageJsonUiController/);
assert.match(loader, /managed-stage-json-ui-controller\.js/);

assert.match(controller, /loadManagedStageJsonBtn/);
assert.match(controller, /managedStageJsonFile/);
assert.match(controller, /convertManagedStageJsonToRvmAtt/);
assert.match(controller, /createRvmPreviewScene/);
assert.match(controller, /downloadRvmBtn/);
assert.match(controller, /downloadAttBtn/);
assert.match(controller, /downloadAuditBtn/);
assert.match(controller, /convertBtn/);
assert.match(controller, /viewer:managed-stage-json-loaded/);

assert.match(preview, /primitive\.kind === 'elbow'/);
assert.match(preview, /function createElbow/);
assert.match(preview, /new THREE\.TorusGeometry/);
assert.match(preview, /primitiveCode: 4/);

console.log('managed-stage JSON UI wiring test passed');

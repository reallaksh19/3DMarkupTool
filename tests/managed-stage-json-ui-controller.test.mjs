import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync('src/app-loader.js', 'utf8');
const controller = fs.readFileSync('src/managed-stage-json-ui-controller.js', 'utf8');
const preview = fs.readFileSync('src/rvm-preview.js', 'utf8');

assert.match(loader, /MANAGED_STAGE_JSON_UI_MODULE_URL/);
assert.match(loader, /loadManagedStageJsonUiController/);
assert.match(loader, /managed-stage-json-ui-controller\.js/);

assert.match(controller, /ManagedStageJsonUiController\.v2/);
assert.match(controller, /loadUnifiedModelFileBtn/);
assert.match(controller, /ensureUnifiedModelFileInput/);
assert.match(controller, /xmlFile/);
assert.match(controller, /\.xml,\.txt,\.json,application\/xml,text\/xml,application\/json/);
assert.match(controller, /Choose InputXML \/ Managed JSON/);
assert.match(controller, /BM_CII_INPUT_managed_stage\.json/);
assert.match(controller, /onUnifiedModelFileChange/);
assert.match(controller, /stopImmediatePropagation/);
assert.match(controller, /looksLikeManagedStageJson/);
assert.match(controller, /inputxml-managed-stage\/v1/);
assert.match(controller, /AVEVA_JSON_FOR_3D_RVM_VIEWER/);
assert.match(controller, /convertManagedStageJsonToRvmAtt/);
assert.match(controller, /createRvmPreviewScene/);
assert.match(controller, /downloadRvmBtn/);
assert.match(controller, /downloadAttBtn/);
assert.match(controller, /downloadAuditBtn/);
assert.match(controller, /convertBtn/);
assert.match(controller, /viewer:managed-stage-json-loaded/);
assert.doesNotMatch(controller, /managedStageJsonFile/);

assert.match(preview, /primitive\.kind === 'elbow'/);
assert.match(preview, /function createElbow/);
assert.match(preview, /new THREE\.TorusGeometry/);
assert.match(preview, /primitiveCode: 4/);

console.log('unified InputXML / managed-stage JSON UI wiring test passed');

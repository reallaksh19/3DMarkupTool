import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync('src/app-loader.js', 'utf8');
const controller = fs.readFileSync('src/managed-stage-json-ui-controller.js', 'utf8');
const sampleController = fs.readFileSync('src/managed-stage-bm-cii-json-sample-controller.js', 'utf8');
const sampleData = fs.readFileSync('src/managed-stage-bm-cii-json-sample-data.js', 'utf8');
const preview = fs.readFileSync('src/rvm-preview.js', 'utf8');

assert.match(loader, /MANAGED_STAGE_JSON_UI_MODULE_URL/);
assert.match(loader, /MANAGED_STAGE_JSON_SAMPLE_MODULE_URL/);
assert.match(loader, /loadManagedStageJsonUiController/);
assert.match(loader, /managed-stage-json-ui-controller\.js/);
assert.match(loader, /managed-stage-bm-cii-json-sample-controller\.js/);

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
assert.match(controller, /BM_CII_INPUTXML_JSON_EXPECTATIONS/);
assert.match(controller, /primitiveCodeCounts:\s*\{\s*4:\s*0,\s*8:\s*91\s*\}/);
assert.match(controller, /primCount:\s*91/);
assert.doesNotMatch(controller, /BM_CII_EXPECTATIONS/);
assert.doesNotMatch(controller, /primitiveCodeCounts:\s*\{\s*4:\s*7,\s*8:\s*41\s*\}/);
assert.doesNotMatch(controller, /primCount:\s*48/);
assert.doesNotMatch(controller, /primCount:\s*70/);
assert.match(controller, /createRvmPreviewScene/);
assert.match(controller, /downloadRvmBtn/);
assert.match(controller, /downloadAttBtn/);
assert.match(controller, /downloadAuditBtn/);
assert.match(controller, /convertBtn/);
assert.match(controller, /viewer:managed-stage-json-loaded/);
assert.doesNotMatch(controller, /managedStageJsonFile/);

assert.match(sampleController, /ManagedStageBmCiiJsonSampleController\.v1/);
assert.match(sampleController, /loadManagedStageJsonSampleBtn/);
assert.match(sampleController, /Load BM_CII JSON sample/);
assert.match(sampleController, /createBmCiiManagedStageSampleJson/);
assert.match(sampleController, /managedStageApi\.loadText\(sourceText, SAMPLE_SOURCE_NAME\)/);
assert.doesNotMatch(sampleController, /modelFileInput\.click/);
assert.doesNotMatch(sampleController, /fetch\(SAMPLE_URL/);

assert.match(sampleData, /BM_CII_INPUT_managed_stage\.json/);
assert.match(sampleData, /inputxml-managed-stage\/v1/);
assert.match(sampleData, /AVEVA_JSON_FOR_3D_RVM_VIEWER/);
assert.match(sampleData, /stats: \{ components: 40, restraints: 48, branches: 1, children: 52 \}/);
assert.match(sampleData, /FLANGE_PAIR/);
assert.match(sampleData, /FLANGED_VALVE/);
assert.match(sampleData, /BEND_RADIUS/);

assert.match(preview, /primitive\.kind === 'elbow'/);
assert.match(preview, /function createElbow/);
assert.match(preview, /new THREE\.TorusGeometry/);
assert.match(preview, /primitiveCode: 4/);

console.log('unified InputXML / managed-stage JSON UI and BM_CII JSON sample wiring test passed');

import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync('src/app-loader.js', 'utf8');
const controller = fs.readFileSync('src/managed-stage-json-ui-controller.js', 'utf8');
const sampleController = fs.readFileSync('src/managed-stage-bm-cii-json-sample-controller.js', 'utf8');
const viewerApiBridge = fs.readFileSync('src/managed-stage-viewer-api-bridge.js', 'utf8');
const sampleData = fs.readFileSync('src/managed-stage-bm-cii-json-sample-data.js', 'utf8');
const rawPreview = fs.readFileSync('src/managed-stage-preview-scene.js', 'utf8');
const supportVisualResolver = fs.readFileSync('src/managed-stage-support-visual-resolver.js', 'utf8');

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
assert.match(controller, /createManagedStagePreviewScene/);
assert.match(controller, /previewPipeline: 'raw-managed-stage-json-coordinate-preserving'/);
assert.match(controller, /previewCoordinateAudit/);
assert.doesNotMatch(controller, /createRvmPreviewScene\(result\.exportModel\)/);
assert.match(controller, /BM_CII_INPUTXML_JSON_EXPECTATIONS/);
assert.match(controller, /primitiveCodeCounts:\s*\{\s*4:\s*0,\s*8:\s*91\s*\}/);
assert.match(controller, /primCount:\s*91/);
assert.doesNotMatch(controller, /BM_CII_EXPECTATIONS/);
assert.doesNotMatch(controller, /primitiveCodeCounts:\s*\{\s*4:\s*7,\s*8:\s*41\s*\}/);
assert.doesNotMatch(controller, /primCount:\s*48/);
assert.doesNotMatch(controller, /primCount:\s*70/);
assert.match(controller, /downloadRvmBtn/);
assert.match(controller, /downloadAttBtn/);
assert.match(controller, /downloadAuditBtn/);
assert.match(controller, /convertBtn/);
assert.match(controller, /viewer:managed-stage-json-loaded/);
assert.match(controller, /Managed-stage preview coordinate audit/);
assert.doesNotMatch(controller, /managedStageJsonFile/);

assert.match(sampleController, /ManagedStageBmCiiJsonSampleController\.v1/);
assert.match(sampleController, /import '\.\/managed-stage-viewer-api-bridge\.js';/);
assert.match(sampleController, /loadManagedStageJsonSampleBtn/);
assert.match(sampleController, /Load BM_CII JSON sample/);
assert.match(sampleController, /createBmCiiManagedStageSampleJson/);
assert.match(sampleController, /managedStageApi\.loadText\(sourceText, SAMPLE_SOURCE_NAME\)/);
assert.doesNotMatch(sampleController, /modelFileInput\.click/);
assert.doesNotMatch(sampleController, /fetch\(SAMPLE_URL/);

assert.match(viewerApiBridge, /ManagedStageViewerApiBridge\.v1/);
assert.match(viewerApiBridge, /__THREED_MARKUP_VIEWER__/);
assert.match(viewerApiBridge, /setModelRoot\(modelRoot, meta = \{\}\)/);
assert.match(viewerApiBridge, /clearModelRoot\(meta = \{\}\)/);
assert.match(viewerApiBridge, /fitRuntimeModel\(runtime, modelRoot\)/);

assert.match(sampleData, /BM_CII_INPUT_managed_stage\.json/);
assert.match(sampleData, /inputxml-managed-stage\/v1/);
assert.match(sampleData, /AVEVA_JSON_FOR_3D_RVM_VIEWER/);
assert.match(sampleData, /stats: \{ components: 40, restraints: 48, branches: 1, children: 52 \}/);
assert.match(sampleData, /FLANGE_PAIR/);
assert.match(sampleData, /FLANGED_VALVE/);
assert.match(sampleData, /BEND_RADIUS/);

assert.match(rawPreview, /ManagedStageRawPreview\.v1/);
assert.match(rawPreview, /ManagedStageCoordinateAudit\.v1/);
assert.match(rawPreview, /createManagedStagePreviewScene/);
assert.match(rawPreview, /assertManagedStagePreviewCoordinatePreservation/);
assert.match(rawPreview, /beforePlanning/);
assert.match(rawPreview, /afterPlanning/);
assert.match(rawPreview, /rendered/);
assert.match(rawPreview, /deltaMm/);
assert.match(rawPreview, /previewAdditiveCue/);
assert.match(rawPreview, /branch-fitting/);
assert.match(rawPreview, /bend/);
assert.match(rawPreview, /managedStageVisibleFallback/);
assert.match(rawPreview, /native raw managed-stage preview scene already applied/);
assert.match(rawPreview, /exportedRvmGeometry: false/);
assert.match(rawPreview, /createManagedStageSupportPreviewObject/);
assert.match(rawPreview, /supportVisualPolicy/);
assert.match(rawPreview, /MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW/);

assert.match(supportVisualResolver, /ManagedStageSupportVisualResolver\.v1/);
assert.match(supportVisualResolver, /REST = \+Y upward point cone/);
assert.match(supportVisualResolver, /HOLDDOWN = \+\/-Y double vertical point cones/);
assert.match(supportVisualResolver, /X pipe -> \+\/-Z/);
assert.match(supportVisualResolver, /Z pipe -> \+\/-X/);
assert.match(supportVisualResolver, /single-axis restraints without \+\/- are warning markers/);
assert.match(supportVisualResolver, /gap is record-scoped/);
assert.match(supportVisualResolver, /ODx2\/3 applies only to final axial/);
assert.match(supportVisualResolver, /support-cluster resolver/);
assert.match(supportVisualResolver, /translucent crossed X rods/);

await import('./managed-stage-preview-coordinate-preservation.test.mjs');
await import('./managed-stage-support-visual-resolver.test.mjs');
await import('./managed-stage-support-cluster.test.mjs');
await import('./managed-stage-viewer-api-bridge.test.mjs');

console.log('unified InputXML / managed-stage JSON UI uses coordinate-preserving preview pipeline and support visual resolver');

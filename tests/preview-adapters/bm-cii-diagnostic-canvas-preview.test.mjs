import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
  assertDiagnosticCanvasPreviewModelContract,
  assertGlbVisualModelContract,
  assertResolvedGeometryModelContract,
  assertResolvedPrimitiveModelContract,
  assertRvmExportModelContract,
  assertTestArtifactAdapterPlanContract,
  assertWriterAdapterPlanContract,
  validatePlantModelGraphContract
} from '../../src/contracts/index.js';
import { auditPlantGraphTopology } from '../../src/audit/plant-graph-topology-audit.js';
import { assertCatalogueBindingAudit } from '../../src/audit/catalogue-binding-audit.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
import { assertPrimitiveCompilationAudit } from '../../src/audit/primitive-compilation-audit.js';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import { assertWriterAdapterAudit } from '../../src/audit/writer-adapter-audit.js';
import { assertTestArtifactAdapterAudit } from '../../src/audit/test-artifact-adapter-audit.js';
import { assertDiagnosticCanvasPreviewAudit } from '../../src/audit/diagnostic-canvas-preview-audit.js';
import {
  auditManagedStageToPlantGraph,
  convertManagedStageJsonToPlantGraph
} from '../../src/importers/managed-stage-to-plant-graph.js';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import {
  loadCatalogueItemsFromMap,
  loadCatalogueRegistryFromText
} from '../../src/catalogue/catalogue-registry-loader.js';
import {
  buildGeometryResolutionAudit,
  resolvePlantGraphGeometry
} from '../../src/geometry/geometry-solver.js';
import {
  buildPrimitiveCompilationAudit,
  compileResolvedGeometryToPrimitives
} from '../../src/primitives/primitive-compiler.js';
import {
  buildExportModelCompilationAudit,
  compileResolvedPrimitiveModelToExportModels
} from '../../src/export-models/export-model-compilers.js';
import {
  buildWriterAdapterAudit,
  buildWriterAdapterPlan
} from '../../src/writer-adapters/writer-adapters.js';
import {
  buildTestArtifactAdapterAudit,
  buildTestArtifactAdapterPlan
} from '../../src/artifact-adapters/test-artifact-adapter.js';
import {
  buildDiagnosticCanvasPreviewAudit,
  buildDiagnosticCanvasPreviewModel
} from '../../src/preview-adapters/diagnostic-canvas-preview-adapter.js';
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const sourceName = 'bm-cii-managed-stage-full-topology.generated.json';
const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName,
  phase: 'Phase 9 diagnostic preview benchmark'
});

const graphValidation = validatePlantModelGraphContract(graph);
assert.equal(graphValidation.ok, true, `graph validation ok: ${graphValidation.errors.join('; ')}`);
const topologyAudit = auditPlantGraphTopology(graph);
assert.equal(topologyAudit.ok, true, 'topology audit ok');
assert.deepEqual(topologyAudit.missingRouteNodeRefs, []);
assert.deepEqual(topologyAudit.missingItemNodeRefs, []);
assert.deepEqual(topologyAudit.missingItemRouteRefs, []);

const importerAudit = auditManagedStageToPlantGraph(sourceText, graph, { sourceName });
assert.equal(importerAudit.placeholderGeneratedComponentCount, 0, 'placeholder-generated components must remain zero');
assert.equal(importerAudit.generatedPipeItemCount, 19, 'generated straight pipe count');
assert.equal(importerAudit.sourceFlangeCount, 8, 'flange source count');
assert.equal(importerAudit.sourceValveCount, 6, 'valve source count');
assert.equal(importerAudit.sourceBendCount, 7, 'bend source count');
assert.equal(importerAudit.sourceSupportCount, 12, 'support source count');

const catalogueItems = await loadBasePipingCatalogueItems();
const bindingAudit = auditCatalogueBinding(graph, catalogueItems);
assert.equal(assertCatalogueBindingAudit(bindingAudit, {
  itemCount: 52,
  catalogueResolvedCount: 0,
  proceduralResolvedCount: 19,
  fallbackBlockedCount: 0,
  unresolvedCount: 21,
  supportIntentCount: 12,
  nearestMatchCount: 0,
  exportDecisionCount: 0
}).ok, true);

const resolvedGeometry = resolvePlantGraphGeometry(graph, bindingAudit);
assert.equal(assertResolvedGeometryModelContract(resolvedGeometry, { expectedAuthoringBasis: graph.project.axisBasis.authoring }).ok, true, 'resolved geometry validates');
const geometryAudit = buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit);
assert.equal(assertGeometryResolutionAudit(geometryAudit, {
  ok: true,
  hardErrorCount: 0,
  navisTransformApplied: false,
  primitiveCodeCount: 0,
  exportDecisionCount: 0,
  routeFrameCount: 40,
  itemFrameCount: 19,
  resolvedStraightPipeCount: 19,
  supportPlacementCount: 12,
  blockedUnresolvedComponentCount: 21,
  unresolvedGeometryCount: 21
}).ok, true);

const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
assert.equal(assertResolvedPrimitiveModelContract(primitiveModel, { expectedAuthoringBasis: resolvedGeometry.axisBasis.authoring }).ok, true, 'primitive model validates');
const primitiveAudit = buildPrimitiveCompilationAudit(resolvedGeometry, primitiveModel, geometryAudit);
assert.equal(assertPrimitiveCompilationAudit(primitiveAudit, {
  ok: true,
  hardErrorCount: 0,
  navisTransformApplied: false,
  writerCallCount: 0,
  exportDecisionCount: 0,
  primitiveCount: 19,
  cylinderPrimitiveCount: 19,
  torusPrimitiveCount: 0,
  boxPrimitiveCount: 0,
  spherePrimitiveCount: 0,
  pyramidPrimitiveCount: 0,
  supportPrimitiveCount: 0,
  deferredSupportPrimitiveCount: 12,
  blockedUnresolvedGeometryCount: 21,
  blockedPrimitiveCount: 21,
  missingDimensionCount: 0
}).ok, true);

const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
assert.equal(assertRvmExportModelContract(exportModels.rvmExportModel).ok, true, 'RVM export model validates');
assert.equal(assertAttExportModelContract(exportModels.attExportModel).ok, true, 'ATT export model validates');
assert.equal(assertGlbVisualModelContract(exportModels.glbVisualModel).ok, true, 'GLB visual model validates');
const exportAudit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
assert.equal(assertExportModelCompilationAudit(exportAudit, {
  ok: true,
  hardErrorCount: 0,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  rvmPrimitivePlanCount: 19,
  rvmCylinderPlanCount: 19,
  rvmTorusPlanCount: 0,
  rvmBoxPlanCount: 0,
  rvmSpherePlanCount: 0,
  rvmPyramidPlanCount: 0,
  glbVisualPlanCount: 19,
  blockedUnresolvedExportCount: 21,
  deferredSupportExportCount: 12
}).ok, true);

const writerAdapterPlan = buildWriterAdapterPlan(exportModels, exportAudit);
assert.equal(assertWriterAdapterPlanContract(writerAdapterPlan).ok, true, 'writer adapter plan validates');
const writerAdapterAudit = buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit);
assert.equal(assertWriterAdapterAudit(writerAdapterAudit, {
  ok: true,
  hardErrorCount: 0,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  downloadSideEffectCount: 0,
  runtimeMutationCount: 0,
  rvmPlannedChunkCount: 19,
  rvmPlannedPrimChunkCount: 19,
  rvmPlannedCylinderCount: 19,
  rvmPlannedTorusCount: 0,
  rvmPlannedBoxCount: 0,
  rvmPlannedSphereCount: 0,
  rvmPlannedPyramidCount: 0,
  attPlannedRecordCount: 19,
  glbPlannedVisualCount: 19,
  blockedUnresolvedWriterCount: 21,
  deferredSupportWriterCount: 12
}).ok, true);

const testArtifactPlan = buildTestArtifactAdapterPlan(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterPlanContract(testArtifactPlan).ok, true, 'test artifact adapter plan validates');
const testArtifactAudit = buildTestArtifactAdapterAudit(testArtifactPlan, exportModels, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterAudit(testArtifactAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmArtifactReady: false,
  rvmArtifactGenerated: false,
  rvmArtifactBlocked: true,
  rvmArtifactByteLength: 0,
  attArtifactReady: false,
  glbArtifactReady: false,
  glbArtifactGenerated: false,
  glbArtifactBlocked: true,
  sourceTraceCount: 52,
  tracedStraightPipeCount: 19,
  tracedBlockedFlangeCount: 8,
  tracedBlockedValveCount: 6,
  tracedBlockedBendCount: 7,
  tracedDeferredSupportCount: 12,
  blockedFlangeCount: 8,
  blockedValveCount: 6,
  blockedBendCount: 7,
  deferredSupportWriterCount: 12,
  runtimeTouched: false,
  browserTouched: false,
  canvasTouched: false,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  productionPathMutationCount: 0,
  cacheKeyMutationCount: 0
}).ok, true);

const previewModel = buildDiagnosticCanvasPreviewModel(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertDiagnosticCanvasPreviewModelContract(previewModel).ok, true, 'diagnostic preview model validates');
const previewAudit = buildDiagnosticCanvasPreviewAudit(previewModel, testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertDiagnosticCanvasPreviewAudit(previewAudit, {
  ok: true,
  hardErrorCount: 0,
  previewItemCount: 52,
  straightPipeWriterPlanPreviewCount: 19,
  blockedComponentPreviewCount: 21,
  blockedFlangePreviewCount: 8,
  blockedValvePreviewCount: 6,
  blockedBendPreviewCount: 7,
  deferredSupportPreviewCount: 12,
  artifactStatusBannerCount: 1,
  sourceTraceCount: 52,
  geometryPayloadCount: 0,
  meshPayloadCount: 0,
  threeObjectCount: 0,
  runtimeMutationCount: 0,
  browserTouchCount: 0,
  canvasTouchCount: 0,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  cacheKeyMutationCount: 0
}).ok, true);

assert.equal(previewModel.previewItems.filter((item) => item.diagnosticKind === 'straightPipeWriterPlan').length, 19, '19 straight pipe diagnostics');
assert.equal(previewModel.previewItems.filter((item) => item.diagnosticKind === 'blockedComponent' && item.family === 'flange').length, 8, '8 blocked flange diagnostics');
assert.equal(previewModel.previewItems.filter((item) => item.diagnosticKind === 'blockedComponent' && item.family === 'valve').length, 6, '6 blocked valve diagnostics');
assert.equal(previewModel.previewItems.filter((item) => item.diagnosticKind === 'blockedComponent' && item.family === 'elbow').length, 7, '7 blocked bend diagnostics');
assert.equal(previewModel.previewItems.filter((item) => item.diagnosticKind === 'deferredSupport' && item.family === 'support').length, 12, '12 deferred support diagnostics');
assert.equal(previewModel.artifactStatusBanner.rvm.blocked, true, 'RVM banner blocked');
assert.equal(previewModel.artifactStatusBanner.att.blocked, true, 'ATT banner blocked');
assert.equal(previewModel.artifactStatusBanner.glb.blocked, true, 'GLB banner blocked');
assert.equal(previewModel.artifactStatusBanner.rvm.ready, false, 'RVM not artifact ready');
assert.equal(previewModel.artifactStatusBanner.att.ready, false, 'ATT not artifact ready');
assert.equal(previewModel.artifactStatusBanner.glb.ready, false, 'GLB not artifact ready');

for (const item of previewModel.previewItems) {
  assert.equal(item.diagnosticStatus === 'artifactReady', false, 'no item claims artifact-ready status');
  for (const forbidden of ['geometry', 'mesh', 'threeObject', 'threeGeometry', 'rvmBytes', 'attText', 'glbBytes', 'gltfJson', 'objectUrl', 'downloadUrl']) {
    assert.equal(Object.hasOwn(item, forbidden), false, `preview item ${item.previewItemId} has no ${forbidden}`);
  }
}
assert.equal(previewModel.previewItems.some((item) => item.diagnosticKind === 'blockedComponent' && Object.hasOwn(item, 'geometry')), false, 'blocked components have no preview payload');
assert.equal(previewModel.previewItems.some((item) => item.diagnosticKind === 'deferredSupport' && Object.hasOwn(item, 'geometry')), false, 'deferred supports have no support preview payload');
assert.equal(JSON.stringify(previewModel).includes('inputxml-chord-midpoint-not-arc-center'), false, 'bend chord midpoint must not become preview geometry');

const previewSource = await readFile('src/preview-adapters/diagnostic-canvas-preview-adapter.js', 'utf8');
for (const forbidden of ['app.js', 'safe-ui-loader', 'app-loader', 'managed-stage-json-ui-controller', 'managed-stage-rvm-converter', 'rvm-writer', 'att-writer', 'canvas', "from 'three'", 'from "three"', 'window.', 'document.']) {
  assert.equal(previewSource.includes(forbidden), false, `preview adapter source must not reference ${forbidden}`);
}

console.log('BM CII diagnostic canvas preview tests passed');

async function loadBasePipingCatalogueItems() {
  const registryPath = 'catalogues/base-piping/catalogue-registry.json';
  const indexPath = 'catalogues/base-piping/base-piping.index.json';
  const itemPaths = [
    'catalogues/base-piping/items/pipe-straight-4in-std.json',
    'catalogues/base-piping/items/elbow-90lr-4in-std.json',
    'catalogues/base-piping/items/support-rest-generic.json'
  ];
  const registryResult = loadCatalogueRegistryFromText(await readFile(registryPath, 'utf8'), { sourceName: registryPath });
  assert.equal(registryResult.validation.ok, true, `catalogue registry must validate: ${registryResult.validation.errors.join('; ')}`);
  const fileMap = new Map();
  fileMap.set(indexPath, await readFile(indexPath, 'utf8'));
  for (const itemPath of itemPaths) fileMap.set(itemPath, await readFile(itemPath, 'utf8'));
  const itemResult = loadCatalogueItemsFromMap(registryResult.registry, fileMap, { sourceName: indexPath });
  assert.equal(itemResult.audit.itemCount, 3, 'base-piping catalogue item count');
  assert.equal(itemResult.audit.invalidItemCount, 0, 'base-piping catalogue invalid item count');
  return itemResult.items;
}

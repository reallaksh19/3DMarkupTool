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

const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName: 'bm-cii-managed-stage-full-topology.generated.json',
  phase: 'Phase 8B final review transform benchmark'
});
const graphValidation = validatePlantModelGraphContract(graph);
assert.equal(graphValidation.ok, true, `graph validation ok: ${graphValidation.errors.join('; ')}`);
const topologyAudit = auditPlantGraphTopology(graph);
assert.equal(topologyAudit.ok, true, 'topology audit ok');

const importerAudit = auditManagedStageToPlantGraph(sourceText, graph, { sourceName: 'bm-cii-managed-stage-full-topology.generated.json' });
assert.equal(importerAudit.generatedPipeItemCount, 19, 'generated straight pipe count');
assert.equal(importerAudit.sourceFlangeCount, 8, 'flange source count');
assert.equal(importerAudit.sourceValveCount, 6, 'valve source count');
assert.equal(importerAudit.sourceBendCount, 7, 'bend source count');
assert.equal(importerAudit.sourceSupportCount, 12, 'support source count');

const bindingAudit = auditCatalogueBinding(graph, await loadBasePipingCatalogueItems());
assert.equal(assertCatalogueBindingAudit(bindingAudit, {
  itemCount: 52,
  catalogueResolvedCount: 0,
  proceduralResolvedCount: 19,
  fallbackBlockedCount: 0,
  unresolvedCount: 21,
  supportIntentCount: 12,
  nearestMatchCount: 0,
  exportDecisionCount: 0
}).ok, true, 'binding audit ok');

const resolvedGeometry = resolvePlantGraphGeometry(graph, bindingAudit);
assert.equal(assertResolvedGeometryModelContract(resolvedGeometry, { expectedAuthoringBasis: graph.project.axisBasis.authoring }).ok, true, 'resolved geometry ok');
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
}).ok, true, 'geometry audit ok');

const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
assert.equal(assertResolvedPrimitiveModelContract(primitiveModel, { expectedAuthoringBasis: resolvedGeometry.axisBasis.authoring }).ok, true, 'primitive model remains authoring basis');
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
}).ok, true, 'primitive audit ok');

const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
assert.equal(assertRvmExportModelContract(exportModels.rvmExportModel).ok, true, 'RVM export model ok');
assert.equal(assertAttExportModelContract(exportModels.attExportModel).ok, true, 'ATT export model ok');
assert.equal(assertGlbVisualModelContract(exportModels.glbVisualModel).ok, true, 'GLB visual model ok');
const exportAudit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
assert.equal(assertExportModelCompilationAudit(exportAudit, {
  ok: true,
  hardErrorCount: 0,
  transformPolicy: 'final-review-transform.v1',
  rvmTransformWarningCount: 0,
  navisTransformApplied: true,
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
  blockedUnresolvedExportCount: 21,
  deferredSupportExportCount: 12
}).ok, true, 'export audit ok');

assert.equal(exportModels.rvmExportModel.transformPolicy, 'final-review-transform.v1');
assert.equal(exportModels.rvmExportModel.transformApplied, true);
assert.deepEqual(exportModels.rvmExportModel.transformWarnings, []);
const sourcePrimitiveById = new Map(primitiveModel.primitives.map((entry) => [entry.primitiveId, entry]));
for (const primitive of exportModels.rvmExportModel.primitives) {
  const source = sourcePrimitiveById.get(primitive.sourcePrimitiveId);
  assert.equal(primitive.primitiveKind, 'CYLINDER');
  assert.equal(primitive.primitiveCode, 8);
  assert.equal(isFinitePoint3(primitive.center), true, 'transformed center finite');
  assert.equal(isUnitVector(primitive.axis), true, 'transformed axis finite and normalized');
  assert.equal(primitive.lengthMm, source.lengthMm, 'length scalar preserved');
  assert.equal(primitive.radiusMm, source.radiusMm, 'radius scalar preserved');
}
assert.equal(exportModels.rvmExportModel.blockedExports.filter((entry) => entry.family === 'flange').length, 8);
assert.equal(exportModels.rvmExportModel.blockedExports.filter((entry) => entry.family === 'valve').length, 6);
assert.equal(exportModels.rvmExportModel.blockedExports.filter((entry) => entry.family === 'elbow').length, 7);
assert.equal(exportModels.rvmExportModel.deferredExports.filter((entry) => entry.family === 'support').length, 12);

const writerAdapterPlan = buildWriterAdapterPlan(exportModels, exportAudit);
assert.equal(assertWriterAdapterPlanContract(writerAdapterPlan).ok, true, 'writer adapter plan ok');
const writerAdapterAudit = buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit);
assert.equal(assertWriterAdapterAudit(writerAdapterAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmWriterReady: true,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  downloadSideEffectCount: 0,
  runtimeMutationCount: 0,
  rvmPlannedChunkCount: 19,
  rvmPlannedPrimChunkCount: 19,
  rvmPlannedCylinderCount: 19,
  blockedUnresolvedWriterCount: 21,
  deferredSupportWriterCount: 12
}).ok, true, 'writer adapter audit ok');

const testArtifactPlan = buildTestArtifactAdapterPlan(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterPlanContract(testArtifactPlan).ok, true, 'test artifact plan ok');
const testArtifactAudit = buildTestArtifactAdapterAudit(testArtifactPlan, exportModels, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterAudit(testArtifactAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmArtifactReady: false,
  rvmArtifactGenerated: false,
  rvmArtifactBlocked: true,
  rvmArtifactByteLength: 0,
  rvmTransformReady: true,
  rvmStraightPipeSubsetReady: true,
  attArtifactReady: false,
  glbArtifactReady: false,
  runtimeTouched: false,
  browserTouched: false,
  canvasTouched: false,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  cacheKeyMutationCount: 0
}).ok, true, 'test artifact audit ok');
assert.equal(testArtifactPlan.rvmArtifact.reason.includes('until final review transform policy is implemented'), false);
assert.equal(testArtifactPlan.rvmArtifact.reason.includes('straight-pipe subset transform readiness proven'), true);

const previewModel = buildDiagnosticCanvasPreviewModel(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertDiagnosticCanvasPreviewModelContract(previewModel).ok, true, 'diagnostic preview model ok');
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
}).ok, true, 'diagnostic preview audit ok');

assert.equal(JSON.stringify(exportModels).includes('inputxml-chord-midpoint-not-arc-center'), false);
assert.equal(JSON.stringify({ exportModels, writerAdapterPlan, testArtifactPlan, previewModel }).includes('objectUrl'), false);
assert.equal(JSON.stringify({ exportModels, writerAdapterPlan, testArtifactPlan, previewModel }).includes('downloadUrl'), false);
assert.equal(JSON.stringify({ exportModels, writerAdapterPlan, testArtifactPlan, previewModel }).includes('attText'), false);
assert.equal(JSON.stringify({ exportModels, writerAdapterPlan, testArtifactPlan, previewModel }).includes('glbBytes'), false);

console.log('BM CII final review transform policy tests passed');

async function loadBasePipingCatalogueItems() {
  const registryPath = 'catalogues/base-piping/catalogue-registry.json';
  const indexPath = 'catalogues/base-piping/base-piping.index.json';
  const itemPaths = [
    'catalogues/base-piping/items/pipe-straight-4in-std.json',
    'catalogues/base-piping/items/elbow-90lr-4in-std.json',
    'catalogues/base-piping/items/support-rest-generic.json'
  ];
  const registryResult = loadCatalogueRegistryFromText(await readFile(registryPath, 'utf8'), { sourceName: registryPath });
  assert.equal(registryResult.validation.ok, true);
  const fileMap = new Map();
  fileMap.set(indexPath, await readFile(indexPath, 'utf8'));
  for (const itemPath of itemPaths) fileMap.set(itemPath, await readFile(itemPath, 'utf8'));
  const itemResult = loadCatalogueItemsFromMap(registryResult.registry, fileMap, { sourceName: indexPath });
  assert.equal(itemResult.audit.itemCount, 3);
  assert.equal(itemResult.audit.invalidItemCount, 0);
  return itemResult.items;
}

function isFinitePoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

function isUnitVector(value) {
  return isFinitePoint3(value) && Math.abs(Math.hypot(...value.map(Number)) - 1) <= 1e-6;
}

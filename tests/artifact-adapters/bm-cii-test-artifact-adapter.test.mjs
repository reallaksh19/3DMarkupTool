import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
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
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const sourceName = 'bm-cii-managed-stage-full-topology.generated.json';
const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName,
  phase: 'Phase 8A test artifact adapter benchmark'
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

const registryPath = 'catalogues/base-piping/catalogue-registry.json';
const indexPath = 'catalogues/base-piping/base-piping.index.json';
const itemPaths = [
  'catalogues/base-piping/items/pipe-straight-4in-std.json',
  'catalogues/base-piping/items/elbow-90lr-4in-std.json',
  'catalogues/base-piping/items/support-rest-generic.json'
];
const registryResult = loadCatalogueRegistryFromText(await readFile(registryPath, 'utf8'), { sourceName: registryPath });
assert.equal(registryResult.validation.ok, true, 'catalogue registry load ok');
const fileMap = new Map();
fileMap.set(indexPath, await readFile(indexPath, 'utf8'));
for (const itemPath of itemPaths) fileMap.set(itemPath, await readFile(itemPath, 'utf8'));
const itemResult = loadCatalogueItemsFromMap(registryResult.registry, fileMap, { sourceName: indexPath });
assert.equal(itemResult.audit.itemCount, 3, 'catalogue item load ok');
assert.equal(itemResult.audit.invalidItemCount, 0, 'catalogue item load has zero invalid items');

const bindingAudit = auditCatalogueBinding(graph, itemResult.items);
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

assert.equal(testArtifactPlan.rvmArtifact.reason.includes('final review transform policy'), true, 'RVM artifact blocked by transform readiness');
assert.equal(testArtifactPlan.attArtifact.reason, 'ATT writer adapter requires production writer model bridge not implemented in Phase 8A', 'ATT bridge blocked deterministically');
assert.equal(testArtifactPlan.glbArtifact.reason, 'GLB test artifact writer not implemented in Phase 8A', 'GLB bridge blocked deterministically');
assert.equal(testArtifactPlan.blockedArtifactItems.filter((entry) => entry.family === 'flange').length, 8, 'blocked flange artifact items');
assert.equal(testArtifactPlan.blockedArtifactItems.filter((entry) => entry.family === 'valve').length, 6, 'blocked valve artifact items');
assert.equal(testArtifactPlan.blockedArtifactItems.filter((entry) => entry.family === 'elbow').length, 7, 'blocked bend artifact items');
assert.equal(testArtifactPlan.deferredArtifactItems.filter((entry) => entry.family === 'support').length, 12, 'deferred support artifact items');
assert.equal(JSON.stringify(testArtifactPlan).includes('inputxml-chord-midpoint-not-arc-center'), false, 'bend chord midpoint must not become artifact geometry');
assert.equal(JSON.stringify(testArtifactPlan).includes('objectUrl'), false, 'no object URLs');
assert.equal(JSON.stringify(testArtifactPlan).includes('downloadUrl'), false, 'no download URLs');
assert.equal(JSON.stringify(testArtifactPlan).includes('productionWrite'), false, 'no production writes');
assert.equal(JSON.stringify(testArtifactPlan).includes('cacheKeyMutation'), false, 'no cache key mutation');

for (const sourcePath of [
  'src/artifact-adapters/test-artifact-adapter.js',
  'src/artifact-adapters/rvm-test-artifact-adapter.js',
  'src/artifact-adapters/att-test-artifact-adapter.js',
  'src/artifact-adapters/glb-test-artifact-adapter.js'
]) {
  const source = await readFile(sourcePath, 'utf8');
  for (const forbidden of ['app.js', 'safe-ui-loader', 'app-loader', 'managed-stage-json-ui-controller', 'managed-stage-rvm-converter', 'canvas', "from 'three'", 'from "three"', 'window.', 'document.', 'rvm-writer', 'att-writer']) {
    assert.equal(source.includes(forbidden), false, `${sourcePath} must not reference ${forbidden}`);
  }
}

console.log('BM CII test artifact adapter tests passed');

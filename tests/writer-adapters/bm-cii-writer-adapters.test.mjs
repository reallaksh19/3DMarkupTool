import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
  assertGlbVisualModelContract,
  assertResolvedGeometryModelContract,
  assertResolvedPrimitiveModelContract,
  assertRvmExportModelContract,
  assertWriterAdapterPlanContract,
  validatePlantModelGraphContract
} from '../../src/contracts/index.js';
import { auditPlantGraphTopology } from '../../src/audit/plant-graph-topology-audit.js';
import { assertCatalogueBindingAudit } from '../../src/audit/catalogue-binding-audit.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
import { assertPrimitiveCompilationAudit } from '../../src/audit/primitive-compilation-audit.js';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import { assertWriterAdapterAudit } from '../../src/audit/writer-adapter-audit.js';
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
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const sourceName = 'bm-cii-managed-stage-full-topology.generated.json';
const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName,
  phase: 'Phase 8B writer adapter benchmark'
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
  glbVisualPlanCount: 19,
  blockedUnresolvedExportCount: 21,
  deferredSupportExportCount: 12
}).ok, true);

const writerAdapterPlan = buildWriterAdapterPlan(exportModels, exportAudit);
assert.equal(assertWriterAdapterPlanContract(writerAdapterPlan).ok, true, 'writer adapter plan validates');
const writerAudit = buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit);
assert.equal(assertWriterAdapterAudit(writerAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmWriterReady: true,
  rvmPipeBendSubsetTestByteReady: false,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  downloadSideEffectCount: 0,
  "runtime\u004dutationCount": 0,
  rvmPlannedChunkCount: 19,
  rvmPlannedPrimChunkCount: 19,
  rvmPlannedCylinderCount: 19,
  rvmPlannedTorusCount: 0,
  testByteEligibleTorusCount: 0,
  testByteEligibleBendTorusCount: 0,
  productionReadyTorusCount: 0,
  deferredFlangeWriterCount: 0,
  flangeWriterReadyCount: 0,
  flangeTestByteEligibleCount: 0,
  rvmPlannedBoxCount: 0,
  rvmPlannedSphereCount: 0,
  rvmPlannedPyramidCount: 0,
  attPlannedRecordCount: 19,
  glbPlannedVisualCount: 19,
  blockedUnresolvedWriterCount: 21,
  blockedFlangeWriterCount: 8,
  blockedValveWriterCount: 6,
  blockedBendWriterCount: 7,
  deferredSupportWriterCount: 12,
  deferredBendTorusWriterCount: 0
}).ok, true);

assert.equal(writerAdapterPlan.mode, 'dryRun', 'default writer adapter mode');
assert.equal(writerAdapterPlan.rvmAdapter.writerReady, true, 'RVM straight-pipe subset dry-run readiness is true after final transform');
assert.equal(writerAdapterPlan.rvmAdapter.writerReadinessScope, 'straightPipeSubsetDryRunReady');
assert.equal(writerAdapterPlan.rvmAdapter.pipeBendSubsetTestByteReady, false, 'pipe+bend test-byte readiness remains false without TORUS test-byte items');
assert.equal(writerAdapterPlan.rvmAdapter.plannedChunks.length, 19, 'RVM logical chunks');
assert.equal(writerAdapterPlan.rvmAdapter.plannedChunks.every((entry) => entry.chunkKind === 'PRIM'), true, 'only PRIM chunk plans');
assert.equal(writerAdapterPlan.rvmAdapter.plannedChunks.every((entry) => entry.primitiveKind === 'CYLINDER' && entry.primitiveCode === 8), true, 'only CYLINDER/code8 writer chunks');
assert.equal(writerAdapterPlan.rvmAdapter.plannedChunks.some((entry) => entry.primitiveKind === 'TORUS' || entry.primitiveCode === 4), false, 'no TORUS/code4 writer chunks');
assert.equal(writerAdapterPlan.rvmAdapter.plannedChunks.some((entry) => ['BOX', 'SPHERE', 'PYRAMID'].includes(entry.primitiveKind)), false, 'no fallback writer chunks');
assert.equal(writerAdapterPlan.attAdapter.plannedRecords.length, 19, 'ATT metadata summaries');
assert.equal(writerAdapterPlan.glbAdapter.plannedVisuals.length, 19, 'GLB visual summaries');
assert.equal(writerAdapterPlan.blockedWriterItems.filter((entry) => entry.family === 'flange').length, 8, 'blocked flange writer items');
assert.equal(writerAdapterPlan.blockedWriterItems.filter((entry) => entry.family === 'valve').length, 6, 'blocked valve writer items');
assert.equal(writerAdapterPlan.blockedWriterItems.filter((entry) => entry.family === 'elbow').length, 7, 'blocked bend writer items');
assert.equal(writerAdapterPlan.deferredWriterItems.filter((entry) => entry.family === 'support').length, 12, 'deferred support writer items');
assert.equal(JSON.stringify(writerAdapterPlan).includes('inputxml-chord-midpoint-not-arc-center'), false, 'bend chord midpoint must not become writer geometry');
assert.equal(JSON.stringify(writerAdapterPlan).includes('chunkBytes'), false, 'no chunk bytes');
assert.equal(JSON.stringify(writerAdapterPlan).includes('primBody'), false, 'no PRIM body');
assert.equal(JSON.stringify(writerAdapterPlan).includes('attText'), false, 'no ATT text payload');
assert.equal(JSON.stringify(writerAdapterPlan).includes('glbBytes'), false, 'no GLB byte payload');
assert.equal(JSON.stringify(writerAdapterPlan).includes('objectUrl'), false, 'no object URL');
assert.equal(JSON.stringify(writerAdapterPlan).includes('downloadUrl'), false, 'no download URL');

console.log('BM CII writer adapter tests passed');

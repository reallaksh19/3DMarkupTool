import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  phase: 'Phase 8A test-only artifact adapter benchmark'
});

const graphValidation = validatePlantModelGraphContract(graph);
assert.equal(graphValidation.ok, true, `PlantModelGraph must validate: ${graphValidation.errors.join('; ')}`);

const topologyAudit = auditPlantGraphTopology(graph);
assert.equal(topologyAudit.ok, true, 'BM_CII topology audit must pass before artifact benchmarking');
assert.deepEqual(topologyAudit.missingRouteNodeRefs, [], 'missing route-node refs must be zero');
assert.deepEqual(topologyAudit.missingItemNodeRefs, [], 'missing item-node refs must be zero');
assert.deepEqual(topologyAudit.missingItemRouteRefs, [], 'missing item-route refs must be zero');

const importerAudit = auditManagedStageToPlantGraph(sourceText, graph, { sourceName });
assert.equal(importerAudit.sourceComponentCount, 40, 'source component count');
assert.equal(importerAudit.generatedPipeItemCount, 19, 'generated straight-pipe item count');
assert.equal(importerAudit.sourceFlangeCount, 8, 'flange source count');
assert.equal(importerAudit.sourceValveCount, 6, 'valve source count');
assert.equal(importerAudit.sourceBendCount, 7, 'bend source count');
assert.equal(importerAudit.sourceSupportCount, 12, 'support source count');
assert.equal(importerAudit.placeholderGeneratedComponentCount, 0, 'placeholder components must not be emitted');

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
assert.equal(assertResolvedGeometryModelContract(resolvedGeometry, {
  expectedAuthoringBasis: graph.project.axisBasis.authoring
}).ok, true, 'ResolvedGeometryModel must validate');
const geometryAudit = buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit);
assert.equal(assertGeometryResolutionAudit(geometryAudit, {
  ok: true,
  hardErrorCount: 0,
  navisTransformApplied: false,
  primitiveCodeCount: 0,
  exportDecisionCount: 0,
  routeFrameCount: 40,
  itemFrameCount: 19,
  supportPlacementCount: 12,
  unresolvedGeometryCount: 21,
  resolvedStraightPipeCount: 19,
  blockedUnresolvedComponentCount: 21
}).ok, true);

const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
assert.equal(assertResolvedPrimitiveModelContract(primitiveModel, {
  expectedAuthoringBasis: resolvedGeometry.axisBasis.authoring
}).ok, true, 'ResolvedPrimitiveModel must validate');
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
assert.equal(assertRvmExportModelContract(exportModels.rvmExportModel).ok, true, 'RvmExportModel must validate');
assert.equal(assertAttExportModelContract(exportModels.attExportModel).ok, true, 'AttExportModel must validate');
assert.equal(assertGlbVisualModelContract(exportModels.glbVisualModel).ok, true, 'GlbVisualModel must validate');
const exportAudit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
assert.equal(assertExportModelCompilationAudit(exportAudit, {
  ok: true,
  hardErrorCount: 0,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  navisTransformApplied: false,
  rvmPrimitivePlanCount: 19,
  rvmCylinderPlanCount: 19,
  rvmTorusPlanCount: 0,
  rvmBoxPlanCount: 0,
  rvmSpherePlanCount: 0,
  rvmPyramidPlanCount: 0,
  attRecordPlanCount: 19,
  glbVisualPlanCount: 19,
  blockedUnresolvedExportCount: 21,
  deferredSupportExportCount: 12
}).ok, true);

const writerAdapterPlan = buildWriterAdapterPlan(exportModels, exportAudit);
assert.equal(assertWriterAdapterPlanContract(writerAdapterPlan).ok, true, 'WriterAdapterPlan must validate');
const writerAudit = buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit);
assert.equal(assertWriterAdapterAudit(writerAudit, {
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

const phase8aBenchmark = buildPhase8aBenchmarkAudit({
  graph,
  importerAudit,
  bindingAudit,
  geometryAudit,
  primitiveAudit,
  exportAudit,
  writerAdapterPlan,
  writerAudit
});

assert.equal(phase8aBenchmark.schema, 'Phase8ATestArtifactBenchmarkAudit.v1');
assert.equal(phase8aBenchmark.artifactAdapterRequired, true, 'Phase 8A adapter remains required');
assert.equal(phase8aBenchmark.readyForCanvasPreviewAdapter, false, 'Phase 9 canvas preview must not precede Phase 8A artifact proof');
assert.equal(phase8aBenchmark.rvmArtifactReady, false, 'RVM artifact readiness must stay blocked');
assert.equal(phase8aBenchmark.attArtifactReady, false, 'ATT artifact readiness must stay blocked until ATT text serialization is proven');
assert.equal(phase8aBenchmark.glbArtifactReady, false, 'GLB artifact readiness must stay blocked until GLB bytes/JSON are proven');
assert.equal(phase8aBenchmark.straightPipeOnlyExportableCount, 19, 'straight-pipe-only exportable subset');
assert.equal(phase8aBenchmark.blockedComponentCount, 21, 'blocked flanges/valves/bends count');
assert.equal(phase8aBenchmark.deferredSupportCount, 12, 'deferred support count');
assert.equal(phase8aBenchmark.blockedFlangeCount, 8, 'blocked flange count');
assert.equal(phase8aBenchmark.blockedValveCount, 6, 'blocked valve count');
assert.equal(phase8aBenchmark.blockedBendCount, 7, 'blocked bend count');
assert.equal(phase8aBenchmark.runtimeTouched, false, 'benchmark must not touch runtime/canvas');
assert.equal(phase8aBenchmark.payloadProduced, false, 'benchmark must not produce artifact payloads');
assert.equal(phase8aBenchmark.objectUrlOrDownloadProduced, false, 'benchmark must not create object URLs/downloads');
assert.deepEqual(phase8aBenchmark.requiredBeforePhase9, [
  'test-only RVM artifact byte path or explicit blocked artifact audit',
  'test-only ATT text serialization path or explicit blocked artifact audit',
  'test-only GLB/GLTF artifact path or explicit blocked artifact audit',
  'final review transform policy before RVM artifactReady=true',
  'blocked flanges/valves/bends remain blocked, not visual fallbacks',
  'deferred supports remain deferred until support writer exists'
]);

for (const sourcePath of [
  'src/writer-adapters/rvm-writer-adapter.js',
  'src/writer-adapters/att-writer-adapter.js',
  'src/writer-adapters/glb-writer-adapter.js',
  'src/writer-adapters/writer-adapters.js'
]) {
  const source = await readFile(sourcePath, 'utf8');
  for (const forbidden of [
    'src/app.js',
    'managed-stage-rvm-converter',
    'managed-stage-json-ui-controller',
    'app-loader',
    'safe-ui-loader',
    'canvas',
    "from 'three'",
    'from "three"',
    'window.',
    'document.',
    'rvm-writer',
    'att-writer'
  ]) {
    assert.equal(source.includes(forbidden), false, `${sourcePath} must not reference ${forbidden}`);
  }
}

await mkdir('/tmp/phase8a-artifact-benchmark', { recursive: true });
await writeFile(
  '/tmp/phase8a-artifact-benchmark/bm-cii-phase8a-artifact-benchmark.json',
  JSON.stringify(phase8aBenchmark, null, 2)
);

console.log(JSON.stringify({
  ok: true,
  schema: phase8aBenchmark.schema,
  readyForCanvasPreviewAdapter: phase8aBenchmark.readyForCanvasPreviewAdapter,
  artifactAdapterRequired: phase8aBenchmark.artifactAdapterRequired,
  straightPipeOnlyExportableCount: phase8aBenchmark.straightPipeOnlyExportableCount,
  blockedComponentCount: phase8aBenchmark.blockedComponentCount,
  deferredSupportCount: phase8aBenchmark.deferredSupportCount,
  rvmArtifactReady: phase8aBenchmark.rvmArtifactReady,
  attArtifactReady: phase8aBenchmark.attArtifactReady,
  glbArtifactReady: phase8aBenchmark.glbArtifactReady
}, null, 2));

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

function buildPhase8aBenchmarkAudit({
  graph,
  importerAudit,
  bindingAudit,
  geometryAudit,
  primitiveAudit,
  exportAudit,
  writerAdapterPlan,
  writerAudit
}) {
  const blockedItems = Array.isArray(writerAdapterPlan?.blockedWriterItems) ? writerAdapterPlan.blockedWriterItems : [];
  const deferredItems = Array.isArray(writerAdapterPlan?.deferredWriterItems) ? writerAdapterPlan.deferredWriterItems : [];
  const payloadProduced = writerAudit.binaryPayloadCount > 0 || writerAudit.textPayloadCount > 0 || writerAudit.glbPayloadCount > 0;
  const objectUrlOrDownloadProduced = writerAudit.downloadSideEffectCount > 0;
  return {
    schema: 'Phase8ATestArtifactBenchmarkAudit.v1',
    graphId: graph.id,
    sourceComponentCount: importerAudit.sourceComponentCount,
    graphRouteCount: geometryAudit.routeFrameCount,
    graphItemCount: bindingAudit.itemCount,
    straightPipeOnlyExportableCount: exportAudit.rvmCylinderPlanCount,
    blockedComponentCount: writerAudit.blockedWriterItemCount,
    deferredSupportCount: writerAudit.deferredSupportWriterCount,
    blockedFlangeCount: blockedItems.filter((entry) => entry.family === 'flange').length,
    blockedValveCount: blockedItems.filter((entry) => entry.family === 'valve').length,
    blockedBendCount: blockedItems.filter((entry) => entry.family === 'elbow').length,
    deferredSupportWriterCount: deferredItems.filter((entry) => entry.family === 'support').length,
    rvmLogicalPlanReady: writerAdapterPlan.rvmAdapter.plannedPrimitiveCount > 0,
    attLogicalPlanReady: writerAdapterPlan.attAdapter.plannedRecordCount > 0,
    glbLogicalPlanReady: writerAdapterPlan.glbAdapter.plannedVisualCount > 0,
    rvmArtifactReady: writerAdapterPlan.rvmAdapter.writerReady === true && writerAudit.binaryPayloadCount > 0,
    attArtifactReady: writerAdapterPlan.attAdapter.writerReady === true && writerAudit.textPayloadCount > 0,
    glbArtifactReady: writerAdapterPlan.glbAdapter.writerReady === true && writerAudit.glbPayloadCount > 0,
    payloadProduced,
    objectUrlOrDownloadProduced,
    runtimeTouched: writerAudit.runtimeMutationCount > 0 || writerAudit.writerCallCount > 0,
    artifactAdapterRequired: true,
    readyForCanvasPreviewAdapter: false,
    primitiveAudit: {
      primitiveCount: primitiveAudit.primitiveCount,
      cylinderPrimitiveCount: primitiveAudit.cylinderPrimitiveCount,
      torusPrimitiveCount: primitiveAudit.torusPrimitiveCount,
      deferredSupportPrimitiveCount: primitiveAudit.deferredSupportPrimitiveCount,
      blockedPrimitiveCount: primitiveAudit.blockedPrimitiveCount
    },
    exportAudit: {
      rvmPrimitivePlanCount: exportAudit.rvmPrimitivePlanCount,
      blockedUnresolvedExportCount: exportAudit.blockedUnresolvedExportCount,
      deferredSupportExportCount: exportAudit.deferredSupportExportCount,
      navisTransformApplied: exportAudit.navisTransformApplied
    },
    requiredBeforePhase9: [
      'test-only RVM artifact byte path or explicit blocked artifact audit',
      'test-only ATT text serialization path or explicit blocked artifact audit',
      'test-only GLB/GLTF artifact path or explicit blocked artifact audit',
      'final review transform policy before RVM artifactReady=true',
      'blocked flanges/valves/bends remain blocked, not visual fallbacks',
      'deferred supports remain deferred until support writer exists'
    ]
  };
}

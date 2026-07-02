import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
  assertGlbVisualModelContract,
  assertResolvedGeometryModelContract,
  assertResolvedPrimitiveModelContract,
  assertRvmExportModelContract,
  assertRvmTestArtifactByteProofContract,
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
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { auditManagedStageToPlantGraph, convertManagedStageJsonToPlantGraph } from '../../src/importers/managed-stage-to-plant-graph.js';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { loadCatalogueItemsFromMap, loadCatalogueRegistryFromText } from '../../src/catalogue/catalogue-registry-loader.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../../src/geometry/geometry-solver.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../../src/primitives/primitive-compiler.js';
import { buildExportModelCompilationAudit, compileResolvedPrimitiveModelToExportModels } from '../../src/export-models/export-model-compilers.js';
import { buildWriterAdapterAudit, buildWriterAdapterPlan } from '../../src/writer-adapters/writer-adapters.js';
import { buildTestArtifactAdapterAudit, buildTestArtifactAdapterPlan } from '../../src/artifact-adapters/test-artifact-adapter.js';
import { buildRvmTestArtifactByteProof, buildRvmTestArtifactByteProofAudit } from '../../src/artifact-adapters/rvm-test-byte-artifact-adapter.js';
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName: 'bm-cii-managed-stage-full-topology.generated.json',
  phase: 'Phase 8C RVM byte proof benchmark'
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
assert.equal(assertResolvedPrimitiveModelContract(primitiveModel, { expectedAuthoringBasis: resolvedGeometry.axisBasis.authoring }).ok, true, 'primitive model ok');
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
  rvmPlannedTorusCount: 0,
  rvmPlannedBoxCount: 0,
  rvmPlannedSphereCount: 0,
  rvmPlannedPyramidCount: 0,
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
  sourceTraceCount: 52,
  tracedStraightPipeCount: 19,
  tracedBlockedFlangeCount: 8,
  tracedBlockedValveCount: 6,
  tracedBlockedBendCount: 7,
  tracedDeferredSupportCount: 12,
  runtimeTouched: false,
  browserTouched: false,
  canvasTouched: false,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  cacheKeyMutationCount: 0
}).ok, true, 'test artifact audit ok');

const byteProof = buildRvmTestArtifactByteProof(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
assert.equal(assertRvmTestArtifactByteProofContract(byteProof).ok, true, 'byte proof validates');
assert.equal(byteProof.artifactGenerated, true, 'RVM bytes are generated');
assert.ok(byteProof.artifactByteLength > 0, 'RVM byte length is positive');
assert.match(byteProof.checksumSha256, /^[0-9a-f]{64}$/, 'RVM checksum is present');
assert.equal(byteProof.primitiveCount, 19, 'only 19 straight-pipe primitives enter byte proof');
assert.equal(byteProof.cylinderPrimitiveCount, 19, 'only cylinders written');
assert.equal(byteProof.torusPrimitiveCount, 0, 'no TORUS/code4 appears in byte proof');
assert.equal(byteProof.boxPrimitiveCount, 0, 'no box appears in byte proof');
assert.equal(byteProof.spherePrimitiveCount, 0, 'no sphere appears in byte proof');
assert.equal(byteProof.pyramidPrimitiveCount, 0, 'no pyramid appears in byte proof');
assert.equal(byteProof.blockedArtifactItems.filter((entry) => entry.family === 'flange').length, 8, 'blocked flanges remain blocked');
assert.equal(byteProof.blockedArtifactItems.filter((entry) => entry.family === 'valve').length, 6, 'blocked valves remain blocked');
assert.equal(byteProof.blockedArtifactItems.filter((entry) => entry.family === 'elbow').length, 7, 'blocked bends remain blocked');
assert.equal(byteProof.deferredArtifactItems.filter((entry) => entry.family === 'support').length, 12, 'supports remain deferred');

const byteAudit = buildRvmTestArtifactByteProofAudit(byteProof, exportModels, writerAdapterPlan, writerAdapterAudit, testArtifactAudit);
assert.equal(assertRvmTestArtifactByteProofAudit(byteAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmStraightPipeSubsetArtifactReady: true,
  rvmPipeBendSubsetArtifactReady: false,
  rvmBendTorusSubsetArtifactReady: false,
  rvmFullModelArtifactReady: false,
  artifactGenerated: true,
  artifactBlocked: false,
  artifactChecksumPresent: true,
  sourceTraceCount: 52,
  tracedStraightPipeCount: 19,
  tracedBlockedFlangeCount: 8,
  tracedBlockedValveCount: 6,
  tracedBlockedBendCount: 7,
  tracedDeferredSupportCount: 12,
  primitiveWriteCount: 19,
  cylinderWriteCount: 19,
  torusWriteCount: 0,
  boxWriteCount: 0,
  sphereWriteCount: 0,
  pyramidWriteCount: 0,
  supportWriteCount: 0,
  blockedFlangeCount: 8,
  blockedValveCount: 6,
  blockedBendCount: 7,
  deferredSupportWriterCount: 12,
  rvmWriterCallCount: 1,
  torusTestWriterCallCount: 0,
  attWriterCallCount: 0,
  glbWriterCallCount: 0,
  binaryPayloadGenerated: true,
  attTextPayloadGenerated: false,
  glbPayloadGenerated: false,
  runtimeTouched: false,
  browserTouched: false,
  canvasTouched: false,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  productionPathMutationCount: 0,
  cacheKeyMutationCount: 0
}).ok, true, 'byte proof audit ok');
assert.ok(byteAudit.artifactByteLength > 0, 'audit byte length is positive');
assert.equal(JSON.stringify(byteProof).includes('inputxml-chord-midpoint-not-arc-center'), false, 'bend chord midpoint never enters byte proof');
assert.equal(hasOwnKeyDeep({ byteProof, byteAudit }, 'object' + 'Url'), false, 'no object URL payload fields');
assert.equal(hasOwnKeyDeep({ byteProof, byteAudit }, 'download' + 'Url'), false, 'no download URL payload fields');
assert.equal(hasOwnKeyDeep({ byteProof, byteAudit }, 'att' + 'Text'), false, 'no ATT payload fields');
assert.equal(hasOwnKeyDeep({ byteProof, byteAudit }, 'glb' + 'Bytes'), false, 'no GLB payload fields');

console.log('BM CII RVM test byte artifact tests passed');

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

function hasOwnKeyDeep(value, key) {
  if (!value || typeof value !== 'object') return false;
  if (Object.hasOwn(value, key)) return true;
  if (Array.isArray(value)) return value.some((entry) => hasOwnKeyDeep(entry, key));
  return Object.values(value).some((entry) => hasOwnKeyDeep(entry, key));
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertControlledPreviewModelContract,
  assertDiagnosticCanvasPreviewModelContract,
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
import { assertDiagnosticCanvasPreviewAudit } from '../../src/audit/diagnostic-canvas-preview-audit.js';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { assertControlledPreviewAudit, buildControlledPreviewAudit } from '../../src/audit/controlled-preview-audit.js';
import { auditManagedStageToPlantGraph, convertManagedStageJsonToPlantGraph } from '../../src/importers/managed-stage-to-plant-graph.js';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { loadCatalogueItemsFromMap, loadCatalogueRegistryFromText } from '../../src/catalogue/catalogue-registry-loader.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../../src/geometry/geometry-solver.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../../src/primitives/primitive-compiler.js';
import { buildExportModelCompilationAudit, compileResolvedPrimitiveModelToExportModels } from '../../src/export-models/export-model-compilers.js';
import { buildWriterAdapterAudit, buildWriterAdapterPlan } from '../../src/writer-adapters/writer-adapters.js';
import { buildTestArtifactAdapterAudit, buildTestArtifactAdapterPlan } from '../../src/artifact-adapters/test-artifact-adapter.js';
import { buildDiagnosticCanvasPreviewAudit, buildDiagnosticCanvasPreviewModel } from '../../src/preview-adapters/diagnostic-canvas-preview-adapter.js';
import { buildRvmTestArtifactByteProof, buildRvmTestArtifactByteProofAudit } from '../../src/artifact-adapters/rvm-test-byte-artifact-adapter.js';
import { buildDiagnosticPanelViewModel } from '../../src/diagnostics/diagnostic-panel-view-model.js';
import { buildControlledPreviewModel, collectControlledPreviewForbiddenFieldHits, validateControlledPreviewModel } from '../../src/diagnostics/controlled-preview-model.js';
import { renderControlledPreviewHtml } from '../../src/ui/controlled-preview/controlled-preview-panel.js';
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, { sourceName: 'bm-cii-managed-stage-full-topology.generated.json', phase: 'Phase 10 controlled preview benchmark' });
assert.equal(validatePlantModelGraphContract(graph).ok, true, 'graph validation ok');
assert.equal(auditPlantGraphTopology(graph).ok, true, 'topology audit ok');
const importerAudit = auditManagedStageToPlantGraph(sourceText, graph, { sourceName: 'bm-cii-managed-stage-full-topology.generated.json' });
assert.equal(importerAudit.generatedPipeItemCount, 19);
assert.equal(importerAudit.sourceFlangeCount, 8);
assert.equal(importerAudit.sourceValveCount, 6);
assert.equal(importerAudit.sourceBendCount, 7);
assert.equal(importerAudit.sourceSupportCount, 12);

const bindingAudit = auditCatalogueBinding(graph, await loadBasePipingCatalogueItems());
assert.equal(assertCatalogueBindingAudit(bindingAudit, { itemCount: 52, catalogueResolvedCount: 0, proceduralResolvedCount: 19, fallbackBlockedCount: 0, unresolvedCount: 21, supportIntentCount: 12, nearestMatchCount: 0, exportDecisionCount: 0 }).ok, true, 'binding audit ok');
const resolvedGeometry = resolvePlantGraphGeometry(graph, bindingAudit);
const geometryAudit = buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit);
assert.equal(assertGeometryResolutionAudit(geometryAudit, { ok: true, hardErrorCount: 0, navisTransformApplied: false, primitiveCodeCount: 0, exportDecisionCount: 0, routeFrameCount: 40, itemFrameCount: 19, resolvedStraightPipeCount: 19, supportPlacementCount: 12, blockedUnresolvedComponentCount: 21, unresolvedGeometryCount: 21 }).ok, true, 'geometry audit ok');
const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
const primitiveAudit = buildPrimitiveCompilationAudit(resolvedGeometry, primitiveModel, geometryAudit);
assert.equal(assertPrimitiveCompilationAudit(primitiveAudit, { ok: true, hardErrorCount: 0, navisTransformApplied: false, writerCallCount: 0, exportDecisionCount: 0, primitiveCount: 19, cylinderPrimitiveCount: 19, torusPrimitiveCount: 0, boxPrimitiveCount: 0, spherePrimitiveCount: 0, pyramidPrimitiveCount: 0, supportPrimitiveCount: 0, deferredSupportPrimitiveCount: 12, blockedUnresolvedGeometryCount: 21, blockedPrimitiveCount: 21, missingDimensionCount: 0 }).ok, true, 'primitive audit ok');
const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
const exportAudit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
assert.equal(assertExportModelCompilationAudit(exportAudit, { ok: true, hardErrorCount: 0, transformPolicy: 'final-review-transform.v1', rvmTransformWarningCount: 0, navisTransformApplied: true, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, rvmPrimitivePlanCount: 19, rvmCylinderPlanCount: 19, rvmTorusPlanCount: 0, rvmBoxPlanCount: 0, rvmSpherePlanCount: 0, rvmPyramidPlanCount: 0, blockedUnresolvedExportCount: 21, deferredSupportExportCount: 12 }).ok, true, 'export audit ok');
const writerAdapterPlan = buildWriterAdapterPlan(exportModels, exportAudit);
assert.equal(assertWriterAdapterPlanContract(writerAdapterPlan).ok, true, 'writer plan ok');
const writerAdapterAudit = buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit);
assert.equal(assertWriterAdapterAudit(writerAdapterAudit, { ok: true, hardErrorCount: 0, rvmWriterReady: true, writerCallCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, downloadSideEffectCount: 0, runtimeMutationCount: 0, rvmPlannedChunkCount: 19, rvmPlannedPrimChunkCount: 19, rvmPlannedCylinderCount: 19, rvmPlannedTorusCount: 0, rvmPlannedBoxCount: 0, rvmPlannedSphereCount: 0, rvmPlannedPyramidCount: 0, blockedUnresolvedWriterCount: 21, deferredSupportWriterCount: 12 }).ok, true, 'writer audit ok');
const testArtifactPlan = buildTestArtifactAdapterPlan(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterPlanContract(testArtifactPlan).ok, true, 'test artifact plan ok');
const testArtifactAudit = buildTestArtifactAdapterAudit(testArtifactPlan, exportModels, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterAudit(testArtifactAudit, { ok: true, hardErrorCount: 0, rvmArtifactReady: false, rvmArtifactGenerated: false, rvmArtifactBlocked: true, rvmArtifactByteLength: 0, rvmTransformReady: true, rvmStraightPipeSubsetReady: true, sourceTraceCount: 52, tracedStraightPipeCount: 19, tracedBlockedFlangeCount: 8, tracedBlockedValveCount: 6, tracedBlockedBendCount: 7, tracedDeferredSupportCount: 12, runtimeTouched: false, browserTouched: false, canvasTouched: false, objectUrlCount: 0, downloadSideEffectCount: 0, cacheKeyMutationCount: 0 }).ok, true, 'test artifact audit ok');
const byteProof = buildRvmTestArtifactByteProof(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
assert.equal(assertRvmTestArtifactByteProofContract(byteProof).ok, true, 'byte proof ok');
const byteProofAudit = buildRvmTestArtifactByteProofAudit(byteProof, exportModels, writerAdapterPlan, writerAdapterAudit, testArtifactAudit);
assert.equal(assertRvmTestArtifactByteProofAudit(byteProofAudit, { ok: true, hardErrorCount: 0, rvmStraightPipeSubsetArtifactReady: true, rvmFullModelArtifactReady: false, artifactGenerated: true, artifactBlocked: false, artifactChecksumPresent: true, sourceTraceCount: 52, tracedStraightPipeCount: 19, tracedBlockedFlangeCount: 8, tracedBlockedValveCount: 6, tracedBlockedBendCount: 7, tracedDeferredSupportCount: 12, primitiveWriteCount: 19, cylinderWriteCount: 19, torusWriteCount: 0, boxWriteCount: 0, sphereWriteCount: 0, pyramidWriteCount: 0, supportWriteCount: 0, blockedFlangeCount: 8, blockedValveCount: 6, blockedBendCount: 7, deferredSupportWriterCount: 12, rvmWriterCallCount: 1, attWriterCallCount: 0, glbWriterCallCount: 0, binaryPayloadGenerated: true, attTextPayloadGenerated: false, glbPayloadGenerated: false, runtimeTouched: false, browserTouched: false, canvasTouched: false, objectUrlCount: 0, downloadSideEffectCount: 0, productionPathMutationCount: 0, cacheKeyMutationCount: 0 }).ok, true, 'byte proof audit ok');
const previewModel = buildDiagnosticCanvasPreviewModel(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertDiagnosticCanvasPreviewModelContract(previewModel).ok, true, 'diagnostic preview model ok');
const previewAudit = buildDiagnosticCanvasPreviewAudit(previewModel, testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertDiagnosticCanvasPreviewAudit(previewAudit, { ok: true, hardErrorCount: 0, previewItemCount: 52, straightPipeWriterPlanPreviewCount: 19, blockedComponentPreviewCount: 21, blockedFlangePreviewCount: 8, blockedValvePreviewCount: 6, blockedBendPreviewCount: 7, deferredSupportPreviewCount: 12, sourceTraceCount: 52, geometryPayloadCount: 0, meshPayloadCount: 0, threeObjectCount: 0, runtimeMutationCount: 0, browserTouchCount: 0, canvasTouchCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, cacheKeyMutationCount: 0 }).ok, true, 'diagnostic preview audit ok');
const panelViewModel = buildDiagnosticPanelViewModel(previewModel, previewAudit, byteProof, byteProofAudit, { featureFlagEnabled: true });
const controlledPreview = buildControlledPreviewModel(panelViewModel, previewModel, previewAudit, byteProof, byteProofAudit, { featureFlagEnabled: true });
assert.equal(validateControlledPreviewModel(controlledPreview).ok, true, 'controlled preview model validates');
assert.equal(assertControlledPreviewModelContract(controlledPreview).ok, true, 'controlled preview contract passes');
assert.equal(controlledPreview.overallStatus, 'partial-rvm-subset-ready');
assert.equal(controlledPreview.straightPipeSubsetPreview.length, 19);
assert.equal(controlledPreview.blockedPreview.length, 21);
assert.equal(controlledPreview.blockedPreview.filter((row) => row.family === 'flange').length, 8);
assert.equal(controlledPreview.blockedPreview.filter((row) => row.family === 'valve').length, 6);
assert.equal(controlledPreview.blockedPreview.filter((row) => row.family === 'elbow').length, 7);
assert.equal(controlledPreview.deferredPreview.length, 12);
assert.equal(controlledPreview.sourceTracePreview.length, 52);
assert.deepEqual(collectControlledPreviewForbiddenFieldHits(controlledPreview), [], 'controlled preview exposes no geometry/raw payloads');
const controlledAudit = buildControlledPreviewAudit(controlledPreview);
assert.equal(assertControlledPreviewAudit(controlledAudit, { ok: true, hardErrorCount: 0, controlledPreviewItemCount: 52, straightPipeSubsetPreviewCount: 19, blockedComponentPreviewCount: 21, blockedFlangePreviewCount: 8, blockedValvePreviewCount: 6, blockedBendPreviewCount: 7, deferredSupportPreviewCount: 12, sourceTracePreviewCount: 52, rvmStraightPipeSubsetReady: true, rvmFullModelReady: false, attReady: false, glbReady: false, geometryPayloadCount: 0, meshPayloadCount: 0, threeObjectCount: 0, runtimeMutationCount: 0, browserTouchCount: 0, canvasTouchCount: 0, objectUrlCount: 0, downloadSideEffectCount: 0, binaryPayloadCount: 0, textPayloadCount: 0, glbPayloadCount: 0, writerCallCount: 0, cacheKeyMutationCount: 0 }).ok, true, 'controlled preview audit ok');
const html = renderControlledPreviewHtml(controlledPreview);
assert.ok(html.includes('Controlled shadow preview — diagnostic/artifact state only, not geometry.'));
assert.ok(html.includes('RVM straight-pipe subset: READY'));
assert.ok(html.includes('RVM full model: NOT READY'));
assert.equal(html.includes('rvmBytes'), false);
assert.equal(html.includes('attText'), false);
assert.equal(html.includes('glbBytes'), false);
assert.equal(html.includes('objectUrl'), false);
assert.equal(html.includes('downloadUrl'), false);

console.log('BM CII controlled preview tests passed');

async function loadBasePipingCatalogueItems() {
  const registryPath = 'catalogues/base-piping/catalogue-registry.json';
  const indexPath = 'catalogues/base-piping/base-piping.index.json';
  const itemPaths = ['catalogues/base-piping/items/pipe-straight-4in-std.json', 'catalogues/base-piping/items/elbow-90lr-4in-std.json', 'catalogues/base-piping/items/support-rest-generic.json'];
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

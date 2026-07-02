import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertComponentCatalogueItemContract, validatePlantModelGraphContract } from '../../src/contracts/index.js';
import { auditManagedStageToPlantGraph, convertManagedStageJsonToPlantGraph } from '../../src/importers/managed-stage-to-plant-graph.js';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../../src/geometry/geometry-solver.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../../src/primitives/primitive-compiler.js';
import { buildExportModelCompilationAudit, compileResolvedPrimitiveModelToExportModels } from '../../src/export-models/export-model-compilers.js';
import { buildWriterAdapterAudit, buildWriterAdapterPlan } from '../../src/writer-adapters/writer-adapters.js';
import { buildTestArtifactAdapterAudit, buildTestArtifactAdapterPlan } from '../../src/artifact-adapters/test-artifact-adapter.js';
import { buildRvmTestArtifactByteProof, buildRvmTestArtifactByteProofAudit } from '../../src/artifact-adapters/rvm-test-byte-artifact-adapter.js';
import { buildDiagnosticCanvasPreviewAudit, buildDiagnosticCanvasPreviewModel } from '../../src/preview-adapters/diagnostic-canvas-preview-adapter.js';
import { buildDiagnosticPanelViewModel } from '../../src/diagnostics/diagnostic-panel-view-model.js';
import { buildControlledPreviewAudit } from '../../src/audit/controlled-preview-audit.js';
import { buildControlledPreviewModel } from '../../src/diagnostics/controlled-preview-model.js';
import { buildBmCiiStyleManagedStageFixture } from './bm-cii-managed-stage-fixture.mjs';

export async function loadPhase11aCatalogueItems() {
  const paths = [
    'catalogues/base-piping/items/pipe-straight-4in-std.json',
    'catalogues/base-piping/items/support-rest-generic.json',
    'catalogues/base-piping/items/elbow-bend-45-114mm-6mm.json',
    'catalogues/base-piping/items/elbow-bend-45-88mm-55mm.json',
    'catalogues/base-piping/items/elbow-bend-45-60mm-39mm.json',
    'catalogues/base-piping/items/flange-weld-neck-114mm-6mm-class150-rf.json',
    'catalogues/base-piping/items/flange-weld-neck-88mm-55mm-class150-rf.json',
    'catalogues/base-piping/items/flange-weld-neck-60mm-39mm-class150-rf.json'
  ];
  const items = [];
  for (const path of paths) { const item = JSON.parse(await readFile(path, 'utf8')); assert.equal(assertComponentCatalogueItemContract(item).ok, true, `${path} validates`); items.push(item); }
  return items;
}

export async function buildBmCiiPhase11aState() {
  const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
  const graph = convertManagedStageJsonToPlantGraph(sourceText, { sourceName: 'BM_CII_INPUT_managed_stage.json', phase: 'Phase 11C flange primitive benchmark' });
  assert.equal(validatePlantModelGraphContract(graph).ok, true, 'PlantModelGraph validates');
  const importerAudit = auditManagedStageToPlantGraph(sourceText, graph, { sourceName: 'BM_CII_INPUT_managed_stage.json' });
  const catalogueItems = await loadPhase11aCatalogueItems();
  const bindingAudit = auditCatalogueBinding(graph, catalogueItems);
  const resolvedGeometry = resolvePlantGraphGeometry(graph, bindingAudit);
  const geometryAudit = buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit);
  const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
  const primitiveAudit = buildPrimitiveCompilationAudit(resolvedGeometry, primitiveModel, geometryAudit);
  const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
  const exportAudit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
  const writerAdapterPlan = buildWriterAdapterPlan(exportModels, exportAudit);
  const writerAdapterAudit = buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit);
  const testArtifactPlan = buildTestArtifactAdapterPlan(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit);
  const testArtifactAudit = buildTestArtifactAdapterAudit(testArtifactPlan, exportModels, writerAdapterPlan, writerAdapterAudit);
  const rvmByteProof = buildRvmTestArtifactByteProof(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
  const rvmByteProofAudit = buildRvmTestArtifactByteProofAudit(rvmByteProof, exportModels, writerAdapterPlan, writerAdapterAudit, testArtifactAudit);
  const diagnosticPreviewModel = buildDiagnosticCanvasPreviewModel(testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit, { sourceTrace: rvmByteProof.sourceTrace });
  const diagnosticPreviewAudit = buildDiagnosticCanvasPreviewAudit(diagnosticPreviewModel, testArtifactPlan, testArtifactAudit, writerAdapterPlan, writerAdapterAudit);
  const diagnosticPanelViewModel = buildDiagnosticPanelViewModel(diagnosticPreviewModel, diagnosticPreviewAudit, rvmByteProof, rvmByteProofAudit, { featureFlagEnabled: true });
  const controlledPreviewModel = buildControlledPreviewModel(diagnosticPanelViewModel, diagnosticPreviewModel, diagnosticPreviewAudit, rvmByteProof, rvmByteProofAudit, { featureFlagEnabled: true });
  const controlledPreviewAudit = buildControlledPreviewAudit(controlledPreviewModel);
  return { sourceText, graph, importerAudit, catalogueItems, bindingAudit, resolvedGeometry, geometryAudit, primitiveModel, primitiveAudit, exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit, rvmByteProof, rvmByteProofAudit, diagnosticPreviewModel, diagnosticPreviewAudit, diagnosticPanelViewModel, controlledPreviewModel, controlledPreviewAudit };
}

export function assertNoRawRuntimePayload(value) {
  for (const forbidden of ['rvm' + 'Bytes', 'att' + 'Text', 'glb' + 'Bytes', 'gltfJson', 'object' + 'Url', 'download' + 'Url', 'threeObject', 'threeGeometry', 'meshGeometry', 'can' + 'vas']) {
    assert.equal(hasOwnKeyDeep(value, forbidden), false, `no ${forbidden}`);
  }
}

function hasOwnKeyDeep(value, key) {
  if (!value || typeof value !== 'object') return false;
  if (Object.hasOwn(value, key)) return true;
  if (Array.isArray(value)) return value.some((entry) => hasOwnKeyDeep(entry, key));
  return Object.values(value).some((entry) => hasOwnKeyDeep(entry, key));
}

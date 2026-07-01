import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePlantModelGraphContract } from '../../src/contracts/index.js';
import { convertManagedStageJsonToPlantGraph } from '../../src/importers/managed-stage-to-plant-graph.js';
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
import { compileResolvedPrimitiveModelToExportModels } from '../../src/export-models/export-model-compilers.js';
import { buildNewCoreReadinessAudit } from '../../src/export-models/new-core-readiness-audit.js';
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const pipeline = await buildPipelineFromActualStages();
const audit = buildNewCoreReadinessAudit(pipeline, { sourceName: pipeline.sourceName });

assert.equal(audit.schema, 'NewCoreReadinessAudit.v1', 'real pipeline generates NewCoreReadinessAudit.v1');
assert.equal(audit.ok, true, audit.errors.join('\n'));
assert.equal(audit.graphId, pipeline.graph.id, 'audit preserves graph identity');
assert.equal(audit.itemCount, pipeline.graph.items.length, 'audit item count matches graph item count');
assert.equal(audit.traceRows.length, pipeline.graph.items.length, 'every graph item gets a trace row');
assert.equal(audit.productionReadyCount > 0, true, 'real pipeline produces production-ready straight-pipe rows');
assert.equal(audit.supportIntentOnlyCount > 0, true, 'real pipeline preserves support-intent-only rows');
assert.equal(audit.unresolvedCount > 0, true, 'real pipeline records unresolved catalogue/procedural decisions');
assert.equal(audit.traceRows.some((row) => row.readinessStatus === 'production-ready' && !row.reason), true, 'production-ready row requires no reason');
assert.equal(audit.traceRows.filter((row) => row.readinessStatus !== 'production-ready').every((row) => row.reason), true, 'non-ready rows carry reasons');

const readyRow = audit.traceRows.find((row) => row.readinessStatus === 'production-ready');
assert.ok(readyRow, 'fixture must contain at least one production-ready row for negative test');

const primitiveEvidenceRemoved = {
  ...pipeline,
  primitiveModel: {
    ...pipeline.primitiveModel,
    primitives: pipeline.primitiveModel.primitives.filter((primitive) => primitive.sourceItemId !== readyRow.itemId)
  }
};
const missingPrimitiveAudit = buildNewCoreReadinessAudit(primitiveEvidenceRemoved, { sourceName: pipeline.sourceName });
const missingPrimitiveRow = missingPrimitiveAudit.traceRows.find((row) => row.itemId === readyRow.itemId);
assert.ok(missingPrimitiveRow, 'negative test row must remain traceable');
assert.equal(missingPrimitiveRow.rvmExportStatus, 'exportPlanned', 'negative test keeps downstream export evidence present');
assert.equal(missingPrimitiveRow.attStatus, 'recordPlanned', 'negative test keeps ATT evidence present');
assert.equal(missingPrimitiveRow.glbStatus, 'visualPlanned', 'negative test keeps GLB evidence present');
assert.equal(missingPrimitiveRow.primitiveStatus, 'missing', 'negative test removes upstream primitive evidence');
assert.equal(missingPrimitiveRow.readinessStatus, 'blocked', 'missing primitive evidence blocks production readiness even when export rows exist');
assert.match(missingPrimitiveRow.reason, /missing resolved primitive evidence/i);
assert.equal(missingPrimitiveAudit.productionReadyCount, audit.productionReadyCount - 1, 'missing primitive evidence reduces production-ready count');
assert.equal(missingPrimitiveAudit.blockedCount, audit.blockedCount + 1, 'missing primitive evidence increases blocked count');

console.log('new-core readiness pipeline smoke tests passed');

async function buildPipelineFromActualStages() {
  const sourceName = 'bm-cii-managed-stage-full-topology.generated.json';
  const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
  const graph = convertManagedStageJsonToPlantGraph(sourceText, {
    sourceName,
    phase: 'Phase 01 new-core readiness smoke test'
  });
  const graphValidation = validatePlantModelGraphContract(graph);
  assert.equal(graphValidation.ok, true, `graph validation ok: ${graphValidation.errors.join('; ')}`);

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
  assert.equal(itemResult.audit.invalidItemCount, 0, 'catalogue item load has zero invalid items');

  const bindingAudit = auditCatalogueBinding(graph, itemResult.items);
  const resolvedGeometry = resolvePlantGraphGeometry(graph, bindingAudit);
  const geometryAudit = buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit);
  assert.equal(geometryAudit.ok, true, `geometry audit ok: ${geometryAudit.errors.join('; ')}`);

  const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
  const primitiveAudit = buildPrimitiveCompilationAudit(resolvedGeometry, primitiveModel, geometryAudit);
  assert.equal(primitiveAudit.ok, true, `primitive audit ok: ${primitiveAudit.errors.join('; ')}`);

  const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
  return {
    sourceName,
    graph,
    bindingAudit,
    resolvedGeometry,
    primitiveModel,
    exportModels
  };
}

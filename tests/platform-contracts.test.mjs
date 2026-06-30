import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertPlantModelGraphContract,
  assertCatalogueRegistryContract,
  assertComponentCatalogueItemContract,
  assertResolvedPrimitiveModelContract,
  CONTRACT_SCHEMA_SET
} from '../src/contracts/index.js';

const graph = await readJson('samples/contracts/BM_CII.plant-graph.json');
const registry = await readJson('samples/contracts/base-piping.catalogue-registry.json');
const catalogueItem = await readJson('samples/contracts/base-piping.elbow-90lr-4in-std.json');
const resolved = await readJson('samples/contracts/BM_CII.resolved-primitive-model.seed.json');

assert.equal(CONTRACT_SCHEMA_SET.schema, 'PlatformContractSchemas.v1');
assert.equal(CONTRACT_SCHEMA_SET.resolvedGeometryModel, 'ResolvedGeometryModel.v1');
assert.equal(CONTRACT_SCHEMA_SET.resolvedPrimitiveModel, 'ResolvedPrimitiveModel.v1');
assert.equal(CONTRACT_SCHEMA_SET.rvmExportModel, 'RvmExportModel.v1');
assert.equal(CONTRACT_SCHEMA_SET.attExportModel, 'AttExportModel.v1');
assert.equal(CONTRACT_SCHEMA_SET.glbVisualModel, 'GlbVisualModel.v1');
assert.equal(CONTRACT_SCHEMA_SET.writerAdapterPlan, 'WriterAdapterPlan.v1');
assert.equal(CONTRACT_SCHEMA_SET.testArtifactAdapterPlan, 'TestArtifactAdapterPlan.v1');
assert.equal(assertPlantModelGraphContract(graph).ok, true);
assert.equal(assertCatalogueRegistryContract(registry).ok, true);
assert.equal(assertComponentCatalogueItemContract(catalogueItem).ok, true);
assert.equal(assertResolvedPrimitiveModelContract(resolved).ok, true);

assert.equal(graph.nodes.length, 3, 'seed graph node count');
assert.equal(graph.routes.length, 2, 'seed graph route count');
assert.equal(graph.items.length, 3, 'seed graph item count');
assert.equal(resolved.primitives.length, 3, 'seed resolved primitive count');

console.log('platform contract tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

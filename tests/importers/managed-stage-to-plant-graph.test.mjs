import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertPlantModelGraphContract,
  validatePlantModelGraphContract
} from '../../src/contracts/index.js';
import {
  auditManagedStageToPlantGraph,
  convertManagedStageJsonToPlantGraph
} from '../../src/importers/managed-stage-to-plant-graph.js';
import { importManagedStageAsPlantGraph } from '../../src/adapters/current-app/managed-stage-import-adapter.js';

const inputPath = 'samples/importers/managed-stage-minimal.input.json';
const expectedPath = 'samples/importers/managed-stage-minimal.expected.plant-graph.json';
const sourceName = 'managed-stage-minimal.input.json';
const sourceText = await readFile(inputPath, 'utf8');
const expectedGraph = JSON.parse(await readFile(expectedPath, 'utf8'));

const generatedGraph = convertManagedStageJsonToPlantGraph(sourceText, { sourceName });
const generatedValidation = validatePlantModelGraphContract(generatedGraph);
const expectedValidation = validatePlantModelGraphContract(expectedGraph);

assert.equal(expectedValidation.ok, true, `expected graph must validate: ${expectedValidation.errors.join('; ')}`);
assert.equal(generatedValidation.ok, true, `generated graph must validate: ${generatedValidation.errors.join('; ')}`);
assert.deepEqual(generatedGraph, expectedGraph, 'generated graph must match golden PlantModelGraph fixture');
assert.equal(assertPlantModelGraphContract(generatedGraph).ok, true);

assert.equal(generatedGraph.nodes.length, 3, 'node count');
assert.equal(generatedGraph.routes.length, 2, 'route count');
assert.equal(generatedGraph.items.find((item) => item.kind === 'support')?.sourceRef, 'SUPPORT-001');
assert.equal(generatedGraph.items.filter((item) => item.kind === 'generated').length, 2);
assert.equal(generatedGraph.items.filter((item) => item.kind === 'component').length, 1);

const audit = auditManagedStageToPlantGraph(sourceText, generatedGraph, { sourceName });
assert.deepEqual(audit, {
  schema: 'ManagedStageToPlantGraphAudit.v1',
  sourceName,
  parsed: true,
  nodeCount: 3,
  routeCount: 2,
  itemCount: 4,
  supportItemCount: 1,
  componentItemCount: 1,
  generatedItemCount: 2,
  taggedItemCount: 1,
  warnings: [],
  unsupportedRecords: []
});

const adapterResult = importManagedStageAsPlantGraph(sourceText, { sourceName });
assert.deepEqual(adapterResult.graph, expectedGraph, 'current-app adapter should wrap importer graph');
assert.equal(adapterResult.validation.ok, true, 'current-app adapter validation');
assert.deepEqual(adapterResult.audit, audit, 'current-app adapter audit');

const importerSource = await readFile('src/importers/managed-stage-to-plant-graph.js', 'utf8');
const adapterSource = await readFile('src/adapters/current-app/managed-stage-import-adapter.js', 'utf8');
for (const forbidden of ['writeRvm', 'writeAtt', 'rvm-writer', 'att-writer']) {
  assert.equal(importerSource.includes(forbidden), false, `importer must not reference ${forbidden}`);
  assert.equal(adapterSource.includes(forbidden), false, `adapter must not reference ${forbidden}`);
}

assert.equal(typeof globalThis.window, 'undefined', 'test must run without browser window dependency');

console.log('managed-stage importer tests passed');

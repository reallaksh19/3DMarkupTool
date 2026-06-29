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
assert.equal(audit.schema, 'ManagedStageToPlantGraphAudit.v1');
assert.equal(audit.sourceName, sourceName);
assert.equal(audit.parsed, true);
assert.equal(audit.nodeCount, 3);
assert.equal(audit.routeCount, 2);
assert.equal(audit.itemCount, 4);
assert.equal(audit.supportItemCount, 1);
assert.equal(audit.componentItemCount, 1);
assert.equal(audit.generatedItemCount, 2);
assert.equal(audit.taggedItemCount, 1);
assert.equal(audit.sourceComponentCount, 2);
assert.equal(audit.sourcePipeCount, 2);
assert.equal(audit.sourceSupportCount, 1);
assert.equal(audit.placeholderGeneratedComponentCount, 0);
assert.deepEqual(audit.warnings, []);
assert.deepEqual(audit.unsupportedRecords, []);

const adapterResult = importManagedStageAsPlantGraph(sourceText, { sourceName });
assert.deepEqual(adapterResult.graph, expectedGraph, 'current-app adapter should wrap importer graph');
assert.equal(adapterResult.validation.ok, true, 'current-app adapter validation');
assert.deepEqual(adapterResult.audit, audit, 'current-app adapter audit');

assert.equal(typeof globalThis.window, 'undefined', 'test must run without browser window dependency');

console.log('managed-stage importer tests passed');

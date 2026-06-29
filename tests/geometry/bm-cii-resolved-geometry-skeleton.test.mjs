import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePlantModelGraphContract, assertResolvedGeometryModelContract } from '../../src/contracts/index.js';
import { auditPlantGraphTopology } from '../../src/audit/plant-graph-topology-audit.js';
import { assertCatalogueBindingAudit } from '../../src/audit/catalogue-binding-audit.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
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
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const sourceName = 'bm-cii-managed-stage-full-topology.generated.json';
const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName,
  phase: 'Phase 5 resolved geometry skeleton benchmark'
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

assert.equal(geometryAudit.ok, true, 'GeometryResolutionAudit.ok');
assert.equal(geometryAudit.hardErrorCount, 0, 'hard error count');
assert.equal(geometryAudit.navisTransformApplied, false, 'Navis transform not applied');
assert.equal(geometryAudit.primitiveCodeCount, 0, 'primitive code count');
assert.equal(geometryAudit.exportDecisionCount, 0, 'export decision count');
assert.equal(geometryAudit.routeFrameCount, 40, 'route frame count');
assert.equal(geometryAudit.itemFrameCount, 19, 'item frame count');
assert.equal(geometryAudit.resolvedStraightPipeCount, 19, 'resolved straight pipe count');
assert.equal(geometryAudit.supportPlacementCount, 12, 'support placement count');
assert.equal(geometryAudit.blockedUnresolvedComponentCount, 21, 'blocked unresolved component count');
assert.equal(geometryAudit.unresolvedGeometryCount, 21, 'unresolved geometry count');
assert.equal(resolvedGeometry.itemFrames.length, 19, 'BM_CII must only create pipe item frames in Phase 5');
assert.equal(resolvedGeometry.unresolvedGeometry.filter((entry) => entry.family === 'flange').length, 8, 'blocked unresolved flanges');
assert.equal(resolvedGeometry.unresolvedGeometry.filter((entry) => entry.family === 'valve').length, 6, 'blocked unresolved valves');
assert.equal(resolvedGeometry.unresolvedGeometry.filter((entry) => entry.family === 'elbow').length, 7, 'blocked unresolved bends');
assert.equal(resolvedGeometry.itemFrames.some((frame) => String(frame.itemId).includes('BEND')), false, 'no fake bend frames');
assert.equal(JSON.stringify(resolvedGeometry).includes('inputxml-chord-midpoint-not-arc-center'), false, 'bend chord midpoint must not become solved geometry');

const solverSource = await readFile('src/geometry/geometry-solver.js', 'utf8');
const contractSource = await readFile('src/contracts/resolved-geometry-model-contract.js', 'utf8');
for (const source of [solverSource, contractSource]) {
  for (const forbidden of ['catalogue-binder', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter', 'canvas', 'app-loader', 'safe-ui-loader', 'window.', 'document.']) {
    assert.equal(source.includes(forbidden), false, `Phase 5 source must not reference ${forbidden}`);
  }
}

console.log('BM CII resolved geometry skeleton tests passed');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePlantModelGraphContract, assertResolvedGeometryModelContract, assertResolvedPrimitiveModelContract } from '../../src/contracts/index.js';
import { auditPlantGraphTopology } from '../../src/audit/plant-graph-topology-audit.js';
import { assertCatalogueBindingAudit } from '../../src/audit/catalogue-binding-audit.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
import { assertPrimitiveCompilationAudit } from '../../src/audit/primitive-compilation-audit.js';
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
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const sourceName = 'bm-cii-managed-stage-full-topology.generated.json';
const sourceText = JSON.stringify(buildBmCiiStyleManagedStageFixture());
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName,
  phase: 'Phase 6 primitive compiler skeleton benchmark'
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

assert.equal(resolvedGeometry.itemFrames.length, 19, 'BM_CII must only create pipe item frames before primitive compilation');
assert.equal(resolvedGeometry.itemFrames.every((frame) => Number.isFinite(Number(frame.radiusMm))), true, 'BM_CII pipe frames carry numeric radius evidence');

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

assert.equal(primitiveModel.primitives.length, 19, 'straight pipe primitive count');
assert.equal(primitiveModel.primitives.every((entry) => entry.primitiveKind === 'CYLINDER' && entry.primitiveCode === 8), true, 'only CYLINDER/code8 compiled');
assert.equal(primitiveModel.primitives.every((entry) => entry.basis === 'authoring'), true, 'primitive basis remains authoring');
assert.equal(primitiveModel.deferredPrimitives.filter((entry) => entry.family === 'support').length, 12, 'supports deferred');
assert.equal(primitiveModel.blockedPrimitives.filter((entry) => entry.family === 'flange').length, 8, 'blocked unresolved flanges');
assert.equal(primitiveModel.blockedPrimitives.filter((entry) => entry.family === 'valve').length, 6, 'blocked unresolved valves');
assert.equal(primitiveModel.blockedPrimitives.filter((entry) => entry.family === 'elbow').length, 7, 'blocked unresolved bends');
assert.equal(JSON.stringify(primitiveModel).includes('inputxml-chord-midpoint-not-arc-center'), false, 'bend chord midpoint must not become primitive geometry');
assert.equal(primitiveModel.primitives.some((entry) => entry.primitiveKind === 'TORUS' || entry.primitiveCode === 4), false, 'no TORUS/code4 in Phase 6');
assert.equal(primitiveModel.primitives.some((entry) => ['BOX', 'SPHERE', 'PYRAMID'].includes(entry.primitiveKind)), false, 'no visual fallback primitive kinds');

const compilerSource = await readFile('src/primitives/primitive-compiler.js', 'utf8');
const contractSource = await readFile('src/contracts/resolved-primitive-model-contract.js', 'utf8');
for (const source of [compilerSource, contractSource]) {
  for (const forbidden of ['catalogue-binder', 'geometry-solver', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter', 'canvas', 'app-loader', 'safe-ui-loader', "from 'three'", 'from "three"', 'window.', 'document.']) {
    assert.equal(source.includes(forbidden), false, `Phase 6 source must not reference ${forbidden}`);
  }
}

console.log('BM CII primitive compiler skeleton tests passed');

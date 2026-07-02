import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePlantModelGraphContract } from '../../src/contracts/index.js';
import { auditPlantGraphTopology } from '../../src/audit/plant-graph-topology-audit.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
import {
  buildGeometryResolutionAudit,
  resolvePlantGraphGeometry
} from '../../src/geometry/geometry-solver.js';

const graph = JSON.parse(await readFile('samples/geometry/minimal-resolved-geometry.input.plant-graph.json', 'utf8'));
const bindingAudit = JSON.parse(await readFile('samples/geometry/minimal-resolved-geometry.binding-audit.json', 'utf8'));
const expectedGeometry = JSON.parse(await readFile('samples/geometry/minimal-resolved-geometry.expected.resolved-geometry.json', 'utf8'));
const expectedAudit = JSON.parse(await readFile('samples/geometry/minimal-resolved-geometry.expected.audit.json', 'utf8'));

const graphValidation = validatePlantModelGraphContract(graph);
assert.equal(graphValidation.ok, true, `graph must validate: ${graphValidation.errors.join('; ')}`);
const topologyAudit = auditPlantGraphTopology(graph);
assert.equal(topologyAudit.ok, true, 'topology audit must pass before geometry solving');

const resolvedGeometry = resolvePlantGraphGeometry(graph, bindingAudit);
assert.deepEqual(resolvedGeometry, expectedGeometry, 'resolved geometry must exactly match golden fixture');
assert.equal(resolvedGeometry.axisBasis.authoring, graph.project.axisBasis.authoring, 'authoring basis must be preserved');
assert.deepEqual(resolvedGeometry.routeFrames[0].start, [0, 0, 0], 'route frame start in authoring basis');
assert.deepEqual(resolvedGeometry.routeFrames[0].direction, [1, 0, 0], 'route frame direction in authoring basis');
assert.equal(resolvedGeometry.itemFrames.find((frame) => frame.itemId === 'PIPE-1').resolver, 'straightPipeGeometry.v1');
assert.equal(resolvedGeometry.supportPlacements.find((entry) => entry.itemId === 'SUPPORT-1').geometryStatus, 'intentOnly');
assert.equal(resolvedGeometry.itemFrames.find((frame) => frame.itemId === 'ELBOW-1').geometryStatus, 'catalogueFrameResolved');
assert.equal(resolvedGeometry.itemFrames.find((frame) => frame.itemId === 'ELBOW-1').primitiveCode, undefined, 'catalogue frame must not include primitive code');
assert.equal(resolvedGeometry.unresolvedGeometry.find((entry) => entry.itemId === 'VALVE-1').geometryStatus, 'blocked');
assert.equal(resolvedGeometry.unresolvedGeometry.find((entry) => entry.itemId === 'VALVE-1').reason, 'no exact catalogue item');

const geometryAudit = buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit);
assert.deepEqual(geometryAudit, expectedAudit, 'geometry audit must exactly match golden fixture');
assert.equal(assertGeometryResolutionAudit(geometryAudit, {
  ok: true,
  navisTransformApplied: false,
  primitiveCodeCount: 0,
  exportDecisionCount: 0,
  hardErrorCount: 0
}).ok, true);

const zeroLengthGraph = structuredClone(graph);
zeroLengthGraph.id = 'zero-length-route-fixture';
zeroLengthGraph.nodes.find((node) => node.id === 'N2').coord = [0, 0, 0];
const zeroLengthGeometry = resolvePlantGraphGeometry(zeroLengthGraph, bindingAudit);
const zeroLengthAudit = buildGeometryResolutionAudit(zeroLengthGraph, zeroLengthGeometry, bindingAudit);
assert.equal(zeroLengthAudit.ok, false, 'zero-length route must fail geometry audit');
assert.ok(zeroLengthAudit.hardErrorCount > 0, 'zero-length route must create a hard error');
assert.ok(zeroLengthAudit.errors.some((entry) => entry.includes('zero length')), 'zero-length error must be reported');
assert.equal(zeroLengthGeometry.itemFrames.some((frame) => frame.itemId === 'PIPE-1'), false, 'invalid route must not produce straight pipe frame');

const missingNodeGraph = structuredClone(graph);
missingNodeGraph.id = 'missing-route-node-fixture';
missingNodeGraph.routes[0].to = 'N404';
const missingNodeGeometry = resolvePlantGraphGeometry(missingNodeGraph, bindingAudit);
const missingNodeAudit = buildGeometryResolutionAudit(missingNodeGraph, missingNodeGeometry, bindingAudit);
assert.equal(missingNodeAudit.ok, false, 'missing route node must fail geometry audit');
assert.ok(missingNodeAudit.errors.some((entry) => entry.includes('missing to node')), 'missing-node error must be reported');

const invalidCoordGraph = structuredClone(graph);
invalidCoordGraph.id = 'invalid-coordinate-route-fixture';
invalidCoordGraph.nodes.find((node) => node.id === 'N2').coord = [1000, Number.NaN, 0];
const invalidCoordGeometry = resolvePlantGraphGeometry(invalidCoordGraph, bindingAudit);
const invalidCoordAudit = buildGeometryResolutionAudit(invalidCoordGraph, invalidCoordGeometry, bindingAudit);
assert.equal(invalidCoordAudit.ok, false, 'invalid route coordinates must fail geometry audit');
assert.ok(invalidCoordAudit.errors.some((entry) => entry.includes('invalid')), 'invalid-coordinate error must be reported');

console.log('geometry solver tests passed');

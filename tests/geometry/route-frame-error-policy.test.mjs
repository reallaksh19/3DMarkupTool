import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildGeometryResolutionAudit,
  resolvePlantGraphGeometry
} from '../../src/geometry/geometry-solver.js';

const graph = JSON.parse(await readFile('samples/geometry/minimal-resolved-geometry.input.plant-graph.json', 'utf8'));
const bindingAudit = JSON.parse(await readFile('samples/geometry/minimal-resolved-geometry.binding-audit.json', 'utf8'));

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

console.log('route frame hard error policy tests passed');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFallbackPolicyRecord,
  createBlockedUnknownEngineeringItemFallback,
  validateFallbackPolicyRecord,
  validatePlantModelGraphContract
} from '../../src/contracts/index.js';
import {
  assertPlantGraphTopologyAudit,
  auditPlantGraphTopology
} from '../../src/audit/plant-graph-topology-audit.js';

const graph = JSON.parse(await readFile('samples/audit/plant-graph-topology.input.json', 'utf8'));
const expectedAudit = JSON.parse(await readFile('samples/audit/plant-graph-topology.expected.audit.json', 'utf8'));

const graphValidation = validatePlantModelGraphContract(graph);
assert.equal(graphValidation.ok, true, `golden input must remain within PlantModelGraph boundary: ${graphValidation.errors.join('; ')}`);

const audit = auditPlantGraphTopology(graph);
assert.deepEqual(audit, expectedAudit, 'topology audit must exactly match golden fixture');
assert.deepEqual(auditPlantGraphTopology(graph), audit, 'topology audit output must be deterministic');
assert.equal(assertPlantGraphTopologyAudit(audit, { ok: false, nodeCount: 6, routeCount: 4, itemCount: 4 }).ok, true);

assert.deepEqual(audit.duplicateNodeIds, [...audit.duplicateNodeIds].sort(compareStable), 'duplicate node IDs must be sorted');
assert.deepEqual(audit.duplicateRouteIds, [...audit.duplicateRouteIds].sort(compareStable), 'duplicate route IDs must be sorted');
assert.deepEqual(audit.duplicateItemIds, [...audit.duplicateItemIds].sort(compareStable), 'duplicate item IDs must be sorted');
assert.deepEqual(audit.openRouteEnds, [...audit.openRouteEnds].sort(compareStable), 'open route ends must be sorted');
assert.deepEqual(audit.branchNodeIds, [...audit.branchNodeIds].sort(compareStable), 'branch node IDs must be sorted');
assert.deepEqual(audit.supportNodeIds, [...audit.supportNodeIds].sort(compareStable), 'support node IDs must be sorted');

const blockedFallback = createBlockedUnknownEngineeringItemFallback();
assert.equal(blockedFallback.fallbackKind, 'blocked');
assert.equal(blockedFallback.requiresUserApproval, true);
assert.equal(validateFallbackPolicyRecord(blockedFallback).ok, true);
assert.equal(assertFallbackPolicyRecord(blockedFallback).ok, true);

const auditSource = await readFile('src/audit/plant-graph-topology-audit.js', 'utf8');
const fallbackSource = await readFile('src/contracts/fallback-policy-contract.js', 'utf8');
for (const source of [auditSource, fallbackSource]) {
  for (const forbidden of [
    'src/app.js',
    'managed-stage-rvm-converter',
    'rvm-writer',
    'att-writer',
    'safe-ui-loader',
    'app-loader',
    'managed-stage-json-ui-controller',
    'window.',
    'document.'
  ]) {
    assert.equal(source.includes(forbidden), false, `governance core source must not reference ${forbidden}`);
  }
}

assert.equal(typeof globalThis.window, 'undefined', 'test must run without browser window dependency');
assert.equal(typeof globalThis.document, 'undefined', 'test must run without browser document dependency');

console.log('plant graph topology audit tests passed');

function compareStable(a, b) {
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

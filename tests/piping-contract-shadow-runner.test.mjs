import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  PIPING_CONTRACT_SHADOW_SCHEMA,
  attachPipingContractShadow,
  compactReport,
  runPipingContractShadow
} from '../src/piping-contract-shadow-runner.js';

const startedAt = performance.now();

phase('01 shadow runner produces compact diagnostics without rendering geometry', () => {
  const report = runPipingContractShadow(syntheticModel());
  assert.equal(report.schemaVersion, PIPING_CONTRACT_SHADOW_SCHEMA);
  assert.equal(report.mode, 'SHADOW_ONLY');
  assert.equal(report.ok, true);
  assert.equal(report.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assert.match(report.replacementPath, /PipingComponent -> PipingGraph -> GeometryContract/);
  assert.equal(report.counts.sourceRecordsTotal, 4);
  assert.equal(report.counts.componentsTotal, 4);
  assert.equal(report.counts.geometryContractsTotal, 4);
  assert.equal(report.counts.renderInstructionsTotal, 4);
  assert.equal(report.counts.fallbackRendered, 0);
  assert.ok(report.counts.graphNodesTotal >= 3);
});

phase('02 shadow report attaches to scene-style userData only', () => {
  const report = runPipingContractShadow(syntheticModel());
  const sceneLike = { userData: { existing: 'kept' } };
  attachPipingContractShadow(sceneLike, report);
  assert.equal(sceneLike.userData.existing, 'kept');
  assert.equal(sceneLike.userData.pipingContractShadow.schemaVersion, PIPING_CONTRACT_SHADOW_SCHEMA);
  assert.equal(sceneLike.userData.pipingContractShadow.ok, true);
  assert.equal(sceneLike.userData.pipingContractShadow.counts.componentsTotal, 4);
  assert.equal(sceneLike.userData.pipingContractShadow.diagnostics, undefined, 'attached report should stay compact, not carry full pipeline internals');
});

phase('03 compact report strips heavy diagnostics but preserves failure info', () => {
  const compact = compactReport({
    schemaVersion: PIPING_CONTRACT_SHADOW_SCHEMA,
    mode: 'SHADOW_ONLY',
    ok: false,
    sourceKind: 'InputXML',
    activeRenderer: 'LEGACY_FALLBACK_ONLY',
    counts: { componentsTotal: 0 },
    diagnostics: { heavy: new Array(50).fill('x') },
    errors: [{ code: 'boom', message: 'failed', name: 'Error', stack: 'must-not-leak' }]
  });
  assert.equal(compact.ok, false);
  assert.equal(compact.diagnostics, undefined);
  assert.deepEqual(compact.errors, [{ code: 'boom', message: 'failed', name: 'Error' }]);
});

phase('04 invalid model fails safely and keeps legacy fallback active', () => {
  const report = runPipingContractShadow(null);
  assert.equal(report.schemaVersion, PIPING_CONTRACT_SHADOW_SCHEMA);
  assert.equal(report.mode, 'SHADOW_ONLY');
  assert.equal(report.ok, false);
  assert.equal(report.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assert.equal(report.counts.componentsTotal, 0);
  assert.ok(report.errors.length >= 1);
  assert.equal(report.errors[0].code, 'pipingContractShadow.failed');
});

console.log(`[piping-shadow] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[piping-shadow] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[piping-shadow] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

function syntheticModel() {
  const nodes = new Map([
    ['10', node('10', 0, 0, 0)],
    ['20', node('20', 1000, 0, 0)],
    ['30', node('30', 1000, 1000, 0)]
  ]);
  return {
    sourceKind: 'InputXML',
    nodes,
    elements: [
      element(nodes, 'PE_001_PIPE_10_TO_20', 'PIPE', '10', '20'),
      element(nodes, 'PE_002_BEND_20_TO_30', 'BEND', '20', '30', { bendRadius: 180, bendAngle: 90 })
    ],
    restraints: [
      { id: 'INPUTXML_RESTRAINT_GUIDE', node: '20', typeCode: '7', rawType: '7', xCos: 0, yCos: 0, zCos: 1, gapMm: 6 },
      { id: 'INPUTXML_RESTRAINT_UNKNOWN', node: '30', typeCode: '???', rawType: '???', xCos: 0, yCos: 1, zCos: 0, gapMm: 0 }
    ]
  };
}

function node(id, x, y, z) {
  return { id, x, y, z };
}

function element(nodes, id, rawType, fromNode, toNode, overrides = {}) {
  const from = nodes.get(fromNode);
  const to = nodes.get(toNode);
  return {
    id,
    rawType,
    type: rawType,
    fromNode,
    toNode,
    from,
    to,
    dx: to.x - from.x,
    dy: to.y - from.y,
    dz: to.z - from.z,
    props: {
      id,
      type: rawType,
      meshRole: rawType,
      fromNode,
      toNode,
      bore: 120,
      source: 'InputXML shadow test fixture',
      ...overrides
    }
  };
}

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { validateGeometryContract } from '../src/piping-component-contract.js';
import { PIPING_COMPONENT_CATALOG, RENDER_RECIPE_CATALOG } from '../src/piping-component-catalog.js';
import {
  adaptInputXmlModelToSourceRecords,
  buildRenderInstructions,
  createFallbackLegacyContract
} from '../src/piping-component-layer.js';
import { buildInputXmlSafePipingContractPipeline as buildPipingContractPipeline } from '../src/piping-component-inputxml-safe-pipeline.js';

const startedAt = performance.now();
const model = syntheticInputXmlModel();
let pipeline;

phase('01 catalog skeleton covers all required component families and recipes', () => {
  for (const key of ['pipe', 'elbow', 'bend', 'tee', 'valve', 'flange', 'reducer', 'support', 'restraint', 'unknown']) {
    assert.ok(PIPING_COMPONENT_CATALOG.entries[key], `catalog entry missing: ${key}`);
  }

  for (const recipeId of [
    'pipe-cylinder-between-nodes.v1',
    'elbow-sweep.v1',
    'tee-composite.v1',
    'valve-symbolic.v1',
    'flange-pair.v1',
    'reducer-transition.v1',
    'restraint-symbol.v1',
    'unknown-placeholder.v1',
    'fallback-legacy.v1'
  ]) {
    assert.ok(RENDER_RECIPE_CATALOG.recipes[recipeId], `render recipe missing: ${recipeId}`);
  }
});

phase('02 source adapter maps records without silent drops', () => {
  const sourceRecords = adaptInputXmlModelToSourceRecords(model);
  assert.equal(sourceRecords.length, model.elements.length + model.restraints.length);
  assert.equal(sourceRecords.filter((record) => record.sourceRecordKind === 'ELEMENT').length, model.elements.length);
  assert.equal(sourceRecords.filter((record) => record.sourceRecordKind === 'RESTRAINT').length, model.restraints.length);
});

phase('03 InputXML source records produce normalized components, graph, contracts, and instructions', () => {
  pipeline = buildPipingContractPipeline(model);
  assert.equal(pipeline.sourceRecords.length, pipeline.components.length, 'classification must not drop source records');
  assert.equal(pipeline.components.length, 10);
  assert.equal(pipeline.graph.schemaVersion, 'PipingGraph.v1');
  assert.ok(pipeline.graph.nodes.length >= 8);
  assert.ok(pipeline.graph.edges.length >= 6);
  assert.equal(pipeline.geometryContracts.length, pipeline.components.length);
  assert.equal(pipeline.renderInstructions.length, pipeline.geometryContracts.length);
});

phase('04 unknown remains unknown and unknown restraint remains UNKNOWN_RESTRAINT', () => {
  const unknownComponent = pipeline.components.find((component) => component.sourceRef.sourceId === 'PE_009_UNKNOWN_90_TO_100');
  assert.ok(unknownComponent, 'fixture unknown component missing');
  assert.equal(unknownComponent.componentClass, 'UNKNOWN');
  assert.equal(unknownComponent.componentType, 'UNKNOWN_COMPONENT');

  const unknownRestraint = pipeline.components.find((component) => component.sourceRef.sourceId === 'INPUTXML_RESTRAINT_UNKNOWN');
  assert.ok(unknownRestraint, 'fixture unknown restraint missing');
  assert.equal(unknownRestraint.componentClass, 'RESTRAINT');
  assert.equal(unknownRestraint.componentType, 'UNKNOWN_RESTRAINT');
});

phase('05 InputXML fittings are classified but delegated to explicit fallback, not invented geometry', () => {
  assertHasKind('PIPE', 'CYLINDER_BETWEEN_NODES');
  assertHasKind('BEND', 'FALLBACK_LEGACY');
  assertHasKind('ELBOW', 'FALLBACK_LEGACY');
  assertHasKind('TEE', 'FALLBACK_LEGACY');
  assertHasKind('VALVE', 'VALVE_SYMBOLIC');
  assertHasKind('FLANGE', 'FLANGE_PAIR');
  assertHasKind('REDUCER', 'REDUCER_TRANSITION');
  assertHasKind('RESTRAINT', 'RESTRAINT_SYMBOL');
  assertHasKind('UNKNOWN', 'UNKNOWN_PLACEHOLDER');
  assertNoInputXmlFittingKind('ELBOW_SWEEP');
  assertNoInputXmlFittingKind('TEE_COMPOSITE');
});

phase('06 richer non-InputXML fitting source may produce explicit fitting contracts', () => {
  const rich = buildPipingContractPipeline(explicitFittingModel());
  assert.ok(rich.geometryContracts.some((contract) => contract.componentClass === 'BEND' && contract.geometryKind === 'ELBOW_SWEEP'));
  assert.ok(rich.geometryContracts.some((contract) => contract.componentClass === 'TEE' && contract.geometryKind === 'TEE_COMPOSITE'));
  assert.equal(rich.diagnostics.fallbackRendered, 0);
});

phase('07 invalid geometry is rejected before render/export instructions', () => {
  const pipe = pipeline.geometryContracts.find((contract) => contract.geometryKind === 'CYLINDER_BETWEEN_NODES');
  const invalid = validateGeometryContract({
    ...pipe,
    placement: { ...pipe.placement, to: [...pipe.placement.from] }
  }, pipeline.components);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((issue) => issue.code === 'geometry.zeroLength'));
});

phase('08 fallback legacy rendering is explicit and counted', () => {
  const pipe = pipeline.components.find((component) => component.componentClass === 'PIPE');
  const fallback = createFallbackLegacyContract(pipe, 'legacy InputXML direct renderer retained as fallback');
  const instructions = buildRenderInstructions([fallback], pipeline.components);
  assert.equal(instructions.length, 1);
  assert.equal(instructions[0].userData.componentId, pipe.componentId);
  assert.equal(instructions[0].userData.componentClass, 'PIPE');
  assert.equal(instructions[0].userData.geometryContractId, fallback.geometryContractId);
  assert.equal(instructions[0].userData.renderRecipeId, 'fallback-legacy.v1');
  assert.equal(instructions[0].userData.fallbackRendered, true);
  assert.match(instructions[0].userData.fallbackReason, /legacy InputXML/i);
});

phase('09 diagnostics report phase counts, fallback, and delegated InputXML fittings', () => {
  const diagnostics = pipeline.diagnostics;
  assert.equal(diagnostics.sourceRecordsTotal, 10);
  assert.equal(diagnostics.componentsTotal, 10);
  assert.equal(diagnostics.componentsByClass.PIPE, 1);
  assert.equal(diagnostics.componentsByClass.BEND, 1);
  assert.equal(diagnostics.componentsByClass.ELBOW, 1);
  assert.equal(diagnostics.componentsByClass.TEE, 1);
  assert.equal(diagnostics.componentsByClass.VALVE, 1);
  assert.equal(diagnostics.componentsByClass.FLANGE, 1);
  assert.equal(diagnostics.componentsByClass.REDUCER, 1);
  assert.equal(diagnostics.componentsByClass.RESTRAINT, 2);
  assert.equal(diagnostics.componentsByClass.UNKNOWN, 1);
  assert.equal(diagnostics.unknownComponents, 2);
  assert.equal(diagnostics.geometryContractsTotal, 10);
  assert.equal(diagnostics.fallbackRendered, 3);
  assert.deepEqual(diagnostics.unrenderableComponents, []);
  assert.deepEqual([...diagnostics.delegatedTopologyComponents].sort(), [
    'PE_002_BEND_20_TO_30',
    'PE_003_ELBOW_30_TO_40',
    'PE_004_TEE_30_TO_35_TO_40'
  ].sort());
  assert.equal(diagnostics.phases.renderInstructionsTotal, 10);
});

console.log(`[piping-layer] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function assertHasKind(componentClass, geometryKind) {
  const match = pipeline.geometryContracts.find((contract) => contract.componentClass === componentClass && contract.geometryKind === geometryKind);
  assert.ok(match, `${componentClass} should produce ${geometryKind}`);
}

function assertNoInputXmlFittingKind(geometryKind) {
  const match = pipeline.geometryContracts.find((contract) => ['BEND', 'ELBOW', 'TEE'].includes(contract.componentClass) && contract.geometryKind === geometryKind);
  assert.equal(match, undefined, `InputXML fitting must not produce ${geometryKind}`);
}

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[piping-layer] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[piping-layer] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

function syntheticInputXmlModel() {
  const nodes = new Map([
    ['10', node('10', 0, 0, 0)],
    ['20', node('20', 1000, 0, 0)],
    ['30', node('30', 1000, 1000, 0)],
    ['35', node('35', 1500, 1000, 0)],
    ['40', node('40', 1000, 2000, 0)],
    ['50', node('50', 1300, 2000, 0)],
    ['60', node('60', 1600, 2000, 0)],
    ['70', node('70', 1900, 2000, 0)],
    ['80', node('80', 2300, 2000, 0)],
    ['90', node('90', 2600, 2000, 0)],
    ['100', node('100', 3000, 2000, 0)]
  ]);

  return {
    sourceKind: 'InputXML',
    nodes,
    elements: [
      element(nodes, 'PE_001_PIPE_10_TO_20', 'PIPE', '10', '20'),
      element(nodes, 'PE_002_BEND_20_TO_30', 'BEND', '20', '30', { bendRadius: 180, bendAngle: 90 }),
      element(nodes, 'PE_003_ELBOW_30_TO_40', 'ELBOW', '30', '40', { bendRadius: 180, bendAngle: 90 }),
      element(nodes, 'PE_004_TEE_30_TO_35_TO_40', 'TEE', '30', '40', { branchNode: '35', branchBore: 80 }),
      element(nodes, 'PE_005_VALVE_40_TO_50', 'VALVE', '40', '50', { rigidType: 'VALVE' }),
      element(nodes, 'PE_006_FLANGE_50_TO_60', 'FLANGE', '50', '60', { rigidType: 'FLANGE' }),
      element(nodes, 'PE_007_REDUCER_60_TO_70', 'REDUCER', '60', '70', { startBore: 150, endBore: 100 }),
      element(nodes, 'PE_009_UNKNOWN_90_TO_100', 'MYSTERY_BOX', '90', '100')
    ],
    restraints: [
      { id: 'INPUTXML_RESTRAINT_GUIDE', node: '30', typeCode: '7', rawType: '7', xCos: 0, yCos: 0, zCos: 1, gapMm: 6 },
      { id: 'INPUTXML_RESTRAINT_UNKNOWN', node: '60', typeCode: '???', rawType: '???', xCos: 0, yCos: 1, zCos: 0, gapMm: 0 }
    ]
  };
}

function explicitFittingModel() {
  const nodes = new Map([
    ['A', node('A', 0, 0, 0)],
    ['B', node('B', 500, 0, 0)],
    ['C', node('C', 1000, 0, 0)],
    ['D', node('D', 1000, 500, 0)],
    ['E', node('E', 1000, 1000, 0)]
  ]);
  return {
    sourceKind: 'PCF',
    nodes,
    elements: [
      element(nodes, 'PCF_BEND_A_B', 'BEND', 'A', 'B', { bendRadius: 200, bendAngle: 90 }),
      element(nodes, 'PCF_TEE_C_D_E', 'TEE', 'C', 'D', { ports: [{ portId: 'MAIN_A', nodeId: 'C' }, { portId: 'MAIN_B', nodeId: 'D' }, { portId: 'BRANCH', nodeId: 'E' }] })
    ],
    restraints: []
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
      source: 'pipeline test fixture',
      ...overrides
    }
  };
}

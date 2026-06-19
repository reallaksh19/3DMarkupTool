import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  RENDER_PLAN_SCHEMA,
  buildRenderPlan,
  buildRenderPlans,
  primitiveFromContract,
  rejectRawSourcePayload
} from '../src/render-plan-adapter.js';

const startedAt = performance.now();

phase('01 pipe contract and instruction produce neutral cylinder plan', () => {
  const contract = pipeContract();
  const instruction = renderInstruction(contract);
  const [plan] = buildRenderPlans([contract], [instruction]);

  assert.equal(plan.schemaVersion, RENDER_PLAN_SCHEMA);
  assert.equal(plan.target, 'VIEWER');
  assert.equal(plan.componentId, 'PIPE_10_20');
  assert.equal(plan.geometryKind, 'CYLINDER_BETWEEN_NODES');
  assert.equal(plan.primitive.primitiveKind, 'CYLINDER');
  assert.deepEqual(plan.primitive.from, [0, 0, 0]);
  assert.deepEqual(plan.primitive.to, [1000, 0, 0]);
  assert.equal(plan.primitive.outerDiameter, 120);
  assert.equal(plan.userData.componentId, 'PIPE_10_20');
  assert.equal(plan.userData.geometryContractId, contract.geometryContractId);
  assert.equal(plan.userData.fallbackRendered, false);
});

phase('02 fallback legacy contract produces reference only, not generated fitting geometry', () => {
  const contract = fallbackContract('TEE_INPUTXML_30_40');
  const instruction = renderInstruction(contract, { fallbackRendered: true, fallbackReason: 'InputXML TEE has no contract-grade branch topology' });
  const plan = buildRenderPlan(contract, instruction);

  assert.equal(plan.geometryKind, 'FALLBACK_LEGACY');
  assert.equal(plan.primitive.primitiveKind, 'LEGACY_FALLBACK_REF');
  assert.equal(plan.primitive.componentId, 'TEE_INPUTXML_30_40');
  assert.equal(plan.primitive.geometryContractId, contract.geometryContractId);
  assert.equal(plan.userData.fallbackRendered, true);
  assert.match(plan.userData.fallbackReason, /InputXML TEE/i);
  assert.ok(plan.diagnostics.some((entry) => /no contract geometry generated/i.test(entry)));
});

phase('03 rich-source tee contract may produce neutral tee composite primitive', () => {
  const contract = teeContract();
  const primitive = primitiveFromContract(contract, renderInstruction(contract, { target: 'GLB' }));

  assert.equal(primitive.primitiveKind, 'TEE_COMPOSITE_PRIMITIVE');
  assert.equal(primitive.ports.length, 3);
  assert.equal(primitive.mainDiameter, 120);
  assert.equal(primitive.branchDiameter, 80);
});

phase('04 render plan adapter rejects raw source payloads at consumer boundary', () => {
  assert.throws(
    () => rejectRawSourcePayload({ sourceRecordKind: 'ELEMENT', rawTypeCode: '7', record: { type: 'PIPE' } }),
    /raw source field/i
  );
});

phase('05 render plan adapter rejects mismatched instruction and contract IDs', () => {
  const contract = pipeContract();
  const instruction = {
    ...renderInstruction(contract),
    geometryContractId: 'GC_OTHER_COMPONENT_CYLINDER_BETWEEN_NODES',
    userData: {
      ...renderInstruction(contract).userData,
      geometryContractId: 'GC_OTHER_COMPONENT_CYLINDER_BETWEEN_NODES'
    }
  };

  assert.throws(() => buildRenderPlans([contract], [instruction]), /missing GeometryContract/i);
});

phase('06 GLB and RVM targets consume the same contract primitive shape', () => {
  const contract = pipeContract();
  const viewer = buildRenderPlan(contract, renderInstruction(contract, { target: 'VIEWER' }));
  const glb = buildRenderPlan(contract, renderInstruction(contract, { target: 'GLB' }));
  const rvm = buildRenderPlan(contract, renderInstruction(contract, { target: 'RVM_ATT' }));

  assert.equal(viewer.primitive.primitiveKind, 'CYLINDER');
  assert.deepEqual(glb.primitive, viewer.primitive);
  assert.deepEqual(rvm.primitive, viewer.primitive);
  assert.equal(glb.target, 'GLB');
  assert.equal(rvm.target, 'RVM_ATT');
});

console.log(`[render-plan-adapter] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[render-plan-adapter] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[render-plan-adapter] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

function pipeContract() {
  return baseContract({
    geometryContractId: 'GC_PIPE_10_20_CYLINDER_BETWEEN_NODES',
    componentId: 'PIPE_10_20',
    componentClass: 'PIPE',
    geometryKind: 'CYLINDER_BETWEEN_NODES',
    placement: { from: [0, 0, 0], to: [1000, 0, 0] },
    dimensions: { outerDiameter: 120 },
    ports: [{ portId: 'A', position: [0, 0, 0] }, { portId: 'B', position: [1000, 0, 0] }],
    renderRecipeId: 'pipe-cylinder-between-nodes.v1'
  });
}

function teeContract() {
  return baseContract({
    geometryContractId: 'GC_TEE_RICH_TEE_COMPOSITE',
    componentId: 'TEE_RICH',
    componentClass: 'TEE',
    geometryKind: 'TEE_COMPOSITE',
    placement: { origin: [0, 0, 0] },
    dimensions: { mainDiameter: 120, branchDiameter: 80 },
    ports: [
      { portId: 'MAIN_A', position: [0, 0, 0] },
      { portId: 'MAIN_B', position: [1000, 0, 0] },
      { portId: 'BRANCH', position: [500, 500, 0] }
    ],
    renderRecipeId: 'tee-composite.v1'
  });
}

function fallbackContract(componentId) {
  return baseContract({
    geometryContractId: `GC_FALLBACK_LEGACY_${componentId}`,
    componentId,
    componentClass: 'TEE',
    geometryKind: 'FALLBACK_LEGACY',
    placement: {},
    dimensions: {},
    ports: [],
    renderRecipeId: 'fallback-legacy.v1',
    fallbackRendered: true,
    diagnostics: ['InputXML fitting lacks contract-grade geometry']
  });
}

function baseContract(overrides) {
  return {
    schemaVersion: 'GeometryContract.v1',
    geometryContractId: overrides.geometryContractId,
    componentId: overrides.componentId,
    componentClass: overrides.componentClass,
    geometryKind: overrides.geometryKind,
    placement: overrides.placement,
    dimensions: overrides.dimensions,
    ports: overrides.ports,
    renderRecipeId: overrides.renderRecipeId,
    selection: { selectable: true, selectionProxy: 'GROUP' },
    export: { includeInGlb: true, includeInRvm: true, includeInAtt: true },
    fallbackRendered: overrides.fallbackRendered === true,
    diagnostics: overrides.diagnostics || []
  };
}

function renderInstruction(contract, options = {}) {
  const target = options.target || 'VIEWER';
  const fallbackRendered = options.fallbackRendered === true;
  return {
    schemaVersion: 'RenderInstruction.v1',
    target,
    componentId: contract.componentId,
    geometryContractId: contract.geometryContractId,
    renderRecipeId: contract.renderRecipeId,
    materialRecipeId: `${contract.componentClass.toLowerCase()}-material.v1`,
    userData: {
      objectRole: 'component-render',
      componentId: contract.componentId,
      componentClass: contract.componentClass,
      sourceRef: { sourceType: 'CONTRACT_TEST', sourceId: `${contract.componentId}_SOURCE` },
      geometryContractId: contract.geometryContractId,
      renderRecipeId: contract.renderRecipeId,
      fallbackRendered,
      ...(fallbackRendered ? { fallbackReason: options.fallbackReason || 'legacy fallback renderer' } : {})
    }
  };
}

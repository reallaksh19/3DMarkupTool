import assert from 'node:assert/strict';
import {
  buildExportPlan,
  buildExportPlans,
  assertExportPlan,
  buildStableExportMetadata
} from '../src/export-plan-adapter.js';

const baseUserData = Object.freeze({
  objectRole: 'component-render',
  componentId: 'PIPE_10_20',
  componentClass: 'PIPE',
  sourceRef: { sourceType: 'InputXML', sourceId: 'SRC_PIPE_1' },
  geometryContractId: 'GC_PIPE_10_20',
  renderRecipeId: 'RR_PIPE_CYLINDER',
  fallbackRendered: false
});

const glbPipePlan = Object.freeze({
  schemaVersion: 'RenderPlan.v1',
  planId: 'RP_GLB_GC_PIPE_10_20',
  target: 'GLB',
  componentId: 'PIPE_10_20',
  componentClass: 'PIPE',
  geometryContractId: 'GC_PIPE_10_20',
  geometryKind: 'CYLINDER_BETWEEN_NODES',
  renderRecipeId: 'RR_PIPE_CYLINDER',
  materialRecipeId: 'MAT_PIPE_DEFAULT',
  primitive: {
    primitiveKind: 'CYLINDER',
    from: [0, 0, 0],
    to: [1000, 0, 0],
    outerDiameter: 100,
    radius: 50
  },
  userData: baseUserData,
  export: { includeInGlb: true, includeInRvm: true, includeInAtt: true },
  diagnostics: []
});

const rvmPipePlan = Object.freeze({
  ...glbPipePlan,
  planId: 'RP_RVM_ATT_GC_PIPE_10_20',
  target: 'RVM_ATT',
  userData: { ...baseUserData }
});

const inputXmlFallbackElbowGlb = Object.freeze({
  schemaVersion: 'RenderPlan.v1',
  planId: 'RP_GLB_GC_ELBOW_LEGACY_1',
  target: 'GLB',
  componentId: 'BEND_30',
  componentClass: 'BEND',
  geometryContractId: 'GC_BEND_30_LEGACY',
  geometryKind: 'FALLBACK_LEGACY',
  renderRecipeId: 'RR_LEGACY_FALLBACK',
  materialRecipeId: 'MAT_FALLBACK',
  primitive: {
    primitiveKind: 'LEGACY_FALLBACK_REF',
    fallbackRendered: true,
    componentId: 'BEND_30',
    geometryContractId: 'GC_BEND_30_LEGACY',
    renderRecipeId: 'RR_LEGACY_FALLBACK'
  },
  userData: {
    objectRole: 'component-render',
    componentId: 'BEND_30',
    componentClass: 'BEND',
    sourceRef: { sourceType: 'InputXML', sourceId: 'SRC_BEND_1' },
    geometryContractId: 'GC_BEND_30_LEGACY',
    renderRecipeId: 'RR_LEGACY_FALLBACK',
    fallbackRendered: true,
    fallbackReason: 'InputXML bend/elbow topology is delegated to legacy renderer'
  },
  export: { includeInGlb: true, includeInRvm: true, includeInAtt: true },
  diagnostics: ['legacy fallback reference; no contract geometry generated']
});

const inputXmlFallbackElbowRvm = Object.freeze({
  ...inputXmlFallbackElbowGlb,
  planId: 'RP_RVM_ATT_GC_ELBOW_LEGACY_1',
  target: 'RVM_ATT',
  userData: { ...inputXmlFallbackElbowGlb.userData }
});

function testGlbPlanUsesStableMetadata() {
  const plan = buildExportPlan([glbPipePlan, rvmPipePlan], { target: 'GLB' });
  assertExportPlan(plan);
  assert.equal(plan.target, 'GLB');
  assert.equal(plan.nodes.length, 1);
  assert.equal(plan.nodes[0].componentId, 'PIPE_10_20');
  assert.equal(plan.nodes[0].extras.componentId, 'PIPE_10_20');
  assert.equal(plan.nodes[0].extras.geometryContractId, 'GC_PIPE_10_20');
  assert.equal(plan.nodes[0].extras.renderRecipeId, 'RR_PIPE_CYLINDER');
  assert.deepEqual(plan.nodes[0].extras.sourceRef, { sourceType: 'InputXML', sourceId: 'SRC_PIPE_1' });
}

function testRvmAttPlanUsesSameStableIdentity() {
  const plan = buildExportPlan([glbPipePlan, rvmPipePlan], { target: 'RVM_ATT' });
  assertExportPlan(plan);
  assert.equal(plan.target, 'RVM_ATT');
  assert.equal(plan.rvmPrimitives.length, 1);
  assert.equal(plan.attRows.length, 1);
  assert.equal(plan.rvmPrimitives[0].componentId, 'PIPE_10_20');
  assert.equal(plan.attRows[0].componentId, 'PIPE_10_20');
  assert.equal(plan.attRows[0].geometryContractId, 'GC_PIPE_10_20');
  assert.equal(plan.attRows[0].primitiveKind, 'CYLINDER');
  assert.equal(plan.attRows[0].metadata.renderRecipeId, 'RR_PIPE_CYLINDER');
}

function testFallbackStaysExplicitReference() {
  const glb = buildExportPlan([inputXmlFallbackElbowGlb], { target: 'GLB' });
  const rvm = buildExportPlan([inputXmlFallbackElbowRvm], { target: 'RVM_ATT' });
  assertExportPlan(glb);
  assertExportPlan(rvm);
  assert.equal(glb.nodes[0].primitiveKind, 'LEGACY_FALLBACK_REF');
  assert.equal(glb.nodes[0].fallbackRendered, true);
  assert.equal(rvm.rvmPrimitives[0].primitiveKind, 'LEGACY_FALLBACK_REF');
  assert.equal(rvm.attRows[0].fallbackRendered, true);
  assert.match(glb.nodes[0].extras.fallbackReason, /legacy renderer/i);
}

function testRawSourcePayloadRejected() {
  assert.throws(
    () => buildExportPlan([{ ...glbPipePlan, rawTypeCode: 'BEND' }], { target: 'GLB' }),
    /raw source field rawTypeCode/
  );
  assert.throws(
    () => buildExportPlan([{ ...glbPipePlan, userData: { ...baseUserData, sourceRef: { sourceType: 'InputXML', sourceId: 'S1', rawKind: 'PIPE' } } }], { target: 'GLB' }),
    /raw source field rawKind/
  );
}

function testBothExportTargetsShareStableMetadata() {
  const [glb, rvm] = buildExportPlans([glbPipePlan, rvmPipePlan, inputXmlFallbackElbowGlb, inputXmlFallbackElbowRvm]);
  assertExportPlan(glb);
  assertExportPlan(rvm);
  const glbPipe = glb.nodes.find((node) => node.componentId === 'PIPE_10_20');
  const rvmPipe = rvm.attRows.find((row) => row.componentId === 'PIPE_10_20');
  assert.deepEqual(glbPipe.extras, rvmPipe.metadata);
  assert.equal(glb.counts.renderPlansTotal, 2);
  assert.equal(rvm.counts.renderPlansTotal, 2);
  assert.equal(glb.counts.fallbackRendered, 1);
  assert.equal(rvm.counts.fallbackRendered, 1);
}

function testStableMetadataBuilderRequiresContractKeys() {
  const metadata = buildStableExportMetadata(glbPipePlan);
  assert.equal(metadata.componentId, 'PIPE_10_20');
  assert.equal(metadata.fallbackRendered, false);
  assert.throws(
    () => buildStableExportMetadata({ ...glbPipePlan, userData: { ...baseUserData, geometryContractId: 'WRONG' } }),
    /geometryContractId must match render plan/
  );
}

const tests = [
  testGlbPlanUsesStableMetadata,
  testRvmAttPlanUsesSameStableIdentity,
  testFallbackStaysExplicitReference,
  testRawSourcePayloadRejected,
  testBothExportTargetsShareStableMetadata,
  testStableMetadataBuilderRequiresContractKeys
];

for (const test of tests) test();
console.log(`render/export plan adapter gate passed (${tests.length} checks)`);

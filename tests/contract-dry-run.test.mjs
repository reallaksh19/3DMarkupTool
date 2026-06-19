import assert from 'node:assert/strict';

import {
  assertContractDryRunResult,
  runPipingContractDryRun
} from '../src/contract-dry-run.js';

function phase(name, fn) {
  fn();
  console.log(`✔ ${name}`);
}

const inputXmlFixture = {
  sourceKind: 'INPUTXML',
  nodePositions: {
    '10': { x: 0, y: 0, z: 0 },
    '20': { x: 1000, y: 0, z: 0 },
    '30': { x: 1000, y: 1000, z: 0 },
    '40': { x: 2000, y: 1000, z: 0 }
  },
  elements: [
    {
      id: 'PIPE_10_20',
      type: 'PIPE',
      fromNode: '10',
      toNode: '20',
      props: { id: 'PIPE_10_20', outerDiameter: 100 }
    },
    {
      id: 'BEND_20_30',
      type: 'BEND',
      fromNode: '20',
      toNode: '30',
      props: { id: 'BEND_20_30' }
    },
    {
      id: 'TEE_30_40',
      type: 'TEE',
      fromNode: '30',
      toNode: '40',
      props: { id: 'TEE_30_40' }
    },
    {
      id: 'UNMAPPED_1',
      type: 'NOT_A_REAL_COMPONENT',
      props: { id: 'UNMAPPED_1' }
    }
  ],
  restraints: [
    {
      id: 'GUIDE_20',
      typeCode: 'GUIDE',
      node: '20',
      axis: 'Y',
      gapMm: 5
    }
  ]
};

const result = runPipingContractDryRun(inputXmlFixture);

phase('dry run result satisfies contract shape', () => {
  assert.equal(result.schemaVersion, 'ContractDryRun.v1');
  assertContractDryRunResult(result);
});

phase('diagnostics report all required acceptance counts', () => {
  assert.equal(result.diagnostics.sourceRecordsTotal, 5);
  assert.equal(result.diagnostics.componentsTotal, 5);
  assert.equal(result.diagnostics.geometryContractsTotal, 5);
  assert.equal(result.diagnostics.exportPlansTotal, 2);
  assert.equal(result.diagnostics.componentsByClass.PIPE, 1);
  assert.equal(result.diagnostics.componentsByClass.BEND, 1);
  assert.equal(result.diagnostics.componentsByClass.TEE, 1);
  assert.equal(result.diagnostics.componentsByClass.RESTRAINT, 1);
  assert.equal(result.diagnostics.componentsByClass.UNKNOWN, 1);
  assert.deepEqual(result.diagnostics.unknownComponents, ['UNMAPPED_1']);
  assert.deepEqual(result.diagnostics.unrenderableComponents, []);
});

phase('InputXML bend and tee are delegated fallback, not generated topology geometry', () => {
  assert.deepEqual(new Set(result.diagnostics.inputXmlDelegatedFittings), new Set(['BEND_20_30', 'TEE_30_40']));

  const glbBend = result.renderPlansByTarget.GLB.find((plan) => plan.componentId === 'BEND_20_30');
  const glbTee = result.renderPlansByTarget.GLB.find((plan) => plan.componentId === 'TEE_30_40');

  assert.equal(glbBend.geometryKind, 'FALLBACK_LEGACY');
  assert.equal(glbBend.primitive.primitiveKind, 'LEGACY_FALLBACK_REF');
  assert.equal(glbBend.userData.fallbackRendered, true);
  assert.match(glbBend.userData.fallbackReason, /InputXML record has no contract-grade fitting geometry/);

  assert.equal(glbTee.geometryKind, 'FALLBACK_LEGACY');
  assert.equal(glbTee.primitive.primitiveKind, 'LEGACY_FALLBACK_REF');
  assert.equal(glbTee.userData.fallbackRendered, true);

  assert.equal(result.renderPlansByTarget.GLB.some((plan) => plan.primitive.primitiveKind === 'ELBOW_SWEEP_PRIMITIVE'), false);
  assert.equal(result.renderPlansByTarget.GLB.some((plan) => plan.primitive.primitiveKind === 'TEE_COMPOSITE_PRIMITIVE'), false);
});

phase('pipe/support/unknown still produce contract-visible downstream plans', () => {
  const glbPipe = result.renderPlansByTarget.GLB.find((plan) => plan.componentId === 'PIPE_10_20');
  const glbSupport = result.renderPlansByTarget.GLB.find((plan) => plan.componentId === 'GUIDE_20');
  const glbUnknown = result.renderPlansByTarget.GLB.find((plan) => plan.componentId === 'UNMAPPED_1');

  assert.equal(glbPipe.primitive.primitiveKind, 'CYLINDER');
  assert.equal(glbPipe.userData.fallbackRendered, false);
  assert.equal(glbSupport.primitive.primitiveKind, 'RESTRAINT_SYMBOL_PRIMITIVE');
  assert.equal(glbUnknown.primitive.primitiveKind, 'UNKNOWN_PLACEHOLDER_PRIMITIVE');
  assert.equal(glbUnknown.componentClass, 'UNKNOWN');
});

phase('GLB and RVM/ATT plans consume the same render-plan metadata', () => {
  const glb = result.exportPlans.find((plan) => plan.target === 'GLB');
  const rvm = result.exportPlans.find((plan) => plan.target === 'RVM_ATT');

  assert.equal(glb.counts.renderPlansTotal, result.renderPlansByTarget.GLB.length);
  assert.equal(rvm.counts.renderPlansTotal, result.renderPlansByTarget.RVM_ATT.length);
  assert.equal(glb.nodes.find((node) => node.componentId === 'BEND_20_30').primitiveKind, 'LEGACY_FALLBACK_REF');
  assert.equal(rvm.attRows.find((row) => row.componentId === 'BEND_20_30').primitiveKind, 'LEGACY_FALLBACK_REF');
  assert.deepEqual(
    glb.nodes.find((node) => node.componentId === 'PIPE_10_20').extras,
    rvm.attRows.find((row) => row.componentId === 'PIPE_10_20').metadata
  );
});

phase('dry run rejects raw InputXML/source payload in downstream plan boundary', () => {
  const corrupted = {
    ...result,
    renderPlansByTarget: {
      GLB: [
        {
          ...result.renderPlansByTarget.GLB[0],
          rawTypeCode: 'PIPE'
        }
      ]
    }
  };

  assert.throws(
    () => assertContractDryRunResult(corrupted),
    /raw source field rawTypeCode/
  );
});

import assert from 'node:assert/strict';

import {
  APP_CONVERSION_PIPELINE_SCHEMA,
  assertAppConversionPipelineResult,
  runAppConversionPipeline
} from '../src/app-conversion-pipeline.js';

function makeLegacyGlbResult() {
  return {
    scene: { userData: {}, name: 'FAKE_GLB_SCENE' },
    glb: new Uint8Array([0x67, 0x6c, 0x62]).buffer,
    audit: { componentCount: 1, nodeCount: 2, supportSymbols: [], diagnostics: [] },
    model: {
      sourceKind: 'InputXML',
      elements: [
        {
          id: 'PIPE_1',
          type: 'PIPE',
          rawType: 'PIPE',
          fromNode: '10',
          toNode: '20',
          from: { id: '10', x: 0, y: 0, z: 0 },
          to: { id: '20', x: 1000, y: 0, z: 0 },
          props: { id: 'PIPE_1', type: 'PIPE', rawType: 'PIPE', bore: 100, source: 'InputXML' }
        }
      ],
      nodes: new Map([
        ['10', { id: '10', x: 0, y: 0, z: 0 }],
        ['20', { id: '20', x: 1000, y: 0, z: 0 }]
      ]),
      restraints: [],
      diagnostics: []
    }
  };
}

function makeDeps(calls = []) {
  return {
    async convertInputXmlToGlb(sourceText, options) {
      calls.push(['glb', sourceText, options]);
      return makeLegacyGlbResult();
    },
    convertInputXmlToRvmAtt(sourceText, options) {
      calls.push(['rvm', sourceText, options]);
      return {
        rvm: new Uint8Array([0x52, 0x56, 0x4d]).buffer,
        att: 'NEW ROOT\nEND\n',
        audit: { componentCount: 1, supportCount: 0, primitiveCount: 1, annotationCount: 0 },
        exportModel: { root: { name: 'ROOT', children: [] } }
      };
    },
    createRvmPreviewScene(exportModel) {
      calls.push(['preview', exportModel]);
      return { userData: { preview: true }, name: 'FAKE_RVM_PREVIEW' };
    }
  };
}

async function testRunsGlbShadowAndRvmExport() {
  const calls = [];
  const result = await runAppConversionPipeline('<inputxml/>', { supportMode: 'compare' }, makeDeps(calls));

  assert.equal(result.schemaVersion, APP_CONVERSION_PIPELINE_SCHEMA);
  assert.equal(result.audit.appConversionPipeline.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assert.equal(result.audit.appConversionPipeline.contractShadowOk, true);
  assert.equal(result.glbResult.audit.contractPipeline.mode, 'SHADOW_ONLY');
  assert.equal(result.glbResult.scene.userData.pipingContractShadow.mode, 'SHADOW_ONLY');
  assert.equal(result.rvmScene.name, 'FAKE_RVM_PREVIEW');
  assert.deepEqual(calls.map((call) => call[0]), ['glb', 'rvm', 'preview']);
  assertAppConversionPipelineResult(result);
}

async function testMissingDependencyFails() {
  await assert.rejects(
    () => runAppConversionPipeline('<inputxml/>', {}, { ...makeDeps(), convertInputXmlToGlb: null }),
    /convertInputXmlToGlb dependency is required/
  );
  await assert.rejects(
    () => runAppConversionPipeline('<inputxml/>', {}, { ...makeDeps(), convertInputXmlToRvmAtt: null }),
    /convertInputXmlToRvmAtt dependency is required/
  );
  await assert.rejects(
    () => runAppConversionPipeline('<inputxml/>', {}, { ...makeDeps(), createRvmPreviewScene: null }),
    /createRvmPreviewScene dependency is required/
  );
}

function testRejectsRendererSwitchWithoutExplicitEnable() {
  assert.throws(
    () => assertAppConversionPipelineResult({
      schemaVersion: APP_CONVERSION_PIPELINE_SCHEMA,
      glbResult: {},
      rvmResult: {},
      audit: { appConversionPipeline: { activeRenderer: 'CONTRACT_RENDERER' } }
    }),
    /legacy renderer active/
  );
}

await testRunsGlbShadowAndRvmExport();
await testMissingDependencyFails();
testRejectsRendererSwitchWithoutExplicitEnable();

console.log('app-conversion-pipeline tests passed');

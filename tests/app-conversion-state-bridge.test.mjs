import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_CONVERSION_STATE_BRIDGE_SCHEMA,
  assertAppConversionState,
  runAppConversionIntoState
} from '../src/app-conversion-state-bridge.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const makeDeps = () => ({
  convertInputXmlToGlb: async () => ({
    glb: new Uint8Array([1, 2, 3]).buffer,
    scene: { userData: {} },
    audit: {
      componentCount: 1,
      nodeCount: 2,
      supportSymbols: [],
      isonoteRecords: 0
    },
    model: {
      sourceType: 'INPUTXML',
      elements: [
        { id: 'P1', type: 'PIPE', fromNode: '10', toNode: '20' }
      ],
      nodes: {
        10: { x: 0, y: 0, z: 0 },
        20: { x: 1000, y: 0, z: 0 }
      },
      restraints: []
    }
  }),
  convertInputXmlToRvmAtt: () => ({
    rvm: new Uint8Array([4, 5]).buffer,
    att: 'NEW ROOT\nEND\n',
    audit: {
      componentCount: 1,
      supportCount: 0,
      primitiveCount: 1,
      annotationCount: 0,
      attBytes: 13
    },
    exportModel: { root: { name: 'ROOT', children: [] } }
  }),
  createRvmPreviewScene: () => ({ userData: { preview: 'rvm' } })
});

{
  const state = {};
  let scenesCreated = false;
  const result = await runAppConversionIntoState({
    sourceText: '<InputXML />',
    options: { supportMode: 'actual' },
    state,
    deps: makeDeps(),
    hooks: {
      onScenesCreated: ({ bridgeReport }) => {
        scenesCreated = bridgeReport.schemaVersion === APP_CONVERSION_STATE_BRIDGE_SCHEMA;
      }
    }
  });

  assert.equal(result.bridgeReport.schemaVersion, APP_CONVERSION_STATE_BRIDGE_SCHEMA);
  assert.equal(result.bridgeReport.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assert.equal(result.bridgeReport.contractShadowOk, true);
  assert.equal(result.bridgeReport.glbBytes, 3);
  assert.equal(result.bridgeReport.rvmBytes, 2);
  assert.equal(result.bridgeReport.attBytes, 13);
  assert.equal(scenesCreated, true);
  assert.equal(state.glb, result.glb);
  assert.equal(state.rvm, result.rvm);
  assert.equal(state.att, result.att);
  assert.equal(state.glbScene, result.glbScene);
  assert.equal(state.rvmScene, result.rvmScene);
  assertAppConversionState(state);
}

await assert.rejects(
  () => runAppConversionIntoState({ sourceText: '', state: {}, deps: makeDeps() }),
  /No InputXML loaded/
);

await assert.rejects(
  () => runAppConversionIntoState({ sourceText: '<InputXML />', deps: makeDeps() }),
  /App state object is required/
);

{
  const source = await readFile(path.join(repoRoot, 'src', 'app-conversion-state-bridge.js'), 'utf8');
  assert.match(source, /runAppConversionPipeline/);
  assert.match(source, /appConversionStateBridge/);
  assert.match(source, /LEGACY_FALLBACK_ONLY/);
  assert.doesNotMatch(source, /CONTRACT_RENDERER/);
}

console.log('app-conversion-state-bridge tests passed');

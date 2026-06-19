import assert from 'node:assert/strict';
import {
  LEGACY_FALLBACK_RENDERER,
  assertAppRunConversionControllerReport,
  runAppConversionController
} from '../src/app-run-conversion-controller.js';

function makeState() {
  return {
    xmlText: '<INPUTXML />',
    glb: null,
    rvm: null,
    att: null,
    audit: null,
    glbScene: null,
    rvmScene: null
  };
}

function makeUi(calls) {
  return {
    status(value) { calls.push(['status', value]); },
    setConvertDisabled(value) { calls.push(['disabled', value]); },
    log(value) { calls.push(['log', value]); },
    setInputDrawer(value) { calls.push(['inputDrawer', value]); },
    setPropsDrawer(value) { calls.push(['propsDrawer', value]); },
    setDownloadButtons(value) { calls.push(['downloadButtons', value]); },
    onError(error) { calls.push(['error', error.message]); }
  };
}

function makeActions(calls) {
  return {
    clearMeasurement() { calls.push(['clearMeasurement']); },
    clearSelection() { calls.push(['clearSelection']); },
    publishViewerRuntime(reason) { calls.push(['runtime', reason]); },
    setModelScene(scene, mode) { calls.push(['setModelScene', scene?.name, mode]); }
  };
}

async function successfulRunner({ state }) {
  state.glb = new Uint8Array([1, 2, 3]).buffer;
  state.rvm = new Uint8Array([4, 5]).buffer;
  state.att = 'ATT';
  state.glbScene = { name: 'glb-scene' };
  state.rvmScene = { name: 'rvm-scene' };
  state.audit = {
    glb: {
      componentCount: 7,
      nodeCount: 9,
      supportSymbols: [{}, {}],
      isonoteRecords: 1
    },
    rvmAtt: {
      componentCount: 7,
      supportCount: 2,
      primitiveCount: 11,
      annotationCount: 1
    },
    appConversionPipeline: {
      activeRenderer: LEGACY_FALLBACK_RENDERER,
      contractShadowOk: true
    },
    appConversionStateBridge: {
      activeRenderer: LEGACY_FALLBACK_RENDERER,
      contractShadowOk: true,
      glbBytes: 3,
      rvmBytes: 2,
      attBytes: 3
    }
  };
  return { state, bridgeReport: state.audit.appConversionStateBridge };
}

async function failingRunner() {
  throw new Error('synthetic conversion failure');
}

async function testSuccessfulUiFlow() {
  const calls = [];
  const state = makeState();
  const result = await runAppConversionController({
    sourceText: state.xmlText,
    options: { supportMode: 'comparison', singleAxisDecision: 'auto' },
    state,
    ui: makeUi(calls),
    actions: makeActions(calls),
    runner: successfulRunner
  });

  assert.equal(result.ok, true);
  assert.equal(state.audit.appRunConversionController.activeRenderer, LEGACY_FALLBACK_RENDERER);
  assertAppRunConversionControllerReport(state.audit.appRunConversionController);

  assert.deepEqual(calls.slice(0, 6), [
    ['status', 'Converting'],
    ['disabled', true],
    ['clearMeasurement'],
    ['clearSelection'],
    ['log', 'Run Conversion mode=comparison, singleAxis=auto'],
    ['runtime', 'conversion:scenes-created']
  ]);
  assert(calls.some((call) => call[0] === 'setModelScene' && call[1] === 'glb-scene' && call[2] === 'glb'));
  assert(calls.some((call) => call[0] === 'inputDrawer' && call[1] === false));
  assert(calls.some((call) => call[0] === 'propsDrawer' && call[1] === true));
  assert(calls.some((call) => call[0] === 'downloadButtons' && call[1] === true));
  assert(calls.some((call) => call[0] === 'status' && call[1] === 'Converted'));
  assert.deepEqual(calls.at(-1), ['disabled', false]);
  assert(calls.some((call) => call[0] === 'log' && call[1].startsWith('Contract shadow: ok=true')));
}

async function testFailureKeepsLegacyFallbackAndReenablesButton() {
  const calls = [];
  const state = makeState();
  const result = await runAppConversionController({
    sourceText: state.xmlText,
    state,
    ui: makeUi(calls),
    actions: makeActions(calls),
    runner: failingRunner
  });

  assert.equal(result.ok, false);
  assert.equal(result.controllerReport.activeRenderer, LEGACY_FALLBACK_RENDERER);
  assert.equal(state.audit.appRunConversionController.activeRenderer, LEGACY_FALLBACK_RENDERER);
  assert(calls.some((call) => call[0] === 'error' && call[1] === 'synthetic conversion failure'));
  assert(calls.some((call) => call[0] === 'status' && call[1] === 'Conversion failed'));
  assert.deepEqual(calls.at(-1), ['disabled', false]);
  assert(!calls.some((call) => call[0] === 'setModelScene'));
}

async function testInvalidInputFailsBeforeRunner() {
  let runnerCalled = false;
  const calls = [];
  const state = makeState();
  const result = await runAppConversionController({
    sourceText: '   ',
    state,
    ui: makeUi(calls),
    runner: async () => {
      runnerCalled = true;
    }
  });

  assert.equal(result.ok, false);
  assert.equal(runnerCalled, false);
  assert.equal(result.controllerReport.activeRenderer, LEGACY_FALLBACK_RENDERER);
  assert.deepEqual(calls.at(-1), ['disabled', false]);
}

async function run() {
  await testSuccessfulUiFlow();
  await testFailureKeepsLegacyFallbackAndReenablesButton();
  await testInvalidInputFailsBeforeRunner();
  console.log('app-run-conversion-controller tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

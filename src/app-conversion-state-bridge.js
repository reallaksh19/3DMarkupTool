import { runAppConversionPipeline } from './app-conversion-pipeline.js';

export const APP_CONVERSION_STATE_BRIDGE_SCHEMA = 'AppConversionStateBridge.v1';

export async function runAppConversionIntoState({
  sourceText,
  options = {},
  state,
  deps,
  hooks = {}
} = {}) {
  if (!sourceText || !String(sourceText).trim()) {
    throw new Error('No InputXML loaded. Choose a file or load the BM_CII sample.');
  }
  if (!state || typeof state !== 'object') {
    throw new Error('App state object is required');
  }

  const result = await runAppConversionPipeline(sourceText, options, deps);

  state.glb = result.glb;
  state.rvm = result.rvm;
  state.att = result.att;
  state.audit = result.audit;
  state.glbScene = result.glbScene;
  state.rvmScene = result.rvmScene;

  const bridgeReport = {
    schemaVersion: APP_CONVERSION_STATE_BRIDGE_SCHEMA,
    activeRenderer: result.audit?.appConversionPipeline?.activeRenderer || 'LEGACY_FALLBACK_ONLY',
    contractShadowOk: Boolean(result.audit?.appConversionPipeline?.contractShadowOk),
    glbBytes: byteLength(result.glb),
    rvmBytes: byteLength(result.rvm),
    attBytes: byteLength(result.att)
  };

  state.audit = {
    ...state.audit,
    appConversionStateBridge: bridgeReport
  };

  hooks.onScenesCreated?.({ result, state, bridgeReport });
  hooks.onConverted?.({ result, state, bridgeReport });

  return {
    ...result,
    bridgeReport,
    state
  };
}

export function assertAppConversionState(state) {
  if (!state || typeof state !== 'object') throw new Error('App state object is required');
  if (!state.glb || !state.rvm || !state.att) throw new Error('App state must include GLB, RVM, and ATT buffers after conversion');
  if (!state.glbScene || !state.rvmScene) throw new Error('App state must include GLB and RVM preview scenes after conversion');
  if (!state.audit?.appConversionPipeline) throw new Error('App state audit must include appConversionPipeline report');
  if (!state.audit?.appConversionStateBridge) throw new Error('App state audit must include appConversionStateBridge report');
  if (state.audit.appConversionStateBridge.activeRenderer !== 'LEGACY_FALLBACK_ONLY') {
    throw new Error('App conversion state bridge must keep legacy renderer active until contract rendering is enabled explicitly');
  }
  return true;
}

function byteLength(value) {
  if (!value) return 0;
  if (Number.isFinite(value.byteLength)) return value.byteLength;
  if (typeof value === 'string') return value.length;
  return 0;
}

import { runAppConversionIntoState } from './app-conversion-state-bridge.js?v=bust-cache-4';

export const APP_RUN_CONVERSION_CONTROLLER_SCHEMA = 'AppRunConversionController.v1';
export const LEGACY_FALLBACK_RENDERER = 'LEGACY_FALLBACK_ONLY';

export async function runAppConversionController({
  sourceText,
  options = {},
  state,
  ui = {},
  actions = {},
  runner = runAppConversionIntoState,
  throwOnError = false
} = {}) {
  const startedAt = Date.now();

  try {
    if (!state || typeof state !== 'object') {
      throw new Error('App state object is required');
    }
    if (!sourceText || !String(sourceText).trim()) {
      throw new Error('No InputXML loaded. Choose a file or load the BM_CII sample.');
    }

    ui.status?.('Converting');
    ui.setConvertDisabled?.(true);
    actions.clearMeasurement?.();
    actions.clearSelection?.();
    ui.log?.(`Run Conversion mode=${options.supportMode || 'unknown'}, singleAxis=${options.singleAxisDecision || 'unknown'}`);

    const result = await runner({ sourceText, options, state });
    const audit = state.audit || result.state?.audit || result.audit || {};
    const bridgeReport = audit.appConversionStateBridge || result.bridgeReport || {};
    const activeRenderer = bridgeReport.activeRenderer || audit.appConversionPipeline?.activeRenderer || LEGACY_FALLBACK_RENDERER;

    actions.publishViewerRuntime?.('conversion:scenes-created');
    actions.setModelScene?.(state.glbScene, 'glb');
    ui.setInputDrawer?.(false);
    ui.setPropsDrawer?.(true);
    ui.setDownloadButtons?.(true);

    logConversionSummary(ui.log, audit, state, bridgeReport);
    ui.status?.('Converted');

    const controllerReport = {
      schemaVersion: APP_RUN_CONVERSION_CONTROLLER_SCHEMA,
      ok: true,
      activeRenderer,
      contractShadowOk: Boolean(bridgeReport.contractShadowOk || audit.appConversionPipeline?.contractShadowOk),
      elapsedMs: Date.now() - startedAt
    };

    state.audit = {
      ...audit,
      appRunConversionController: controllerReport
    };

    return {
      ok: true,
      result,
      state,
      controllerReport
    };
  } catch (err) {
    const message = err?.message || String(err);
    ui.onError?.(err);
    ui.log?.(`ERROR: ${message}`);
    ui.status?.('Conversion failed');

    const failure = {
      ok: false,
      error: message,
      controllerReport: {
        schemaVersion: APP_RUN_CONVERSION_CONTROLLER_SCHEMA,
        ok: false,
        activeRenderer: LEGACY_FALLBACK_RENDERER,
        error: message,
        elapsedMs: Date.now() - startedAt
      }
    };

    if (state && typeof state === 'object') {
      state.audit = {
        ...(state.audit || {}),
        appRunConversionController: failure.controllerReport
      };
    }

    if (throwOnError) throw err;
    return failure;
  } finally {
    ui.setConvertDisabled?.(false);
  }
}

export function assertAppRunConversionControllerReport(report) {
  if (!report || typeof report !== 'object') throw new Error('App run conversion controller report is required');
  if (report.schemaVersion !== APP_RUN_CONVERSION_CONTROLLER_SCHEMA) throw new Error('Invalid app run conversion controller schema');
  if (report.activeRenderer !== LEGACY_FALLBACK_RENDERER) throw new Error('App run conversion controller must keep legacy fallback renderer active');
  if (!Number.isFinite(report.elapsedMs) || report.elapsedMs < 0) throw new Error('Controller report must include finite elapsedMs');
  return true;
}

function logConversionSummary(log, audit, state, bridgeReport) {
  if (typeof log !== 'function') return;

  const glb = audit?.glb || {};
  const rvmAtt = audit?.rvmAtt || {};

  log(`Converted GLB: components=${safeNumber(glb.componentCount)}, nodes=${safeNumber(glb.nodeCount)}, supportSymbols=${safeLength(glb.supportSymbols)}, isonoteRecords=${safeNumber(glb.isonoteRecords)}`);
  log(`Converted RVM+ATT: components=${safeNumber(rvmAtt.componentCount)}, supports=${safeNumber(rvmAtt.supportCount)}, primitives=${safeNumber(rvmAtt.primitiveCount)}, annotations=${safeNumber(rvmAtt.annotationCount)}`);
  log(`GLB size=${formatBytes(bridgeReport.glbBytes ?? state?.glb?.byteLength)}, RVM size=${formatBytes(bridgeReport.rvmBytes ?? state?.rvm?.byteLength)}, ATT size=${formatBytes(bridgeReport.attBytes ?? state?.att?.byteLength)}`);

  const contract = audit?.appConversionPipeline || audit?.contractPipeline || {};
  if (contract.contractShadowOk !== undefined || contract.activeRenderer) {
    log(`Contract shadow: ok=${Boolean(contract.contractShadowOk)}, renderer=${contract.activeRenderer || LEGACY_FALLBACK_RENDERER}`);
  }
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function safeLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function formatBytes(value) {
  const bytes = Number.isFinite(value) ? value : 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

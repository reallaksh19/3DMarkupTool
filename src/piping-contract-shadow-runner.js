import { buildPipingContractPipeline } from './piping-component-layer.js';

export const PIPING_CONTRACT_SHADOW_SCHEMA = 'PipingContractShadow.v1';

export function runPipingContractShadow(model, options = {}) {
  const startedAt = performanceNow();
  const sourceKind = String(model?.sourceKind || options.sourceKind || 'UNKNOWN_SOURCE');
  try {
    const pipeline = buildPipingContractPipeline(model, {
      ...options,
      target: options.target || 'VIEWER'
    });
    const elapsedMs = elapsed(startedAt);
    return freezeReport({
      schemaVersion: PIPING_CONTRACT_SHADOW_SCHEMA,
      mode: 'SHADOW_ONLY',
      ok: true,
      sourceKind,
      elapsedMs,
      replacementPath: 'Source Adapter -> PipingComponent -> PipingGraph -> GeometryContract -> RenderInstruction',
      activeRenderer: 'LEGACY_FALLBACK_ONLY',
      diagnostics: sanitizeDiagnostics(pipeline.diagnostics),
      counts: {
        sourceRecordsTotal: pipeline.sourceRecords.length,
        componentsTotal: pipeline.components.length,
        graphNodesTotal: pipeline.graph.nodes.length,
        graphEdgesTotal: pipeline.graph.edges.length,
        geometryContractsTotal: pipeline.geometryContracts.length,
        renderInstructionsTotal: pipeline.renderInstructions.length,
        fallbackRendered: pipeline.diagnostics?.fallbackRendered || 0,
        unknownComponents: pipeline.diagnostics?.unknownComponents || 0,
        unrenderableComponents: Array.isArray(pipeline.diagnostics?.unrenderableComponents) ? pipeline.diagnostics.unrenderableComponents.length : 0
      },
      errors: []
    });
  } catch (error) {
    return freezeReport({
      schemaVersion: PIPING_CONTRACT_SHADOW_SCHEMA,
      mode: 'SHADOW_ONLY',
      ok: false,
      sourceKind,
      elapsedMs: elapsed(startedAt),
      replacementPath: 'Source Adapter -> PipingComponent -> PipingGraph -> GeometryContract -> RenderInstruction',
      activeRenderer: 'LEGACY_FALLBACK_ONLY',
      diagnostics: {},
      counts: {
        sourceRecordsTotal: 0,
        componentsTotal: 0,
        graphNodesTotal: 0,
        graphEdgesTotal: 0,
        geometryContractsTotal: 0,
        renderInstructionsTotal: 0,
        fallbackRendered: 0,
        unknownComponents: 0,
        unrenderableComponents: 0
      },
      errors: [{
        code: 'pipingContractShadow.failed',
        message: error?.message || String(error),
        name: error?.name || 'Error'
      }]
    });
  }
}

export function attachPipingContractShadow(target, report) {
  if (!target || typeof target !== 'object') return report;
  const userData = target.userData && typeof target.userData === 'object' ? target.userData : {};
  target.userData = {
    ...userData,
    pipingContractShadow: compactReport(report)
  };
  return report;
}

export function compactReport(report = {}) {
  return freezeReport({
    schemaVersion: report.schemaVersion || PIPING_CONTRACT_SHADOW_SCHEMA,
    mode: report.mode || 'SHADOW_ONLY',
    ok: Boolean(report.ok),
    sourceKind: report.sourceKind || 'UNKNOWN_SOURCE',
    activeRenderer: report.activeRenderer || 'LEGACY_FALLBACK_ONLY',
    replacementPath: report.replacementPath || 'Source Adapter -> PipingComponent -> PipingGraph -> GeometryContract -> RenderInstruction',
    counts: { ...(report.counts || {}) },
    errors: Array.isArray(report.errors) ? report.errors.map((error) => ({
      code: String(error.code || 'shadow.error'),
      message: String(error.message || ''),
      name: String(error.name || 'Error')
    })) : []
  });
}

function sanitizeDiagnostics(diagnostics = {}) {
  const allowed = [
    'sourceRecordsTotal',
    'componentsTotal',
    'componentsByClass',
    'unknownComponents',
    'geometryContractsTotal',
    'fallbackRendered',
    'unrenderableComponents',
    'graphNodesTotal',
    'graphEdgesTotal',
    'phases'
  ];
  const out = {};
  for (const key of allowed) {
    const value = diagnostics[key];
    if (value == null) continue;
    if (Array.isArray(value)) out[key] = value.map(String);
    else if (typeof value === 'object') out[key] = JSON.parse(JSON.stringify(value));
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}

function freezeReport(report) {
  return Object.freeze(report);
}

function performanceNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

function elapsed(startedAt) {
  return Math.round((performanceNow() - startedAt) * 100) / 100;
}
